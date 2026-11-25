import { expect, test } from './fixtures';

// F1-G4: 폰 하단 내비는 일정·고객·계정을 한 줄로 둔다(약 57px + safe area).
test('phone bottom navigation is one row with account entry, 44px targets and no overflow', async ({
  page,
}) => {
  const viewport = page.viewportSize()!;
  test.skip(viewport.width >= 768, '하단 내비는 767 이하에서만 보인다');
  await page.goto('/app/schedule');

  const nav = page.locator('[data-bottom-navigation]:visible');
  await expect(nav).toHaveCount(1);
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveText('일정');
  await expect(links.nth(1)).toHaveText('고객');
  await expect(links.nth(2)).toHaveText('계정');

  // 한 줄: 세 링크의 세로 위치(top)가 같고, 내비 높이가 60 이하다(이전 101).
  const boxes = await Promise.all([0, 1, 2].map((i) => links.nth(i).boundingBox()));
  const navBox = (await nav.boundingBox())!;
  expect(navBox.height).toBeLessThanOrEqual(60);
  expect(navBox.height).toBeGreaterThanOrEqual(56);
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.y).toBeCloseTo(boxes[0]!.y, 0);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  // 내비가 뷰포트 안(가로 넘침 없음)에 있고 화면 맨 아래에 붙어 있다.
  expect(navBox.x).toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(viewport.width);
  expect(navBox.y + navBox.height).toBeCloseTo(viewport.height, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // safe area는 내비 하단 패딩으로 처리한다.
  expect(await nav.evaluate((el) => getComputedStyle(el).paddingBottom)).toBe('0px');
  expect(await nav.evaluate((el) => el.className)).toContain('pb-[env(safe-area-inset-bottom)]');
});

test('phone account entry keeps aria-current and opens settings', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, '하단 내비는 767 이하에서만 보인다');
  await page.goto('/app/schedule');
  const nav = page.locator('[data-bottom-navigation]:visible');
  await expect(nav.getByRole('link', { name: '일정' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: '계정' })).not.toHaveAttribute('aria-current');

  await nav.getByRole('link', { name: '계정' }).click();
  await expect(page).toHaveURL('/app/settings');
  await expect(
    page.locator('[data-bottom-navigation]:visible').getByRole('link', { name: '계정' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
});

test('320x640 first screen keeps the add-event actions above the one-row navigation', async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width !== 375, '320x640 전용 검증은 한 프로젝트에서만 수행한다');
  await page.setViewportSize({ width: 320, height: 640 });
  const navBox = async () =>
    (await page.locator('[data-bottom-navigation]:visible').boundingBox())!;

  await page.goto('/app/customers/customer-tenant-1');
  const add = page.getByRole('button', { name: '일정 추가' }).first();
  await expect(add).toBeVisible();
  const addBox = (await add.boundingBox())!;
  expect(addBox.y + addBox.height).toBeLessThanOrEqual((await navBox()).y);
  expect(addBox.y).toBeGreaterThanOrEqual(0);

  await page.goto('/app/schedule');
  const scheduleAdd = page.locator('[data-schedule-add-event]');
  await expect(scheduleAdd).toBeVisible();
  const scheduleBox = (await scheduleAdd.boundingBox())!;
  expect(scheduleBox.y + scheduleBox.height).toBeLessThanOrEqual((await navBox()).y);
});

// F1-G9: ko 시각·날짜는 24시간제 `M월 D일 (요일) HH:mm`. 저장 값은 그대로다.
test('schedule and detail show 24-hour times without a meridiem marker', async ({ page }) => {
  await page.goto('/app/schedule');
  const rowTimes = page.locator('[data-agenda-row] time, [data-event-id] time');
  await expect(rowTimes.first()).toBeVisible();
  const texts = await rowTimes.allTextContents();
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) expect(text.trim()).toMatch(/^\d{2}:\d{2}$/);
  await expect(page.locator('main, body').first()).not.toContainText(/오전 \d|오후 \d/);

  await page.goto('/app/events/event-tenant-transitioned');
  const times = await page.locator('[data-event-detail] time').allTextContents();
  expect(times.length).toBe(2);
  for (const text of times) {
    expect(text.trim()).toMatch(/^\d{1,2}월 \d{1,2}일 \([일월화수목금토]\) \d{2}:\d{2}$/);
  }
  // 저장 값(dateTime 속성)은 표시 변경과 무관하게 ISO 그대로다.
  const stored = await page.locator('[data-event-detail] time').first().getAttribute('datetime');
  expect(stored).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

test('customer list and detail dates use the ko display format', async ({ page }) => {
  await page.goto('/app/customers');
  await expect(page.locator('main time').first()).toBeVisible();
  const dates = await page.locator('main time').allTextContents();
  expect(dates.length).toBeGreaterThan(0);
  for (const text of dates)
    expect(text.trim()).toMatch(/^\d{1,2}월 \d{1,2}일 \([일월화수목금토]\)$/);
});

// 하단 내비 높이가 바뀌면 스크롤 영역 높이가 달라진다. 첫 앵커 직후 레이아웃 정착 scroll 이벤트가
// 사용자 스크롤로 오인돼 오늘 주가 풀리던 문제의 회귀 가드(이전엔 375×856 같은 높이에서 재현).
for (const height of [812, 856, 900]) {
  test(`schedule keeps today's week selected after first anchor at 375x${height}`, async ({
    page,
  }) => {
    test.skip(page.viewportSize()!.width !== 375, '폰 폭 한 프로젝트에서 높이를 바꿔 검증한다');
    await page.setViewportSize({ width: 375, height });
    await page.goto('/app/schedule');
    const selected = page.locator('[data-week-strip] button[aria-current="date"]');
    await expect(selected).toHaveAttribute('data-date-key', '2026-08-11');
    await page.waitForTimeout(1200);
    await expect(selected).toHaveAttribute('data-date-key', '2026-08-11');
  });
}
