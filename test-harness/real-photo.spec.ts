import { test, expect, Browser, Page } from '@playwright/test';
import * as crypto from 'crypto';
import * as fs from 'fs';

// 실제 PNG 파일을 전송하고, 수신본이 바이트/구조적으로 동일한 PNG인지 검증한다.
const ROOM = '9999';
const REAL_PNG = '/tmp/pb_real.png';

async function join(page: Page, room: string) {
  await page.goto('/');
  await page.fill('input[placeholder*="방 번호"]', room);
  await page.click('button:has-text("입장")');
}

test('실제 PNG 사진 P2P 전송: 바이트+PNG시그니처 검증', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const original = fs.readFileSync(REAL_PNG);
  const originalHash = crypto.createHash('sha256').update(original).digest('hex');
  // PNG magic number 확인
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(original.subarray(0, 8).equals(PNG_SIG)).toBe(true);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await join(pageB, ROOM);
  await pageB.waitForTimeout(500);
  await join(pageA, ROOM);

  await expect(pageA.locator('text=연결됨')).toBeVisible({ timeout: 25_000 });
  await expect(pageB.locator('text=연결됨')).toBeVisible({ timeout: 25_000 });

  // 실제 PNG 파일을 input에 주입 (디스크 경로)
  await pageA.setInputFiles('input[type="file"]', REAL_PNG);

  // 수신측 갤러리에 1장 뜰 때까지 대기 → 썸네일 blob URL에서 바이트 추출
  await expect(pageB.locator('text=받은 사진 1장')).toBeVisible({
    timeout: 25_000,
  });
  const imgSrc = await pageB.locator('img[alt="pb_real.png"]').getAttribute('src');
  expect(imgSrc).toBeTruthy();

  // 브라우저 컨텍스트에서 blob을 fetch해 base64로 반환
  const b64 = await pageB.evaluate(async (src) => {
    const res = await fetch(src as string);
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }, imgSrc);
  const received = Buffer.from(b64, 'base64');
  const receivedHash = crypto
    .createHash('sha256')
    .update(received)
    .digest('hex');

  // 1) 수신본도 유효한 PNG (시그니처)
  expect(received.subarray(0, 8).equals(PNG_SIG)).toBe(true);
  // 2) 크기 동일
  expect(received.length).toBe(original.length);
  // 3) 해시 동일 = 비트 단위 완전 동일
  expect(receivedHash).toBe(originalHash);

  // 수신본을 디스크에 저장 (육안 검증용)
  fs.writeFileSync('/tmp/pb_received.png', received);

  await ctxA.close();
  await ctxB.close();
});
