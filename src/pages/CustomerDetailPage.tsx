import { useNavigate, useParams } from 'react-router';

import { adaptLegacyCustomerEvents } from '@/adapters/legacyCustomerEventAdapter';
import { Badge } from '@/components/ui/badge';
import { CustomerContextSection } from '@/components/customers/CustomerContextSection';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { PageHeader } from '@/components/common/PageHeader';
import { buildAppCustomersPath } from '@/constants/routes';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';

export function CustomerDetailPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scenario = SCENARIO_FIXTURES.find((entry) => entry.customer.id === customerId);

  if (!scenario) return <AppNotFoundPage />;

  const { events } = adaptLegacyCustomerEvents({
    timelineEntries: scenario.timeline,
    followUps: [scenario.followUp],
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={scenario.customer.displayName}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <Badge tone="info">{scenario.workspace.name}</Badge>
        <CustomerContextSection context={scenario.context} />
        <CustomerTimeline events={events} />
      </main>
    </div>
  );
}
