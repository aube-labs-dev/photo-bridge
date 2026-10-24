import { test, expect, Browser } from '@playwright/test';
const BASE='http://localhost:8099';
test('새 방 만들기: 난수 6자리 입장+URL', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(60_000);
  const ctx=await browser.newContext(); const p=await ctx.newPage();
  await p.setViewportSize({width:420,height:900});
  await p.goto(`${BASE}/`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/create_ui1.png'});
  // 새 방 만들기 클릭
  await p.locator('button:has-text("새 방 만들기")').click();
  await p.waitForTimeout(1200);
  // URL이 6자리 난수 방으로
  const url = await p.evaluate(()=>window.location.href);
  const m = url.match(/room=(\d{6})/);
  console.log(`CREATE URL: ${url}`);
  expect(m).not.toBeNull();
  // 방 뱃지에 그 번호 노출 + QR 대기
  await expect(p.locator('text=방 '+m![1])).toBeVisible({timeout:5000});
  await p.screenshot({path:'/tmp/create_ui2.png'});
  console.log('RESULT: 난수방 '+m![1]+' 생성+입장 OK');
  await ctx.close();
});
