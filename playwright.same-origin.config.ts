import { defineConfig } from '@playwright/test';

// Production-mode build with a same-origin API base ('/'), served by vite preview.
// Requests under /api are answered by the DEV edge Worker code via route interception.
const port = 4175;

export default defineConfig({
  testDir: './e2e-same-origin',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `VITE_CARELOG_API_BASE_URL=/ pnpm build:client && pnpm exec vite preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
});
