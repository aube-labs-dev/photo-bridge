// UX 스크린샷: 입장 전/대기/연결됨/전송중/수신 상태를 캡처
import { test, Browser } from '@playwright/test';

const PROD = 'https://photo.playwiki.org';
const ROOM = 'ux' + Math.floor(Math.random() * 100000);
const OUT = '/tmp/ux';

test('UX 화면 캡처', async ({ browser }: { browser: Browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 크기
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  // 1. 입장 전 화면
  await A.goto(PROD);
  await A.waitForTimeout(1000);
  await A.screenshot({ path: `${OUT}_1_landing.png` });

  // 2. 방 입장 → 대기 상태 (A만)
  await A.goto(`${PROD}/?room=${ROOM}`);
  await A.waitForTimeout(2500);
  await A.screenshot({ path: `${OUT}_2_waiting.png` });

  // 3. B 입장 → 양쪽 연결됨
  await B.goto(`${PROD}/?room=${ROOM}`);
  await A.waitForTimeout(6000);
  await A.screenshot({ path: `${OUT}_3_connected_sender.png` });
  await B.screenshot({ path: `${OUT}_3_connected_receiver.png` });

  // 4. A가 사진 전송 → 수신측(B) 완료 화면
  const buf = require('fs').readFileSync('/tmp/pb_real.png');
  const dl = B.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await A.setInputFiles('input[type="file"]', {
    name: 'pb_real.png', mimeType: 'image/png', buffer: buf,
  });
  await A.waitForTimeout(2500);
  await A.screenshot({ path: `${OUT}_4_sent.png` });
  await B.screenshot({ path: `${OUT}_4_received.png` });
  await dl;

  await ctxA.close();
  await ctxB.close();
});
