import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-real',
  testMatch: 'carelog-workspace-isolation.real.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    trace: 'off',
  },
});
