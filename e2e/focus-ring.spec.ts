import { expect, test, type Page } from './fixtures';

/**
 * 포커스 표시 통일(F3 C-06): Tab으로 도는 모든 요소가 2px 실선 + offset 2의 포커스 표시를 갖고,
 * 그 색이 "바로 뒤 바탕"과 3:1 이상이어야 한다(WCAG 2.2 AA 1.4.11). Strong 버튼 포함, Light·Dark.
 */
const ROUTES = [
  '/app/schedule',
  '/app/customers',
  '/app/customers/customer-patient-1',
  '/app/events/followup-patient-1',
  '/app/events/followup-tenant-1',
  '/app/customers/new',
  '/app/settings',
  '/app/assistant',
];

type Sample = {
  label: string;
  outlineColor: string;
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  backdrop: string;
  contrast: number;
};

async function tabAndMeasure(page: Page, maxTabs = 60): Promise<Sample[]> {
  const samples: Sample[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    const sample = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const parse = (value: string): [number, number, number, number] => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0, 0];
        const parts = m[1]!
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      // 바로 뒤 바탕: 요소 바깥(링이 그려지는 자리)이므로 부모부터 불투명한 배경을 만날 때까지 합성한다.
      const layers: Array<[number, number, number, number]> = [];
      for (let node = el.parentElement; node; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] >= 1) break;
      }
      let base: [number, number, number] = parse(
        getComputedStyle(document.documentElement).backgroundColor,
      ).slice(0, 3) as [number, number, number];
      if (layers.length === 0 || layers[layers.length - 1]![3] < 1) {
        base = base[0] + base[1] + base[2] === 0 ? [255, 255, 255] : base;
      }
      let backdrop: number[] =
        layers.length && layers[layers.length - 1]![3] >= 1 ? layers.pop()!.slice(0, 3) : base;
      while (layers.length) {
        const [r, g, b, a] = layers.pop()!;
        backdrop = [
          r * a + backdrop[0]! * (1 - a),
          g * a + backdrop[1]! * (1 - a),
          b * a + backdrop[2]! * (1 - a),
        ];
      }
      const style = getComputedStyle(el);
      const outline = parse(style.outlineColor);
      const l1 = lum(outline);
      const l2 = lum(backdrop);
      const label =
        (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30) +
        ' <' +
        el.tagName.toLowerCase() +
        '>';
      return {
        label,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        outlineOffset: parseFloat(style.outlineOffset),
        backdrop: `rgb(${backdrop.map((v) => Math.round(v)).join(',')})`,
        contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
      };
    });
    if (!sample) continue;
    const key = `${sample.label}|${sample.outlineColor}|${sample.backdrop}`;
    if (seen.has(key)) {
      if (samples.length > 3 && samples.length === seen.size) break;
      continue;
    }
    seen.add(key);
    samples.push(sample);
  }
  return samples;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`focus indicator is 2px solid, offset 2, and >= 3:1 against its backdrop (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const failures: string[] = [];
    let measured = 0;
    for (const route of ROUTES) {
      await page.goto(route);
      await page.locator('main, [data-app-content]').first().waitFor();
      for (const sample of await tabAndMeasure(page)) {
        measured += 1;
        const ok =
          sample.outlineStyle === 'solid' &&
          sample.outlineWidth >= 2 &&
          sample.outlineOffset >= 2 &&
          sample.contrast >= 3;
        if (!ok) {
          failures.push(
            `${route} ${sample.label}: ${sample.outlineStyle} ${sample.outlineWidth}px +${sample.outlineOffset} ${sample.outlineColor} on ${sample.backdrop} = ${sample.contrast.toFixed(2)}`,
          );
        }
      }
    }
    expect(measured).toBeGreaterThan(20);
    expect(failures).toEqual([]);
  });
}

test('the Strong 기록 완료 button shows a visible focus ring (Light and Dark)', async ({
  page,
}) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/app/events/followup-patient-1');
    const strong = page.locator('[data-event-action="occur"]');
    await strong.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(strong).toBeFocused();
    const style = await strong.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        color: s.outlineColor,
        width: s.outlineWidth,
        offset: s.outlineOffset,
        text: s.color,
      };
    });
    expect(style.width).toBe('2px');
    expect(style.offset).toBe('2px');
    // 글자색(on-strong)이나 반투명이 아니라 포커스 토큰 색이어야 한다.
    expect(style.color).not.toBe(style.text);
    expect(style.color).not.toMatch(/rgba\(.*,\s*0?\.\d+\)/);
  }
});
