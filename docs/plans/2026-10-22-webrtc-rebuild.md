# Photo Bridge WebRTC 재개발 Implementation Plan

**Goal:** OS 구분 없이(iOS Safari/Android Chrome/데스크톱) 모든 모바일 브라우저에서 사진을 서버 경유 없이 P2P로 안정적으로 주고받는 웹서비스로 수리/재개발한다.

**Architecture:** Next.js 정적 프론트(WebRTC 클라이언트) + Nest.js Socket.IO 시그널링(메모리 방관리, 2인 1실) + nginx 리버스프록시 + Docker 단일 컨테이너. 사진은 RTCDataChannel 직송(서버 미경유, NODE 철학). 프론트의 WebRTC 객체는 전부 useRef로 관리하고 Perfect Negotiation + 역압(backpressure)으로 안정화.

**Tech Stack:** Next.js 14(output: export), React 18 useRef, socket.io 4, Nest.js 10, TypeScript, Docker, nginx. 검증은 Playwright(크로미움 2탭 P2P 시뮬).

---

## 근본 원인 (현행 코드 실패 이유)

1. **stale closure (치명):** `peerConnections`/`dataChannels`/`fileReceivers`를 `useState`로 관리 → `connectSocket`의 소켓 콜백이 생성시점의 빈/오래된 Map을 캡처 → `answer`/`ice_candidate`/수신버퍼 조회가 어긋나 연결·전송 실패.
2. **역압 없음:** 16KB 청크를 `bufferedAmount` 체크 없이 연속 send → 수MB 사진에서 SCTP 버퍼 초과 → 전송 실패.
3. **glare:** 역할 구분(polite/impolite) 없이 양측이 offer/DataChannel 동시 생성 가능 → 협상 충돌.
4. **iOS 호환:** Safari는 `pc.ondatachannel`/바이너리 타입(`binaryType`) 민감 — ArrayBuffer 고정 필요.

## 재설계 핵심 결정

- **WebRTC 상태 = useRef Map.** 렌더 트리거가 필요한 UI 상태(연결여부/진행률/로그)만 useState.
- **Perfect Negotiation 패턴** (MDN 표준): 방의 두 번째 입장자를 impolite, 먼저 있던 자를 polite로 서버가 지정 → glare 해소.
- **역압:** `bufferedAmountLowThreshold` + `onbufferedamountlow` 로 청크 흐름 제어. `binaryType='arraybuffer'`.
- **방 2인 제한:** 백엔드에서 3번째 입장 거부(`room_full`).
- **진행률 UI:** 송/수신 퍼센트 바 + 완료/실패 토스트. 로그는 접이식(디버그).
- **파일 다운로드:** 수신 완료 시 Blob → object URL 다운로드(모바일 브라우저 공통 동작).
- **TURN:** 환경변수(`NEXT_PUBLIC_TURN_URL/USER/CRED`)로 선택 주입. 없으면 STUN만(현행 유지, 추후 coturn).
- **버전 고정:** next/eslint-config-next 와일드카드 → 정확 버전.

## Files likely to change

- `frontend/pages/index.tsx` — 전면 재작성 (useRef 기반 WebRTC 클라이언트 + UI)
- `frontend/lib/webrtc.ts` — (신규) WebRTC/파일전송 코어 로직 분리
- `frontend/package.json` — next 버전 고정
- `frontend/next.config.js` — 유지(점검)
- `backend/src/photo-transfer.gateway.ts` — 2인 제한 + Perfect Negotiation 역할 지정 + 검증
- `nginx.conf` — socket.io 프록시 점검(유지)
- `Dockerfile` — 유지(점검), 헬스체크 선택
- `frontend/e2e/` + 루트 `test-harness/` — (신규) Playwright 2탭 P2P 검증

---

## 작업 순서 (bite-sized)

