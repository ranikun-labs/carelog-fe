import { expect, test, type Page } from './fixtures';

async function expectCustomerDetailShell(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const bottomNavigation = page.locator('[data-bottom-navigation]');
  const sideNavigation = page.locator('[data-side-navigation]');
  const visibleBottomNavigation = page.locator('[data-bottom-navigation]:visible');
  const visibleSideNavigation = page.locator('[data-side-navigation]:visible');

  await expect(bottomNavigation).toHaveCount(1);
  await expect(sideNavigation).toHaveCount(1);

  if (viewport!.width < 768) {
    await expect(visibleBottomNavigation).toHaveCount(1);
    await expect(visibleSideNavigation).toHaveCount(0);
  } else {
    await expect(visibleBottomNavigation).toHaveCount(0);
    await expect(visibleSideNavigation).toHaveCount(1);
  }

  const twoPane = viewport!.width >= 1100 && viewport!.height < viewport!.width;
  await expect(page.locator('[data-scroll-surface]')).toHaveCount(twoPane ? 2 : 1);
  await expect(page.locator('main')).toHaveCount(1);

  const contentBox = await page.locator('[data-app-content]').boundingBox();
  expect(contentBox).not.toBeNull();
  const expectedContentWidth = viewport!.width < 768 ? viewport!.width : viewport!.width - 80;
  expect(contentBox!.width).toBe(expectedContentWidth);
  if (twoPane) {
    await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
      'data-adaptive-mode',
      'two-pane',
    );
  } else {
    const frameBox = await page.locator('[data-adaptive-single-frame]').boundingBox();
    expect(frameBox).not.toBeNull();
    expect(frameBox!.width).toBe(
      viewport!.width < 768 ? viewport!.width : viewport!.width < 1024 ? 520 : 560,
    );
  }

  const visibleNavigation = page.locator(
    '[data-bottom-navigation]:visible, [data-side-navigation]:visible',
  );
  await expect(visibleNavigation).toHaveCount(1);
  for (const link of await visibleNavigation.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await expect(page.locator('main button a, main a button')).toHaveCount(0);
}

test('Customer Detail keeps the shared responsive shell on direct and list navigation', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');
  await expect(page.getByRole('heading', { name: '박세입' })).toBeVisible();
  await expectCustomerDetailShell(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: '박세입' })).toBeVisible();
  await expectCustomerDetailShell(page);

  await page.goto('/app/customers');
  await page.getByRole('link', { name: /박세입/ }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expectCustomerDetailShell(page);
});

test('Customer Detail Upcoming resolves to the real planned Event Detail route', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');

  const upcoming = page.locator('[data-upcoming-primary]');
  await expect(upcoming).toHaveAttribute('href', '/app/events/followup-tenant-1');
  await upcoming.click();

  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await expect(page.getByRole('heading', { name: '계약 갱신 여부 재확인' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toHaveCount(0);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute('data-event-status', 'PLANNED');
  await expect(
    page.locator('[data-event-detail] [data-slot="badge"]').filter({ hasText: '예정' }),
  ).toHaveCount(1);
  await expect(page.locator('[data-event-detail]').getByText('박세입')).toBeVisible();
  await expect(
    page.locator('[data-event-detail] time[datetime="2026-08-15T10:00:00+09:00"]'),
  ).toHaveCount(1);
});

test('Customer Detail History resolves to the real occurred Event Detail route', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');

  await page
    .locator('[data-customer-history-item][data-event-id="event-tenant-transitioned"] a')
    .click();

  await expect(page).toHaveURL('/app/events/event-tenant-transitioned');
  await expect(page.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toHaveCount(0);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
  await expect(page.getByText('기록됨')).toBeVisible();
  await expect(page.locator('[data-event-detail]').getByText('박세입')).toBeVisible();
  await expect(page.locator('[data-event-detail] time')).toHaveCount(2);
});
