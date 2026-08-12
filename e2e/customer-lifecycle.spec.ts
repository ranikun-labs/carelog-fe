import { expect, test, type Page } from './fixtures';

async function createFirstCustomer(page: Page, name: string, memo: string) {
  await page.goto('/app/customers?customerSeed=empty');
  await page.getByRole('link', { name: '첫 고객 추가' }).click();
  await expect(page).toHaveURL('/app/customers/new');

  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill(name);
  await form.locator('[data-customer-field="customerMemo"]').fill(memo);
  await form.locator('[data-customer-form-submit]').click();
  await expect(page).toHaveURL(/\/app\/customers\/customer-[^/]+$/);
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    /^customer-/,
  );
}

test('first-use creates a customer, resolves detail, and continues into the existing EventForm', async ({
  page,
}) => {
  await page.goto('/app/customers?customerSeed=empty');
  await expect(page.locator('[data-customers-empty]')).toBeVisible();
  await expect(page.getByRole('link', { name: '첫 고객 추가' })).toHaveAttribute(
    'href',
    '/app/customers/new',
  );

  await page.getByRole('link', { name: '첫 고객 추가' }).click();
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('첫 E2E 고객');
  await form.locator('[data-customer-field="customerMemo"]').fill('첫 명시 메모');
  await form.locator('[data-customer-form-submit]').click();

  await expect(page.getByRole('heading', { name: '첫 E2E 고객' })).toBeVisible();
  await expect(page.getByTestId('customer-memo-copy')).toHaveText('첫 명시 메모');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toHaveCount(0);

  await expect(page.locator('[data-add-event]')).toBeEnabled();
  await page.locator('[data-add-event]').click();
  const eventForm = page.locator('[data-event-form]');
  await expect(eventForm).toBeVisible();
  await eventForm.locator('[data-event-field="descriptor"]').fill('첫 일정');
  await eventForm.locator('[data-event-field="scheduledAt"]').fill('2026-08-15T10:00');
  await eventForm.locator('[data-event-form-submit]').click();

  await expect(page.locator('[data-upcoming-primary]')).toContainText('첫 일정');
  await expect(page.locator('[data-customer-history-item]')).toHaveCount(0);
});

test('customer edit keeps the same runtime identity and propagates to list and detail', async ({
  page,
}) => {
  await createFirstCustomer(page, '수정 전 고객', '수정 전 메모');
  const initialId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(initialId).toMatch(/^customer-/);

  await page.locator('[data-add-event]').click();
  const eventForm = page.locator('[data-event-form]');
  await eventForm.locator('[data-event-field="descriptor"]').fill('연결된 일정');
  await eventForm.locator('[data-event-field="scheduledAt"]').fill('2026-08-16T10:00');
  await eventForm.locator('[data-event-form-submit]').click();
  await expect(page.locator('[data-upcoming-primary]')).toContainText('연결된 일정');

  await page.getByRole('link', { name: '고객 정보 수정' }).click();
  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('수정 후 고객');
  await form.locator('[data-customer-field="customerMemo"]').fill('수정 후 메모');
  await form.locator('[data-customer-form-submit]').click();

  await expect(page.getByRole('heading', { name: '수정 후 고객' })).toBeVisible();
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    initialId!,
  );
  await expect(page.getByTestId('customer-memo-copy')).toHaveText('수정 후 메모');
  await expect(page.locator('[data-upcoming-primary]')).toContainText('연결된 일정');
  await expect(page.getByText('수정 전 고객')).toHaveCount(0);

  await page.getByRole('button', { name: '고객 목록으로 돌아가기' }).click();
  await expect(
    page.locator('[data-customer-card][data-customer-id="' + initialId + '"]'),
  ).toContainText('수정 후 고객');
  await expect(page.getByText('수정 전 고객')).toHaveCount(0);
});

test('Schedule Customer=0 offers the first-customer entry without using the event-empty contract', async ({
  page,
}) => {
  await page.goto('/app/schedule?customerSeed=empty');

  await expect(page.getByText('먼저 고객을 추가해 주세요')).toBeVisible();
  await expect(page.getByText('아직 일정이 없습니다')).toHaveCount(0);
  await expect(page.locator('[data-schedule-first-customer-cta]')).toHaveAttribute(
    'href',
    '/app/customers/new',
  );
  await page.locator('[data-schedule-first-customer-cta]').click();
  await expect(page).toHaveURL('/app/customers/new');
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
});
