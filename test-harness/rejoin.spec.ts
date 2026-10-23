// 재입장(ck 교체) 검증 — 버그2 수정
// A, B 두 명이 방에 있고, B가 '좀비'로 남은 상태에서 B가 같은 ck로 재접속하면
// room_full 거부가 아니라 정상 입장(기존 좀비 교체)되어야 한다.
// Playwright context는 sessionStorage가 context별로 유지되므로, 같은 context에서
// 새로고침하면 동일 ck로 재접속한다.
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const ROOM = 'rejoin' + Math.floor(Math.random() * 100000);

test('재입장: 같은 탭 재접속 시 room_full 아님(좀비 교체)', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  await A.goto(`${BASE}/?room=${ROOM}`);
  await B.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  // B를 새로고침 → 같은 ck로 재접속 (이전 소켓은 서버가 교체해야 함)
  await B.reload();

  // B가 room_full이 아니라 정상 입장(대기/연결)되어야 함
  await expect(B.locator('text=이미 2명이 사용 중')).toBeHidden({
    timeout: 5_000,
  });
  // 재연결 완료 (연결됨 또는 최소한 room_full 아님)
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  console.log('REJOIN OK: room_full 없이 재입장 성공');

  await ctxA.close();
  await ctxB.close();
});
