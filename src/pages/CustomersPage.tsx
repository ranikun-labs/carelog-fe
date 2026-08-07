import { Users } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { useTranslation } from '@/i18n/I18nContext';

export function CustomersPage() {
  const { t } = useTranslation();
  return (
    <main className="p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('customers.title')}</h1>
      <p className="text-text-secondary mt-2">{t('customers.description')}</p>
      <EmptyState
        icon={<Users className="size-8" aria-hidden="true" />}
        title={t('customers.title')}
        description={t('placeholder.comingSoon')}
      />
    </main>
  );
}
