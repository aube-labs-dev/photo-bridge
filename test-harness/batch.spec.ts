// 배치 저장 + 백프레셔 검증 (현실적 파일 크기 150KB로 전송 지연 확보)
// 송신 측 [Flow] pause/resume 로그로 백프레셔 메커니즘 동작을 직접 검증한다.
import { test, expect, Browser } from '@playwright/test';

const BASE = 'http://localhost:8099';
const ROOM = 'batch' + Math.floor(Math.random() * 100000);
const N = 130;

test('배치 저장 백프레셔: 130장 → 100장 근처 멈춤 → 계속 → 완료', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(240_000);
  const ctxA = await browser.newContext(); // 송신
  const ctxB = await browser.newContext(); // 수신
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const aFlow: string[] = [];
  A.on('console', (m) => {
    const t = m.text();
    if (t.includes('[Flow]')) aFlow.push(t);
  });
  B.on('download', (d) =>
    d.saveAs(`/tmp/batch_dl/${Date.now()}_${d.suggestedFilename()}`).catch(() => {}),
  );

  await A.goto(`${BASE}/?room=${ROOM}`);
  await B.goto(`${BASE}/?room=${ROOM}`);
  await expect(A.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });
  await expect(B.locator('text=연결됨')).toBeVisible({ timeout: 45_000 });

  // 송신: 130장 150KB 더미 파일 주입
  await A.evaluate((n) => {
    const dt = new DataTransfer();
    const payload = new Uint8Array(150 * 1024);
    for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff;
    for (let i = 0; i < n; i++) {
      dt.items.add(new File([payload], `p${i}.png`, { type: 'image/png' }));
    }
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, N);

  // 수신측: 100장 채워 '저장하고 계속 받기' 노출 대기
  await expect(B.locator('text=저장하고 계속 받기')).toBeVisible({ timeout: 120_000 });
  const pausedCount = await B.locator('img[loading="lazy"]').count();
  console.log(`PAUSED domImgs=${pausedCount} flowLogs=${JSON.stringify(aFlow)}`);
  // 백프레셔: 송신측이 pause 신호를 받았어야 함 + 멈춘 시점 장수가 130 미만(전송 중단됨)
  expect(aFlow.some((l) => l.includes('pause'))).toBe(true);
  expect(pausedCount).toBeLessThan(N);

  // 저장하고 계속
  await B.locator('text=저장하고 계속 받기').click();

  // 재개 후 나머지 수신 완료 (저장 버튼 사라짐)
  await expect(B.locator('text=저장하고 계속 받기')).toBeHidden({ timeout: 90_000 });
  await B.waitForTimeout(5000);
  const finalCount = await B.locator('img[loading="lazy"]').count();
  console.log(`RESULT: final domImgs=${finalCount} flowLogs=${JSON.stringify(aFlow)}`);
  // 재개 신호가 송신측에 전달됐어야 함
  expect(aFlow.some((l) => l.includes('resume'))).toBe(true);

  await ctxA.close();
  await ctxB.close();
});
