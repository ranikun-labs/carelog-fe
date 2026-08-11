import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomerContextSection } from '@/components/customers/CustomerContextSection';
import { CustomerMemo } from '@/components/customers/CustomerMemo';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerUpcoming } from '@/components/customers/CustomerUpcoming';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface, useOptionalAdaptiveHost } from '@/components/layout/adaptiveHostContext';
import { EventForm, type EventFormSubmitValues } from '@/components/schedule/EventForm';
import { buildAppCustomersPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import type { EventCreationInput } from '@/state/eventStore';

export interface CustomerDetailPageProps {
  events?: readonly CustomerEvent[];
  now?: Date;
  /** Explicit customer-level memo evidence; legacy context is intentionally not a fallback. */
  memo?: string;
  onCreateEvent?: (input: EventCreationInput) => CustomerEvent | undefined;
}

export function CustomerDetailPage({
  events = SCHEDULE_FIXTURE.events,
  now = new Date(),
  memo,
  onCreateEvent,
}: CustomerDetailPageProps) {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const eventStore = useOptionalEventStore();
  const [isCreating, setIsCreating] = useState(false);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const scenario = SCENARIO_FIXTURES.find((entry) => entry.customer.id === customerId);

  useLayoutEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface || !adaptiveHost) return;
    scrollSurface.scrollTop = adaptiveHost.customers.detailScrollTop;
  }, [adaptiveHost]);

  useEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;
    const updateScrollPosition = () => {
      adaptiveHost?.setCustomerDetailScrollTop(scrollSurface.scrollTop);
    };
    scrollSurface.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => scrollSurface.removeEventListener('scroll', updateScrollPosition);
  }, [adaptiveHost]);

  if (!scenario) return <AppNotFoundPage />;

  const customer = scenario;
  const sourceEvents =
    eventStore && events === SCHEDULE_FIXTURE.events ? eventStore.events : events;
  const customerEvents = sourceEvents.filter((event) => event.customerId === customer.customer.id);
  const createEvent = onCreateEvent ?? (eventStore ? eventStore.createEvent : undefined);

  const openEvent =
    adaptiveHost?.mode === 'two-pane'
      ? (event: CustomerEvent) => adaptiveHost.selectCustomerEvent(customer.customer.id, event.id)
      : undefined;

  function handleCreate(values: EventFormSubmitValues) {
    if (!createEvent) return;

    const input: EventCreationInput =
      values.status === 'PLANNED'
        ? {
            status: 'PLANNED',
            customerId: customer.customer.id,
            scheduledAt: values.scheduledAt ?? '',
            ...(values.descriptor ? { descriptor: values.descriptor } : {}),
            ...(values.note ? { note: values.note } : {}),
          }
        : {
            status: 'OCCURRED',
            customerId: customer.customer.id,
            occurredAt: values.occurredAt ?? '',
            ...(values.descriptor ? { descriptor: values.descriptor } : {}),
            ...(values.note ? { note: values.note } : {}),
          };

    createEvent(input);
    setIsCreating(false);
  }

  return (
    <AdaptiveSurface
      majorSurface="customer-detail"
      data-customer-detail-page
      data-selected-customer-id={customer.customer.id}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={customer.customer.displayName}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <div
        ref={scrollSurfaceRef}
        data-scroll-surface
        data-root-scroll-surface="customers-detail"
        className="flex-1 overflow-y-auto p-6"
      >
        <section data-customer-identity aria-label={t('customers.detail.title')}>
          <Badge tone="info">{customer.workspace.name}</Badge>
          <CustomerContextSection context={customer.context} />
        </section>

        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            disabled={!createEvent}
            data-add-event
            onClick={() => setIsCreating(true)}
          >
            {t('customers.detail.addEvent')}
          </Button>
        </div>

        {isCreating && createEvent ? (
          <EventForm
            mode="create"
            customerName={customer.customer.displayName}
            now={now}
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        ) : null}

        <CustomerUpcoming events={customerEvents} now={now} onOpenEvent={openEvent} />
        <CustomerMemo memo={memo} />
        <CustomerTimeline events={customerEvents} onOpenEvent={openEvent} />
      </div>
    </AdaptiveSurface>
  );
}
