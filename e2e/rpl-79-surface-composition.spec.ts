import { expect, test, useEmptyApplicationSeed, type Page } from './fixtures';

function isDesktopTarget(width: number | undefined) {
  return width === 1180 || width === 1440;
}

async function readBox(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x), width: Math.round(rect.width) };
  });
}

test('desktop no-secondary roots reclaim the adaptive area and return after selection', async ({
  page,
}) => {
  test.skip(!isDesktopTarget(page.viewportSize()?.width), 'desktop composition targets only');

  for (const [root, trigger, backLabel] of [
    ['schedule', '[data-agenda-row] button', '일정으로 돌아가기'],
    ['customers', '[data-customer-card] a', '고객 목록으로 돌아가기'],
  ] as const) {
    await page.goto(`/app/${root}`);

    const host = page.locator('[data-adaptive-host]');
    await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
    await expect(host).toHaveAttribute('data-is-co-visible', 'false');
    await expect(page.locator('[data-adaptive-composition]')).toHaveAttribute(
      'data-adaptive-composition-layout',
      'single',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(1);
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);

    const compositionBox = await readBox(page, '[data-adaptive-composition]');
    const paneBox = await readBox(page, '[data-adaptive-pane="master"]');
    const surfaceBox = await readBox(page, '[data-major-surface]');
    expect(paneBox.width).toBe(compositionBox.width);
    expect(surfaceBox.width).toBe(compositionBox.width);

    await page.locator(trigger).first().click();
    await expect(host).toHaveAttribute('data-is-co-visible', 'true');
    await expect(page.locator('[data-adaptive-composition]')).toHaveAttribute(
      'data-adaptive-composition-layout',
      'two-pane',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
    await expect(page.locator('[data-major-surface]')).toHaveCount(2);

    await page.getByRole('button', { name: backLabel }).click();
    await expect(host).toHaveAttribute('data-is-co-visible', 'false');
    await expect(page.locator('[data-adaptive-composition]')).toHaveAttribute(
      'data-adaptive-composition-layout',
      'single',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(1);
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);
    const returnedPaneBox = await readBox(page, '[data-adaptive-pane="master"]');
    expect(returnedPaneBox.width).toBe(compositionBox.width);
  }
});

test('desktop empty Schedule and Customer roots do not render an empty secondary half', async ({
  page,
}) => {
  test.skip(!isDesktopTarget(page.viewportSize()?.width), 'desktop composition targets only');
  await useEmptyApplicationSeed(page);

  for (const route of ['/app/schedule', '/app/customers']) {
    await page.goto(route);
    await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
      'data-adaptive-mode',
      'two-pane',
    );
    await expect(page.locator('[data-adaptive-composition]')).toHaveAttribute(
      'data-adaptive-composition-layout',
      'single',
    );
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);

    const compositionBox = await readBox(page, '[data-adaptive-composition]');
    const surfaceBox = await readBox(page, '[data-major-surface]');
    expect(surfaceBox.width).toBe(compositionBox.width);
  }
});

test('1024 separates scan allocation from readable detail and form allocation', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1024, 'tablet geometry target only');

  await page.goto('/app/schedule');
  await expect(page.locator('[data-adaptive-single-frame]')).toHaveAttribute(
    'data-adaptive-single-frame-policy',
    'scan',
  );
  const scheduleFrame = await readBox(page, '[data-adaptive-single-frame]');
  const scheduleSurface = await readBox(page, '[data-major-surface="schedule"]');
  expect(scheduleFrame.width).toBe(944);
  expect(scheduleSurface.width).toBe(scheduleFrame.width);

  await page.goto('/app/customers');
  const customerFrame = await readBox(page, '[data-adaptive-single-frame]');
  const customerSurface = await readBox(page, '[data-major-surface="customer-list"]');
  expect(customerFrame.width).toBe(944);
  expect(customerSurface.width).toBe(customerFrame.width);

  await page.goto('/app/customers/customer-tenant-1');
  await expect(page.locator('[data-adaptive-single-frame]')).toHaveAttribute(
    'data-adaptive-single-frame-policy',
    'readable',
  );
  const detailFrame = await readBox(page, '[data-adaptive-single-frame]');
  const detailContent = await readBox(page, '[data-adaptive-surface-content="readable"]');
  expect(detailFrame.width).toBe(560);
  expect(detailContent.width).toBeLessThan(detailFrame.width);

  await page.locator('[data-add-event]').click();
  const eventForm = await readBox(page, '[data-event-form]');
  const submit = await readBox(page, '[data-event-form-submit]');
  expect(eventForm.width).toBeLessThan(detailFrame.width);
  expect(submit.width).toBeLessThan(eventForm.width);
});

test('1440 Event create and edit actions remain bounded and right aligned', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1440, 'desktop density target only');

  async function expectBoundedAction() {
    const form = await readBox(page, '[data-event-form]');
    const submit = await readBox(page, '[data-event-form-submit]');
    expect(submit.width).toBeLessThan(form.width);
    expect(submit.x).toBeGreaterThan(form.x + form.width / 2);
  }

  await page.goto('/app/customers/customer-tenant-1');
  await page.locator('[data-add-event]').click();
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await expectBoundedAction();

  await page.goto('/app/events/followup-tenant-1');
  await page.locator('[data-event-action="edit"]').click();
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await expectBoundedAction();
});
