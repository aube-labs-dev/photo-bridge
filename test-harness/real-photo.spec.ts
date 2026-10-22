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

  const downloadPromise = pageB.waitForEvent('download', { timeout: 25_000 });

  // 실제 PNG 파일을 input에 주입 (디스크 경로)
  await pageA.setInputFiles('input[type="file"]', REAL_PNG);

  const download = await downloadPromise;
  // 수신 파일명 확인
  expect(download.suggestedFilename()).toBe('pb_real.png');

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c as Buffer));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const received = Buffer.concat(chunks);
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
