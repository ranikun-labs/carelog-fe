import { expect, test } from '@playwright/test';

test('Customer Detail creates planned and immediate OCCURRED events into the shared projections', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');

  await page.getByRole('button', { name: '일정 추가' }).click();
  const plannedForm = page.locator('[data-event-form]');
  await plannedForm.locator('[data-event-field="descriptor"]').fill('새 예정 상담');
  await plannedForm.locator('[data-event-field="scheduledAt"]').fill('2026-08-12T09:00');
  await plannedForm.getByRole('button', { name: '일정 추가', exact: true }).click();

  await expect(page.locator('[data-upcoming-primary]')).toContainText('새 예정 상담');
  await expect(
    page.locator('[data-customer-history-item]').filter({ hasText: '새 예정 상담' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: '일정 추가' }).click();
  const occurredForm = page.locator('[data-event-form]');
  await occurredForm.locator('input[value="OCCURRED"]').check();
  await occurredForm.locator('[data-event-field="descriptor"]').fill('즉시 기록 상담');
  await occurredForm.getByRole('button', { name: '일정 추가', exact: true }).click();

  await expect(
    page.locator('[data-customer-history-item]').filter({ hasText: '즉시 기록 상담' }),
  ).toHaveCount(1);
  await expect(page.locator('[data-upcoming-primary]')).not.toContainText('즉시 기록 상담');
});

test('reschedule relocates one Event ID, then occurrence preserves the original scheduled time', async ({
  page,
}) => {
  await page.goto('/app/events/followup-tenant-1');

  await page.getByRole('button', { name: '수정' }).click();
  const form = page.locator('[data-event-form]');
  await form.locator('[data-event-field="scheduledAt"]').fill('2026-08-25T15:00');
  await form.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page).toHaveURL('/app/schedule');
  const relocatedRow = page.locator('[data-event-id="followup-tenant-1"]');
  await expect(relocatedRow).toHaveCount(1);
  await expect(relocatedRow).toHaveAttribute('data-event-status', 'PLANNED');
  await expect(page.locator('[data-event-highlighted="true"]')).toHaveCount(1);

  await relocatedRow.getByRole('button').click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await page.getByRole('button', { name: '기록 완료' }).click();

  await expect(page).toHaveURL('/app/schedule');
  await expect(page.locator('[data-event-id="followup-tenant-1"]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await page
    .locator('[data-event-id="followup-tenant-1"]')
    .getByRole('button')
    .click({
      position: { x: 24, y: 20 },
    });
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.locator('[data-event-detail] time')).toHaveCount(2);
  await expect(page.locator('[data-event-detail] time').first()).toHaveAttribute(
    'datetime',
    '2026-08-25T15:00:00+09:00',
  );
});

test('planned cancel keeps the same record in Customer History and out of Upcoming', async ({
  page,
}) => {
  await page.goto('/app/events/followup-tenant-1');
  await page.getByRole('button', { name: '취소 처리' }).click();

  await expect(page).toHaveURL('/app/schedule');
  const cancelledRow = page.locator('[data-event-id="followup-tenant-1"]');
  await expect(cancelledRow).toHaveCount(1);
  await expect(cancelledRow).toHaveAttribute('data-event-status', 'CANCELLED');

  await cancelledRow.getByRole('link', { name: '박세입' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(
    page.locator('[data-customer-history-item][data-event-id="followup-tenant-1"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-customer-history-item][data-event-id="followup-tenant-1"]'),
  ).toHaveAttribute('data-event-status', 'CANCELLED');
  await expect(page.locator('[data-upcoming-primary]')).toHaveCount(0);
});
