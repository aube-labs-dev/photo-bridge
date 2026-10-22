# Photo Bridge — Cloudflare 올인 마이그레이션 Plan

**Goal:** Photo Bridge를 Cloudflare 풀스택으로 이전해 사실상 $0로 운영한다. 프론트=Cloudflare Pages, 시그널링=Workers+Durable Objects, TURN=Cloudflare Realtime TURN, 도메인=playwiki.org(Spaceship 등록 → Cloudflare 네임서버).

**Architecture:** 정적 Next export를 Cloudflare Pages가 서빙. WebSocket 시그널링은 Worker가 받아 방ID 기준 Durable Object로 라우팅(각 방=1 DO 인스턴스, 메모리 방관리). 사진은 기존처럼 WebRTC DataChannel P2P 직송(서버 미경유). 안 뚫릴 때만 Cloudflare TURN.

**Tech Stack:** Cloudflare Workers, Durable Objects, Wrangler, Next.js 14 static export, 네이티브 WebSocket(Socket.IO 제거), TypeScript.

---

## 핵심 변경: Socket.IO → 네이티브 WebSocket

Cloudflare Workers/DO는 Socket.IO 서버를 못 돌린다(Node 런타임 아님). 시그널링을 **표준 WebSocket**으로 교체:
- 프론트 `socket.io-client` → 브라우저 네이티브 `WebSocket`
- 메시지는 JSON `{type, ...}` 프레이밍
- 기존 이벤트명 유지: create_or_join_room, start_negotiation, peer_joined, offer, answer, ice_candidate, peer_left, room_full
- 방 관리 로직(Perfect Negotiation 역할 지정, 2인 제한)은 DO 안에서 그대로

## Files

- `signaling/` (신규 Worker 프로젝트)
  - `wrangler.toml` — DO 바인딩, 라우트
  - `src/index.ts` — Worker 엔트리: /ws 업그레이드 → DO fetch
  - `src/room.ts` — RoomDurableObject: WebSocket 쌍 관리 + 시그널링 중계
- `frontend/lib/signaling.ts` (신규) — 네이티브 WS 클라이언트(소켓 추상화, 재연결)
- `frontend/lib/webrtc.ts` — socket 타입을 추상 Signaling 인터페이스로 교체
- `frontend/pages/index.tsx` — io() 제거, Signaling 사용
- `frontend/lib/ice.ts` 또는 webrtc.ts — Cloudflare TURN credential fetch 추가
- `frontend/package.json` — socket.io-client 제거
- `docs/CLOUDFLARE_DEPLOY.md` (신규) — 배포/네임서버 가이드

## 작업 순서

### Task 1: Worker 시그널링 프로젝트 생성
- `signaling/` 에 wrangler 프로젝트, DO(RoomDurableObject) 바인딩
- wrangler를 레포 devDependency로 설치(npx 지연 회피)

### Task 2: RoomDurableObject 구현
- `fetch()` 에서 WebSocketPair 생성, accept
- 메시지 핸들러: join→역할지정(Perfect Negotiation), offer/answer/ice 1:1 중계, 2인 제한(room_full), close→peer_left
- 기존 gateway.ts 로직 포팅(socket.id → 각 WS에 부여한 clientId)

### Task 3: Worker 엔트리(index.ts)
- `/ws?room=xxx` 업그레이드 요청 → idFromName(room)으로 DO 라우팅
- CORS/health 엔드포인트

### Task 4: 프론트 네이티브 WS 클라이언트
- `signaling.ts`: connect(url), on(event, cb), emit(event, data), 자동재연결
- webrtc.ts의 `Socket` 의존 → `Signaling` 인터페이스로 치환(emit/on 시그니처 동일하게)

### Task 5: 프론트 통합 + TURN
- index.tsx: io() 제거, Signaling 연결(wss://signaling.playwiki.org/ws?room=)
- Cloudflare TURN: 런타임에 `/turn-credentials` (Worker) 호출해 ice servers 주입(또는 env)

### Task 6: 로컬 검증 (wrangler dev + Playwright)
- `wrangler dev` 로 Worker+DO 로컬 기동
- 하니스를 WS 프록시로 조정 or 프론트가 직접 wrangler dev WS에 연결
- 기존 Playwright E2E(바이트 동일성/실제 PNG/room_full) 재통과

### Task 7: 배포
- (유저) Cloudflare 가입 + Spaceship 네임서버 변경 + wrangler login
- `wrangler deploy` (Worker) → signaling.playwiki.org 라우트
- Cloudflare Pages: frontend/out 배포 → photo.playwiki.org
- Cloudflare TURN 키 발급 → Worker 시크릿

### Task 8: 커밋/문서
- 서브모듈(frontend) 커밋 + 신규 signaling은 메인 레포에 포함할지/별도 서브모듈
- CLOUDFLARE_DEPLOY.md

## 검증
- 로컬: wrangler dev + Playwright 2탭 P2P, 실기기(LG) 교차
- 운영: 배포 후 실제 도메인에서 2기기 전송

## Risks
- Socket.IO 제거로 프론트/백 시그널링 전면 교체 → 회귀 위험. E2E로 커버.
- DO 무료 한도(요청 10만/일, DO는 유료플랜 필요할 수 있음 — 확인 필요: Workers Free에 DO 포함 여부 2026 기준 재확인)
- wrangler login/배포는 유저 계정 필요(에이전트 불가)
- 네임서버 변경 시 기존 hifive.playwiki.org DNS 재생성 필요
