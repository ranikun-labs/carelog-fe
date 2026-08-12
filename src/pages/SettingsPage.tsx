import { Button } from '@/components/ui/button';
import type { Locale } from '@/constants/routes';
import { useAuth } from '@/auth/AuthProvider';
import { useAppLocale } from '@/i18n/AppLocaleProvider';
import { useTranslation } from '@/i18n/I18nContext';

export function SettingsPage() {
  const { locale, setLocale } = useAppLocale();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const options: readonly [Locale, string][] = [
    ['ko', t('settings.korean')],
    ['en', t('settings.english')],
  ];
  return (
    <main className="grid gap-8 p-6 pt-10">
      <div>
        <h1 className="text-3xl font-bold">{t('auth.account.title')}</h1>
        <p className="text-text-secondary mt-2">{t('auth.account.description')}</p>
      </div>
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
        <p className="text-text-secondary">{t('settings.description')}</p>
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
