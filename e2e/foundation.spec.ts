import { expect, test } from './fixtures';

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
  await expect(page.getByRole('heading', { name: '일정', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '고객', exact: true }).click();
  await expect(page).toHaveURL('/app/customers');
  await expect(page.getByRole('link', { name: '고객', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: '일정', exact: true }).click();
  await expect(page).toHaveURL('/app/schedule');
  await expect(page.getByRole('link', { name: '일정', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('responsive app frame and scroll contract', async ({ page }) => {
  await page.goto('/app/customers');
  const viewport = page.viewportSize()!;
  const hostBox = await page.locator('[data-app-host]').boundingBox();
  const contentBox = await page.locator('[data-app-content]').boundingBox();
  const adaptiveHost = page.locator('[data-adaptive-host]');
  expect(hostBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(hostBox!.width).toBe(viewport.width);
  const expectedAvailableWidth = viewport.width < 768 ? viewport.width : viewport.width - 80;
  expect(contentBox!.width).toBe(expectedAvailableWidth);
  if (viewport.width >= 768) {
    const frameBox = await page.locator('[data-app-frame]').boundingBox();
    const sideBox = await page.locator('[data-side-navigation]').boundingBox();
    expect(frameBox).not.toBeNull();
    expect(sideBox).not.toBeNull();
    expect(contentBox!.x).toBe(frameBox!.x + sideBox!.width);
  }
  if (viewport.width === 1180) {
    await expect(adaptiveHost).toHaveAttribute('data-adaptive-mode', 'two-pane');
    await expect(page.locator('[data-adaptive-composition]')).toHaveCount(1);
    await expect(page.locator('[data-adaptive-single-frame]')).toHaveCount(0);
  } else {
    await expect(adaptiveHost).toHaveAttribute('data-adaptive-mode', 'single');
    const expectedFrameWidth =
      viewport.width < 768 ? viewport.width : viewport.width < 1024 ? 520 : 560;
    const frameBox = await page.locator('[data-adaptive-single-frame]').boundingBox();
    expect(frameBox).not.toBeNull();
    expect(frameBox!.width).toBe(expectedFrameWidth);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('[data-scroll-surface]')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  const activeTab = page.getByRole('link', { name: '고객', exact: true });
  await expect(activeTab).toHaveAttribute('aria-current', 'page');
});

test('semantic tokens, touch targets, and keyboard focus load from the shared foundation', async ({
  page,
}) => {
  await page.goto('/app/customers');

  const tertiary = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--text-tertiary')
      .replaceAll(' ', '')
      .trim(),
  );
  expect(tertiary).toBe('oklch(53%.01260)');

  for (const tab of await page.getByRole('navigation').getByRole('link').all()) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  const bottomNavigationLink = page
    .locator('[data-bottom-navigation]:visible, [data-side-navigation]:visible')
    .getByRole('link', { name: '고객', exact: true });
  await bottomNavigationLink.focus();
  const bottomNavigationFocus = await bottomNavigationLink.evaluate((element) => {
    const accentProbe = document.createElement('span');
    accentProbe.style.color = 'var(--accent-primary)';
    document.body.append(accentProbe);
    const accentColor = getComputedStyle(accentProbe).color;
    accentProbe.remove();

    const style = getComputedStyle(element);
    return {
      accentColor,
      color: style.outlineColor,
      offset: style.outlineOffset,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(bottomNavigationFocus.color).toBe(bottomNavigationFocus.accentColor);
  expect(bottomNavigationFocus).toMatchObject({
    offset: '2px',
    style: 'solid',
    width: '2px',
  });

  const customerLink = page.getByRole('link', { name: /박세입/ });
  await customerLink.focus();
  const focus = await customerLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      offset: style.outlineOffset,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focus).toEqual({ offset: '2px', style: 'solid', width: '2px' });

  await customerLink.click();
  const backButton = page.getByRole('button', { name: '고객 목록으로 돌아가기' });
  const backBox = await backButton.boundingBox();
  expect(backBox).not.toBeNull();
  expect(backBox!.width).toBeGreaterThanOrEqual(44);
  expect(backBox!.height).toBeGreaterThanOrEqual(44);
});

test('generic text controls expand instead of clipping at increased text scale', async ({
  page,
}) => {
  await page.goto('/app');
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));

  const action = page
    .locator('[data-bottom-navigation]:visible, [data-side-navigation]:visible')
    .getByRole('link', { name: '고객', exact: true });
  const dimensions = await action.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
});

const customerScenarios: Array<{
  scenarioName: string;
  customerName: string;
  expectedTimelineLabels: string[];
}> = [
  {
    scenarioName: 'landlord-tenant',
    customerName: '박세입',
    expectedTimelineLabels: [
      '현장 확인 일정',
      '계약 갱신 상담',
      '갱신 조건 안내 문자 발송',
      '계약 갱신 의사 확인 통화',
      '입주 안내 완료',
    ],
  },
  {
    scenarioName: 'therapist-patient',
    customerName: '최내원',
    expectedTimelineLabels: [
      '내원 확인 기록',
      '다음 방문 일정 조율 연락',
      '내원 확인',
      '첫 방문 접수',
    ],
  },
];

for (const { scenarioName, customerName, expectedTimelineLabels } of customerScenarios) {
  test(`customer list -> detail -> context -> canonical history (${scenarioName})`, async ({
    page,
  }) => {
    await page.goto('/app/customers');
    await page.getByRole('link', { name: new RegExp(customerName) }).click();
    await expect(page.getByRole('heading', { name: customerName })).toBeVisible();
    await expect(page.getByRole('heading', { name: '고객 맥락' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '타임라인' })).toBeVisible();
    const timelineItems = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '타임라인', exact: true }) })
      .getByRole('listitem');
    await expect(timelineItems).toHaveCount(expectedTimelineLabels.length);
    await expect(timelineItems.locator('p')).toHaveText(expectedTimelineLabels);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const backAction = page.getByRole('button', { name: '고객 목록으로 돌아가기' });
    await expect(backAction).toBeVisible();
    await backAction.click();
    await expect(page).toHaveURL('/app/customers');
  });
}

test('unknown customer id renders the app not-found surface', async ({ page }) => {
  await page.goto('/app/customers/does-not-exist');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
});
