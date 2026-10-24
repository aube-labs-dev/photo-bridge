import { test, expect, Browser } from '@playwright/test';
const BASE='http://localhost:8099';
const ROOM='prem'+Math.floor(Math.random()*100000);
// 연결 성사 전(ICE 핸드셰이크 완료 전) 상대가 빠지면 '나갔어요'를 띄우지 않는다.
test('연결 전 상대 이탈 → 나갔어요 미표시, 대기 유지', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(45_000);
  const ctxA = await browser.newContext();
  const A = await ctxA.newPage();
  await A.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=상대 기다리는 중')).toBeVisible({ timeout: 15_000 });
  // B가 잠깐 들어왔다가 ICE 연결되기 전에 즉시 이탈
  const ctxB = await browser.newContext();
  const B = await ctxB.newPage();
  await B.goto(`${BASE}/?room=${ROOM}`);
  await A.locator('text=/연결 중|peer_joined/').first().waitFor({ timeout: 10_000 }).catch(()=>{});
  await ctxB.close(); // 연결 완료 전 바로 나감
  await A.waitForTimeout(3000);
  const gone = await A.locator('text=상대가 나갔어요').count();
  const waiting = await A.locator('text=상대 기다리는 중').count();
  console.log(`RESULT: 나갔어요=${gone} 기다리는중=${waiting}`);
  expect(gone).toBe(0);           // '나갔어요' 안 떠야 함
  expect(waiting).toBeGreaterThan(0); // 대기 유지
  await ctxA.close();
});
