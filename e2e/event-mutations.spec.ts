import { expect, test, type Page } from './fixtures';

const FOLLOWUP_EVENT_ID = 'followup-tenant-1';
const ORIGINAL_SCHEDULED_AT = '2026-08-15T10:00:00+09:00';
const RESCHEDULED_AT = '2026-08-25T15:00:00+09:00';
const OVERRIDDEN_OCCURRED_AT = '2026-08-16T09:00:00+09:00';

async function prepareCustomerCreate(page: Page, descriptor: string) {
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="descriptor"]').fill(descriptor);
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-12T09:00');
  const submit = form.locator('[data-event-form-submit]');
  await submit.scrollIntoViewIfNeeded();
  const submitBox = await submit.boundingBox();
  if (!submitBox) throw new Error('Customer EventForm submit button has no bounding box.');

  return {
    x: submitBox.x + submitBox.width / 2,
    y: submitBox.y + submitBox.height / 2,
  };
}

test('Customer-origin create blocks native double activation without retargeting', async ({
  page,
}) => {
  const width = page.viewportSize()?.width;
  const descriptor = `Customer native double ${width}`;
  const submitPoint = await prepareCustomerCreate(page, descriptor);

  await page.mouse.dblclick(submitPoint.x, submitPoint.y, { delay: 100 });

  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(page.locator('[data-event-detail-page]')).toHaveCount(0);
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    'customer-tenant-1',
  );
  const createdLinks = page
    .locator('[data-customer-upcoming] a[href^="/app/events/"]')
    .filter({ hasText: descriptor });
  await expect(createdLinks).toHaveCount(1);
  await expect(
    page.locator('[data-customer-history-item]').filter({ hasText: descriptor }),
  ).toHaveCount(0);
  expect(await page.locator('[data-major-surface]').count()).toBeLessThanOrEqual(2);
});

test('Customer-origin create accepts the first fresh pointer action', async ({ page }) => {
  const width = page.viewportSize()?.width;
  const descriptor = `Customer fresh pointer ${width}`;
  const submitPoint = await prepareCustomerCreate(page, descriptor);

  await page.mouse.click(submitPoint.x, submitPoint.y);
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  const createdLink = page
    .locator('[data-customer-upcoming] a[href^="/app/events/"]')
    .filter({ hasText: descriptor });
  await expect(createdLink).toHaveCount(1);
  const createdHref = await createdLink.getAttribute('href');
  expect(createdHref).toMatch(/^\/app\/events\/event-/);

  await createdLink.click();
  await expect(page).toHaveURL(createdHref!);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute('data-event-status', 'PLANNED');
});

test('Customer-origin create accepts the first fresh Enter sequence', async ({ page }) => {
  const width = page.viewportSize()?.width;
  const descriptor = `Customer fresh Enter ${width}`;
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="descriptor"]').fill(descriptor);
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-12T09:00');
  const submit = form.locator('[data-event-form-submit]');
  await submit.focus();
  await submit.press('Enter');

  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  const createdLink = page
    .locator('[data-customer-upcoming] a[href^="/app/events/"]')
    .filter({ hasText: descriptor });
  await expect(createdLink).toHaveCount(1);
  const createdHref = await createdLink.getAttribute('href');
  await createdLink.focus();
  await createdLink.press('Enter');
  await expect(page).toHaveURL(createdHref!);
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    createdHref!.split('/').at(-1)!,
  );
});

test('Customer-origin return provenance does not leak into Schedule', async ({ page }) => {
  const width = page.viewportSize()?.width;
  const descriptor = `Customer route leak ${width}`;
  const submitPoint = await prepareCustomerCreate(page, descriptor);
  await page.mouse.click(submitPoint.x, submitPoint.y);
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(
    page
      .locator('[data-customer-upcoming] a[href^="/app/events/"]')
      .filter({ hasText: descriptor }),
  ).toHaveCount(1);

  await page.getByRole('link', { name: '일정', exact: true }).first().click();
  await expect(page).toHaveURL('/app/schedule');
  const unrelatedEvent = page
    .locator('[data-agenda-row][data-event-id="followup-tenant-1"]')
    .getByRole('button');
  await unrelatedEvent.click();
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
});

test('Customer-origin return provenance allows the first fresh Enter on Schedule', async ({
  page,
}) => {
  const width = page.viewportSize()?.width;
  const descriptor = `Customer route keyboard ${width}`;
  const submitPoint = await prepareCustomerCreate(page, descriptor);
  await page.mouse.click(submitPoint.x, submitPoint.y);
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(
    page
      .locator('[data-customer-upcoming] a[href^="/app/events/"]')
      .filter({ hasText: descriptor }),
  ).toHaveCount(1);

  await page.getByRole('link', { name: '일정', exact: true }).first().click();
  await expect(page).toHaveURL('/app/schedule');
  const unrelatedEvent = page
    .locator('[data-agenda-row][data-event-id="followup-tenant-1"]')
    .getByRole('button');
  await unrelatedEvent.focus();
  await unrelatedEvent.press('Enter');
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
});

