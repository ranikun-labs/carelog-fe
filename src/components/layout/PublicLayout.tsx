import { Link, Outlet, useParams } from 'react-router';

import {
  buildPublicFeaturesPath,
  buildPublicHomePath,
  isSupportedLocale,
} from '@/constants/routes';
import { I18nProvider, useTranslation } from '@/i18n/I18nContext';
import { PublicNotFoundPage } from '@/pages/public/PublicNotFoundPage';

// 터치 타깃 44×44: 텍스트 링크라도 패딩으로 확보한다.
const linkClass = 'rounded-control inline-flex min-h-11 min-w-11 items-center justify-center px-3';

function PublicChrome() {
  const { locale, t } = useTranslation();
  const peer = locale === 'ko' ? 'en' : 'ko';
  return (
    <div className="min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="border-b pt-[env(safe-area-inset-top)]">
        <nav
          aria-label={t('navigation.ariaLabel')}
          className="type-body mx-auto flex max-w-5xl items-center gap-1 px-4 py-2"
        >
          <Link className={`${linkClass} font-semibold`} to={buildPublicHomePath(locale)}>
            {t('common.appName')}
          </Link>
          <Link className={`${linkClass} ml-auto`} to={buildPublicHomePath(locale)}>
            {t('navigation.home')}
          </Link>
          <Link className={linkClass} to={buildPublicFeaturesPath(locale)}>
            {t('navigation.features')}
          </Link>
          <Link
            className={linkClass}
            aria-label={t('common.changeLanguage')}
            to={buildPublicHomePath(peer)}
          >
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
