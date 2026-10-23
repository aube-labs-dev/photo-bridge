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
  await expect(pageA.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(pageB.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  // 테스트 이미지 생성 (랜덤 바이트 200KB → 청크/역압 경로 커버)
  const originalBytes = crypto.randomBytes(200 * 1024);
  const originalHash = crypto.createHash('sha256').update(originalBytes).digest('hex');

  // B에서 수신 완료를 갤러리로 감지하고 바이트 확보
  // A의 file input에 메모리 파일 주입
  await pageA.setInputFiles('input[type="file"]', {
    name: 'test.png',
    mimeType: 'image/png',
    buffer: originalBytes,
  });

  // B 갤러리에 1장 뜰 때까지 대기 → blob URL 바이트 추출
  await expect(pageB.locator('text=받은 사진 1장')).toBeVisible({
    timeout: 25_000,
  });
  const imgSrc = await pageB.locator('img[alt="test.png"]').getAttribute('src');
  const b64 = await pageB.evaluate(async (src) => {
    const res = await fetch(src as string);
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }, imgSrc);
  const received = Buffer.from(b64, 'base64');
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
