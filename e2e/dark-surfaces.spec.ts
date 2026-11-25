import { expect, test, useAssistantAdapter, useAuthAdapterScenario, type Page } from './fixtures';

/**
 * Dark 면 보정(F1-05 PR-C7, F1-01 C-1) 회귀 가드.
 * Dark는 설정 > 화면 모드로 노출된다(G2). 이 테스트는 선택 UI와 무관하게 `.dark`를 직접 붙여
 * 실제 렌더 색을 잰다: 글자 4.5:1(큰 글자 3:1), 입력 외곽선 3:1.
 */

async function forceDark(page: Page) {
  await page.addInitScript(() => {
    const apply = () => {
      const root = document.documentElement;
      if (root && !root.classList.contains('dark')) root.classList.add('dark');
    };
    apply();
    new MutationObserver(apply).observe(document, { childList: true, subtree: true });
    // 전환 도중의 중간 색을 재지 않도록 전환·애니메이션을 끈다(색 값만 본다).
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent =
        '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.append(style);
    });
  });
}

type Violation = { kind: string; target: string; ratio: number };

async function measureDarkContrast(
  page: Page,
): Promise<{ checked: number; violations: Violation[] }> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const over = (top: number[], bottom: number[]) =>
      [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat([1]);
    const backgroundOf = (el: Element) => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) chain.push(e);
      let acc = [255, 255, 255, 1];
      for (const e of chain.reverse()) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) acc = over(c, acc);
      }
      return acc;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent ?? '').trim().slice(0, 24)}"`;

    const violations: { kind: string; target: string; ratio: number }[] = [];
    let checked = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const bg = backgroundOf(el);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (hasText) {
        checked += 1;
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const r = ratio(over(rgba(cs.color), bg), bg);
        if (r < (large ? 3 : 4.5))
          violations.push({ kind: 'text', target: label(el), ratio: +r.toFixed(2) });
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (['radio', 'checkbox', 'hidden'].includes((el as HTMLInputElement).type)) continue;
        if (parseFloat(cs.borderTopWidth) === 0) continue;
        checked += 1;
        const r = ratio(over(rgba(cs.borderTopColor), bg), bg);
        if (r < 3)
          violations.push({ kind: 'control-outline', target: label(el), ratio: +r.toFixed(2) });
      }
    }
    return { checked, violations };
  });
}

const SCREENS: [string, string][] = [
  ['일정', '/app/schedule'],
  ['고객 목록', '/app/customers'],
  ['고객 상세', '/app/customers/customer-tenant-1'],
  ['고객 폼', '/app/customers/new'],
  ['일정 추가 폼', '/app/events/new'],
  ['일정 상세(기록됨)', '/app/events/event-tenant-transitioned'],
  ['일정 상세(취소됨)', '/app/events/event-tenant-cancelled'],
  ['계정', '/app/settings'],
  ['로그인', '/auth/login'],
  ['회원가입', '/auth/signup'],
];

for (const [name, path] of SCREENS) {
  test(`Dark 강제: ${name}은 글자 4.5:1·입력 외곽선 3:1을 지킨다`, async ({ page }) => {
    // 인증 화면은 로그인 전 상태로 열어야 한다(로그인돼 있으면 앱으로 돌아간다).
    if (path.startsWith('/auth/')) await useAuthAdapterScenario(page, { bootstrap: 'anonymous' });
    await forceDark(page);
    await page.goto(path);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('h1').first()).toBeVisible();
    const { checked, violations } = await measureDarkContrast(page);
    expect(checked).toBeGreaterThan(3);
    expect(violations).toEqual([]);
  });
}

test('Dark 강제: 일정 상세 확인 패널·일정 폼 오류·고객 상세 인라인 폼도 대비를 지킨다', async ({
  page,
}) => {
  await forceDark(page);
  await page.goto('/app/schedule');
  await page.locator('[data-agenda-row]:has([data-agenda-rail="warning"]) button').first().click();
  await page.locator('[data-event-action="occur"]').click();
  await expect(page.locator('[data-event-occurrence-confirmation]')).toBeVisible();
  expect((await measureDarkContrast(page)).violations).toEqual([]);

  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await page.locator('#event-scheduled-at').fill('');
  await page.locator('[data-event-form-submit]').click();
  await expect(page.locator('[data-event-form] [role="alert"]')).toBeVisible();
  expect((await measureDarkContrast(page)).violations).toEqual([]);
});

test('Dark 강제: 도우미의 질문 입력·메모 입력 외곽선이 3:1을 지킨다', async ({ page }) => {
  await forceDark(page);
  await useAssistantAdapter(page);
  await page.goto('/app/customers/customer-tenant-1');
  await page.getByRole('button', { name: 'AI에게 물어보기', exact: true }).click();
  await expect(page.locator('[data-assistant-page]')).toBeVisible();
  expect((await measureDarkContrast(page)).violations).toEqual([]);
  await page.locator('[data-assistant-suggested-action]').first().click();
  await expect(page.locator('[data-assistant-result]')).toBeVisible();
  await page.locator('[data-assistant-add-to-memo]').click();
  await expect(page.locator('#assistant-memo')).toBeVisible();
  expect((await measureDarkContrast(page)).violations).toEqual([]);
});

test('일정 폼은 브라우저 기본 검증 말풍선 대신 앱 오류만 보이고, 입력과 포커스를 지킨다', async ({
  page,
}) => {
  await page.goto('/app/events/new');
  await page.locator('[data-customer-selector-option]').first().click();
  const form = page.locator('[data-event-form]');
  await expect(form).toHaveAttribute('novalidate', '');
  await page.locator('#event-descriptor').fill('입력은 남아야 해요');
  await page.locator('#event-scheduled-at').fill('');
  await page.locator('[data-event-form-submit]').click();

  const alert = form.locator('[data-slot="field-message"][role="alert"]');
  await expect(alert).toBeVisible();
  // 기본 말풍선이 떴다면 입력은 :invalid 상태이고 submit이 막혀 앱 오류가 나오지 않는다. 앱 오류가 보이므로 말풍선 경로가 아니다.
  await expect(page.locator('#event-scheduled-at')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#event-scheduled-at')).toBeFocused();
  await expect(page.locator('#event-descriptor')).toHaveValue('입력은 남아야 해요');
});
