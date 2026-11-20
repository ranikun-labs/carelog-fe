import {
  APP_LOCALE_STORAGE_KEY,
  PUBLIC_LOCALE_SESSION_KEY,
  normalizeBrowserLocale,
  resolveInitialAppLocale,
} from '@/i18n/appLocale';

describe('app locale', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a public language in this tab unless an explicit choice exists', () => {
    sessionStorage.setItem(PUBLIC_LOCALE_SESSION_KEY, 'en');
    expect(resolveInitialAppLocale()).toBe('en');
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'ko');
    expect(resolveInitialAppLocale()).toBe('ko');
  });

  it('uses storage before the browser locale', () => {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'en');
    expect(resolveInitialAppLocale()).toBe('en');
  });

  it('normalizes browser locale candidates', () => {
    expect(normalizeBrowserLocale(['fr-FR', 'ko-KR'])).toBe('ko');
    expect(normalizeBrowserLocale(['fr-FR'])).toBeUndefined();
  });
});
