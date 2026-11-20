import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

import { isSupportedLocale, type Locale } from '@/constants/routes';
import {
  readStoredAppLocale,
  resolveInitialAppLocale,
  writePublicSessionLocale,
  writeStoredAppLocale,
} from '@/i18n/appLocale';
import { I18nProvider, useTranslation } from '@/i18n/I18nContext';

const LocaleSetterContext = createContext<{
  setLocale: (locale: Locale) => void;
  adoptPublicLocale: (locale: Locale) => void;
} | null>(null);

export function AppLocaleProvider({
  children,
  syncDocumentLang = true,
}: {
  children: ReactNode;
  syncDocumentLang?: boolean;
}) {
  const [locale, setLocaleState] = useState(resolveInitialAppLocale);
  const explicitlySelected = useRef(readStoredAppLocale() !== null);
  const setLocale = (next: Locale) => {
    if (!isSupportedLocale(next)) return;
    explicitlySelected.current = true;
    setLocaleState(next);
    writeStoredAppLocale(next);
  };
  const adoptPublicLocale = (next: Locale) => {
    const stored = readStoredAppLocale();
    if (stored) {
      explicitlySelected.current = true;
      setLocaleState(stored);
      return;
    }
    if (!explicitlySelected.current && isSupportedLocale(next)) {
      setLocaleState(next);
      writePublicSessionLocale(next);
    }
  };

  return (
    <LocaleSetterContext.Provider value={{ setLocale, adoptPublicLocale }}>
      <I18nProvider locale={locale} syncDocumentLang={syncDocumentLang}>
        {children}
      </I18nProvider>
    </LocaleSetterContext.Provider>
  );
}

export function useAppLocale() {
  const { locale } = useTranslation();
  const setters = useContext(LocaleSetterContext);
  if (!setters) throw new Error('useAppLocale must be used within AppLocaleProvider.');
  return { locale, ...setters };
}
