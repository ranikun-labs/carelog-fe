import '@/styles/globals.css';
import globalsCss from '@/styles/globals.css?raw';

function rootToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function colorToken(name: string): string {
  return rootToken(name).replaceAll(' ', '');
}

describe('Carelog semantic design tokens (Foundation v1.0.0)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('loads the Foundation light color contract with the Teal brand', () => {
    expect(colorToken('--page')).toBe('#f2f4f6');
    expect(colorToken('--card')).toBe('#ffffff');
    expect(colorToken('--control')).toBe('#e9ecef');
    expect(colorToken('--foreground')).toBe('#191f28');
    expect(colorToken('--text-secondary')).toBe('#4e5968');
    expect(colorToken('--text-tertiary')).toBe('#5b6673');
    expect(colorToken('--primary')).toBe('#007974');
    expect(colorToken('--brand-deep')).toBe('#00605c');
    expect(colorToken('--brand-subtle')).toBe('#d9f1ef');
    expect(colorToken('--warning')).toBe('#8a4a00');
    expect(colorToken('--warning-bg')).toBe('#fff1d6');
    expect(colorToken('--border')).toBe('#e5e8eb');
  });

  it('keeps every RPL-56 token name as an alias of a Foundation token', () => {
    const aliases: Record<string, string> = {
      '--bg-page': 'var(--page)',
      '--bg-surface': 'var(--card)',
      '--bg-subtle': 'var(--control)',
      '--text-primary': 'var(--foreground)',
      '--status-neutral-foreground': 'var(--text-secondary)',
      '--border-subtle': 'var(--border)',
      '--border-default': 'var(--border)',
      '--accent-primary': 'var(--primary)',
      '--accent-primary-deep': 'var(--brand-deep)',
      '--accent-primary-bg': 'var(--brand-subtle)',
      '--accent-primary-rail': 'var(--status-rail-planned)',
      '--warning-rail': 'var(--status-rail-warning)',
      '--rail-neutral': 'var(--status-rail-neutral)',
    };
    for (const [name, value] of Object.entries(aliases)) {
      expect(colorToken(name), name).toBe(value);
    }
  });

  it('loads the spacing, rail and shadow contract (RPL-56 product grammar unchanged)', () => {
    expect(rootToken('--space-1')).toBe('4px');
    expect(rootToken('--space-2')).toBe('8px');
    expect(rootToken('--space-3')).toBe('12px');
    expect(rootToken('--space-4')).toBe('16px');
    expect(rootToken('--space-5')).toBe('20px');
    expect(rootToken('--space-6')).toBe('24px');
    expect(rootToken('--space-8')).toBe('32px');
    expect(rootToken('--status-rail-width')).toBe('3px');
    expect(rootToken('--shadow-default')).toBe('none');
  });

  it('loads the Foundation radius set: badge 6 / control 10 / inset 12 / card 16 / sheet 24', () => {
    // @theme 블록은 jsdom 계산 스타일에 나오지 않아 소스에서 읽는다.
    const theme = globalsCss.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const read = (name: string) => theme.match(new RegExp(`--radius-${name}:\\s*([^;]+);`))?.[1];
    expect(read('badge')).toBe('6px');
    expect(read('control')).toBe('10px');
    expect(read('inset')).toBe('12px');
    expect(read('card')).toBe('16px');
    expect(read('sheet')).toBe('24px');
    expect(rootToken('--radius-pane')).toBe('var(--radius-card)');
  });

  it('loads the Compact density without inventing unspecified line heights', () => {
    expect(rootToken('--control-h')).toBe('44px');
    expect(rootToken('--touch-min')).toBe('44px');
    expect(rootToken('--type-page-title-size')).toBe('22px');
    expect(rootToken('--type-body-size')).toBe('14px');
    expect(rootToken('--type-body-lh')).toBe('21px');
    expect(rootToken('--type-reading-lh')).toBe('24px');
    // 12px 미만 텍스트 금지
    for (const match of globalsCss.matchAll(/--type-[a-z-]+-size:\s*(\d+)px/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(12);
    }
  });

  it('redefines the full palette and every alias for dark (no light values inherited)', () => {
    document.documentElement.classList.add('dark');

    expect(colorToken('--primary')).toBe('#3cb7ab');
    expect(colorToken('--brand-deep')).toBe('#8fe0d6');
    expect(colorToken('--brand-subtle')).toBe('#0f2e2c');
    expect(colorToken('--warning')).toBe('#f0b44c');
    expect(colorToken('--warning-bg')).toBe('#33260c');
    expect(colorToken('--status-neutral-foreground')).toBe('var(--text-secondary)');
    expect(colorToken('--accent-primary-bg')).toBe('var(--brand-subtle)');
    expect(colorToken('--muted-foreground')).toBe('var(--text-tertiary)');

    // .dark 블록은 :root 블록의 모든 색 토큰 이름을 다시 선언해야 한다.
    const rootBlock = globalsCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const darkBlock = globalsCss.match(/\n\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const names = (block: string) =>
      [...block.matchAll(/^\s*(--[a-z-]+):/gm)].map((m) => m[1]).filter((n) => !isStructural(n));
    const dark = new Set(names(darkBlock));
    const missing = names(rootBlock).filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });
});

/** 테마와 무관한 구조 토큰(밀도·간격·반경·레일 폭·그림자). */
function isStructural(name: string): boolean {
  return /^--(radius|touch-min|control-h|type-|space-|status-rail-width|shadow-default)/.test(name);
}
