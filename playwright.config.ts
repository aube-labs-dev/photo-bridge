import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test-harness',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    // 로컬 정적 서버 (글로벌 셋업에서 기동)
    baseURL: 'http://localhost:8099',
    headless: true,
    permissions: [],
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        // headless 크로미움에서 host candidate(로컬 IP) 수집 허용
        '--force-webrtc-ip-handling-policy=default',
        '--disable-webrtc-encryption',
        // mDNS(.local) candidate 난독화 비활성 → 2탭이 서로의 host IP 해석 가능
        '--disable-features=WebRtcHideLocalIpsWithMdns',
      ],
    },
  },
});
