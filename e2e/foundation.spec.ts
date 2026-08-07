import { expect, test } from '@playwright/test';

test('public routes and locale switch', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/ko');
  await expect(page.locator('h1')).toHaveCount(1);
  await page.getByRole('link', { name: '기능 보기' }).click();
  await expect(page).toHaveURL('/ko/features');
  await page.getByRole('link', { name: '언어 변경' }).click();
  await expect(page).toHaveURL('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('app home, customers, and navigation', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('link', { name: '고객 목록 보기' }).click();
  await expect(page).toHaveURL('/app/customers');
  await expect(page.getByRole('link', { name: '고객', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: '후속 업무' }).click();
  await expect(page).toHaveURL('/app/follow-ups');
  await expect(page.getByRole('link', { name: '후속 업무' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('responsive app frame and scroll contract', async ({ page }) => {
  await page.goto('/app/customers');
  const viewport = page.viewportSize()!;
  const frame = page.locator('#root > div');
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(480);
  if (viewport.width === 1024) {
    expect(Math.abs(box!.x - (viewport.width - box!.width) / 2)).toBeLessThanOrEqual(1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('[data-scroll-surface]')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  const activeTab = page.getByRole('link', { name: '고객' });
  await expect(activeTab).toHaveAttribute('aria-current', 'page');
});

test('customer detail keeps one scroll surface and an accessible back action', async ({ page }) => {
  await page.goto('/app/customers/customer-1');
  await expect(page.locator('h1')).toHaveCount(1);
  const backAction = page.getByRole('button', { name: '고객 목록으로 돌아가기' });
  await expect(backAction).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
