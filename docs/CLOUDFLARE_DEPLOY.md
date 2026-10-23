# Photo Bridge — Cloudflare 배포 가이드

완전 무료(사실상 $0) 운영. 프론트=Cloudflare Pages, 시그널링=Workers+Durable Objects, TURN=Cloudflare Realtime TURN(선택).

## 현재 배포 주소
- 서비스(커스텀 도메인): https://photo.playwiki.org
- 프론트(Pages): https://photo-bridge-4a6.pages.dev
- 시그널링(Worker): https://photo-bridge-signaling.aube-labs.workers.dev
- 계정: Aube.labs@gmail.com (account id: cfa6fb769d97b4ca81c9846572857e9c)
- zone: playwiki.org (id: 834e6c39c7800ff54df2559504e8c8ab), 네임서버 Cloudflare(amanda/corey)
- TURN: ✅ 활성 (Realtime TURN 키 주입 완료)

## 사전 준비
- Cloudflare 계정 + API 토큰(Workers/Pages 편집 권한)
- 토큰은 환경변수로만: `export CLOUDFLARE_API_TOKEN=...` (절대 커밋 금지)
- node 22 + nvm, 레포 루트에 wrangler devDependency

## 1) 시그널링 Worker 배포
```bash
cd signaling
npm install
export CLOUDFLARE_API_TOKEN=***          # 노출 금지
npx wrangler deploy
# → https://photo-bridge-signaling.<subdomain>.workers.dev
```
- `wrangler.toml`: Durable Object 바인딩(ROOM=RoomDurableObject), SQLite 마이그레이션(v1)
- WebSocket Hibernation 사용 → idle 과금 없음
- 엔드포인트: `/ws?room=xxx`(시그널링), `/turn-credentials`, `/health`

## 2) 프론트 Pages 배포
```bash
cd frontend
# .env.production 의 NEXT_PUBLIC_SIGNALING_URL 을 배포된 Worker wss:// 로 설정
npm run build                              # out/ 생성
export CLOUDFLARE_API_TOKEN=***
npx wrangler pages project create photo-bridge --production-branch=main   # 최초 1회
npx wrangler pages deploy out --project-name=photo-bridge --branch=main
```

## 3) (선택) TURN 활성화 — 교차망/대칭 NAT 대응
- Cloudflare 대시보드 → Realtime → TURN 키 생성 → TOKEN_ID / API_TOKEN 확보
- Worker 시크릿 주입:
```bash
cd signaling
npx wrangler secret put TURN_TOKEN_ID
npx wrangler secret put TURN_API_TOKEN
```
- 프론트는 `/turn-credentials` 를 호출해 자동으로 ICE 서버에 TURN 포함(코드 반영됨)
- 미설정 시 STUN(stun.cloudflare.com)만 사용 → 같은망/일반 NAT는 OK, 대칭 NAT는 실패 가능

## 4) (선택) 커스텀 도메인 playwiki.org
현재 Spaceship 등록. 네임서버를 Cloudflare로 이전 후:
- Pages: `photo.playwiki.org` → Pages 프로젝트 Custom domain
- Worker: `signaling.playwiki.org` → wrangler.toml routes custom_domain=true (주석 해제) 또는 대시보드
- 기존 `hifive.playwiki.org`(GitHub Pages CNAME) DNS 레코드는 Cloudflare 가져오기 시 유지 확인

## 로컬 개발/검증
```bash
# Worker(DO) 로컬 + 정적 서빙 프록시 + Playwright
bash test-harness/start-servers.sh        # wrangler dev(8795) + harness(8099)
npx playwright test p2p real-photo         # E2E
```
- `test-harness/server.js`: /ws,/turn-credentials,/health → Worker 프록시, 나머지 정적
- 실기기 교차: `PB_SERVER=http://<맥LAN IP>:8099 PB_ROOM=xxx npx playwright test device-cross`

## 무료 한도(2026 기준)
- Durable Objects(SQLite, Free): 요청 10만/일(WS 메시지 20:1), Duration 13,000 GB-s/일
- Pages: 무제한 대역폭, 빌드 월 500회
- 시그널링은 텍스트 수KB라 한도 초과 사실상 없음
