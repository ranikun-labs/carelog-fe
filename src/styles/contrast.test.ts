// upstream pattern: finance-fe@7dd9590:src/styles/contrast.test.ts
// 로직(hex 파싱·휘도·별칭 추적)은 상류 패턴을 따르고, 쌍 목록과 Carelog 규칙은 이 레포 소유다.
import globalsCss from '@/styles/globals.css?raw';
import { describe, expect, it } from 'vitest';

function parseHexColor(value: string): [number, number, number] {
  const normalized = value.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance(hex: string): number {
  const channels = parseHexColor(hex).map((channel) => channel / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

type Theme = 'light' | 'dark';

function block(theme: Theme): string {
  const re = theme === 'light' ? /:root\s*\{([\s\S]*?)\n\}/ : /\n\.dark\s*\{([\s\S]*?)\n\}/;
  return globalsCss.match(re)?.[1] ?? '';
}

/** 테마 블록에서 토큰 hex를 읽는다. `var(--x)` 별칭은 같은 테마 → light 순서로 따라간다. */
export function token(theme: Theme, name: string, depth = 0): string {
  if (depth > 6) return '';
  for (const source of theme === 'dark' ? [block('dark'), block('light')] : [block('light')]) {
    const value = source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) continue;
    const alias = value.match(/^var\(--([a-z-]+)\)$/);
    if (alias) return token(theme, alias[1], depth + 1);
    return value;
  }
  return '';
}

// 텍스트 4.5:1 기준. 배경은 하드코딩하지 않고 실제 globals.css의 배경 토큰을 읽는다.
const SURFACES = ['page', 'card', 'inset', 'control'] as const;
const TEXTS = ['foreground', 'text-body', 'text-secondary', 'text-tertiary', 'muted-foreground'];
const STATUSES = ['success', 'warning', 'danger', 'conflict', 'info'] as const;

describe.each(['light', 'dark'] as const)('Foundation v1 %s theme contrast (>= 4.5:1)', (theme) => {
  const pairs: [string, string, string][] = [];
  for (const text of TEXTS) {
    for (const surface of SURFACES) {
      pairs.push([`${text} on ${surface}`, text, surface]);
    }
  }
  pairs.push(['primary on card', 'primary', 'card']);
  pairs.push(['primary on page', 'primary', 'page']);
  pairs.push(['brand-deep on brand-subtle', 'brand-deep', 'brand-subtle']);
  pairs.push(['brand-deep on card', 'brand-deep', 'card']);
  pairs.push(['primary-foreground on primary', 'primary-foreground', 'primary']);
  pairs.push(['on-danger-solid on danger-solid', 'on-danger-solid', 'danger-solid']);
  pairs.push(['destructive-foreground on destructive', 'destructive-foreground', 'destructive']);
  for (const status of STATUSES) {
    pairs.push([`${status} on ${status}-bg`, status, `${status}-bg`]);
    pairs.push([`${status} on card`, status, 'card']);
    pairs.push([`${status} on page`, status, 'page']);
  }
  // RPL-56 호환 별칭도 같은 기준을 통과해야 한다(화면 파일이 아직 이 이름을 쓴다).
  pairs.push(['text-primary on bg-page', 'text-primary', 'bg-page']);
  pairs.push(['text-primary on bg-surface', 'text-primary', 'bg-surface']);
  pairs.push(['text-primary on bg-subtle', 'text-primary', 'bg-subtle']);
  pairs.push(['text-tertiary on bg-subtle', 'text-tertiary', 'bg-subtle']);
  pairs.push(['status-neutral-foreground on bg-subtle', 'status-neutral-foreground', 'bg-subtle']);
  pairs.push([
    'accent-primary-deep on accent-primary-bg',
    'accent-primary-deep',
    'accent-primary-bg',
  ]);
  pairs.push(['accent-primary-deep on bg-surface', 'accent-primary-deep', 'bg-surface']);
  pairs.push(['accent-primary on bg-surface', 'accent-primary', 'bg-surface']);
  pairs.push(['warning on warning-bg (alias)', 'warning', 'warning-bg']);

  it.each(pairs)('%s', (_name, foreground, background) => {
    const fg = token(theme, foreground);
    const bg = token(theme, background);
    expect(fg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('control/input outline is at least 3:1 on card (non-text contrast)', () => {
    expect(contrastRatio(token(theme, 'input'), token(theme, 'card'))).toBeGreaterThanOrEqual(3);
  });

  // 입력은 카드 면 외에 page·inset 위에도 놓인다(인증·도우미·일정 폼). 외곽선 토큰은 어느 면에서도 3:1.
  it.each(['page', 'inset', 'control'] as const)(
    'control/input outline is at least 3:1 on %s (non-text contrast)',
    (surface) => {
      expect(contrastRatio(token(theme, 'input'), token(theme, surface))).toBeGreaterThanOrEqual(3);
    },
  );

  it('focus ring (brand strong) is at least 3:1 on card, page and brand-subtle', () => {
    for (const surface of ['card', 'page', 'brand-subtle']) {
      expect(
        contrastRatio(token(theme, 'ring'), token(theme, surface)),
        `ring on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Carelog Teal rule: text on brand-subtle must be brand-deep', () => {
  it('forbids Teal strong on brand-subtle in Light (4.46:1 < 4.5) — only deep is allowed', () => {
    const strongOnSubtle = contrastRatio(token('light', 'primary'), token('light', 'brand-subtle'));
    const deepOnSubtle = contrastRatio(
      token('light', 'brand-deep'),
      token('light', 'brand-subtle'),
    );
    // 이 값이 4.5를 넘게 바뀌면 규칙의 전제가 사라진 것이므로 규칙·README를 함께 재검토한다.
    expect(strongOnSubtle).toBeLessThan(4.5);
    expect(strongOnSubtle).toBeGreaterThan(4.4);
    expect(deepOnSubtle).toBeGreaterThanOrEqual(4.5);
  });

  // 소스 규칙: 같은 줄에서 brand-subtle 계열 면 위에 strong 글자(text-primary / text-accent-primary)를 쓰지 않는다.
  const sources = import.meta.glob('/src/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const SUBTLE_SURFACE = /\b(?:bg-brand-subtle|bg-accent-primary-bg)\b(?!\/)/;
  const STRONG_TEXT = /(?<![-\w])text-(?:primary|accent-primary|brand)(?![-\w])/;

  const violations = Object.entries(sources)
    .filter(([file]) => !/\.test\.tsx$/.test(file))
    .flatMap(([file, source]) =>
      source
        .split('\n')
        .filter((line) => SUBTLE_SURFACE.test(line) && STRONG_TEXT.test(line))
        .map(() => file),
    );

  it('ported ui components never put strong text on a brand-subtle surface', () => {
    expect(violations.filter((file) => file.startsWith('/src/components/ui/'))).toEqual([]);
  });

  it('screen files only contain the known pre-existing violation (cleared by the Auth status PR)', () => {
    // TODO(PR-7): AuthStatusSurface의 `bg-accent-primary-bg text-accent-primary`를 deep으로 교체하면 이 목록을 비운다.
    expect(violations.filter((file) => !file.startsWith('/src/components/ui/'))).toEqual([
      '/src/components/auth/AuthStatusSurface.tsx',
    ]);
  });
});

describe('Dark on-strong (Teal) — 제안(미확정)', () => {
  it('keeps the proposed dark on-strong at 4.5:1 or more on Teal strong', () => {
    expect(
      contrastRatio(token('dark', 'primary-foreground'), token('dark', 'primary')),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Foundation v1 token values shared with Finance 7dd9590 (drift guard)', () => {
  it.each([
    ['light', 'page', '#f2f4f6'],
    ['light', 'card', '#ffffff'],
    ['light', 'inset', '#f2f4f6'],
    ['light', 'control', '#e9ecef'],
    ['light', 'foreground', '#191f28'],
    ['light', 'text-body', '#333d4b'],
    ['light', 'text-secondary', '#4e5968'],
    ['light', 'text-tertiary', '#5b6673'],
    ['light', 'success', '#0a6b3b'],
    ['light', 'warning', '#8a4a00'],
    ['light', 'danger', '#c42336'],
    ['light', 'conflict', '#6b3fb4'],
    ['light', 'info', '#2a4f86'],
    ['light', 'border', '#e5e8eb'],
    ['light', 'input', '#78838f'],
    ['dark', 'page', '#0f1114'],
    ['dark', 'card', '#1a1d21'],
    ['dark', 'inset', '#22262b'],
    ['dark', 'control', '#2a2f35'],
    ['dark', 'foreground', '#f2f4f6'],
    ['dark', 'text-secondary', '#b4bcc5'],
    ['dark', 'text-tertiary', '#98a2ad'],
    ['dark', 'success', '#5fd08f'],
    ['dark', 'warning', '#f0b44c'],
    ['dark', 'danger', '#ff8a95'],
    ['dark', 'conflict', '#b79cf0'],
    ['dark', 'info', '#8fb2ea'],
  ] as const)('%s %s = %s', (theme, name, expected) => {
    expect(token(theme, name).toLowerCase()).toBe(expected);
  });
});

describe('Carelog brand.carelog Teal values (Foundation v1.0.0)', () => {
  it.each([
    ['light', 'primary', '#007974'],
    ['light', 'brand-deep', '#00605c'],
    ['light', 'brand-subtle', '#d9f1ef'],
    ['light', 'primary-foreground', '#ffffff'],
    ['dark', 'primary', '#3cb7ab'],
    ['dark', 'brand-deep', '#8fe0d6'],
    ['dark', 'brand-subtle', '#0f2e2c'],
  ] as const)('%s %s = %s', (theme, name, expected) => {
    expect(token(theme, name).toLowerCase()).toBe(expected);
  });
});
