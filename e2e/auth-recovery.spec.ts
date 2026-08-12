import {
  expect,
  readAuthLogoutAttemptCount,
  readAuthRecoveryAttemptCount,
  test,
  triggerAuthFailure,
  useAuthAdapterScenario,
} from './fixtures';

async function expectProtectedSurfaceAbsent(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-app-shell]')).toHaveCount(0);
  await expect(page.locator('[data-schedule-page]')).toHaveCount(0);
  await expect(page.locator('[data-customers-page]')).toHaveCount(0);
}

test('delayed anonymous bootstrap never flashes protected UI', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 375, 'bootstrap boundary runs at the phone target');
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous', bootstrapDelayMs: 250 });
  await page.goto('/app/schedule');

  await expect(page.locator('[data-auth-status-surface]')).toBeVisible();
  await expectProtectedSurfaceAbsent(page);
  await expect(page.locator('[data-side-navigation]')).toHaveCount(0);
  await expect(page.locator('[data-bottom-navigation]')).toHaveCount(0);
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
});

test('recovery success keeps the product shell mounted and permits a later episode', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1180, 'recovery state runs at the desktop target');
  await useAuthAdapterScenario(page, {
    bootstrap: 'authenticated',
    recovery: 'success',
    recoveryDelayMs: 120,
  });
  await page.goto('/app/schedule');
  await expect(page.locator('[data-schedule-page]')).toBeVisible();
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);

  await triggerAuthFailure(page, 'UNAUTHORIZED');
  await expect(page.locator('[data-auth-recovery-banner]')).toBeVisible();
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
  await expect(page.locator('[data-schedule-page]')).toBeVisible();
  await expect(page.locator('[data-side-navigation]:visible')).toHaveCount(1);
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
  expect(await readAuthRecoveryAttemptCount(page)).toBe(1);

  await triggerAuthFailure(page, 'UNAUTHORIZED');
  await expect(page.locator('[data-auth-recovery-banner]')).toBeVisible();
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
  expect(await readAuthRecoveryAttemptCount(page)).toBe(2);
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
});

test('concurrent unauthorized signals share exactly one recovery attempt', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1180, 'single-flight runs at the desktop target');
  await useAuthAdapterScenario(page, {
    bootstrap: 'authenticated',
    recovery: 'success',
    recoveryDelayMs: 120,
  });
  await page.goto('/app/schedule');
  await expect(page.locator('[data-schedule-page]')).toBeVisible();

  await Promise.all([
    triggerAuthFailure(page, 'UNAUTHORIZED'),
    triggerAuthFailure(page, 'UNAUTHORIZED'),
  ]);
  await expect(page.locator('[data-auth-recovery-banner]')).toBeVisible();
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
  expect(await readAuthRecoveryAttemptCount(page)).toBe(1);
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
});

test('recovery success preserves Schedule selection and scroll context', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1180, 'preservation runs at the desktop target');
  await useAuthAdapterScenario(page, {
    bootstrap: 'authenticated',
    recovery: 'success',
    recoveryDelayMs: 120,
  });
  await page.goto('/app/schedule');
  const master = page.locator('[data-major-surface="schedule"]');
  const targetRow = page.locator('[data-agenda-row][data-event-id="followup-tenant-1"]');
  await targetRow.scrollIntoViewIfNeeded();
  await master.evaluate((element) => {
    element.scrollTop = Math.max(element.scrollTop, 120);
  });
  await targetRow.getByRole('button').click();
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );
  const scrollBeforeRecovery = await master.evaluate((element) => element.scrollTop);

  await triggerAuthFailure(page, 'UNAUTHORIZED');
  await expect(page.locator('[data-auth-recovery-banner]')).toBeVisible();
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );
  expect(await master.evaluate((element) => element.scrollTop)).toBe(scrollBeforeRecovery);
});

test('recovery success preserves an unsaved Customer Edit draft', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1180, 'draft preservation runs at the desktop target');
  await useAuthAdapterScenario(page, {
    bootstrap: 'authenticated',
    recovery: 'success',
    recoveryDelayMs: 120,
  });
  await page.goto('/app/customers/customer-tenant-1/edit');
  const memo = page.locator('[data-customer-field="customerMemo"]');
  await memo.fill('draft preserved across session recovery');

  await triggerAuthFailure(page, 'UNAUTHORIZED');
  await expect(page.locator('[data-auth-recovery-banner]')).toBeVisible();
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
  await expect(memo).toHaveValue('draft preserved across session recovery');
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
});

test('failed recovery returns to Auth Entry without stale product DOM', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1024, 'failure boundary runs at the tablet target');
  await useAuthAdapterScenario(page, {
    bootstrap: 'authenticated',
    recovery: 'server',
    recoveryDelayMs: 80,
  });
  await page.goto('/app/schedule');
  await expect(page.locator('[data-schedule-page]')).toBeVisible();
  await triggerAuthFailure(page, 'UNAUTHORIZED');

  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  await expectProtectedSurfaceAbsent(page);
  await expect(page.locator('[data-auth-recovery-banner]')).toHaveCount(0);
});

test('403 keeps the product state and does not show a retry without a callback', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1024, '403 boundary runs at the tablet target');
  await page.goto('/app/schedule');
  await expect(page.locator('[data-schedule-page]')).toBeVisible();
  await triggerAuthFailure(page, 'FORBIDDEN');

  await expect(page.locator('[data-auth-operation-error]')).toBeVisible();
  await expect(
    page.locator('[data-auth-operation-error]').getByRole('button', { name: '다시 시도' }),
  ).toHaveCount(0);
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
  expect(await readAuthLogoutAttemptCount(page)).toBe(0);
});

test('server and network failures retain the session and expose only real retry behavior', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1024, 'operation failures run at the tablet target');
  await page.goto('/app/schedule');
  await expect(page.locator('[data-schedule-page]')).toBeVisible();

  for (const kind of ['SERVER', 'NETWORK'] as const) {
    await triggerAuthFailure(page, kind, true);
    const operationError = page.locator('[data-auth-operation-error]');
    await expect(operationError).toBeVisible();
    await expect(operationError.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await operationError.getByRole('button', { name: '다시 시도' }).click();
    await expect(operationError).toHaveCount(0);
    await expect(page.locator('[data-app-shell]')).toHaveCount(1);
  }
  expect(await readAuthLogoutAttemptCount(page)).toBe(0);
});

test('logout is single-flight and browser history cannot restore protected UI', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 375, 'logout boundary runs at the phone target');
  await useAuthAdapterScenario(page, { bootstrap: 'authenticated', logoutDelayMs: 120 });
  await page.goto('/app/schedule');
  await page
    .locator('[data-bottom-navigation]:visible')
    .getByRole('link', { name: '계정', exact: true })
    .click();
  const logout = page.getByRole('button', { name: '로그아웃', exact: true });
  await logout.click({ clickCount: 2, delay: 0 });

  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  expect(await readAuthLogoutAttemptCount(page)).toBe(1);
  await page.goBack();
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  await expectProtectedSurfaceAbsent(page);

  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/app/schedule');
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  await expectProtectedSurfaceAbsent(page);
});
