import { defineConfig } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'mobile-375', use: { browserName: 'chromium', viewport: { width: 375, height: 812 } } },
    { name: 'mobile-480', use: { browserName: 'chromium', viewport: { width: 480, height: 812 } } },
    {
      name: 'tablet-768-portrait',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'tablet-1024-portrait',
      use: { browserName: 'chromium', viewport: { width: 1024, height: 1366 } },
    },
    {
      name: 'desktop-1180-landscape',
      use: { browserName: 'chromium', viewport: { width: 1180, height: 800 } },
    },
  ],
});
