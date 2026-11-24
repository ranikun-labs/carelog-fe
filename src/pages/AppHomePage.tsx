import { Link } from 'react-router';

import { buttonVariants } from '@/components/ui/button';
import { buildAppCustomersPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function AppHomePage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-full flex-col items-start gap-4 p-5 pt-10">
      <h1 className="type-page-title text-foreground">{t('app.home.title')}</h1>
      <p className="type-reading text-text-secondary">{t('app.home.description')}</p>
      <Link className={buttonVariants()} to={buildAppCustomersPath()}>
        {t('app.home.customersAction')}
      </Link>
    </main>
  );
}
