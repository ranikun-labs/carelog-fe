import { expect, test } from './fixtures';

const isDark = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));

test('기본은 시스템 설정을 따르고, 시스템 변경이 새로고침 없이 반영된다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app/settings');
  await expect(page.getByRole('radio', { name: '시스템 설정 따르기' })).toBeChecked();
  expect(await isDark(page)).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0f1114');
});

test('설정에서 다크를 고르면 이 기기에만 저장되고 새로고침·재방문에서도 유지된다', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH'].includes(r.method())) requests.push(r.url());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app/settings');
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => window.localStorage.getItem('carelog.theme'))).toBe('dark');
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.getByRole('radio', { name: '다크' })).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/dark/);
  // 명시 선택은 시스템 변경보다 우선한다.
  await page.locator('[data-theme-option="light"]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('첫 페인트 전에 적용된다: 앱 번들이 로드되지 않아도 저장된 다크가 이미 켜져 있다', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => window.localStorage.setItem('carelog.theme', 'dark'));
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/app/settings');
  expect(await isDark(page)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');
});

test('공개·인증 화면도 같은 모드를 따른다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('모드 전환은 입력 중인 내용과 화면 회전 뒤 선택을 보존한다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app/customers/new');
  const field = page.locator('input[type="text"], input:not([type])').first();
  await field.fill('테스트 입력');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(field).toHaveValue('테스트 입력');

  await page.goto('/app/settings');
  await page.locator('[data-theme-option="dark"]').click();
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await expect(page.getByRole('radio', { name: '다크' })).toBeChecked();
  await page.setViewportSize({ width, height });
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('다크에서도 일정 상태 배지는 텍스트와 함께 보인다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/app/schedule');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const rows = page.locator('[data-agenda-row]');
  await expect(rows.first()).toBeVisible();
  const texts = await rows.allInnerTexts();
  expect(texts.length).toBeGreaterThan(0);
  // 색·레일만으로 상태를 전달하지 않는다: 모든 행에 상태 텍스트가 함께 있다.
  for (const text of texts) expect(text).toMatch(/예정|정리 필요|기록됨|취소됨/);
});
