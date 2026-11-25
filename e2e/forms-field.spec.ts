import type { Locator } from '@playwright/test';

import { expect, test, type Page } from './fixtures';

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Control has no bounding box.');
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  expect(box.width).toBeGreaterThanOrEqual(43.5);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function rotate(page: Page) {
  const size = page.viewportSize();
  if (!size) throw new Error('No viewport.');
  await page.setViewportSize({ width: size.height, height: size.width });
}

test('고객 폼: 라벨·오류 연결, 44 조작, 입력 중 회전 시 값 보존', async ({ page }) => {
  await page.goto('/app/customers/new');
  const name = page.getByLabel('고객 이름');
  const memo = page.getByLabel('고객 메모');
  await expectTouchTarget(name);
  await expectTouchTarget(page.locator('[data-customer-form-submit]'));
  await expectNoHorizontalOverflow(page);

  // 빈 이름 제출 → 오류가 필드에 연결된다(공백만 입력해 native required를 우회).
  await name.fill('   ');
  await page.locator('[data-customer-form-submit]').click();
  const alert = page.locator('[data-customer-form] [data-slot="field-message"][role="alert"]');
  await expect(alert).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  const alertId = await alert.getAttribute('id');
  expect(await name.getAttribute('aria-describedby')).toContain(alertId!);

  await name.fill('회전 고객');
  await memo.fill('회전 메모');
  await expect(alert).toHaveCount(0);
  await rotate(page);
  await expect(page.getByLabel('고객 이름')).toHaveValue('회전 고객');
  await expect(page.getByLabel('고객 메모')).toHaveValue('회전 메모');
  await rotate(page);
  await expect(page.getByLabel('고객 이름')).toHaveValue('회전 고객');
  await expectNoHorizontalOverflow(page);
});

test('일정 폼: 라벨·오류 연결, 44 조작, 입력 중 회전 시 값 보존', async ({ page }) => {
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  const form = page.locator('[data-event-form]');
  const title = form.getByLabel('제목');
  const time = form.getByLabel('예정 시각');
  const note = form.getByLabel('메모');
  await expectTouchTarget(title);
  await expectTouchTarget(time);
  await expectTouchTarget(form.locator('[data-event-form-submit]'));
  await expectTouchTarget(form.locator('[data-event-form-cancel]'));

  await title.fill('회전 일정');
  await note.fill('회전 메모');
  await time.fill('2026-08-12T09:30');
  await rotate(page);
  await expect(form.getByLabel('제목')).toHaveValue('회전 일정');
  await expect(form.getByLabel('메모')).toHaveValue('회전 메모');
  await expect(form.getByLabel('예정 시각')).toHaveValue('2026-08-12T09:30');
  await rotate(page);
  await expect(form.getByLabel('제목')).toHaveValue('회전 일정');
  await expectNoHorizontalOverflow(page);
});

test('일정 추가 화면: 직접 진입 폼도 같은 Field 계약을 따른다', async ({ page }) => {
  await page.goto('/app/events/new');
  const firstCustomer = page.locator('[data-customer-selector-option]').first();
  await firstCustomer.click();
  const form = page.locator('[data-event-form]');
  await expect(form).toBeVisible();
  for (const label of ['제목', '예정 시각', '메모']) {
    const control = form.getByLabel(label);
    await expect(control).toHaveAttribute('aria-invalid', 'false');
  }
  await expectNoHorizontalOverflow(page);
});

test('계정 언어 선택: native radio, 선택은 brand-subtle 면 + 체크', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page.locator('[data-locale-option]')).toHaveCount(2);
  const ko = page.locator('[data-locale-option="ko"]');
  const en = page.locator('[data-locale-option="en"]');
  await expectTouchTarget(ko);
  await expectTouchTarget(en);
  await expect(ko.locator('svg')).toHaveCount(1);
  await expect(en.locator('svg')).toHaveCount(0);

  await page.keyboard.press('Tab');
  await en.click();
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
  await expect(en.locator('svg')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test('계정 화면 모드 선택: 3개 native radio, 터치 타깃 44px, 선택은 체크', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page.locator('[data-theme-option]')).toHaveCount(3);
  for (const value of ['system', 'light', 'dark']) {
    await expectTouchTarget(page.locator(`[data-theme-option="${value}"]`));
  }
  await expect(page.locator('[data-theme-option="system"] svg')).toHaveCount(1);
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.getByRole('radio', { name: '다크' })).toBeChecked();
  await expect(page.locator('[data-theme-option="dark"] svg')).toHaveCount(1);
  await expect(page.locator('[data-theme-option="system"] svg')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
