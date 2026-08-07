import { useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function CustomerImportPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('customers.import.title')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomerDetailPath(customerId))}
      />
      <main className="flex-1 p-6">
        <EmptyState
          title={t('customers.import.title')}
          description={t('placeholder.comingSoon')}
        />
      </main>
    </div>
  );
}
