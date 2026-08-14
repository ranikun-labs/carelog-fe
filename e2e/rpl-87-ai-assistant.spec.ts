import { expect, test, useAssistantAdapter } from './fixtures';

test('Customer entry keeps the canonical memo unchanged until explicit save', async ({ page }) => {
  await useAssistantAdapter(page);
  await page.goto('/app/customers/customer-tenant-1');

  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();
  await expect(page.locator('[data-assistant-page]')).toBeVisible();
  await expect(page.locator('[data-assistant-context]')).toContainText('박세입');

  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-loading]')).toBeVisible();
  await expect(page.locator('[data-assistant-result]')).toBeVisible();

  await page.locator('[data-assistant-add-to-memo]').click();
  await page.locator('[data-assistant-memo]').fill('저장 전에 사용자가 확인한 고객 메모');
  await expect(page.locator('[data-testid="customer-memo-copy"]')).toHaveCount(0);
  await page.locator('[data-assistant-memo-cancel]').click();
  await page.getByRole('button', { name: '원래 화면으로 돌아가기' }).click();
  await expect(page.locator('[data-customer-detail-page]')).toBeVisible();
  await expect(page.locator('[data-testid="customer-memo-copy"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();
  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-result]')).toBeVisible();
  await page.locator('[data-assistant-add-to-memo]').click();
  await page.locator('[data-assistant-memo]').fill('저장한 고객 메모');
  await page.locator('[data-assistant-memo-save]').click();
  await expect(page.locator('[data-assistant-save-confirmation]')).toBeFocused();
  await page.getByRole('button', { name: '원래 화면으로 돌아가기' }).click();
  await expect(page.locator('[data-testid="customer-memo-copy"]')).toHaveText('저장한 고객 메모');
});

test('PLANNED Event entry preserves status and scheduled time through memo save', async ({
  page,
}) => {
  await useAssistantAdapter(page);
  await page.goto('/app/events/followup-tenant-1');

  const beforeDetail = page.locator('[data-event-detail]');
  const statusBefore = await beforeDetail.getAttribute('data-event-status');
  const timeBefore = await beforeDetail
    .locator('time')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('dateTime')));

  await page.getByRole('button', { name: '미리 준비하기', exact: true }).click();
  await expect(page.locator('[data-assistant-context]')).toContainText('예정 일정');
  await expect(page.locator('[data-assistant-context]')).toContainText('박세입');
  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-result]')).toBeVisible();
  await page.locator('[data-assistant-add-to-memo]').click();
  await page.locator('[data-assistant-memo]').fill('예정 일정에서 확인한 메모');
  await page.locator('[data-assistant-memo-save]').click();
  await expect(page.locator('[data-assistant-save-confirmation]')).toBeFocused();
  await page.getByRole('button', { name: '원래 화면으로 돌아가기' }).click();

  const afterDetail = page.locator('[data-event-detail]');
  await expect(afterDetail).toHaveAttribute('data-event-status', statusBefore!);
  await expect(afterDetail.locator('time')).toHaveCount(timeBefore.length);
  const timeAfter = await afterDetail
    .locator('time')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('dateTime')));
  expect(timeAfter).toEqual(timeBefore);
  await expect(afterDetail).toContainText('예정 일정에서 확인한 메모');
});

test('OCCURRED Event entry preserves status and occurred time through memo save', async ({
  page,
}) => {
  await useAssistantAdapter(page);
  await page.goto('/app/events/event-tenant-transitioned');

  const beforeDetail = page.locator('[data-event-detail]');
  const timeBefore = await beforeDetail
    .locator('time')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('dateTime')));

  await page.getByRole('button', { name: '기록에 대해 질문', exact: true }).click();
  await expect(page.locator('[data-assistant-context]')).toContainText('기록된 일정');
  await expect(page.locator('[data-assistant-context]')).toContainText('박세입');
  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-result]')).toBeVisible();
  await page.locator('[data-assistant-add-to-memo]').click();
  await page.locator('[data-assistant-memo]').fill('기록에서 확인한 메모');
  await page.locator('[data-assistant-memo-save]').click();
  await page.getByRole('button', { name: '원래 화면으로 돌아가기' }).click();

  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.locator('[data-event-detail] time')).toHaveCount(timeBefore.length);
  await expect(page.locator('[data-event-detail]')).toContainText('기록에서 확인한 메모');
});

test('CANCELLED Event has no Assistant entry', async ({ page }) => {
  await useAssistantAdapter(page);
  await page.goto('/app/events/event-tenant-cancelled');
  await expect(page.getByRole('button', { name: '미리 준비하기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '기록에 대해 질문', exact: true })).toHaveCount(0);
});

test('Assistant remains one bounded surface or two co-visible surfaces at each target width', async ({
  page,
}) => {
  await useAssistantAdapter(page);
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();

  const width = page.viewportSize()?.width ?? 0;
  const host = page.locator('[data-adaptive-host]');
  if (width >= 1100) {
    await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
    await expect(page.locator('[data-adaptive-composition]')).toHaveAttribute(
      'data-adaptive-composition-layout',
      'two-pane',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
    await expect(page.locator('[data-major-surface]')).toHaveCount(2);
  } else {
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(page.locator('[data-adaptive-single-frame]')).toHaveAttribute(
      'data-adaptive-single-frame-policy',
      'readable',
    );
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(1);
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);
  }
});

test('deterministic error keeps the Assistant context and connects retry to the adapter', async ({
  page,
}) => {
  await useAssistantAdapter(page, { latencyMs: 80, scenario: 'error' });
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();
  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-error]')).toBeVisible();
  await expect(page.locator('[data-assistant-context]')).toContainText('박세입');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('[data-assistant-error]')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/assistant$/);
});
