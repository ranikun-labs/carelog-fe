import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  THEME_COLOR,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  readStoredThemePreference,
  resolveTheme,
  writeStoredThemePreference,
} from '@/theme/themePreference';

function stubMatchMedia(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi
      .fn()
      .mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  document.head.querySelector('meta[name="theme-color"]')?.remove();
});

describe('theme preference', () => {
  it('defaults to system and ignores corrupted stored values', () => {
    expect(readStoredThemePreference()).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readStoredThemePreference()).toBe('system');
    writeStoredThemePreference('dark');
    expect(readStoredThemePreference()).toBe('dark');
  });

  it('survives unavailable storage without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredThemePreference()).toBe('system');
    expect(() => writeStoredThemePreference('light')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('resolves explicit choices over the system setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('syncs the dark class, color-scheme and theme-color meta', () => {
    applyResolvedTheme('dark');
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
    expect(meta.content).toBe(THEME_COLOR.dark);
    applyResolvedTheme('light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    expect(meta.content).toBe(THEME_COLOR.light);
  });

  it('keeps theme-color equal to the --page token of each theme', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const light = /:root\s*\{[^}]*?--page:\s*(#[0-9a-f]{6})/is.exec(css)?.[1];
    const dark = /\.dark\s*\{[^}]*?--page:\s*(#[0-9a-f]{6})/is.exec(css)?.[1];
    expect(light).toBe(THEME_COLOR.light);
    expect(dark).toBe(THEME_COLOR.dark);
  });
});

describe('first-paint inline script (index.html)', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];

  function run(stored: string | null, systemDark: boolean) {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#f2f4f6" />');
    stubMatchMedia(systemDark);
    if (stored) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
    new Function(script)();
    return {
      dark: document.documentElement.classList.contains('dark'),
      scheme: document.documentElement.style.colorScheme,
      meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content,
    };
  }

  it.each([
    [null, false, 'light'],
    [null, true, 'dark'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['garbage', true, 'dark'],
  ] as const)(
    'stored=%s systemDark=%s -> %s, same as resolveTheme',
    (stored, systemDark, expected) => {
      const result = run(stored, systemDark);
      expect(result.dark).toBe(expected === 'dark');
      expect(result.scheme).toBe(expected);
      expect(result.meta).toBe(THEME_COLOR[expected]);
      const pref = stored === 'light' || stored === 'dark' ? stored : 'system';
      expect(resolveTheme(pref, systemDark)).toBe(expected);
    },
  );

  it('falls back to the system setting when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    stubMatchMedia(true);
    expect(() => new Function(script)()).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    vi.restoreAllMocks();
  });
});
