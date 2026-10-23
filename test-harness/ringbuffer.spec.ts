// 링버퍼 디버그: 배치2 전송/수신 추적
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const ROOM = 'ring' + Math.floor(Math.random() * 100000);

test('링버퍼 디버그: 48+5', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  const ctxA = await browser.newContext({ acceptDownloads: true });
  const ctxB = await browser.newContext({ acceptDownloads: true });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  let dlCount = 0;
  let incoming = 0;
  B.on('download', (d) => { dlCount++; d.saveAs('/tmp/ring_dl/' + Date.now() + '_' + d.suggestedFilename()).catch(() => {}); });
  B.on('console', (m) => { if (/incoming/.test(m.text())) { incoming++; } });
  B.on('pageerror', (e) => console.log(`B> PAGEERROR: ${e.message}`.slice(0, 200)));
  A.on('pageerror', (e) => console.log(`A> PAGEERROR: ${e.message}`.slice(0, 200)));

  await B.goto(`${BASE}/?room=${ROOM}`);
  await B.waitForTimeout(800);
  await A.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });

  const mk = (start: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      name: `p${start + i}.png`, mimeType: 'image/png',
      buffer: Buffer.alloc(2 * 1024, (start + i) % 256),
    }));

  // 배치1: 48장
  await A.setInputFiles('input[type="file"]', mk(0, 48));
  await expect(B.locator('text=받은 사진 48장')).toBeVisible({ timeout: 120_000 });
  console.log(`배치1: domImgs=${await B.locator('img[alt$=".png"]').count()} incoming=${incoming} 보냈어요=${await A.locator('text=보냈어요').count()}`);
  await A.waitForTimeout(1500);

  // 배치2: 5장 → 누적 53, 링버퍼 발동(3장 자동저장)
  console.log(`배치2 전송 시작...`);
  await A.setInputFiles('input[type="file"]', mk(48, 5));
  for (let t = 0; t < 30; t++) {
    const cnt = await B.locator('img[alt$=".png"]').count();
    const notice = await B.locator('text=자동 저장').count();
    console.log(`T+${t}s domImgs=${cnt} incoming=${incoming} dl=${dlCount} notice=${notice}`);
    if (dlCount >= 3 || incoming >= 53) break;
    await B.waitForTimeout(1500);
  }
  console.log(`RESULT: domImgs=${await B.locator('img[alt$=".png"]').count()} incoming=${incoming} dl=${dlCount}`);

  await ctxA.close();
  await ctxB.close();
});
