import { expect, test, useAuthAdapterScenario, useEmptyApplicationSeed } from './fixtures';

test('anonymous direct navigation never flashes protected product content', async ({ page }) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/app/schedule');

  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  await expect(page.locator('[data-app-shell]')).toHaveCount(0);
  await expect(page.locator('[data-schedule-page]')).toHaveCount(0);
});

test('login reaches Schedule when the canonical Customer store has records', async ({ page }) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/auth/entry');
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.getByLabel('계정').fill('fixture-account');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-secret');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page).toHaveURL('/app/schedule');
  await expect(page.getByRole('heading', { name: '일정', exact: true })).toBeVisible();
});

test('signup reaches the Customers empty flow when the canonical store is empty', async ({
  page,
}) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await useEmptyApplicationSeed(page);
  await page.goto('/auth/signup');
  await page.getByLabel('계정').fill('fixture-account');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-secret');
  await page.getByLabel('비밀번호 확인').fill('fixture-secret');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();

  await expect(page).toHaveURL('/app/customers');
  await expect(page.getByText('아직 고객이 없습니다')).toBeVisible();
});

test('fixture login failure keeps entered fields and stays in the auth surface', async ({
  page,
}) => {
  await useAuthAdapterScenario(page, {
    bootstrap: 'anonymous',
    login: 'invalid-credentials',
  });
  await page.goto('/auth/login');
  await page.getByLabel('계정').fill('wrong-account');
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-secret');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('계정 정보를 확인할 수 없습니다.');
  await expect(page.getByLabel('계정')).toHaveValue('wrong-account');
  await expect(page.getByLabel('비밀번호')).toHaveValue('wrong-secret');
  await expect(page.locator('[data-app-shell]')).toHaveCount(0);
});

test('account entry logs out and blocks the protected surface', async ({ page }) => {
  await page.goto('/app/settings');
  const visibleNavigation = page.locator(
    '[data-bottom-navigation]:visible, [data-side-navigation]:visible',
  );
  await visibleNavigation.getByRole('link', { name: '계정', exact: true }).click();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();

  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  await expect(page.locator('[data-app-shell]')).toHaveCount(0);
});

test('auth remains a readable bounded surface across the adaptive viewports', async ({ page }) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/auth/login');

  const form = page.locator('[data-auth-form]');
  const formBox = await form.boundingBox();
  expect(formBox).not.toBeNull();
  expect(formBox!.width).toBeLessThanOrEqual(560);
  await expect(page.locator('[data-side-navigation]')).toHaveCount(0);
  await expect(page.locator('[data-adaptive-composition]')).toHaveCount(0);

  for (const control of [
    page.getByLabel('계정'),
    page.getByLabel('비밀번호', { exact: true }),
    page.getByRole('button', { name: '로그인', exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
