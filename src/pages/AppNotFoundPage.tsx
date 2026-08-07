import { Link } from 'react-router';

import { buildAppHomePath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function AppNotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-content-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="text-text-secondary">{t('notFound.description')}</p>
      <Link className="text-primary underline" to={buildAppHomePath()}>
        {t('notFound.action')}
      </Link>
    </main>
  );
}
