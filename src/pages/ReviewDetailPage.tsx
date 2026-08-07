import { useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { buildAppCustomersPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function ReviewDetailPage() {
  const { reviewId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('reviews.detail.title')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <main className="flex-1 p-6">
        <p className="text-text-secondary break-all">{reviewId}</p>
        <EmptyState title={t('reviews.detail.title')} description={t('placeholder.comingSoon')} />
      </main>
    </div>
  );
}
