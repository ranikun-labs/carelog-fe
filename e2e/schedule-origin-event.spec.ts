import { expect, test, useEmptyApplicationSeed, type Page } from './fixtures';

async function prepareScheduleCreate(page: Page, descriptor: string) {
  await page.goto('/app/schedule');
  await page.locator('[data-week-strip] button[data-date-key="2026-08-15"]').click();
  await page.getByRole('button', { name: '+ 일정', exact: true }).click();
  await page.getByRole('button', { name: '박세입', exact: true }).click();

  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="descriptor"]').fill(descriptor);
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-15T10:30');
  const submitBox = await form.locator('[data-event-form-submit]').boundingBox();
  if (!submitBox) throw new Error('Schedule EventForm submit button has no bounding box.');

  return {
    x: submitBox.x + submitBox.width / 2,
    y: submitBox.y + submitBox.height / 2,
  };
}

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
  await expect(page.locator('[data-event-detail-page]')).toHaveCount(0);
  const createdRows = page
    .locator('[data-agenda-row]')
    .filter({ hasText: 'Schedule에서 만든 일정' });
  await expect(createdRows).toHaveCount(1);
  await expect(createdRows.first()).toHaveAttribute('data-event-status', 'PLANNED');
  const createdEventId = await createdRows.first().getAttribute('data-event-id');
  expect(createdEventId).toBeTruthy();
  await expect(
    page.locator('[data-agenda-section][data-date-key="2026-08-15"] [data-agenda-row]'),
  ).toHaveCount(2);
  await expect(
    page.locator(
      `[data-agenda-section][data-date-key="2026-08-15"] [data-event-id="${createdEventId}"]`,
    ),
  ).toHaveCount(1);
  await expect(page.locator(`[data-event-id="${createdEventId}"]`)).toHaveCount(1);
});

test('Schedule create ignores bounded pointer retarget probes at mobile and desktop widths', async ({
  page,
}) => {
  const width = page.viewportSize()?.width;
  test.skip(width !== 375 && width !== 1180, 'bounded retarget probes target 375px and 1180px');

  for (const delay of [75, 100, 150]) {
    const descriptor = `Schedule race probe ${width} ${delay}ms`;
    const submitPoint = await prepareScheduleCreate(page, descriptor);

    await page.mouse.click(submitPoint.x, submitPoint.y);
    await expect(page).toHaveURL('/app/schedule');
    await page.waitForTimeout(delay);
    await page.mouse.click(submitPoint.x, submitPoint.y);

    await expect(page).toHaveURL('/app/schedule');
    await expect(page.locator('[data-event-detail-page]')).toHaveCount(0);
    const createdRows = page.locator('[data-agenda-row]').filter({ hasText: descriptor });
    await expect(createdRows).toHaveCount(1);
    const createdEventId = await createdRows.getAttribute('data-event-id');
    expect(createdEventId).toBeTruthy();
    await expect(
      page.locator(
        `[data-agenda-section][data-date-key="2026-08-15"] [data-event-id="${createdEventId}"]`,
      ),
    ).toHaveCount(1);

    if (width === 1180) {
      await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
        'data-adaptive-mode',
        'two-pane',
      );
    }
    expect(await page.locator('[data-major-surface]').count()).toBeLessThanOrEqual(2);
  }
});

test('Schedule create leaves a normal next Event activation usable', async ({ page }) => {
  const width = page.viewportSize()?.width;
  test.skip(width !== 375 && width !== 1180, 'post-transition activation targets 375px and 1180px');

  const submitPoint = await prepareScheduleCreate(page, `Schedule normal click ${width}`);
  await page.mouse.click(submitPoint.x, submitPoint.y);
  await expect(page).toHaveURL('/app/schedule');

  await page
    .locator('[data-agenda-row][data-event-id="followup-tenant-1"]')
    .getByRole('button')
    .click();
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );
});

test('Schedule create suppresses repeated Enter retarget and releases keyboard navigation', async ({
  page,
}) => {
  const width = page.viewportSize()?.width;
  test.skip(width !== 375 && width !== 1180, 'keyboard retarget targets 375px and 1180px');

  await page.goto('/app/schedule');
  await page.getByRole('button', { name: '+ 일정', exact: true }).click();
  await page.getByRole('button', { name: '박세입', exact: true }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="descriptor"]').fill(`Schedule keyboard ${width}`);
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-15T10:30');
  const submit = form.locator('[data-event-form-submit]');
  await submit.focus();
  await submit.press('Enter');
  await expect(page).toHaveURL('/app/schedule');

  const unrelatedEvent = page
    .locator('[data-agenda-row][data-event-id="followup-tenant-1"]')
    .getByRole('button');
  await unrelatedEvent.focus();
  await unrelatedEvent.press('Enter');
  await expect(page).toHaveURL('/app/schedule');
  await expect(page.locator('[data-event-detail-page]')).toHaveCount(0);

  await unrelatedEvent.focus();
  await unrelatedEvent.press('Enter');
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
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
