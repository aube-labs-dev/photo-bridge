# 📷 Photo Bridge

OS 구분 없이 **모든 모바일 브라우저에서 사진을 직접(P2P) 주고받는** 웹서비스.
서버는 연결 중개(시그널링)만 하고, 사진은 **브라우저끼리 직접 전송(WebRTC DataChannel)** — 서버에 사진이 저장되지 않는다.

## 🌐 운영 주소
- **서비스:** https://photo.playwiki.org
- 시그널링(Worker): https://photo-bridge-signaling.aube-labs.workers.dev
- (Pages 기본 주소: https://photo-bridge-4a6.pages.dev)

## 사용법
1. 두 기기(폰/PC 아무거나)에서 https://photo.playwiki.org 접속
2. 같은 **방 번호** 입력하고 입장 (또는 `?room=1234` 링크 공유)
3. 연결되면 "사진 보내기"로 전송 — 상대 브라우저가 바로 다운로드

## 아키텍처 (Cloudflare 올인, 사실상 $0)
```
[브라우저 A] ──사진 P2P(WebRTC DataChannel)── [브라우저 B]
     │                                              │
     └──── 시그널링(WebSocket) ──┐   ┌── 시그널링 ──┘
                                 ▼   ▼
              Cloudflare Worker + Durable Objects
              (방 관리 / offer·answer·ICE 중계만)

정적 프론트: Cloudflare Pages
TURN(교차망 대응): Cloudflare Realtime TURN
```
- **프론트:** Next.js(static export) → Cloudflare Pages
- **시그널링:** Cloudflare Workers + **Durable Objects** (방 1개 = DO 1 인스턴스, WebSocket Hibernation으로 idle 과금 0)
- **TURN:** Cloudflare Realtime TURN (대칭 NAT·LTE↔WiFi 교차망에서 relay)
- **핵심 설계:** 서버는 시그널링 텍스트만 중계. 사진 데이터는 서버 미경유(P2P). → 프라이버시 + 무료 운영

## 레포 구조
```
photo-bridge/
├── signaling/        # ★현행 백엔드: Cloudflare Worker + Durable Object (시그널링)
│   ├── src/index.ts  #   라우팅(/ws, /turn-credentials, /health) + TURN credential
│   ├── src/room.ts   #   RoomDurableObject (Perfect Negotiation, 2인제한, Hibernation)
│   └── wrangler.toml
├── frontend/         # Next.js 정적 프론트 (서브모듈)
│   ├── pages/index.tsx
│   ├── lib/webrtc.ts     # WebRTC P2P 코어 (useRef, 역압, CHUNK 16KB)
│   └── lib/signaling.ts  # 네이티브 WebSocket 시그널링 클라이언트
├── backend/          # (레거시) Nest.js+Socket.IO. 현재 미사용 — signaling/ 으로 대체됨
├── test-harness/     # Playwright E2E (로컬 wrangler dev + 실기기/운영 검증)
└── docs/
    ├── CLOUDFLARE_DEPLOY.md              # 배포 가이드
    └── plans/2026-10-22-cloudflare-migration.md
```

> ⚠️ `backend/`(Nest.js+Docker)는 레거시다. 현행 시그널링은 `signaling/`의 Cloudflare Worker + Durable Object.

## 배포
→ [docs/CLOUDFLARE_DEPLOY.md](docs/CLOUDFLARE_DEPLOY.md) 참고.

요약:
```bash
# 시그널링 Worker
cd signaling && npm install
source ~/.cloudflare_token          # CLOUDFLARE_API_TOKEN (커밋 금지)
npx wrangler deploy

# 프론트 Pages
cd frontend && npm run build
npx wrangler pages deploy out --project-name=photo-bridge --branch=main
```

## 로컬 개발 / 검증
```bash
bash test-harness/start-servers.sh        # wrangler dev(Worker/DO) + 정적 프록시
npx playwright test p2p real-photo         # E2E (바이트/실제PNG 동일성)
# 운영 배포본 검증
npx playwright test prod
# 실기기 교차(Android Chrome 등이 같은 방 선입장 후)
PB_SERVER=https://photo.playwiki.org PB_ROOM=xxxx npx playwright test device-cross
```

## 검증 현황
- ✅ 로컬 E2E (Durable Object 시그널링): 바이트 동일성 / 실제 PNG / room_full 2인제한
- ✅ 실기기 교차 (맥 Chrome ↔ LG Android Chrome): SHA256 일치
- ✅ 운영 배포본 (Cloudflare Pages + Worker DO): P2P 전송 통과
- ✅ TURN relay candidate 수집 확인
- ⬜ iOS Safari 실기기 교차 (예정)
