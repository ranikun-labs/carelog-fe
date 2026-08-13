import { expect, test, useEmptyApplicationSeed } from './fixtures';

test('Schedule creates one PLANNED event through the canonical EventForm', async ({ page }) => {
  await page.goto('/app/schedule');
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-11"][aria-current="date"]'),
  ).toHaveCount(1);
  await page.locator('[data-week-strip] button[data-date-key="2026-08-15"]').click();
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-15"][aria-current="date"]'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: '+ 일정', exact: true }).click();

  await expect(page).toHaveURL('/app/events/new');
  await expect(page.locator('[data-customer-selector]')).toBeVisible();
  await page.getByRole('button', { name: '박세입', exact: true }).click();

  const form = page.locator('[data-event-form]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[value="OCCURRED"]')).toHaveCount(0);
  await expect(form.locator('[data-event-field="scheduledAt"]')).toHaveValue(
    /^2026-08-15T\d{2}:\d{2}$/,
  );
  await form.locator('[data-event-field="descriptor"]').fill('Schedule에서 만든 일정');
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-15T10:30');
  await form.locator('[data-event-form-submit]').dblclick();

  await expect(page).toHaveURL('/app/schedule');
  const createdRows = page
    .locator('[data-agenda-row]')
    .filter({ hasText: 'Schedule에서 만든 일정' });
  await expect(createdRows).toHaveCount(1);
  await expect(createdRows.first()).toHaveAttribute('data-event-status', 'PLANNED');
  await expect(
    page.locator('[data-agenda-section][data-date-key="2026-08-15"]').locator('[data-agenda-row]'),
  ).toHaveCount(2);
  await expect(
    page.locator('[data-event-id]').filter({ hasText: 'Schedule에서 만든 일정' }),
  ).toHaveCount(1);
});

test('Schedule Customer=0 enters the existing first-customer flow from + 일정', async ({
  page,
}) => {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/schedule');

  await page.getByRole('button', { name: '+ 일정', exact: true }).click();
  await expect(page).toHaveURL('/app/events/new');
  const eventCreatePage = page.locator('[data-event-create-page]');
  await expect(eventCreatePage.getByText('먼저 고객을 추가해 주세요')).toBeVisible();
  await eventCreatePage.getByRole('link', { name: '첫 고객 추가' }).click();
  await expect(page).toHaveURL('/app/customers/new');
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
});

test('Schedule-origin cancel preserves the selected date and scroll context', async ({ page }) => {
  test.skip(
    page.viewportSize()?.width !== 1024,
    'context preservation uses the single-surface target',
  );

  await page.goto('/app/schedule');
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-11"][aria-current="date"]'),
  ).toHaveCount(1);
  await page.locator('[data-week-strip] button[data-date-key="2026-08-15"]').click();
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-15"][aria-current="date"]'),
  ).toHaveCount(1);
  const targetSection = page.locator('[data-agenda-section][data-date-key="2026-08-15"]');
  await targetSection.scrollIntoViewIfNeeded();
  const scheduleSurface = page.locator('[data-major-surface="schedule"]');
  const scrollBefore = await scheduleSurface.evaluate((element) => element.scrollTop);
  await page
    .getByRole('button', { name: '+ 일정', exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await page.getByRole('button', { name: '일정으로 돌아가기' }).click();

  await expect(page).toHaveURL('/app/schedule');
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-15"][aria-current="date"]'),
  ).toHaveCount(1);
  await expect
    .poll(() => scheduleSurface.evaluate((element) => element.scrollTop))
    .toBeGreaterThanOrEqual(scrollBefore);
});

test('Schedule-origin composition keeps one surface until desktop two-pane', async ({ page }) => {
  const width = page.viewportSize()?.width;
  await page.goto('/app/schedule');
  await page.getByRole('button', { name: '+ 일정', exact: true }).click();

  if (width && width >= 1180) {
    await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
      'data-adaptive-mode',
      'two-pane',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
    await expect(page.locator('[data-major-surface]')).toHaveCount(2);
  } else {
    await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
      'data-adaptive-mode',
      'single',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(1);
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);
  }
});

test('Customer selector supports keyboard movement and visible selection semantics', async ({
  page,
}) => {
  await page.goto('/app/events/new');
  const options = page.locator('[data-customer-selector-option]');
  await expect(options).toHaveCount(2);
  await options.first().focus();
  await options.first().press('ArrowDown');
  await expect(options.nth(1)).toBeFocused();
  await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await options.nth(1).press('Enter');
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await expect(page.locator('[data-event-create-page]')).toHaveAttribute(
    'data-event-create-selected-customer-id',
    'customer-patient-1',
  );
});

test('Schedule-origin draft survives the single-to-two-pane transition', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto('/app/schedule');
  await page.getByRole('button', { name: '+ 일정', exact: true }).click();
  await page.getByRole('button', { name: '박세입', exact: true }).click();

  const form = page.locator('[data-event-form]');
  const note = form.locator('[data-event-field="note"]');
  await form.locator('[data-event-field="descriptor"]').fill('적응형 일정 초안');
  await note.fill('적응형 메모');
  await note.focus();
  await page.setViewportSize({ width: 1180, height: 800 });

  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'two-pane',
  );
  await expect(page.locator('[data-event-field="descriptor"]')).toHaveValue('적응형 일정 초안');
  await expect(page.locator('[data-event-field="note"]')).toHaveValue('적응형 메모');
  await expect(page.locator('[data-event-field="note"]')).toBeFocused();
});
