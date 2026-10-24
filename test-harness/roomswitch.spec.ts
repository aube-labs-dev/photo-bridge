// 방 전환 시 받은 사진 갤러리 초기화 검증
// B가 방1에서 사진 받음 → 나가기 → 방2 입장 시 이전 갤러리가 남아있지 않아야 함
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const R1 = 'rsw1' + Math.floor(Math.random() * 100000);
const R2 = 'rsw2' + Math.floor(Math.random() * 100000);

test('방 전환 시 받은 사진 초기화', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  // 방1: A↔B 연결, A가 2장 전송
  await A.goto(`${BASE}/?room=${R1}`);
  await B.goto(`${BASE}/?room=${R1}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await A.evaluate(() => {
    const dt = new DataTransfer();
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    for (let i = 0; i < 2; i++) dt.items.add(new File([arr], `r${i}.png`, { type: 'image/png' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(B.locator('text=받은 사진 2장')).toBeVisible({ timeout: 30_000 });

  // B가 '나가기' → 받은 사진 사라져야 함
  await B.locator('button:has-text("나가기")').click();
  await B.waitForTimeout(500);
  expect(await B.locator('text=받은 사진').count()).toBe(0);

  // 나가기 후 URL에서 ?room= 제거 확인 (새로고침해도 이전 방 자동입장 X)
  const urlAfterLeave = await B.evaluate(() => window.location.href);
  console.log(`URL after leave: ${urlAfterLeave}`);
  expect(urlAfterLeave).not.toContain('room=');

  // B가 방2로 입장 (새 방) → 이전 갤러리 없이 깨끗
  await B.goto(`${BASE}/?room=${R2}`);
  await B.waitForTimeout(1500);
  const leftover = await B.locator('text=받은 사진').count();
  console.log(`RESULT: 방2 입장 후 받은사진 섹션=${leftover}`);
  expect(leftover).toBe(0);

  // 방 입력창으로 다른 방 입장 시 URL이 그 방으로 갱신되는지
  await B.goto(`${BASE}/`);
  await B.waitForTimeout(500);
  await B.locator('input[type="text"]').first().fill('urltest99');
  await B.locator('button:has-text("입장")').first().click();
  await B.waitForTimeout(800);
  const urlAfterJoin = await B.evaluate(() => window.location.href);
  console.log(`URL after join: ${urlAfterJoin}`);
  expect(urlAfterJoin).toContain('room=urltest99');

  await ctxA.close();
  await ctxB.close();
});
