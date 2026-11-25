import { expect, test, type Page } from './fixtures';

function visibleNavLink(page: Page, name: string) {
  return page
    .locator('[data-bottom-navigation]:visible, [data-side-navigation]:visible')
    .getByRole('link', { name, exact: true });
}

async function openCustomerCreate(page: Page) {
  // 앱 안 이동으로 들어와야 뒤로 가기가 SPA 이동(보호 대상)이 된다. page.goto는 문서 전체 이동이다.
  await page.goto('/app/customers');
  await page.locator('[data-customer-add-cta]').click();
  const name = page.locator('[data-customer-field="displayName"]');
  await expect(name).toBeVisible();
  return name;
}

test('customer form: nav, browser back and link all ask first; 계속 작성 keeps value and focus', async ({
  page,
}) => {
  const name = await openCustomerCreate(page);
  await name.fill('작성 중 고객');
  await name.focus();

  // 내비(하단 내비 또는 사이드 레일)
  await visibleNavLink(page, '일정').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('작성 중인 내용이 사라져요')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/customers\/new$/);
  await dialog.getByRole('button', { name: '계속 작성' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue('작성 중 고객');
  await expect(name).toBeFocused();

  // 브라우저 뒤로 가기
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/customers\/new$/);
  await page.getByRole('button', { name: '계속 작성' }).click();
  await expect(name).toHaveValue('작성 중 고객');
  await expect(name).toBeFocused();

  // 나가기: 확정하면 이동하고 임시 초안은 버려진다
  await visibleNavLink(page, '일정').click();
  await page.getByRole('button', { name: '나가기' }).click();
  await expect(page).toHaveURL(/\/app\/schedule$/);
  await page.goto('/app/customers');
  await page.locator('[data-customer-add-cta]').click();
  await expect(page.locator('[data-customer-field="displayName"]')).toHaveValue('');
});

test('customer form: no confirmation when nothing was typed, and saving is not interrupted', async ({
  page,
}) => {
  const name = await openCustomerCreate(page);
  await visibleNavLink(page, '일정').click();
  await expect(page).toHaveURL(/\/app\/schedule$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/app/customers');
  await page.locator('[data-customer-add-cta]').click();
  await page.locator('[data-customer-field="displayName"]').fill('저장할 고객');
  await page.locator('[data-customer-form-submit]').click();
  await expect(page).toHaveURL(/\/app\/customers\/[^/]+$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  void name;
});

test('event form on customer detail asks before the bottom nav or back leaves typed input', async ({
  page,
}) => {
  await page.goto('/app/customers');
  await page.locator('a[href="/app/customers/customer-tenant-1"]').first().click();
  await expect(page).toHaveURL(/\/app\/customers\/customer-tenant-1$/);
  await page.getByRole('button', { name: '일정 추가' }).click();
  const form = page.locator('[data-event-form]');
  await expect(form).toBeVisible();
  const descriptor = form.locator('input[type="text"], textarea').first();
  await descriptor.fill('작성 중 일정 제목');
  await descriptor.focus();

  await visibleNavLink(page, '일정').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '계속 작성' }).click();
  await expect(descriptor).toHaveValue('작성 중 일정 제목');
  await expect(descriptor).toBeFocused();

  await page.goBack();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '계속 작성' }).click();
  await expect(descriptor).toHaveValue('작성 중 일정 제목');
  await expect(page).toHaveURL(/\/app\/customers\/customer-tenant-1$/);
});
