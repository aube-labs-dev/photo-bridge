// 실기기 교차 검증: 환경변수로 서버/방 지정.
//   PB_SERVER=http://<맥LAN IP>:8099 PB_ROOM=lgtest npx playwright test device-cross
// 사전에 실기기(예: Android Chrome)가 같은 방에 먼저 입장해 있어야 한다.
import { test, expect, Browser } from '@playwright/test';

const SERVER = process.env.PB_SERVER || 'http://localhost:8099';
const ROOM = process.env.PB_ROOM || 'lgtest2';

test('맥↔실기기 연결 + 맥에서 기기로 전송 시작', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('console', (m) => console.log(`MAC> ${m.text()}`));

  await page.goto(`${SERVER}/?room=${ROOM}`);

  // LG가 이미 방에 있으므로 맥은 즉시 협상 시작 → 연결
  await expect(page.locator('text=연결됨')).toBeVisible({ timeout: 30_000 });
  console.log('MAC> === 연결됨 확인 ===');

  // 맥 → LG 로 PNG 전송
  await page.setInputFiles('input[type="file"]', '/tmp/pb_real.png');
  await expect(page.locator('text=보내기 완료')).toBeVisible({ timeout: 20_000 });
  console.log('MAC> === 전송 완료 ===');

  await page.waitForTimeout(1500);
  await ctx.close();
});
