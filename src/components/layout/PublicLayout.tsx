import { Link, Outlet, useParams } from 'react-router';

import {
  buildPublicFeaturesPath,
  buildPublicHomePath,
  isSupportedLocale,
} from '@/constants/routes';
import { I18nProvider, useTranslation } from '@/i18n/I18nContext';
import { PublicNotFoundPage } from '@/pages/public/PublicNotFoundPage';

function PublicChrome() {
  const { locale, t } = useTranslation();
  const peer = locale === 'ko' ? 'en' : 'ko';
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <nav
          aria-label={t('navigation.ariaLabel')}
          className="mx-auto flex max-w-5xl items-center gap-5 px-5 py-4"
        >
          <Link className="font-semibold" to={buildPublicHomePath(locale)}>
            {t('common.appName')}
          </Link>
          <Link className="ml-auto" to={buildPublicHomePath(locale)}>
            {t('navigation.home')}
          </Link>
          <Link to={buildPublicFeaturesPath(locale)}>{t('navigation.features')}</Link>
          <Link aria-label={t('common.changeLanguage')} to={buildPublicHomePath(peer)}>
            {peer.toUpperCase()}
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export function PublicLayout() {
  const { locale = '' } = useParams();
  if (!isSupportedLocale(locale)) return <PublicNotFoundPage />;
  return (
    <I18nProvider locale={locale}>
      <PublicChrome />
    </I18nProvider>
  );
}
