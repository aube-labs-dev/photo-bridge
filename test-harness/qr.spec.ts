// QR 렌더 확인 스크린샷
import { test, expect, Browser } from '@playwright/test';

test('QR 표시', async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('http://localhost:8099/?room=qrtest42');
  // 대기 상태에서 QR canvas 렌더 대기
  await p.waitForTimeout(3000);
  const canvas = p.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  // canvas에 실제로 그려졌는지 (빈 캔버스 아닌지) 확인
  const nonEmpty = await p.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    if (!c) return false;
    const ctx = c.getContext('2d');
    const data = ctx!.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 128) dark++;
    }
    return dark > 100; // QR 모듈(검은 픽셀) 존재
  });
  console.log(`QR nonEmpty=${nonEmpty} canvasSize=${await canvas.evaluate((c: any) => c.width + 'x' + c.height)}`);
  expect(nonEmpty).toBe(true);
  await p.screenshot({ path: '/tmp/qr_shot.png', fullPage: true });
  await ctx.close();
});
