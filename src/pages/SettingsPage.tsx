import { Button } from '@/components/ui/button';
import type { Locale } from '@/constants/routes';
import { useAppLocale } from '@/i18n/AppLocaleProvider';
import { useTranslation } from '@/i18n/I18nContext';

export function SettingsPage() {
  const { locale, setLocale } = useAppLocale();
  const { t } = useTranslation();
  const options: readonly [Locale, string][] = [
    ['ko', t('settings.korean')],
    ['en', t('settings.english')],
  ];
  return (
    <main className="p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      <p className="text-text-secondary mt-2">{t('settings.description')}</p>
      <p className="mt-8 font-medium">
        {t('settings.currentLanguage')}: {locale.toUpperCase()}
      </p>
      <div className="mt-4 flex gap-3">
        {options.map(([value, label]) => (
          <Button
            key={value}
            variant={locale === value ? 'default' : 'outline'}
            aria-pressed={locale === value}
            onClick={() => setLocale(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </main>
  );
}
