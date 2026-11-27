import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { CustomerContextSection } from '@/components/customers/CustomerContextSection';
import { CustomerMemo } from '@/components/customers/CustomerMemo';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerUpcoming } from '@/components/customers/CustomerUpcoming';
import {
  getOverdueCustomerEvents,
  getUpcomingCustomerEvents,
} from '@/components/customers/customerDetailModel';
import { PageHeader } from '@/components/common/PageHeader';
import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { EventSavedNotice } from '@/components/schedule/EventSavedNotice';
import { EventForm, type EventFormSubmitValues } from '@/components/schedule/EventForm';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  buildAppAssistantPath,
  buildAppCustomerEditPath,
  buildAppCustomersPath,
} from '@/constants/routes';
import type { AssistantNavigationState } from '@/assistant/assistantTypes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalCustomerFormDraft } from '@/state/CustomerFormDraftContext';
import type { EventFormDraft } from '@/state/EventCreateDraftContext';
import { useOptionalEventCreateActivation } from '@/state/EventCreateActivationContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import { useOptionalSaveSession } from '@/state/saveSessionContext';
import type { EventCreationInput } from '@/state/eventStore';

export interface CustomerDetailPageProps {
  customerId?: string;
  events?: readonly CustomerEvent[];
  now?: Date;
  /** Explicit customer-level memo evidence; legacy context is intentionally not a fallback. */
  memo?: string;
  onCreateEvent?: (input: EventCreationInput) => CustomerEvent | undefined | Promise<CustomerEvent>;
}

