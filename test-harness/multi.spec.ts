// 여러 장 전송 + 받은 갤러리 검증 (로컬 하니스)
import { test, expect, Browser } from '@playwright/test';
import * as crypto from 'crypto';

const BASE = 'http://localhost:8099';
const ROOM = 'multi' + Math.floor(Math.random() * 100000);

function pngBuf(seed: number): Buffer {
  // 간단한 유효 PNG 대용 — 실제 PNG는 별도 테스트(real-photo)에서. 여기선 바이트 무결성.
  return crypto.randomBytes(40 * 1024 + seed * 1000);
}

test('여러 장(3) 전송 → 수신 갤러리 3장', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  A.on('console', (m) => console.log(`A> ${m.text()}`));
  B.on('console', (m) => console.log(`B> ${m.text()}`));

  await B.goto(`${BASE}/?room=${ROOM}`);
  await B.waitForTimeout(800);
  await A.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });

  // A가 3장 한번에 선택
  await A.setInputFiles('input[type="file"]', [
    { name: 'a.png', mimeType: 'image/png', buffer: pngBuf(1) },
    { name: 'b.png', mimeType: 'image/png', buffer: pngBuf(2) },
    { name: 'c.png', mimeType: 'image/png', buffer: pngBuf(3) },
  ]);

  // B 갤러리에 3장 뜨는지
  await expect(B.locator('text=받은 사진 3장')).toBeVisible({ timeout: 30_000 });
  const thumbs = B.locator('img[alt$=".png"]');
  await expect(thumbs).toHaveCount(3, { timeout: 10_000 });

  // A는 "사진 3장을 보냈어요" 표시
  await expect(A.locator('text=사진 3장을 보냈어요')).toBeVisible({
    timeout: 10_000,
  });

  await ctxA.close();
  await ctxB.close();
});
