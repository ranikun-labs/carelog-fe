import { createContext, useContext, useState, type ReactNode } from 'react';

import { isSupportedLocale, type Locale } from '@/constants/routes';
import { resolveInitialAppLocale, writeStoredAppLocale } from '@/i18n/appLocale';
import { I18nProvider, useTranslation } from '@/i18n/I18nContext';

const LocaleSetterContext = createContext<((locale: Locale) => void) | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(resolveInitialAppLocale);
  const setLocale = (next: Locale) => {
    if (!isSupportedLocale(next)) return;
    setLocaleState(next);
    writeStoredAppLocale(next);
  };

  return (
    <LocaleSetterContext.Provider value={setLocale}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </LocaleSetterContext.Provider>
  );
}

export function useAppLocale() {
  const { locale } = useTranslation();
  const setLocale = useContext(LocaleSetterContext);
  if (!setLocale) throw new Error('useAppLocale must be used within AppLocaleProvider.');
  return { locale, setLocale };
}
