import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/constants/routes';
import { useAuth } from '@/auth/AuthProvider';
import { useAppLocale } from '@/i18n/AppLocaleProvider';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePreference } from '@/theme/themePreference';

export function SettingsPage() {
  const { locale, setLocale } = useAppLocale();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const themeOptions: readonly [ThemePreference, string][] = [
    ['system', t('settings.themeSystem')],
    ['light', t('settings.themeLight')],
    ['dark', t('settings.themeDark')],
  ];
  const options: readonly [Locale, string][] = [
    ['ko', t('settings.korean')],
    ['en', t('settings.english')],
  ];
  return (
    <main className="grid gap-8 p-6 pt-10">
      <div>
        <h1 className="type-page-title text-foreground">{t('auth.account.title')}</h1>
        <p className="type-body text-text-secondary mt-2">{t('auth.account.description')}</p>
      </div>
      <section className="grid gap-4">
        <h2 className="type-section-title text-foreground">{t('settings.title')}</h2>
        <p className="type-body text-text-secondary">{t('settings.description')}</p>
        <p className="type-content-title text-foreground mt-4">
          {t('settings.currentLanguage')}: {locale.toUpperCase()}
        </p>
        {/* 선택 표시는 행동 강도(Strong)가 아니라 brand-subtle 면 + 체크로 한다(M6). 단일 선택은 native radio. */}
        <fieldset className="grid min-w-0 gap-2">
          <legend className="sr-only">{t('settings.currentLanguage')}</legend>
          {options.map(([value, label]) => {
            const selected = locale === value;
            return (
              <label
                key={value}
                data-locale-option={value}
                className={cn(
                  'rounded-control type-body flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold',
                  'has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                  selected ? 'bg-brand-subtle text-brand-deep' : 'bg-inset text-foreground',
                )}
              >
                <input
                  type="radio"
                  name="app-locale"
                  value={value}
                  checked={selected}
                  onChange={() => setLocale(value)}
                  className="sr-only"
                />
                <span className="min-w-0 wrap-anywhere break-keep">{label}</span>
                {selected ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
              </label>
            );
          })}
        </fieldset>
      </section>
      <section className="grid gap-4">
        <h2 className="type-section-title text-foreground">{t('settings.themeTitle')}</h2>
        <fieldset className="grid min-w-0 gap-2">
          <legend className="sr-only">{t('settings.themeTitle')}</legend>
          {themeOptions.map(([value, label]) => {
            const selected = preference === value;
            return (
              <label
                key={value}
                data-theme-option={value}
                className={cn(
                  'rounded-control type-body flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold',
                  'has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                  selected ? 'bg-brand-subtle text-brand-deep' : 'bg-inset text-foreground',
                )}
              >
                <input
                  type="radio"
                  name="app-theme"
                  value={value}
                  checked={selected}
                  onChange={() => setPreference(value)}
                  className="sr-only"
                />
                <span className="min-w-0 wrap-anywhere break-keep">{label}</span>
                {selected ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
              </label>
            );
          })}
        </fieldset>
      </section>
      <Button
        type="button"
        variant="outline"
        onClick={() => void logout()}
        className="w-full sm:w-fit"
      >
        {t('auth.account.logout')}
      </Button>
    </main>
  );
}
