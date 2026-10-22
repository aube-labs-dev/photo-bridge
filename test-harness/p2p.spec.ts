import { test, expect, Browser, Page } from '@playwright/test';
import * as crypto from 'crypto';

// 두 개의 독립 컨텍스트(별도 브라우저 탭)를 같은 방에 넣고
// A→B 로 이미지를 전송, 수신 바이트가 원본과 동일한지 검증한다.

const ROOM = '7777';

async function join(page: Page, room: string) {
  await page.goto('/');
  await page.fill('input[placeholder*="방 번호"]', room);
  await page.click('button:has-text("입장")');
}

test('P2P 이미지 전송: 바이트 동일성', async ({ browser }: { browser: Browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const logs: string[] = [];
  pageA.on('console', (m) => logs.push(`A: ${m.text()}`));
  pageB.on('console', (m) => logs.push(`B: ${m.text()}`));

  // B 먼저 입장(polite), 그 다음 A 입장(impolite) → A가 offer
  await join(pageB, ROOM);
  await pageB.waitForTimeout(500);
  await join(pageA, ROOM);

  // 양쪽 "연결됨" 대기
  await expect(pageA.locator('text=연결됨')).toBeVisible({ timeout: 25_000 });
  await expect(pageB.locator('text=연결됨')).toBeVisible({ timeout: 25_000 });

  // 테스트 이미지 생성 (랜덤 바이트 200KB → 청크/역압 경로 커버)
  const originalBytes = crypto.randomBytes(200 * 1024);
  const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');

  // B에서 수신 완료를 감지하기 위해, 수신 다운로드를 가로채 바이트 확보
  const downloadPromise = pageB.waitForEvent('download', { timeout: 25_000 });

  // A의 file input에 메모리 파일 주입
  await pageA.setInputFiles('input[type="file"]', {
    name: 'test.png',
    mimeType: 'image/png',
    buffer: originalBytes,
  });

  // B가 받은 다운로드 바이트 검증
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c as Buffer));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const received = Buffer.concat(chunks);
  const receivedHash = crypto.createHash('sha256').update(received).digest('hex');

  if (receivedHash !== originalHash) {
    console.log('--- LOGS ---\n' + logs.join('\n'));
  }

  expect(received.length).toBe(originalBytes.length);
  expect(receivedHash).toBe(originalHash);

  await ctxA.close();
  await ctxB.close();
});

test('방 2인 초과 거부(room_full)', async ({ browser }: { browser: Browser }) => {
  const room = '8888';
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const c3 = await browser.newContext();
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();
  const p3 = await c3.newPage();

  await join(p1, room);
  await p1.waitForTimeout(300);
  await join(p2, room);
  await p2.waitForTimeout(300);
  await join(p3, room);

  // 3번째는 room_full 안내
  await expect(p3.locator('text=이미 2명')).toBeVisible({ timeout: 10_000 });

  await c1.close();
  await c2.close();
  await c3.close();
});
