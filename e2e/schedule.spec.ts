import { expect, test } from './fixtures';

test('schedule agenda exposes the canonical week, overdue cue, and event rows', async ({
  page,
}) => {
  await page.goto('/app/schedule');

  await expect(page.getByRole('heading', { name: '일정', exact: true })).toBeVisible();
  await expect(page.locator('[data-week-strip] button')).toHaveCount(7);
  await expect(page.locator('[data-event-dot]')).not.toHaveCount(0);
  await expect(page.locator('[data-agenda-section]')).not.toHaveCount(0);

  const overdueCue = page.locator('[data-overdue-cue]');
  await expect(overdueCue).toBeVisible();
  // 정리 필요 안내는 주간 띠와 같은 고정 영역에 있다(F3 C-03).
  await expect(page.locator('[data-schedule-sticky] [data-overdue-cue]')).toHaveCount(1);
  await expect(overdueCue.getByText('정리 필요')).toBeVisible();
});

test('"+ 일정" and the overdue cue are inside the viewport right after landing', async ({
  page,
}) => {
  await page.goto('/app/schedule');
  const viewport = page.viewportSize()!;
  const add = page.locator('[data-schedule-add-event]');
  const cue = page.locator('[data-overdue-cue] button');
  await expect(add).toBeVisible();
  await expect(cue).toBeVisible();
  // 오늘로 자동 스크롤이 끝난 뒤에도 같은 자리에 남는다.
  await page.waitForTimeout(600);
  for (const locator of [add, cue]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  }
  const weekStrip = await page.locator('[data-week-strip]').boundingBox();
  expect(weekStrip!.y).toBeGreaterThanOrEqual(0);
});

test('saving a new event with its default time lands in the upcoming list with a status sentence', async ({
  page,
}) => {
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: '일정 추가' }).click();
  const form = page.locator('[data-event-form]');
  const time = form.locator('[data-event-field="scheduledAt"]');
  // 고정 시계 2026-08-11 12:00 KST 기준, 기본값은 항상 미래(다음 정시).
  await expect(time).toHaveValue('2026-08-11T13:00');
  await form.locator('[data-event-field="descriptor"]').fill('기본 시각으로 추가한 일정');
  await form.locator('[data-event-form-submit], button[type="submit"]').first().click();

  const notice = page.locator('[data-event-saved-notice]');
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText('일정을 저장했어요.');
  await expect(
    page.locator('[data-customer-upcoming]').getByText('기본 시각으로 추가한 일정').first(),
  ).toBeVisible();
  await expect(page.locator('[data-customer-upcoming]').getByText('정리 필요')).toHaveCount(0);
});

test('agenda row and customer target open their separate destinations', async ({ page }) => {
  await page.goto('/app/schedule');

  const transitionedRow = page.locator('[data-event-id="event-tenant-transitioned"]');
  await transitionedRow.getByRole('link', { name: '박세입' }).click();
  await expect(page).toHaveURL('/app/customers/customer-tenant-1');

  await page.goto('/app/schedule');
  await page
    .locator('[data-event-id="event-tenant-transitioned"]')
    .click({ position: { x: 24, y: 20 } });
  await expect(page).toHaveURL('/app/events/event-tenant-transitioned');
  await expect(page.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
  await expect(page.locator('[data-event-detail]').getByText('예정', { exact: true })).toHaveCount(
    1,
  );
  await expect(page.locator('[data-event-detail]').getByText('실제', { exact: true })).toHaveCount(
    1,
  );
  await expect(page.locator('[data-event-detail] time')).toHaveCount(2);
});

test('agenda scroll keeps the selected date inside the WeekStrip week', async ({ page }) => {
  await page.goto('/app/schedule');

  const targetSection = page.locator('[data-agenda-section][data-date-key="2026-07-05"]');
  await targetSection.scrollIntoViewIfNeeded();

  await expect(
    page.locator('[data-week-strip] button[data-date-key="2026-07-05"][aria-current="date"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-week-strip] button[aria-current="date"]')).toHaveCount(1);
});

test('agenda targets have foundation focus and touch semantics without nested controls', async ({
  page,
}) => {
  await page.goto('/app/schedule');

  const row = page.locator('[data-agenda-row]').first();
  const customerLink = row.getByRole('link', { name: '박세입' });
  const customerBox = await customerLink.boundingBox();
  expect(customerBox).not.toBeNull();
  expect(customerBox!.width).toBeGreaterThanOrEqual(44);
  expect(customerBox!.height).toBeGreaterThanOrEqual(44);

  await row.getByRole('button').focus();
  const focus = await row.getByRole('button').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      offset: style.outlineOffset,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focus).toEqual({ offset: '2px', style: 'solid', width: '2px' });
  expect(await row.locator('button a, a button').count()).toBe(0);
});

test('event detail preserves cancelled schedule context without inventing occurrence', async ({
  page,
}) => {
  await page.goto('/app/events/event-tenant-cancelled');

  await expect(page.getByRole('heading', { name: '현장 확인 일정' })).toBeVisible();
  await expect(
    page.locator('[data-event-detail]').getByText('취소됨', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-event-detail]').getByText('예정', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-event-detail]').getByText('실제', { exact: true }),
  ).not.toBeVisible();
  await expect(page.locator('[data-event-detail] time')).toHaveCount(1);
});

test('schedule week strip cells stay 44px or larger and text 12px or larger at 320', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-375',
    '320 boundary is checked once, on the phone project',
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/schedule');
  await expect(page.locator('[data-week-strip] button')).toHaveCount(7);

  const cells = await page.locator('[data-week-strip] button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  for (const cell of cells) {
    expect(cell.width).toBeGreaterThanOrEqual(44);
    expect(cell.height).toBeGreaterThanOrEqual(44);
  }

  const smallest = await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>('[data-schedule-page] *')]
      .filter((element) =>
        [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ),
      )
      .map((element) => parseFloat(getComputedStyle(element).fontSize));
    return Math.min(...sizes);
  });
  expect(smallest).toBeGreaterThanOrEqual(12);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('agenda rows lead with the time and show text status without description badges', async ({
  page,
}) => {
  await page.goto('/app/schedule');

  const row = page.locator('[data-event-id="event-tenant-transitioned"]');
  const timeBox = await row.locator('time').boundingBox();
  const titleBox = await row.locator('h3').boundingBox();
  expect(timeBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(timeBox!.x).toBeLessThan(titleBox!.x);
  await expect(row.getByText('기록됨', { exact: true })).toBeVisible();
  await expect(row.locator('[data-slot="badge"]')).toHaveCount(0);

  const cancelled = page.locator('[data-event-id="event-tenant-cancelled"]');
  await expect(cancelled.locator('[data-slot="badge"]')).toHaveText('취소됨');
});
