import { useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { buildAppCustomersPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function CustomerDetailPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('customers.detail.title')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <main className="flex-1 p-6">
        <p className="text-text-secondary break-all">{customerId}</p>
        <EmptyState
          title={t('customers.detail.title')}
          description={t('placeholder.comingSoon')}
        />
      </main>
    </div>
  );
}
