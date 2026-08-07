import {
  APP_LOCALE_STORAGE_KEY,
  normalizeBrowserLocale,
  resolveInitialAppLocale,
} from '@/i18n/appLocale';

describe('app locale', () => {
  beforeEach(() => localStorage.clear());

  it('uses storage before the browser locale', () => {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'en');
    expect(resolveInitialAppLocale()).toBe('en');
  });

  it('normalizes browser locale candidates', () => {
    expect(normalizeBrowserLocale(['fr-FR', 'ko-KR'])).toBe('ko');
    expect(normalizeBrowserLocale(['fr-FR'])).toBeUndefined();
  });
});
