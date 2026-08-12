import { Link, Outlet } from 'react-router';

import { buildAuthEntryPath } from '@/constants/routes';
import { useAppLocale } from '@/i18n/AppLocaleProvider';
import { useTranslation } from '@/i18n/I18nContext';

export function AuthLayout() {
  const { locale, setLocale } = useAppLocale();
  const { t } = useTranslation();
  const peer = locale === 'ko' ? 'en' : 'ko';

  return (
    <div data-auth-surface className="bg-page min-h-dvh w-full">
      <header className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          to={buildAuthEntryPath()}
          className="text-text-primary rounded-md font-semibold"
          aria-label={t('auth.entry.title')}
        >
          {t('common.appName')}
        </Link>
        <button
          type="button"
          className="text-text-secondary hover:bg-subtle min-h-11 rounded-md px-3 text-sm font-semibold"
          onClick={() => setLocale(peer)}
          aria-label={t('common.changeLanguage')}
        >
          {peer.toUpperCase()}
        </button>
      </header>
      <main className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[560px] items-center px-5 py-8 sm:px-8">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
