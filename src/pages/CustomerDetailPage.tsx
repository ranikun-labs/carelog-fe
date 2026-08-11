import { useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomerContextSection } from '@/components/customers/CustomerContextSection';
import { CustomerMemo } from '@/components/customers/CustomerMemo';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerUpcoming } from '@/components/customers/CustomerUpcoming';
import { PageHeader } from '@/components/common/PageHeader';
import { buildAppCustomersPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';

export interface CustomerDetailPageProps {
  events?: readonly CustomerEvent[];
  now?: Date;
  /** Explicit customer-level memo evidence; legacy context is intentionally not a fallback. */
  memo?: string;
}

export function CustomerDetailPage({
  events = SCHEDULE_FIXTURE.events,
  now = new Date(),
  memo,
}: CustomerDetailPageProps) {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scenario = SCENARIO_FIXTURES.find((entry) => entry.customer.id === customerId);

  if (!scenario) return <AppNotFoundPage />;

  const customerEvents = events.filter((event) => event.customerId === scenario.customer.id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={scenario.customer.displayName}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <section data-customer-identity aria-label={t('customers.detail.title')}>
          <Badge tone="info">{scenario.workspace.name}</Badge>
          <CustomerContextSection context={scenario.context} />
        </section>

        <div className="mt-6">
          <Button type="button" variant="outline" disabled>
            {t('customers.detail.addEvent')}
          </Button>
        </div>

        <CustomerUpcoming events={customerEvents} now={now} />
        <CustomerMemo memo={memo} />
        <CustomerTimeline events={customerEvents} />
      </main>
    </div>
  );
}
