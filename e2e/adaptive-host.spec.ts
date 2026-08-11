import { expect, test } from './fixtures';

test('adaptive host applies the width and orientation contract', async ({ page }) => {
  const initialViewport = page.viewportSize();
  expect(initialViewport).not.toBeNull();
  await page.goto('/app/schedule');

  const host = page.locator('[data-adaptive-host]');
  const bottomNavigation = page.locator('[data-bottom-navigation]:visible');
  const sideNavigation = page.locator('[data-side-navigation]:visible');

  if (initialViewport!.width < 768) {
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(bottomNavigation).toHaveCount(1);
    await expect(sideNavigation).toHaveCount(0);
  } else if (initialViewport!.width < 1100) {
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(bottomNavigation).toHaveCount(0);
    await expect(sideNavigation).toHaveCount(1);
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);
  } else {
    await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
    await expect(bottomNavigation).toHaveCount(0);
    await expect(sideNavigation).toHaveCount(1);
    await expect(host).toHaveAttribute('data-is-co-visible', 'false');
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);

    await page
      .getByRole('button', { name: /일정 상세 열기/ })
      .first()
      .click();
    await expect(host).toHaveAttribute('data-is-co-visible', 'true');
    await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
    await expect(page.locator('[data-major-surface]')).toHaveCount(2);
    await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
      'data-selected-event-id',
      /.+/,
    );

    await page.setViewportSize({ width: 1090, height: 800 });
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(host).toHaveAttribute('data-landscape', 'true');
    await expect(page.locator('[data-major-surface]')).toHaveCount(1);

    await page.setViewportSize({ width: 1180, height: 1366 });
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(host).toHaveAttribute('data-landscape', 'false');

    await page.setViewportSize({ width: 1024, height: 1366 });
    await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
    await expect(page.locator('[data-event-detail-page]')).toBeVisible();
    await expect(page.locator('[data-side-navigation]:visible')).toHaveCount(1);

    await page.setViewportSize({ width: 1180, height: 800 });
    await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
    await expect(host).toHaveAttribute('data-is-co-visible', 'true');
    await expect(page.locator('[data-major-surface]')).toHaveCount(2);
  }
});

test('customer event selection replaces the right surface without a third pane', async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1180, 'composition check runs at the desktop target');

  await page.goto('/app/customers');
  await page.getByRole('link', { name: /박세입/ }).click();

  const host = page.locator('[data-adaptive-host]');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="customer-detail"]')).toHaveCount(1);
  await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
  await expect(page.locator('[data-major-surface]')).toHaveCount(2);
  await expect(host).toHaveAttribute('data-is-co-visible', 'true');

  await page.locator('[data-customer-detail-page] [data-upcoming-primary]').click();
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="customer-detail"]')).toHaveCount(0);
  await expect(page.locator('[data-major-surface="event-detail"]')).toHaveCount(1);
  await expect(page.locator('[data-adaptive-pane]')).toHaveCount(2);
  await expect(page.locator('[data-major-surface]')).toHaveCount(2);
  await expect(host).toHaveAttribute('data-is-co-visible', 'true');

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="event-detail"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface]')).toHaveCount(2);
});

test('portrait-start Customer to Event keeps the customer root through rotation and return', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto('/app/customers/customer-tenant-1');

  const host = page.locator('[data-adaptive-host]');
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(host).toHaveAttribute('data-active-root', 'customers');

  await page.locator('[data-customer-detail-page] [data-upcoming-primary]').click();
  await expect(page).toHaveURL('/app/events/followup-tenant-1');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="schedule"]')).toHaveCount(0);
  await expect(page.locator('[data-major-surface="event-detail"]')).toHaveCount(1);
  await expect(
    page.locator('[data-major-surface="customer-list"] a[aria-current="true"]'),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    'followup-tenant-1',
  );

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="event-detail"]')).toHaveCount(1);

  await page.getByRole('button', { name: '일정으로 돌아가기' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');
  await expect(host).toHaveAttribute('data-active-root', 'customers');
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="customer-detail"]')).toHaveCount(1);
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    'customer-tenant-1',
  );
});

