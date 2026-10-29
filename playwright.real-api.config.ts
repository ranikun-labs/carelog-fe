import { defineConfig } from '@playwright/test';

const port = 4174;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Real API E2E requires ${name}; refusing to skip the integration test.`);
  }
  return value;
}

if (process.env.CARELOG_E2E_DISPOSABLE !== '1') {
  throw new Error('Real API E2E requires CARELOG_E2E_DISPOSABLE=1.');
}

const gatewayTarget = requiredEnvironmentValue('CARELOG_E2E_GATEWAY_TARGET');
const accountA = requiredEnvironmentValue('CARELOG_E2E_ACCOUNT_A');
const passwordA = requiredEnvironmentValue('CARELOG_E2E_PASSWORD_A');

let gatewayUrl: URL;
try {
  gatewayUrl = new URL(gatewayTarget);
} catch {
  throw new Error('Real API E2E requires a loopback-only HTTP Gateway target.');
}

const gatewayAuthority = gatewayTarget.slice('http://'.length).split(/[/?#]/, 1)[0] ?? '';
if (
  gatewayUrl.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost'].includes(gatewayUrl.hostname) ||
  !gatewayUrl.port ||
  gatewayAuthority.includes('@') ||
  gatewayUrl.username ||
  gatewayUrl.password ||
  gatewayUrl.pathname !== '/' ||
  gatewayUrl.search ||
  gatewayUrl.hash
) {
  throw new Error('Real API E2E requires a loopback-only HTTP Gateway target.');
}

export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'off',
  },
  webServer: {
    command: `pnpm exec vite --mode real-api-e2e --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: {
      VITE_CARELOG_API_BASE_URL: `http://127.0.0.1:${port}`,
      CARELOG_E2E_GATEWAY_TARGET: gatewayUrl.origin,
      CARELOG_E2E_ACCOUNT_A: accountA,
      CARELOG_E2E_PASSWORD_A: passwordA,
      CARELOG_E2E_DISPOSABLE: '1',
    },
  },
});
