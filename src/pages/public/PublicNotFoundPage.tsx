import { Link } from 'react-router';

import { DEFAULT_LOCALE, buildPublicHomePath } from '@/constants/routes';
import { I18nProvider, useTranslation } from '@/i18n/I18nContext';

function Content() {
  const { locale, t } = useTranslation();
  return (
    <main className="grid min-h-dvh place-content-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="text-text-secondary">{t('notFound.description')}</p>
      <Link className="text-primary underline" to={buildPublicHomePath(locale)}>
        {t('notFound.action')}
      </Link>
    </main>
  );
}

export function PublicNotFoundPage() {
  return (
    <I18nProvider locale={DEFAULT_LOCALE}>
      <Content />
    </I18nProvider>
  );
}
