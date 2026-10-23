// 저장 완료 체크 표시 검증
// B가 사진 2장 받고 → 개별 '저장' 클릭 시 '저장됨 ✓' 뱃지, '전체 저장' 시 전부 체크
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const ROOM = 'saved' + Math.floor(Math.random() * 100000);

test('저장 완료 체크 표시', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  B.on('download', (d) => d.saveAs(`/tmp/saved_dl/${Date.now()}_${d.suggestedFilename()}`).catch(() => {}));

  await A.goto(`${BASE}/?room=${ROOM}`);
  await B.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  // A가 3장 전송
  await A.evaluate(() => {
    const dt = new DataTransfer();
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    for (let i = 0; i < 3; i++) dt.items.add(new File([arr], `s${i}.png`, { type: 'image/png' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // B가 3장 수신
  await expect(B.locator('text=받은 사진 3장')).toBeVisible({ timeout: 30_000 });

  // 저장 전: '저장됨 ✓' 없음
  expect(await B.locator('text=저장됨 ✓').count()).toBe(0);

  // 개별 저장 1장 클릭 (썸네일 내 버튼, 데스크톱=다운로드 경로)
  const thumbBtns = B.locator('div[style*="relative"] button');
  await thumbBtns.first().click();
  await B.waitForTimeout(800);
  // 버튼 '저장됨 ✓' + 헤더 카운터 '1장 저장됨'
  const savedAfterOne = await B.locator('text=저장됨').count();
  console.log(`after individual: 저장됨=${savedAfterOne}`);
  expect(savedAfterOne).toBeGreaterThanOrEqual(1);

  // 전체 저장
  await B.locator('button:has-text("전체 저장")').click();
  await B.waitForTimeout(1500);
  // 헤더 카운터 '3장 저장됨' 노출
  await expect(B.locator('text=3장 저장됨')).toBeVisible({ timeout: 5_000 });
  console.log('RESULT: 전체 저장 후 3장 저장됨 표시 확인');

  await ctxA.close();
  await ctxB.close();
});
