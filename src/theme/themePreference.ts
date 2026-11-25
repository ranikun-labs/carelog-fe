export const THEME_STORAGE_KEY = 'carelog.theme';
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

/** `--page` 값과 같게 유지한다(globals.css, 테스트가 일치를 고정). 브라우저 UI 색(theme-color)에 쓴다. */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f2f4f6', dark: '#0f1114' };

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** 저장값이 없거나 손상·접근 불가이면 'system'(시스템 설정 추종). */
export function readStoredThemePreference(): ThemePreference {
  try {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 저장에 실패해도 이번 세션의 화면 테마는 바뀐다(이 기기 저장만 건너뛴다).
  }
}

export function systemPrefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** `.dark` class, color-scheme, theme-color meta를 한 번에 맞춘다. */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = THEME_COLOR[theme];
}
