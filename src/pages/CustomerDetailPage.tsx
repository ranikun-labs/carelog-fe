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
import { buildAppCustomerEditPath, buildAppCustomersPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import type { EventCreationInput } from '@/state/eventStore';

export interface CustomerDetailPageProps {
  events?: readonly CustomerEvent[];
  now?: Date;
  /** Explicit customer-level memo evidence; legacy context is intentionally not a fallback. */
  memo?: string;
  onCreateEvent?: (input: EventCreationInput) => CustomerEvent | undefined | Promise<CustomerEvent>;
}

export function CustomerDetailPage({
  events,
  now = new Date(),
  memo,
  onCreateEvent,
}: CustomerDetailPageProps) {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const loadCustomer = customerStore.loadCustomer;
  const loadCustomerDetail = eventStore?.loadCustomerDetail;
  const remoteReadsEnabled = eventStore?.remoteReadsEnabled ?? false;
  const [isCreating, setIsCreating] = useState(false);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const customer = customerStore.getCustomer(customerId);
  const queryNowRef = useRef(now);

  useEffect(() => {
    if (!customerStore.remoteReadsEnabled || customer || customerId === '') return;
    if (customerStore.detailLoadState !== 'idle') return;
    void loadCustomer(customerId).catch(() => undefined);
  }, [
    customer,
    customerId,
    customerStore.detailLoadState,
    customerStore.remoteReadsEnabled,
    loadCustomer,
  ]);

  useEffect(() => {
    if (!customer || !remoteReadsEnabled || !loadCustomerDetail || events !== undefined) return;
    void loadCustomerDetail(customer.id, queryNowRef.current).catch(() => undefined);
  }, [customer, events, loadCustomerDetail, remoteReadsEnabled]);

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

  if (!customer) {
    if (customerStore.detailLoadState === 'loading' || customerStore.loadState === 'loading') {
      return (
        <div role="status" aria-busy="true" className="p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    if (customerStore.error) {
      return (
        <div role="alert" className="p-6">
          {t(getCarelogMessageKey(customerStore.error))}
        </div>
      );
    }
    return <AppNotFoundPage />;
  }
  const currentCustomer = customer;
  const snapshot = eventStore?.getCustomerSnapshot(currentCustomer.id);
  const sourceEvents =
    events ??
    (eventStore?.remoteReadsEnabled
      ? [...(snapshot?.upcoming ?? []), ...(snapshot?.history ?? [])]
      : (eventStore?.events ?? []));
  const customerEvents = [
    ...new Map(
      sourceEvents
        .filter((event) => event.customerId === currentCustomer.id)
        .map((event) => [event.id, event]),
    ).values(),
  ];
  const createEvent = onCreateEvent ?? (eventStore ? eventStore.createEvent : undefined);
  const explicitMemo = memo ?? currentCustomer.customerMemo;

  const openEvent = adaptiveHost
    ? (event: CustomerEvent) => adaptiveHost.selectCustomerEvent(currentCustomer.id, event.id)
    : undefined;

  async function handleCreate(values: EventFormSubmitValues) {
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

    await createEvent(input);
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
            {currentCustomer.workspace?.name ? (
              <Badge tone="info">{currentCustomer.workspace.name}</Badge>
            ) : null}
            <CustomerContextSection context={currentCustomer.context} />
          </section>

          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={!createEvent || eventStore?.mutationPending}
              data-add-event
              onClick={() => setIsCreating(true)}
            >
              {t('customers.detail.addEvent')}
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

          {eventStore?.remoteReadsEnabled &&
          events === undefined &&
          eventStore.detailLoadState === 'loading' ? (
            <p role="status" className="text-text-secondary mt-4 text-sm">
              {t('schedule.loadingLabel')}
            </p>
          ) : null}
          {eventStore?.remoteReadsEnabled && events === undefined && eventStore.error ? (
            <p role="alert" className="text-warning mt-4 text-sm font-semibold">
              {t(getCarelogMessageKey(eventStore.error))}
            </p>
          ) : null}

          <CustomerUpcoming events={customerEvents} now={now} onOpenEvent={openEvent} />
          <CustomerMemo memo={explicitMemo} />
          <CustomerTimeline events={customerEvents} onOpenEvent={openEvent} />
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}
