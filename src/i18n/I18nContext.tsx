import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import type { Locale } from '@/constants/routes';
import { getMessages, type MessageKey } from '@/i18n/dictionary';

interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveMessage(key: MessageKey, locale: Locale): string {
  const value: unknown = key
    .split('.')
    .reduce<unknown>(
      (current, segment) => (current as Record<string, unknown> | undefined)?.[segment],
      getMessages(locale),
    );
  if (typeof value !== 'string') throw new Error(`Missing message "${key}" for "${locale}".`);
  return value;
}

function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => params[name] ?? match);
}

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key, params) => interpolate(resolveMessage(key, locale), params) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider.');
  return context;
}
