// 운영 배포본 검증: Cloudflare Pages + Worker(DO) 경유 실제 인터넷 P2P.
import { test, expect, Browser, Page } from '@playwright/test';
import * as crypto from 'crypto';

const PROD = process.env.PB_PROD_URL || 'https://photo-bridge-4a6.pages.dev';
const ROOM = 'prod' + Math.floor(Math.random() * 100000);

async function join(page: Page, room: string) {
  await page.goto(`${PROD}/?room=${room}`);
}

test('운영 배포본 P2P 전송 (Cloudflare Pages+Worker DO)', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  pageA.on('console', (m) => console.log(`A> ${m.text()}`));
  pageB.on('console', (m) => console.log(`B> ${m.text()}`));

  await join(pageB, ROOM);
  await pageB.waitForTimeout(800);
  await join(pageA, ROOM);

  await expect(pageA.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });
  await expect(pageB.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });

  const original = crypto.randomBytes(150 * 1024);
  const origHash = crypto.createHash('sha256').update(original).digest('hex');

  await pageA.setInputFiles('input[type="file"]', {
    name: 'prod.png',
    mimeType: 'image/png',
    buffer: original,
  });

  await expect(pageB.locator('text=받은 사진 1장')).toBeVisible({
    timeout: 25_000,
  });
  const imgSrc = await pageB.locator('img[alt="prod.png"]').getAttribute('src');
  const b64 = await pageB.evaluate(async (src) => {
    const res = await fetch(src as string);
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }, imgSrc);
  const received = Buffer.from(b64, 'base64');
  const recvHash = crypto.createHash('sha256').update(received).digest('hex');

  expect(received.length).toBe(original.length);
  expect(recvHash).toBe(origHash);

  await ctxA.close();
  await ctxB.close();
});
