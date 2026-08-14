import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { CustomerContextSection } from '@/components/customers/CustomerContextSection';
import { CustomerMemo } from '@/components/customers/CustomerMemo';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerUpcoming } from '@/components/customers/CustomerUpcoming';
import { PageHeader } from '@/components/common/PageHeader';
import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { EventForm, type EventFormSubmitValues } from '@/components/schedule/EventForm';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  buildAppAssistantPath,
  buildAppCustomerEditPath,
  buildAppCustomersPath,
} from '@/constants/routes';
import type { AssistantNavigationState } from '@/assistant/assistantTypes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import type { EventCreationInput } from '@/state/eventStore';

export interface CustomerDetailPageProps {
  customerId?: string;
  events?: readonly CustomerEvent[];
  now?: Date;
  /** Explicit customer-level memo evidence; legacy context is intentionally not a fallback. */
  memo?: string;
  onCreateEvent?: (input: EventCreationInput) => CustomerEvent | undefined;
}

export function CustomerDetailPage({
  customerId: customerIdProp,
  events = SCHEDULE_FIXTURE.events,
  now = new Date(),
  memo,
  onCreateEvent,
}: CustomerDetailPageProps) {
  const { customerId: routeCustomerId = '' } = useParams();
  const customerId = customerIdProp ?? routeCustomerId;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const [isCreating, setIsCreating] = useState(false);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const customer = customerStore.getCustomer(customerId);

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

  if (!customer) return <AppNotFoundPage />;
  const currentCustomer = customer;
  const sourceEvents =
    eventStore && events === SCHEDULE_FIXTURE.events ? eventStore.events : events;
  const customerEvents = sourceEvents.filter((event) => event.customerId === currentCustomer.id);
  const createEvent = onCreateEvent ?? (eventStore ? eventStore.createEvent : undefined);
  const explicitMemo = memo ?? currentCustomer.customerMemo;

  const openEvent = adaptiveHost
    ? (event: CustomerEvent) => adaptiveHost.selectCustomerEvent(currentCustomer.id, event.id)
    : undefined;

  const assistantNavigation: AssistantNavigationState = {
    context: { kind: 'customer', customerId: currentCustomer.id },
    returnTo: { kind: 'customer-detail', customerId: currentCustomer.id },
  };

  function openAssistant() {
    if (adaptiveHost) {
      adaptiveHost.openAssistant(assistantNavigation);
      return;
    }
    navigate(buildAppAssistantPath(), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: currentCustomer.id,
        assistant: assistantNavigation,
      },
    });
  }

  function handleCreate(values: EventFormSubmitValues) {
    if (!createEvent) return;

    const input: EventCreationInput =
      values.status === 'PLANNED'
        ? {
            status: 'PLANNED',
            customerId: currentCustomer.id,
            scheduledAt: values.scheduledAt ?? '',
            ...(values.descriptor ? { descriptor: values.descriptor } : {}),
            ...(values.note ? { note: values.note } : {}),
          }
        : {
            status: 'OCCURRED',
            customerId: currentCustomer.id,
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
      data-selected-customer-id={currentCustomer.id}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={currentCustomer.displayName}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
        trailing={
          <Link
            to={buildAppCustomerEditPath(currentCustomer.id)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            data-edit-customer
          >
            {t('customers.detail.edit')}
          </Link>
        }
      />
      <div
        ref={scrollSurfaceRef}
        data-scroll-surface
        data-root-scroll-surface="customers-detail"
        className="flex-1 overflow-y-auto p-6"
      >
        <AdaptiveSurfaceContent policy="readable">
          <section data-customer-identity aria-label={t('customers.detail.title')}>
            {currentCustomer.workspace.name ? (
              <Badge tone="info">{currentCustomer.workspace.name}</Badge>
            ) : null}
            <CustomerContextSection context={currentCustomer.context} />
          </section>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!createEvent}
              data-add-event
              onClick={() => setIsCreating(true)}
            >
              {t('customers.detail.addEvent')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-assistant-entry="customer"
              onClick={openAssistant}
            >
              {t('customers.detail.askAssistant')}
            </Button>
          </div>

          {isCreating && createEvent ? (
            <EventForm
              mode="create"
              customerName={currentCustomer.displayName}
              now={now}
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
            />
          ) : null}

          <CustomerUpcoming events={customerEvents} now={now} onOpenEvent={openEvent} />
          <CustomerMemo memo={explicitMemo} />
          <CustomerTimeline events={customerEvents} onOpenEvent={openEvent} />
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}
