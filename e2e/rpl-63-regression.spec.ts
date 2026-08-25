import { expect, test, useAuthAdapterScenario } from './fixtures';

async function readFocusStyle(locator: import('@playwright/test').Locator) {
  await locator.focus();
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
    };
  });
}

async function readPageOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
  );
}

test('Non-AI form controls expose the canonical computed keyboard focus outline', async ({
  page,
}) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/auth/login');

  expect(await readFocusStyle(page.getByLabel('계정'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });

  await page.getByLabel('계정').fill('fixture-account');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-secret');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/app/schedule');
  await useAuthAdapterScenario(page, { bootstrap: 'authenticated' });

  await page.goto('/app/customers/new');
  expect(await readFocusStyle(page.locator('[data-customer-field="displayName"]'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });
  expect(await readFocusStyle(page.locator('[data-customer-field="customerMemo"]'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });

  await page.goto('/app/customers/customer-tenant-1');
  await page.locator('[data-add-event]').click();
  expect(await readFocusStyle(page.locator('[data-event-field="descriptor"]'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });
  expect(await readFocusStyle(page.locator('[data-event-field="note"]'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });

  await page.goto('/app/events/followup-tenant-1');
  await page.getByRole('button', { name: '기록 완료', exact: true }).click();
  expect(await readFocusStyle(page.getByLabel('실제'))).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '2px',
  });
});

test('Auth touch controls meet 44px targets and stay overflow-free at 200% text scale', async ({
  page,
}) => {
  await useAuthAdapterScenario(page, {
    bootstrap: 'anonymous',
    login: 'invalid-credentials',
    signup: 'invalid-credentials',
  });

  for (const mode of ['login', 'signup'] as const) {
    await page.goto(`/auth/${mode}`);
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));

    for (const control of [
      page.locator('[data-auth-surface] header a'),
      page.locator('[data-auth-surface] header button'),
      page.locator('[data-auth-form] ~ p a'),
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    const submit = page.locator('[data-auth-form] button[type="submit"]');
    await expect(submit).toBeVisible();
    await submit.scrollIntoViewIfNeeded();
    const overflowBeforeError = await readPageOverflow(page);
    expect(overflowBeforeError).toBeLessThanOrEqual(1);

    await page.getByLabel('계정').fill('long-account-'.repeat(40));
    await page.getByLabel('비밀번호', { exact: true }).fill('fixture-secret');
    if (mode === 'signup') {
      await page.getByLabel('비밀번호 확인').fill('fixture-secret');
    }
    await submit.click();
    await expect(page.getByRole('alert')).toBeVisible();
    const overflowAfterError = await readPageOverflow(page);
    expect(overflowAfterError).toBeLessThanOrEqual(1);
    await expect(page.locator('[data-auth-form] input').first()).toBeVisible();
  }
});

test('representative product surfaces stay within the viewport across the responsive matrix', async ({
  page,
}) => {
  for (const route of [
    '/app/schedule',
    '/app/customers',
    '/app/customers/customer-tenant-1',
    '/app/events/followup-tenant-1',
    '/app/customers/new',
    '/app/events/new',
  ]) {
    await page.goto(route);
    expect(await readPageOverflow(page)).toBeLessThanOrEqual(1);
    expect(await page.locator('[data-major-surface]').count()).toBeLessThanOrEqual(2);
    expect(await page.locator('[data-adaptive-pane]').count()).toBeLessThanOrEqual(2);
  }
});

test('representative long content wraps without horizontal overflow at 200% text scale', async ({
  page,
}) => {
  const longName = '아주 긴 고객 이름 '.repeat(40);
  const longMemo = '고객 메모가 화면 너비보다 길어도 문서 폭을 늘리지 않아야 합니다. '.repeat(30);
  const longEventText =
    '일정 설명과 메모가 길어도 입력 체인은 화면 안에서 줄바꿈되어야 합니다. '.repeat(30);

  const cases = [
    { route: '/app/schedule', primary: '[data-schedule-add-event]' },
    { route: '/app/customers', primary: '[data-customer-add-cta]' },
    { route: '/app/customers/customer-tenant-1', primary: '[data-add-event]' },
    { route: '/app/events/followup-tenant-1', primary: '[data-event-action="edit"]' },
    { route: '/app/customers/new', primary: '[data-customer-form-submit]' },
    { route: '/app/events/new', primary: '[data-event-form-submit]' },
  ] as const;

  for (const { route, primary } of cases) {
    await page.goto(route);
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));

    if (route === '/app/customers/new') {
      await page.locator('[data-customer-field="displayName"]').fill(longName);
      await page.locator('[data-customer-field="customerMemo"]').fill(longMemo);
    }
    if (route === '/app/events/new') {
      await page.locator('[data-customer-selector-option]').first().click();
      await page.locator('[data-event-field="descriptor"]').fill(longEventText);
      await page.locator('[data-event-field="note"]').fill(longMemo);
    }

    await expect(page.locator(primary)).toBeVisible();
    await page.locator(primary).scrollIntoViewIfNeeded();
    expect(await readPageOverflow(page)).toBeLessThanOrEqual(1);
    expect(
      await page.locator('main').evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
  }

  await page.goto('/app/customers/new');
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));
  await page.locator('[data-customer-field="displayName"]').fill('');
  await page.locator('[data-customer-form]').evaluate((element) => {
    (element as HTMLFormElement).noValidate = true;
  });
  await page.locator('[data-customer-form-submit]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await readPageOverflow(page)).toBeLessThanOrEqual(1);

  await page.goto('/app/events/new');
  await page.locator('[data-customer-selector-option]').first().click();
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));
  await page.locator('[data-event-field="scheduledAt"]').fill('');
  await page.locator('[data-event-form]').evaluate((element) => {
    (element as HTMLFormElement).noValidate = true;
  });
  await page.locator('[data-event-form-submit]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await readPageOverflow(page)).toBeLessThanOrEqual(1);
});

test('Auth keyboard order has no positive tabindex and reaches every primary control', async ({
  page,
}) => {
  await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
  await page.goto('/auth/login');

  const positiveTabIndexes = await page
    .locator('[tabindex]')
    .evaluateAll((elements) =>
      elements
        .map((element) => Number(element.getAttribute('tabindex')))
        .filter((tabIndex) => Number.isInteger(tabIndex) && tabIndex > 0),
    );
  expect(positiveTabIndexes).toEqual([]);

  await page.locator('[data-auth-surface] header a').focus();
  const expectedTabOrder = [
    '[data-auth-surface] header button',
    '[data-auth-form-mode] > div:first-child a',
    '#login-account',
    '#login-secret',
    '[data-auth-form] button[type="submit"]',
    '[data-auth-form] ~ p a',
  ];
  for (const selector of expectedTabOrder) {
    await page.keyboard.press('Tab');
    await expect(page.locator(selector)).toBeFocused();
  }
});

test('reduced motion removes the existing event highlight animation and nested interactive controls stay valid', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/schedule');

  const animation = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'event-highlight';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const result = {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
    };
    probe.remove();
    return result;
  });
  expect(animation).toEqual({ animationName: 'none', animationDuration: '0s' });
  expect(await page.locator('main button a, main a button').count()).toBe(0);
});
