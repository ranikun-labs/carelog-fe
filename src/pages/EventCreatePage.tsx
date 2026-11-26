import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
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
import {
  EventForm,
  type EventFormSubmitOptions,
  type EventFormSubmitValues,
} from '@/components/schedule/EventForm';
import { buttonVariants } from '@/components/ui/button';
import { buildAppCustomerCreatePath, buildAppSchedulePath } from '@/constants/routes';
import {
  getAgendaDateKey,
  getDateKeyFromDate,
  getDefaultPlannedDateTimeLocal,
} from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useEventCreateDraft, type EventFormDraft } from '@/state/EventCreateDraftContext';
import { useOptionalEventCreateActivation } from '@/state/EventCreateActivationContext';
import { useOptionalSaveSession } from '@/state/saveSessionContext';
import { useEventStore } from '@/state/EventStoreContext';

export interface EventCreatePageProps {
  now?: Date;
}

export function EventCreatePage({ now = new Date() }: EventCreatePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // 저장 응답이 떠난 뒤 도착할 수 있다. 마운트 여부로 떠난 화면의 후속 처리를 막는다(CustomerDetailPage와 같은 방식).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const adaptiveHost = useOptionalAdaptiveHost();
  const eventCreateActivation = useOptionalEventCreateActivation();
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

  useEffect(() => {
    eventCreateActivation?.beginCreateSession();
  }, [eventCreateActivation]);

  const returnToSchedule = useCallback(() => {
    eventCreateActivation?.clearCreateReturnProvenance();
    clearDraft();
    adaptiveHost?.setScheduleDate(selectedDateKey);
    navigate(buildAppSchedulePath(), {
      state: {
        adaptiveRoot: 'schedule',
        targetDateKey: selectedDateKey,
        targetScrollTop: entryScrollTop,
      } satisfies AdaptiveNavigationState,
    });
  }, [adaptiveHost, clearDraft, entryScrollTop, eventCreateActivation, navigate, selectedDateKey]);

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
    ({ descriptor, note, scheduledAt }: EventFormDraft) => {
      updateDraft({ descriptor, note, scheduledAt });
    },
    [updateDraft],
  );

  const initialValues = useMemo(
    () => ({
      descriptor: draft.descriptor,
      note: draft.note,
      scheduledAt: draft.scheduledAt || getDefaultPlannedDateTimeLocal(selectedDateKey, now),
    }),
    [draft.descriptor, draft.note, draft.scheduledAt, now, selectedDateKey],
  );

  // 저장 세션: 생성 화면이 지금 보이는 업무임을 등록한다(떠나면 해제). 같은 화면의 재마운트는 같은 키로 이어진다.
  const saveSession = useOptionalSaveSession();
  const setSaveActive = saveSession?.setActive;
  useEffect(() => {
    if (!setSaveActive) return;
    setSaveActive('event-create', true);
    return () => setSaveActive('event-create', false);
  }, [setSaveActive]);

  const handleCreate = useCallback(
    async (values: EventFormSubmitValues, options: EventFormSubmitOptions) => {
      if (!selectedCustomer || values.status !== 'PLANNED' || !values.scheduledAt) {
        eventCreateActivation?.clearCreateReturnProvenance();
        return;
      }

      let createdEvent;
      try {
        createdEvent = await eventStore.createEvent({
          status: 'PLANNED',
          customerId: selectedCustomer.id,
          scheduledAt: values.scheduledAt,
          ...(values.descriptor ? { descriptor: values.descriptor } : {}),
          ...(values.note ? { note: values.note } : {}),
        });
      } catch (error) {
        if (mountedRef.current) eventCreateActivation?.clearCreateReturnProvenance();
        throw error;
      }
      // 떠난 뒤 도착한 저장 응답은 화면 이동·초안·선택 상태를 건드리지 않는다(저장 자체는 스토어에 남는다).
      const current = options.isCurrent ? options.isCurrent() : mountedRef.current;
      if (!current) return;
      if (!createdEvent) {
        eventCreateActivation?.clearCreateReturnProvenance();
        return;
      }
      // 저장 성공을 확인한 뒤 일정 화면으로 옮기므로 이탈 보호를 먼저 놓는다.
      options.allowLeave();
      clearDraft();

      if (adaptiveHost) {
        adaptiveHost.returnFromEvent(
          createdEvent.id,
          selectedCustomer.id,
          getAgendaDateKey(createdEvent),
        );
        return;
      }

      eventCreateActivation?.armCreateReturn({
        kind: 'schedule',
        eventId: createdEvent.id,
        customerId: selectedCustomer.id,
        dateKey: getAgendaDateKey(createdEvent),
      });
      navigate(buildAppSchedulePath(), {
        state: {
          adaptiveRoot: 'schedule',
          targetEventId: createdEvent.id,
          targetDateKey: getAgendaDateKey(createdEvent),
        } satisfies AdaptiveNavigationState,
      });
    },
    [adaptiveHost, clearDraft, eventCreateActivation, eventStore, navigate, selectedCustomer],
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
        className="flex-1 scroll-pb-28 overflow-y-auto p-4 md:p-6"
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
                onDiscard={clearDraft}
                saveKey="event-create"
                onSubmit={handleCreate}
                onValidationFailure={() => eventCreateActivation?.clearCreateReturnProvenance()}
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
