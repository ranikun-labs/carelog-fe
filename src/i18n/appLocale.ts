import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/constants/routes';

export const APP_LOCALE_STORAGE_KEY = 'react-product-foundation.language';

export function normalizeBrowserLocale(candidates: readonly string[]): Locale | undefined {
  for (const candidate of candidates) {
    const primary = candidate.split(/[-_]/)[0].toLowerCase();
    if (isSupportedLocale(primary)) return primary;
  }
  return undefined;
}

export function readStoredAppLocale(): Locale | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
    return stored && isSupportedLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredAppLocale(locale: Locale): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale);
  } catch {
    // The active React state still changes when storage is unavailable.
  }
}

export function resolveInitialAppLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = readStoredAppLocale();
  if (stored) return stored;
  const browser = normalizeBrowserLocale(
    navigator.languages.length > 0 ? navigator.languages : [navigator.language],
  );
  return browser ?? DEFAULT_LOCALE;
}