export function CustomerDetailPage({
  customerId: customerIdProp,
  events,
  now = new Date(),
  memo,
  onCreateEvent,
}: CustomerDetailPageProps) {
  const { customerId: routeCustomerId = '' } = useParams();
  const customerId = customerIdProp ?? routeCustomerId;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const eventCreateActivation = useOptionalEventCreateActivation();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const loadCustomer = customerStore.loadCustomer;
  const loadCustomerDetail = eventStore?.loadCustomerDetail;
  const remoteReadsEnabled = eventStore?.remoteReadsEnabled ?? false;
  const [creatingCustomerId, setCreatingCustomerId] = useState<string | null>(null);
  const [retriedCustomerId, setRetriedCustomerId] = useState<string | null>(null);
  // 인라인 일정 폼의 열림·입력값은 draft에도 둔다. 회전으로 1단↔2단이 바뀌어 화면이 다시 마운트돼도 이어 쓴다.
  const draftStore = useOptionalCustomerFormDraft();
  const inlineEventDraft = draftStore?.getInlineEventDraft(customerId);
  // 인라인 생성이 이 방문에서 성공했으면(재마운트 포함) 폼을 다시 열지 않는다. 같은 입력의 재제출을 막는다.
  const saveSession = useOptionalSaveSession();
  const inlineSaveKey = `inline-event:${customerId}`;
  const inlineCompleted = saveSession?.saveRecordFor(inlineSaveKey)?.status === 'completed';
  const isCreating =
    !inlineCompleted && (creatingCustomerId === customerId || inlineEventDraft !== undefined);
  useEffect(() => {
    if (inlineCompleted && inlineEventDraft !== undefined) {
      draftStore?.clearInlineEventDraft(customerId);
    }
  }, [customerId, draftStore, inlineCompleted, inlineEventDraft]);
  const handleInlineDraftChange = useCallback(
    (draft: EventFormDraft) => draftStore?.setInlineEventDraft(customerId, draft),
    [customerId, draftStore],
  );
  const currentViewRef = useRef({ customerId, generation: 0 });
  const mountedRef = useRef(true);
  const addEventTriggerRef = useRef<HTMLButtonElement>(null);
  const loadingStatusRef = useRef<HTMLParagraphElement>(null);
  const retryFocusRef = useRef(false);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const customer = customerStore.getCustomer(customerId);
  const queryNowRef = useRef(now);

  useLayoutEffect(() => {
    retryFocusRef.current = false;
    currentViewRef.current = {
      customerId,
      generation: currentViewRef.current.generation + 1,
    };
  }, [customerId]);

  useEffect(() => {
    if (eventStore?.detailCustomerId !== customerId || !retryFocusRef.current) return;
    const destination =
      loadingStatusRef.current ??
      scrollSurfaceRef.current?.querySelector<HTMLElement>(
        '[role="alert"], [data-customer-upcoming] h2',
      );
    if (!destination) return;
    retryFocusRef.current = false;
    destination.tabIndex = -1;
    destination.focus();
  }, [customerId, eventStore?.detailCustomerId, eventStore?.detailLoadState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        <div role="status" aria-busy="true" className="type-body text-text-secondary p-4 md:p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    if (customerStore.error) {
      return <ErrorState title={t(getCarelogMessageKey(customerStore.error))} />;
    }
    return <AppNotFoundPage />;
  }
  const currentCustomer = customer;
  const snapshot = eventStore?.getCustomerSnapshot(currentCustomer.id);
  const remoteDetail = remoteReadsEnabled && events === undefined;
  const detailMatchesCustomer = eventStore?.detailCustomerId === currentCustomer.id;
  const detailLoading =
    remoteDetail &&
    (!detailMatchesCustomer ||
      eventStore?.detailLoadState === 'idle' ||
      eventStore?.detailLoadState === 'loading');
  const detailFailed =
    remoteDetail && detailMatchesCustomer && eventStore?.detailLoadState === 'error';
  const knownEvents =
    detailFailed && !snapshot
      ? (eventStore?.events ?? []).filter((event) => event.customerId === currentCustomer.id)
      : [];
  const hasDetailData = !remoteDetail || snapshot !== undefined;
  const sourceEvents =
    events ??
    (eventStore?.remoteReadsEnabled
      ? snapshot
        ? [...snapshot.upcoming, ...snapshot.history]
        : knownEvents
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
    ? (event: CustomerEvent, options?: { openOccurrence?: boolean }) =>
        adaptiveHost.selectCustomerEvent(currentCustomer.id, event.id, options)
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

  // 행동 강도: 조회 화면이라 Subtle. Strong 0.
  const addEventButton = (
    <Button
      ref={addEventTriggerRef}
      type="button"
      variant="subtle"
      className="w-full"
      disabled={!createEvent || eventStore?.mutationPending}
      data-add-event
      onClick={() => {
        saveSession?.clearRecord(inlineSaveKey);
        eventCreateActivation?.beginCreateSession();
        setCreatingCustomerId(currentCustomer.id);
      }}
    >
      {t('customers.detail.addEvent')}
    </Button>
  );

  async function handleCreate(values: EventFormSubmitValues) {
    if (!createEvent) return;
    const viewGeneration = currentViewRef.current.generation;

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

    let createdEvent: CustomerEvent | undefined;
    try {
      createdEvent = await createEvent(input);
    } catch (error) {
      if (mountedRef.current && currentViewRef.current.generation === viewGeneration) {
        eventCreateActivation?.clearCreateReturnProvenance();
      }
      throw error;
    }
    if (!mountedRef.current || currentViewRef.current.generation !== viewGeneration) return;
    if (createdEvent) {
      eventCreateActivation?.armCreateReturn({
        kind: 'customer-detail',
        customerId: currentCustomer.id,
        eventId: createdEvent.id,
      });
      if (remoteDetail && !snapshot) {
        void loadCustomerDetail?.(currentCustomer.id, queryNowRef.current).catch(() => undefined);
      }
    } else {
      eventCreateActivation?.clearCreateReturnProvenance();
    }
    draftStore?.clearInlineEventDraft(currentCustomer.id);
    setCreatingCustomerId(null);
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
            className={buttonVariants({ variant: 'text', size: 'sm' })}
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
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        <AdaptiveSurfaceContent policy="readable">
          <section data-customer-identity aria-label={t('customers.detail.title')}>
            {currentCustomer.workspace?.name ? (
              <p className="type-supporting text-text-secondary wrap-anywhere break-keep">
                {currentCustomer.workspace.name}
              </p>
            ) : null}
            {/* "AI에게 물어보기"는 머리 안 Neutral small. 다음 일정(Key Block)보다 약하게, 하지만 현행 위치 맥락은 유지한다. */}
            <Button
              type="button"
              variant="neutral"
              size="sm"
              className="mt-3"
              data-assistant-entry="customer"
              onClick={openAssistant}
            >
              {t('customers.detail.askAssistant')}
            </Button>
            <CustomerContextSection context={currentCustomer.context} />
          </section>

          {detailLoading || (remoteDetail && retriedCustomerId === currentCustomer.id) ? (
            <p
              ref={loadingStatusRef}
              role="status"
              tabIndex={-1}
              className="type-body text-text-secondary mt-8"
            >
              {detailLoading
                ? t('schedule.loadingLabel')
                : detailFailed
                  ? t('schedule.errorTitle')
                  : t('customers.detail.eventsLoaded')}
            </p>
          ) : null}
          {detailFailed ? (
            <div className="bg-inset rounded-inset mt-8 space-y-3 p-4">
              <p role="alert" className="type-body text-danger font-semibold break-keep">
                {eventStore?.detailError
                  ? t(getCarelogMessageKey(eventStore.detailError))
                  : t('schedule.errorDescription')}
              </p>
              {snapshot ? (
                <p className="type-body text-text-secondary break-keep">
                  {t('customers.detail.staleEvents')}
                </p>
              ) : null}
              {!snapshot && knownEvents.length > 0 ? (
                <p className="type-body text-text-secondary break-keep">
                  {t('customers.detail.partialEvents')}
                </p>
              ) : null}
              <Button
                type="button"
                variant="neutral"
                onClick={() => {
                  retryFocusRef.current = true;
                  setRetriedCustomerId(currentCustomer.id);
                  void loadCustomerDetail?.(currentCustomer.id, queryNowRef.current).catch(
                    () => undefined,
                  );
                }}
              >
                {t('schedule.retry')}
              </Button>
            </div>
          ) : null}
          <EventSavedNotice className="mt-4" customerId={customerId} />
          {/* 로딩·실패로 다음 일정을 못 그려도 "일정 추가"는 같은 자리(같은 DOM)에 남는다. */}
          <CustomerUpcoming
            events={customerEvents}
            now={now}
            onOpenEvent={openEvent}
            action={addEventButton}
            ready={
              hasDetailData ||
              getUpcomingCustomerEvents(knownEvents, now).length > 0 ||
              getOverdueCustomerEvents(knownEvents, now).length > 0
            }
          />

          {isCreating && createEvent ? (
            <EventForm
              mode="create"
              customerName={currentCustomer.displayName}
              now={now}
              initialValues={inlineEventDraft}
              onDraftChange={handleInlineDraftChange}
              onDiscard={() => draftStore?.clearInlineEventDraft(currentCustomer.id)}
              saveKey={inlineSaveKey}
              onSubmit={handleCreate}
              onValidationFailure={() => eventCreateActivation?.clearCreateReturnProvenance()}
              onCancel={() => {
                eventCreateActivation?.clearCreateReturnProvenance();
                draftStore?.clearInlineEventDraft(currentCustomer.id);
                setCreatingCustomerId(null);
                addEventTriggerRef.current?.focus();
              }}
            />
          ) : null}

          <CustomerMemo memo={explicitMemo} />
          {hasDetailData ? (
            <CustomerTimeline events={customerEvents} onOpenEvent={openEvent} />
          ) : null}
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}
