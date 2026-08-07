import { Link } from 'react-router';

import { ComplianceNotice } from '@/components/ComplianceNotice';
import { buttonVariants } from '@/components/ui/button';
import { buildAppItemsPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function AppHomePage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-full flex-col gap-6 p-6 pt-12">
      <p className="text-primary font-medium">{t('app.home.eyebrow')}</p>
      <h1 className="text-3xl font-bold">{t('app.home.title')}</h1>
      <p className="text-text-secondary">{t('app.home.description')}</p>
      <Link className={buttonVariants()} to={buildAppItemsPath()}>
        {t('app.home.itemsAction')}
      </Link>
      <ComplianceNotice />
    </main>
  );
}
