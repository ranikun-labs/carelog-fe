import { expect, test, type Page, useEmptyApplicationSeed } from './fixtures';

async function createFirstCustomer(page: Page, name: string, memo: string) {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/customers');
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
  await useEmptyApplicationSeed(page);
  await page.goto('/app/customers');
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

test('customer create accepts one mutation for a double-click submit', async ({ page }) => {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/customers');
  await page.getByRole('link', { name: '첫 고객 추가' }).click();

  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('중복 방지 고객');
  await form.locator('[data-customer-form-submit]').dblclick();

  await expect(page).toHaveURL(/\/app\/customers\/customer-[^/]+$/);
  const createdId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(createdId).toMatch(/^customer-/);

  await page.getByRole('button', { name: '고객 목록으로 돌아가기' }).click();
  const cards = page.locator('[data-customer-card]');
  await expect(cards).toHaveCount(1);
  expect(await cards.evaluateAll((items) => items.map((item) => item.dataset.customerId))).toEqual([
    createdId,
  ]);
});

test('customer edit keeps one identity under a double-click submit', async ({ page }) => {
  await createFirstCustomer(page, '중복 수정 전', '기존 메모');
  const initialId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(initialId).toMatch(/^customer-/);

  await page.getByRole('link', { name: '고객 정보 수정' }).click();
  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('중복 수정 후');
  await form.locator('[data-customer-form-submit]').dblclick();

  await expect(page).toHaveURL(new RegExp(`/app/customers/${initialId}$`));
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    initialId!,
  );
  await expect(page.getByRole('heading', { name: '중복 수정 후' })).toBeVisible();
});

test('customer edit draft survives adaptive remounts and cancel leaves canonical state unchanged', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await createFirstCustomer(page, '적응형 이전 이름', '적응형 이전 메모');
  const initialId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(initialId).toMatch(/^customer-/);

  await page.getByRole('link', { name: '고객 정보 수정' }).click();
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'single',
  );
  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('적응형 새 이름');
  const memo = form.locator('[data-customer-field="customerMemo"]');
  await memo.fill('적응형 새 메모');
  await memo.focus();

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'two-pane',
  );
  await expect(form.locator('[data-customer-field="displayName"]')).toHaveValue('적응형 새 이름');
  await expect(form.locator('[data-customer-field="customerMemo"]')).toHaveValue('적응형 새 메모');
  await expect(page.locator('[data-customer-field="customerMemo"]')).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'single',
  );
  await expect(page.locator('[data-customer-field="displayName"]')).toHaveValue('적응형 새 이름');
  await expect(page.locator('[data-customer-field="customerMemo"]')).toHaveValue('적응형 새 메모');

  await page.getByRole('button', { name: '취소' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/customers/${initialId}$`));
  await expect(page.getByRole('heading', { name: '적응형 이전 이름' })).toBeVisible();
  await expect(page.getByTestId('customer-memo-copy')).toHaveText('적응형 이전 메모');
  await expect(page.getByRole('heading', { name: '적응형 새 이름' })).toHaveCount(0);
});

test('customer create draft survives adaptive remounts and cancel creates no ghost customer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await useEmptyApplicationSeed(page);
  await page.goto('/app/customers/new');
  const form = page.locator('[data-customer-form]');
  await form.locator('[data-customer-field="displayName"]').fill('취소할 고객');
  await form.locator('[data-customer-field="customerMemo"]').fill('취소할 메모');

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(page.locator('[data-customer-field="displayName"]')).toHaveValue('취소할 고객');
  await expect(page.locator('[data-customer-field="customerMemo"]')).toHaveValue('취소할 메모');
  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.locator('[data-customer-field="displayName"]')).toHaveValue('취소할 고객');
  await expect(page.locator('[data-customer-field="customerMemo"]')).toHaveValue('취소할 메모');

  await page.getByRole('button', { name: '취소' }).click();
  await expect(page).toHaveURL('/app/customers');
  await expect(page.locator('[data-customers-empty]')).toBeVisible();
  await expect(page.locator('[data-customer-card]')).toHaveCount(0);
});

test('Schedule Customer=0 offers the first-customer entry without using the event-empty contract', async ({
  page,
}) => {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/schedule');

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

test('production URL queries cannot override customer or event seeds', async ({ page }) => {
  await page.goto('/app/customers?customerSeed=empty');
  await expect(page.getByText('박세입')).toBeVisible();
  await expect(page.locator('[data-customers-empty]')).toHaveCount(0);

  await page.goto('/app/events/event-tenant-transitioned?eventSeed=empty');
  await expect(page.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
});