test('direct Event route keeps schedule fallback without customer origin context', async ({
  page,
}) => {
  await page.goto('/app/events/followup-tenant-1');

  const host = page.locator('[data-adaptive-host]');
  await expect(host).toHaveAttribute('data-active-root', 'schedule');
  await expect(page.locator('[data-event-detail-page]')).toBeVisible();

  await page.getByRole('button', { name: '일정으로 돌아가기' }).click();
  await expect(page).toHaveURL('/app/schedule');
  await expect(host).toHaveAttribute('data-active-root', 'schedule');
  await expect(page.locator('[data-major-surface="schedule"]')).toHaveCount(1);
  await expect(page.locator('[data-major-surface="customer-list"]')).toHaveCount(0);
});

test('Event Detail focus survives mode changes without stealing navigation focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.goto('/app/events/followup-tenant-1');

  const host = page.locator('[data-adaptive-host]');
  const editButton = page.locator('[data-event-action="edit"]');
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await editButton.focus();
  await expect(editButton).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(page.locator('[data-event-action="edit"]')).toBeFocused();

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await expect(page.locator('[data-event-action="edit"]')).toBeFocused();

  const customersNavigation = page
    .locator('[data-side-navigation]:visible')
    .getByRole('link', { name: '고객', exact: true });
  await customersNavigation.focus();
  await expect(customersNavigation).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(customersNavigation).toBeFocused();
});

test('adaptive mode changes keep the canonical Event mutation state', async ({ page }) => {
  test.skip(
    page.viewportSize()?.width !== 1180,
    'mutation preservation runs at the desktop target',
  );

  await page.goto('/app/events/followup-tenant-1');
  await page.getByRole('button', { name: '기록 완료' }).click();
  await page
    .locator('[data-event-occurrence-confirmation]')
    .getByRole('button', { name: '확인' })
    .click();

  const host = page.locator('[data-adaptive-host]');
  const scheduleRow = page.locator('[data-event-id="followup-tenant-1"]');
  await expect(page).toHaveURL('/app/schedule');
  await expect(scheduleRow).toHaveAttribute('data-event-status', 'OCCURRED');

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'single');
  await expect(page.locator('[data-event-id="followup-tenant-1"]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(host).toHaveAttribute('data-adaptive-mode', 'two-pane');
  await expect(page.locator('[data-event-id="followup-tenant-1"]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );

  await page.locator('[data-event-id="followup-tenant-1"]').getByRole('button').click();
  await expect(page.locator('[data-event-detail]')).toHaveAttribute(
    'data-event-status',
    'OCCURRED',
  );
});

test('schedule selection and scroll context survive rotation', async ({ page }) => {
  test.skip(
    page.viewportSize()?.width !== 1180,
    'rotation preservation runs at the desktop target',
  );

  await page.goto('/app/schedule');
  const targetSection = page.locator('[data-agenda-section][data-date-key="2026-08-15"]');
  await targetSection.scrollIntoViewIfNeeded();
  const targetRow = targetSection.locator('[data-agenda-row][data-event-id="followup-tenant-1"]');
  const eventId = await targetRow.getAttribute('data-event-id');
  expect(eventId).not.toBeNull();
  await targetRow.getByRole('button').click();
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    eventId!,
  );

  await page.setViewportSize({ width: 1024, height: 1366 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'single',
  );
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    eventId!,
  );

  await page.setViewportSize({ width: 1180, height: 800 });
  await expect(page.locator('[data-adaptive-host]')).toHaveAttribute(
    'data-adaptive-mode',
    'two-pane',
  );
  await expect(page.locator('[data-event-detail-page]')).toHaveAttribute(
    'data-selected-event-id',
    eventId!,
  );
  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-08-15"][aria-current="date"]'),
  ).toHaveCount(1);
  const restoredScrollTop = await page
    .locator('[data-major-surface="schedule"]')
    .evaluate((element) => element.scrollTop);
  expect(restoredScrollTop).toBeGreaterThan(0);
});
