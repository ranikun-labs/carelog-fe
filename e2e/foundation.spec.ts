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

test('app list, detail, navigation, and locale persistence', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('link', { name: '예시 항목 보기' }).click();
  await page.getByRole('link', { name: '확인 체크리스트' }).click();
  await expect(page).toHaveURL('/app/items/check%2Fchecklist');
  await expect(page.getByRole('link', { name: '항목', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: '설정' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('responsive app frame and scroll contract', async ({ page }) => {
  await page.goto('/app/items');
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
  const activeTab = page.getByRole('link', { name: /항목|Items/ });
  await expect(activeTab).toHaveAttribute('aria-current', 'page');
});

test('detail keeps one scroll surface and an accessible final action', async ({ page }) => {
  await page.goto('/app/items/starter-task');
  await expect(page.locator('[data-scroll-surface]')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  const finalAction = page.getByRole('link', { name: '항목으로 돌아가기' });
  await finalAction.scrollIntoViewIfNeeded();
  await expect(finalAction).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
