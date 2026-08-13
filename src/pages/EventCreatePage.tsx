import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  readAdaptiveNavigationState,
  useOptionalAdaptiveHost,
  type AdaptiveNavigationState,
} from '@/components/layout/adaptiveHostContext';
import { EventForm, type EventFormSubmitValues } from '@/components/schedule/EventForm';
import { buttonVariants } from '@/components/ui/button';
import { buildAppCustomerCreatePath, buildAppSchedulePath } from '@/constants/routes';
import { getAgendaDateKey, getDateKeyFromDate } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useEventCreateDraft, type EventFormDraft } from '@/state/EventCreateDraftContext';
import { useEventStore } from '@/state/EventStoreContext';

export interface EventCreatePageProps {
  now?: Date;
}

function buildInitialScheduledAt(dateKey: string, now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${dateKey}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function EventCreatePage({ now = new Date() }: EventCreatePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useEventStore();
  const { draft, updateDraft, clearDraft } = useEventCreateDraft();
  const customerOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const navigationState = readAdaptiveNavigationState(location.state);
  const selectedDateKey =
    navigationState.targetDateKey ??
    adaptiveHost?.schedule.selectedDateKey ??
    getDateKeyFromDate(now);
  const entryScrollTop = navigationState.targetScrollTop ?? adaptiveHost?.schedule.scrollTop ?? 0;
  const selectedCustomer = draft.customerId
    ? customerStore.getCustomer(draft.customerId)
    : undefined;

  const returnToSchedule = useCallback(() => {
    clearDraft();
    adaptiveHost?.setScheduleDate(selectedDateKey);
    navigate(buildAppSchedulePath(), {
      state: {
        adaptiveRoot: 'schedule',
        targetDateKey: selectedDateKey,
        targetScrollTop: entryScrollTop,
      } satisfies AdaptiveNavigationState,
    });
  }, [adaptiveHost, clearDraft, entryScrollTop, navigate, selectedDateKey]);

  const selectCustomer = useCallback(
    (customerId: string) => {
      updateDraft({ customerId });
    },
    [updateDraft],
  );

  const handleCustomerOptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (customerStore.customers.length === 0) return;

      let nextIndex: number | undefined;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        nextIndex = (index + 1) % customerStore.customers.length;
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + customerStore.customers.length) % customerStore.customers.length;
      }

      if (nextIndex === undefined) return;
      event.preventDefault();
      customerOptionRefs.current[nextIndex]?.focus();
    },
    [customerStore.customers.length],
  );

  const onDraftChange = useCallback(
    (values: EventFormDraft) => {
      updateDraft(values);
    },
    [updateDraft],
  );

  const initialValues = useMemo(
    () => ({
      descriptor: draft.descriptor,
      note: draft.note,
      scheduledAt: draft.scheduledAt || buildInitialScheduledAt(selectedDateKey, now),
    }),
    [draft.descriptor, draft.note, draft.scheduledAt, now, selectedDateKey],
  );

  const handleCreate = useCallback(
    (values: EventFormSubmitValues) => {
      if (!selectedCustomer || values.status !== 'PLANNED' || !values.scheduledAt) return;

      const createdEvent = eventStore.createEvent({
        status: 'PLANNED',
        customerId: selectedCustomer.id,
        scheduledAt: values.scheduledAt,
        ...(values.descriptor ? { descriptor: values.descriptor } : {}),
        ...(values.note ? { note: values.note } : {}),
      });
      clearDraft();

      if (adaptiveHost) {
        adaptiveHost.returnFromEvent(
          createdEvent.id,
          selectedCustomer.id,
          getAgendaDateKey(createdEvent),
        );
        return;
      }

      navigate(buildAppSchedulePath(), {
        state: {
          adaptiveRoot: 'schedule',
          targetEventId: createdEvent.id,
          targetDateKey: getAgendaDateKey(createdEvent),
        } satisfies AdaptiveNavigationState,
      });
    },
    [adaptiveHost, clearDraft, eventStore, navigate, selectedCustomer],
  );

  return (
    <AdaptiveSurface
      majorSurface="event-create"
      data-event-create-page
      data-event-create-selected-customer-id={selectedCustomer?.id}
      data-event-create-selected-date-key={selectedDateKey}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={t('eventForm.createTitle')}
        backLabel={t('eventCreate.back')}
        onBack={returnToSchedule}
      />
      <div
        data-scroll-surface
        data-root-scroll-surface="event-create"
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        <AdaptiveSurfaceContent policy="readable">
          {selectedCustomer ? (
            <div data-event-create-step="form">
              <EventForm
                mode="create"
                customerName={selectedCustomer.displayName}
                now={now}
                initialValues={initialValues}
                fixedCreateStatus="PLANNED"
                onDraftChange={onDraftChange}
                onSubmit={handleCreate}
                onCancel={returnToSchedule}
              />
            </div>
          ) : customerStore.customers.length === 0 ? (
            <div data-event-create-step="customer-empty">
              <EmptyState
                title={t('eventCreate.firstCustomerTitle')}
                description={t('eventCreate.firstCustomerDescription')}
                action={
                  <Link
                    to={buildAppCustomerCreatePath()}
                    className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-2')}
                    data-schedule-event-first-customer-cta
                  >
                    {t('eventCreate.firstCustomerAction')}
                  </Link>
                }
              />
            </div>
          ) : (
            <section data-customer-selector aria-labelledby="event-customer-selector-title">
              <h2
                id="event-customer-selector-title"
                className="text-text-primary text-lg font-bold"
              >
                {t('eventCreate.customerTitle')}
              </h2>
              <p className="text-text-secondary mt-1 text-sm">
                {t('eventCreate.customerDescription')}
              </p>
              <fieldset className="mt-4 grid gap-2" aria-label={t('eventCreate.customerTitle')}>
                <legend className="sr-only">{t('eventCreate.customerTitle')}</legend>
                {customerStore.customers.map((customer, index) => {
                  const isSelected = customer.id === draft.customerId;
                  return (
                    <button
                      key={customer.id}
                      ref={(element) => {
                        customerOptionRefs.current[index] = element;
                      }}
                      type="button"
                      className={cn(
                        buttonVariants({ variant: isSelected ? 'primary' : 'outline' }),
                        'min-h-11 w-full justify-start text-left',
                      )}
                      aria-pressed={isSelected}
                      data-customer-selector-option
                      data-customer-id={customer.id}
                      onClick={() => selectCustomer(customer.id)}
                      onKeyDown={(event) => handleCustomerOptionKeyDown(event, index)}
                    >
                      {customer.displayName}
                    </button>
                  );
                })}
              </fieldset>
            </section>
          )}
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}