### Task 1: 로컬 개발/검증 환경 준비
- backend `npm install`, frontend `npm install` (nvm node 22.18.0)
- Playwright + 크로미움 설치 (`npm i -D @playwright/test`, `npx playwright install chromium`)
- 검증: `npm run build` 양쪽 성공 확인

### Task 2: 백엔드 시그널링 재작성
**File:** `backend/src/photo-transfer.gateway.ts`
- 방 2인 제한, 3번째 `room_full` emit
- 입장 시 역할 지정: 기존자=polite, 신규자=impolite → 신규자에게만 `start_offer`(상대 socketId 동봉)
- 상대 떠나면 `peer_left` emit
- offer/answer/ice는 1:1 타겟 중계(현행 유지)
- 검증: 백엔드 단독 기동 + wscat/스크립트로 2소켓 join → 역할/이벤트 순서 로그 확인

### Task 3: 프론트 WebRTC 코어 (useRef)
**File:** `frontend/lib/webrtc.ts` (신규)
- `createPeer(remoteId, socket, {polite})` → RTCPeerConnection + Perfect Negotiation 핸들러
- DataChannel 송신: 역압(bufferedAmount) 적용한 `sendFile(file, onProgress)`
- 수신: `file_info`→버퍼(ref)→청크 누적→`file_end`→Blob 다운로드, `onProgress`
- `binaryType='arraybuffer'`
- 모든 상태는 호출측 ref Map에 저장

### Task 4: 프론트 UI 재작성
**File:** `frontend/pages/index.tsx`
- useRef: `pcRef`, `dcRef`, `recvRef`, `socketRef`
- useState: `status`, `roomId`, `sendProgress`, `recvProgress`, `log[]`
- 방 입장/나가기, 파일 선택→전송, 진행률 바, 수신 자동 다운로드
- 모바일 레이아웃(반응형, viewport)
- 검증: dev 서버 + Playwright

### Task 5: Playwright E2E P2P 검증 (핵심)
**File:** `test-harness/p2p.spec.ts` (신규)
- backend(3000) + frontend(next dev/정적 serve) 기동
- 크로미움 2개 컨텍스트 → 같은 방 입장 → connection `connected` 도달 확인
- A가 테스트 이미지 전송 → B가 수신 → 다운로드 파일 바이트/해시 == 원본 확인
- `--use-fake-ui-for-media-stream` 등 불필요(파일전송만), fake STUN 로컬 host candidate로 연결
- 검증: `npx playwright test` green

### Task 6: Docker 통합 빌드 검증
- `docker build -t photo-bridge .` 성공
- `docker run -p 8080:80` → 호스트 브라우저/Playwright로 같은 방 2탭 P2P 재검증
- 검증: 컨테이너에서 실제 전송 성공

### Task 7: 버전/문서/정리 + 커밋
- next 버전 고정, README 갱신(실행법/검증법)
- 서브모듈 각각 커밋(backend/frontend) → 메인 레포 포인터 갱신 커밋
- **커밋 author = jonghwa1225** (user.name 설정, 이메일 확인 필요)

---

## Tests / validation
- 단위: 파일 청크 재조립 바이트 동일성(해시 비교)
- E2E: Playwright 2탭 실제 P2P 전송 성공(로컬 + Docker)
- 수동(유저): iOS Safari ↔ Android Chrome 실기기 교차 (TURN 필요시 별도)

## Risks / open questions
- **로컬 Playwright P2P**: 동일 호스트라 host candidate로 STUN 없이도 연결됨 → 로컬 검증은 신뢰성 높음. 단 **실제 교차 네트워크(LTE↔LTE)** 는 TURN 없이 실패 가능 → 로컬 green ≠ 실망 보장. 실기기 교차는 유저 확인 또는 TURN 도입 후.
- 서브모듈 3레포 커밋 순서(backend/frontend 먼저 push → 메인 포인터).
- 커밋 author 이메일(jonghwa1225): noreply 형식 확인 필요.
