// 상대 새로고침 → 재연결 시 '상대가 나갔어요' notice가 사라지는지 검증
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const ROOM = 'reconn' + Math.floor(Math.random() * 100000);

test('상대 새로고침 재연결 → 나갔어요 사라지고 연결됨 유지', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(120_000);
  const ctxA = await browser.newContext(); // 남아있는 쪽(LG 역할)
  const ctxB = await browser.newContext(); // 새로고침하는 쪽(아이폰 역할)
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  await A.goto(`${BASE}/?room=${ROOM}`);
  await B.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  // B 새로고침 (아이폰 브라우저 새로고침 재현)
  await B.reload();

  // A 화면: 잠깐 '나갔어요'가 뜰 수 있지만, 재연결 후엔 사라지고 '연결됨' 유지
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  // 재연결 완료까지 대기 후 notice 확인
  await A.waitForTimeout(3000);
  const leftNotice = await A.locator('text=상대가 나갔어요').count();
  const connected = await A.locator('text=연결됨').count();
  console.log(`RESULT: 나갔어요=${leftNotice} 연결됨=${connected}`);
  expect(connected).toBe(1);
  expect(leftNotice).toBe(0); // 모순 상태 없어야 함

  // B도 재연결됐는지
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  await ctxA.close();
  await ctxB.close();
});
