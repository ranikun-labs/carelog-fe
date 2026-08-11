import { expect, test } from '@playwright/test';

test('schedule agenda exposes the canonical week, overdue cue, and event rows', async ({
  page,
}) => {
  await page.goto('/app/schedule');

  await expect(page.getByRole('heading', { name: '일정', exact: true })).toBeVisible();
  await expect(page.locator('[data-week-strip] button')).toHaveCount(7);
  await expect(page.locator('[data-event-dot]')).not.toHaveCount(0);
  await expect(page.locator('[data-agenda-section]')).not.toHaveCount(0);

  const overdueCue = page.locator('[data-overdue-cue]');
  await expect(overdueCue).toBeVisible();
  await expect(overdueCue).not.toHaveClass(/sticky/);
  await expect(overdueCue.getByText('정리 필요')).toBeVisible();
});

test('agenda row and customer target open their separate destinations', async ({ page }) => {
  await page.goto('/app/schedule');

  const transitionedRow = page.locator('[data-event-id="event-tenant-transitioned"]');
  await transitionedRow.getByRole('link', { name: '박세입' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');

  await page.goto('/app/schedule');
  await page
    .locator('[data-event-id="event-tenant-transitioned"]')
    .click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL('/app/events/event-tenant-transitioned');
  await expect(page.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
  await expect(page.getByText('예정')).toHaveCount(1);
  await expect(page.getByText('실제')).toHaveCount(1);
  await expect(page.locator('[data-event-detail] time')).toHaveCount(2);
});

test('event detail preserves cancelled schedule context without inventing occurrence', async ({
  page,
}) => {
  await page.goto('/app/events/event-tenant-cancelled');

  await expect(page.getByRole('heading', { name: '현장 확인 일정' })).toBeVisible();
  await expect(page.getByText('취소됨')).toBeVisible();
  await expect(page.getByText('예정')).toBeVisible();
  await expect(page.getByText('실제')).not.toBeVisible();
  await expect(page.locator('[data-event-detail] time')).toHaveCount(1);
});