test('PLANNED create resolves the same Event through Customer, Schedule, and Detail', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');

  await page.getByRole('button', { name: '일정 추가' }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="descriptor"]').fill('새 예정 상담');
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-12T09:00');
  await form.getByRole('button', { name: '일정 추가', exact: true }).click();

  const upcoming = page.locator('[data-upcoming-primary]');
  await expect(upcoming).toContainText('새 예정 상담');
  const eventHref = await upcoming.getAttribute('href');
  expect(eventHref).toMatch(/^\/app\/events\/event-/);
  const eventId = eventHref!.split('/').at(-1)!;
  await expect(
    page.locator('[data-customer-history-item]').filter({ hasText: '새 예정 상담' }),
  ).toHaveCount(0);

  await upcoming.click();
  await expect(page).toHaveURL(`/app/events/${eventId}`);
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toHaveCount(0);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute('data-event-status', 'PLANNED');
  await expect(
    page.locator(`[data-event-detail] time[datetime="2026-08-12T09:00:00+09:00"]`),
  ).toHaveCount(1);

  await page.getByRole('button', { name: '일정으로 돌아가기' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(page.locator('[data-customer-detail-page] [data-upcoming-primary]')).toContainText(
    '새 예정 상담',
  );
});

test('immediate OCCURRED create projects one unscheduled Event across Customer, Schedule, and Detail', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');

  await page.getByRole('button', { name: '일정 추가' }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('input[value="OCCURRED"]').check();
  await form.locator('[data-event-field="descriptor"]').fill('즉시 기록 상담');
  await form.locator('[data-event-field="occurredAt"]').fill('2026-08-11T11:00');
  await form.getByRole('button', { name: '일정 추가', exact: true }).click();

  const historyItem = page
    .locator('[data-customer-history-item]')
    .filter({ hasText: '즉시 기록 상담' });
  await expect(historyItem).toHaveCount(1);
  const eventHref = await historyItem.getByRole('link').getAttribute('href');
  expect(eventHref).toMatch(/^\/app\/events\/event-/);
  const eventId = eventHref!.split('/').at(-1)!;
  await expect(page.locator('[data-upcoming-primary]')).not.toContainText('즉시 기록 상담');

  await historyItem.getByRole('link').click();
  await expect(page).toHaveURL(`/app/events/${eventId}`);
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toHaveCount(0);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.locator('[data-event-detail]').getByText('예정')).toHaveCount(0);
  await expect(
    page.locator('[data-event-detail] time[datetime="2026-08-11T11:00:00+09:00"]'),
  ).toHaveCount(1);

  await page.getByRole('button', { name: '일정으로 돌아가기' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(
    page.locator('[data-customer-detail-page] [data-customer-history-item]').filter({
      hasText: '즉시 기록 상담',
    }),
  ).toHaveCount(1);
});

test('reschedule relocates one Event ID, then default occurrence preserves the original scheduled time', async ({
  page,
}) => {
  await page.goto(`/app/events/${FOLLOWUP_EVENT_ID}`);

  await page.getByRole('button', { name: '수정' }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-25T15:00');
  await form.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page).toHaveURL('/app/schedule');
  const relocatedRow = page.locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`);
  await expect(relocatedRow).toHaveCount(1);
  await expect(relocatedRow).toHaveAttribute('data-event-status', 'PLANNED');
  await expect(
    page.locator(
      `[data-agenda-section][data-date-key="2026-08-15"] [data-event-id="${FOLLOWUP_EVENT_ID}"]`,
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      `[data-agenda-section][data-date-key="2026-08-25"] [data-event-id="${FOLLOWUP_EVENT_ID}"]`,
    ),
  ).toHaveCount(1);

  await relocatedRow.getByRole('button').click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL(`/app/events/${FOLLOWUP_EVENT_ID}`);
  await page.getByRole('button', { name: '기록 완료' }).click();
  await expect(page.locator('[data-event-occurrence-confirmation]')).toBeVisible();
  await expect(page.locator('[data-event-occurrence-time]')).toHaveValue('2026-08-25T15:00');
  await page
    .locator('[data-event-occurrence-confirmation]')
    .getByRole('button', { name: '확인' })
    .click();

  await expect(page).toHaveURL('/app/schedule');
  await expect(page.locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`)).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(
    page.locator(
      `[data-agenda-section][data-date-key="2026-08-25"] [data-event-id="${FOLLOWUP_EVENT_ID}"]`,
    ),
  ).toHaveCount(1);
  await expect(page.locator('[data-event-highlighted="true"]')).toHaveCount(1);

  await page
    .locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`)
    .getByRole('button')
    .click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL(`/app/events/${FOLLOWUP_EVENT_ID}`);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.locator('[data-event-detail] time')).toHaveCount(1);
  await expect(page.locator('[data-event-detail] time')).toHaveAttribute(
    'datetime',
    RESCHEDULED_AT,
  );
  await expect(page.getByText('실제')).not.toBeVisible();
});

test('actual occurrence override relocates the same Event, preserves both times, viewport, and transient highlight', async ({
  page,
}) => {
  await page.goto(`/app/events/${FOLLOWUP_EVENT_ID}`);
  await page.getByRole('button', { name: '기록 완료' }).click();

  const confirmation = page.locator('[data-event-occurrence-confirmation]');
  await expect(confirmation).toBeVisible();
  await expect(page.locator('[data-event-occurrence-time]')).toHaveValue('2026-08-15T10:00');
  await page.locator('[data-event-occurrence-time]').fill('2026-08-16T09:00');
  await page
    .locator('[data-event-occurrence-confirmation]')
    .getByRole('button', { name: '확인' })
    .click();

  await expect(page).toHaveURL('/app/schedule');
  const targetRow = page.locator(
    `[data-agenda-section][data-date-key="2026-08-16"] [data-event-id="${FOLLOWUP_EVENT_ID}"]`,
  );
  await expect(targetRow).toHaveCount(1);
  await expect(targetRow).toHaveAttribute('data-event-status', 'OCCURRED');
  await expect(
    page.locator(
      `[data-agenda-section][data-date-key="2026-08-15"] [data-event-id="${FOLLOWUP_EVENT_ID}"]`,
    ),
  ).toHaveCount(0);
  await expect(page.locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`)).toHaveCount(1);
  await expect(page.locator('[data-event-highlighted="true"]')).toHaveCount(1);

  const scrollSurface = page.locator('[data-scroll-surface]');
  await expect
    .poll(async () => {
      const rowBox = await targetRow.boundingBox();
      const surfaceBox = await scrollSurface.boundingBox();
      if (!rowBox || !surfaceBox) return false;
      return (
        rowBox.y >= surfaceBox.y && rowBox.y + rowBox.height <= surfaceBox.y + surfaceBox.height
      );
    })
    .toBe(true);

  await expect(page.locator('[data-event-highlighted="true"]')).toHaveCount(0, {
    timeout: 3000,
  });

  await targetRow.getByRole('button').click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL(`/app/events/${FOLLOWUP_EVENT_ID}`);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.locator('[data-event-detail] time')).toHaveCount(2);
  await expect(page.locator('[data-event-detail] time').first()).toHaveAttribute(
    'datetime',
    ORIGINAL_SCHEDULED_AT,
  );
  await expect(page.locator('[data-event-detail] time').last()).toHaveAttribute(
    'datetime',
    OVERRIDDEN_OCCURRED_AT,
  );
  await expect(
    page.locator('[data-event-detail]').getByText('예정', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-event-detail]').getByText('실제', { exact: true }),
  ).toBeVisible();
});

test('planned cancel keeps the same record in Customer History and out of Upcoming', async ({
  page,
}) => {
  await page.goto(`/app/events/${FOLLOWUP_EVENT_ID}`);
  await page.getByRole('button', { name: '취소 처리' }).click();

  await expect(page).toHaveURL('/app/schedule');
  const cancelledRow = page.locator(`[data-event-id="${FOLLOWUP_EVENT_ID}"]`);
  await expect(cancelledRow).toHaveCount(1);
  await expect(cancelledRow).toHaveAttribute('data-event-status', 'CANCELLED');
  await expect(cancelledRow.locator('time')).toHaveAttribute('datetime', ORIGINAL_SCHEDULED_AT);

  await cancelledRow.getByRole('link', { name: '박세입' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(
    page.locator(`[data-customer-history-item][data-event-id="${FOLLOWUP_EVENT_ID}"]`),
  ).toHaveCount(1);
  await expect(
    page.locator(`[data-customer-history-item][data-event-id="${FOLLOWUP_EVENT_ID}"]`),
  ).toHaveAttribute('data-event-status', 'CANCELLED');
  await expect(page.locator('[data-upcoming-primary]')).toHaveCount(0);
});
