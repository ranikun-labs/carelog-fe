import { expect, test as base, type Page } from '@playwright/test';

export const TEST_NOW = '2026-08-11T12:00:00+09:00';

const TEST_NOW_MS = Date.parse(TEST_NOW);

export async function useEmptyApplicationSeed(page: Page) {
  await page.addInitScript(() => {
    window.__CARELOG_TEST_INITIALIZATION__ = {
      ...window.__CARELOG_TEST_INITIALIZATION__,
      initialCustomers: [],
      initialEvents: [],
    };
  });
}

export async function useAuthAdapterScenario(
  page: Page,
  authAdapterOptions: NonNullable<Window['__CARELOG_TEST_INITIALIZATION__']>['authAdapterOptions'],
) {
  await page.addInitScript((options) => {
    window.__CARELOG_TEST_INITIALIZATION__ = {
      ...window.__CARELOG_TEST_INITIALIZATION__,
      authAdapterOptions: options,
    };
  }, authAdapterOptions);
}

export async function triggerAuthFailure(
  page: Page,
  kind: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER' | 'NETWORK',
  retryable = false,
) {
  await page.evaluate(
    ({ failureKind, canRetry }) => {
      const control = window.__CARELOG_TEST_AUTH_CONTROL__;
      if (!control) throw new Error('Test auth control is unavailable.');
      control.reportFailure(failureKind, canRetry);
    },
    { failureKind: kind, canRetry: retryable },
  );
}

export async function readAuthRecoveryAttemptCount(page: Page) {
  return page.evaluate(
    () => window.__CARELOG_TEST_AUTH_CONTROL__?.getRecoveryAttemptCount?.() ?? 0,
  );
}

export async function readAuthLogoutAttemptCount(page: Page) {
  return page.evaluate(() => window.__CARELOG_TEST_AUTH_CONTROL__?.getLogoutAttemptCount?.() ?? 0);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.__CARELOG_TEST_INITIALIZATION__ = {
        ...window.__CARELOG_TEST_INITIALIZATION__,
        authAdapterOptions: { bootstrap: 'authenticated' },
      };
    });
    await page.addInitScript(
      ({ nowMs }) => {
        const NativeDate = Date;
        const FixedDate = new Proxy(NativeDate, {
          apply: () => new NativeDate(nowMs).toString(),
          construct: (target, args) =>
            Reflect.construct(target, args.length === 0 ? [nowMs] : args),
        });

        Object.defineProperty(FixedDate, 'now', { value: () => nowMs });
        Object.defineProperty(globalThis, 'Date', {
          configurable: true,
          value: FixedDate,
          writable: true,
        });
      },
      { nowMs: TEST_NOW_MS },
    );
    await use(page);
  },
});

export { expect };
export type { Page };
