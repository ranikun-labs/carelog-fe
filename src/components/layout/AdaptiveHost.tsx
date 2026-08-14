import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router';

import {
  hasVisibleMajorSurface,
  shouldUseTwoPane,
  type ViewportMetrics,
} from '@/components/layout/adaptiveHostModel';
import { CustomersPage } from '@/pages/CustomersPage';
import { SchedulePage } from '@/pages/SchedulePage';
import {
  APP_BASE,
  APP_ROUTE_PATHS,
  buildAppCustomerDetailPath,
  buildAppEventDetailPath,
  buildAppSchedulePath,
} from '@/constants/routes';
import {
  AdaptiveHostProvider,
  type AdaptiveSurfacePolicy,
  type AdaptiveHostContextValue,
  type AdaptiveMode,
  type AdaptiveNavigationState,
  type AdaptiveRoot,
  type SelectEventOptions,
  readAdaptiveNavigationState,
} from '@/components/layout/adaptiveHostContext';
import { cn } from '@/lib/utils';
import {
  useScheduleActivationGuard,
  type ScheduleCreateActivation,
} from '@/state/ScheduleActivationGuardContext';

interface AdaptiveRootState {
  scheduleDateKey: string | null;
  scheduleEventId: string | null;
  scheduleScrollTop: number;
  customerId: string | null;
  customerEventId: string | null;
  customerListScrollTop: number;
  customerDetailScrollTop: number;
  eventDetailScrollTop: number;
}

type RouteKind =
  | 'schedule'
  | 'customers'
  | 'customer-detail'
  | 'customer-form'
  | 'event-create'
  | 'event'
  | 'other';

interface RouteInfo {
  kind: RouteKind;
  eventId?: string;
  customerId?: string;
  navigationState: AdaptiveNavigationState;
}

type EventFocusTarget =
  | { eventId: string; kind: 'event-action'; value: string }
  | { eventId: string; kind: 'occurrence-time' }
  | { eventId: string; kind: 'occurrence-cancel' }
  | { eventId: string; kind: 'occurrence-confirm' };

type CustomerFormFocusTarget = {
  formKey: string;
  field: 'displayName' | 'customerMemo';
};

type EventFormFocusTarget = {
  field: 'descriptor' | 'scheduledAt' | 'occurredAt' | 'note' | 'submit' | 'cancel';
};

type CustomerSelectorFocusTarget = {
  customerId: string;
};

const INITIAL_ROOT_STATE: AdaptiveRootState = {
  scheduleDateKey: null,
  scheduleEventId: null,
  scheduleScrollTop: 0,
  customerId: null,
  customerEventId: null,
  customerListScrollTop: 0,
  customerDetailScrollTop: 0,
  eventDetailScrollTop: 0,
};

function readViewportMetrics(host: HTMLElement | null): ViewportMetrics {
  if (typeof window === 'undefined') {
    return { availableWidth: 0, viewportWidth: 0, viewportHeight: 0 };
  }

  const rect = host?.getBoundingClientRect();
  return {
    availableWidth: rect?.width ?? host?.clientWidth ?? 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function useViewportMetrics(
  hostRef: RefObject<HTMLElement | null>,
  beforeMeasure: () => void,
): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => readViewportMetrics(null));

  const measure = useCallback(() => {
    beforeMeasure();
    setMetrics((current) => {
      const next = readViewportMetrics(hostRef.current);
      if (
        current.availableWidth === next.availableWidth &&
        current.viewportWidth === next.viewportWidth &&
        current.viewportHeight === next.viewportHeight
      ) {
        return current;
      }
      return next;
    });
  }, [beforeMeasure, hostRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    if (resizeObserver && hostRef.current) resizeObserver.observe(hostRef.current);

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [hostRef, measure]);

  return metrics;
}

function readEventFocusTarget(host: HTMLElement | null): EventFocusTarget | null {
  if (typeof document === 'undefined' || !host) return null;

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !host.contains(activeElement)) return null;

  const eventSurface = activeElement.closest<HTMLElement>('[data-event-detail-page]');
  const eventId = eventSurface?.dataset.selectedEventId;
  if (!eventSurface || !eventId || !host.contains(eventSurface)) return null;

  const eventAction =
    activeElement.closest<HTMLElement>('[data-event-action]')?.dataset.eventAction;
  if (eventAction) return { eventId, kind: 'event-action', value: eventAction };
  if (activeElement.closest('[data-event-occurrence-time]')) {
    return { eventId, kind: 'occurrence-time' };
  }
  if (activeElement.closest('[data-event-occurrence-cancel]')) {
    return { eventId, kind: 'occurrence-cancel' };
  }
  if (activeElement.closest('[data-event-occurrence-confirm]')) {
    return { eventId, kind: 'occurrence-confirm' };
  }

  return null;
}

function findEventFocusTarget(host: HTMLElement, target: EventFocusTarget): HTMLElement | null {
  const eventSurface = Array.from(
    host.querySelectorAll<HTMLElement>('[data-event-detail-page]'),
  ).find((candidate) => candidate.dataset.selectedEventId === target.eventId);
  if (!eventSurface) return null;

  if (target.kind === 'event-action') {
    return (
      Array.from(eventSurface.querySelectorAll<HTMLElement>('[data-event-action]')).find(
        (candidate) => candidate.dataset.eventAction === target.value,
      ) ?? null
    );
  }

  const selector = {
    'occurrence-time': '[data-event-occurrence-time]',
    'occurrence-cancel': '[data-event-occurrence-cancel]',
    'occurrence-confirm': '[data-event-occurrence-confirm]',
  }[target.kind];
  return eventSurface.querySelector<HTMLElement>(selector);
}

function readCustomerFormFocusTarget(host: HTMLElement | null): CustomerFormFocusTarget | null {
  if (typeof document === 'undefined' || !host) return null;

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !host.contains(activeElement)) return null;

  const form = activeElement.closest<HTMLElement>('[data-customer-form]');
  const formKey = form?.dataset.customerFormKey;
  const field = activeElement.closest<HTMLElement>('[data-customer-field]')?.dataset.customerField;
  if (!form || !formKey || (field !== 'displayName' && field !== 'customerMemo')) return null;

  return { formKey, field };
}

function findCustomerFormFocusTarget(
  host: HTMLElement,
  target: CustomerFormFocusTarget,
): HTMLElement | null {
  const form = Array.from(
    host.querySelectorAll<HTMLElement>('[data-customer-form][data-customer-form-key]'),
  ).find((candidate) => candidate.dataset.customerFormKey === target.formKey);
  if (!form) return null;

  return form.querySelector<HTMLElement>(`[data-customer-field="${target.field}"]`);
}

function readEventFormFocusTarget(host: HTMLElement | null): EventFormFocusTarget | null {
  if (typeof document === 'undefined' || !host) return null;

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !host.contains(activeElement)) return null;

  const form = activeElement.closest<HTMLElement>('[data-event-form]');
  if (!form) return null;

  const field = activeElement.closest<HTMLElement>('[data-event-field]')?.dataset.eventField;
  if (
    field === 'descriptor' ||
    field === 'scheduledAt' ||
    field === 'occurredAt' ||
    field === 'note'
  ) {
    return { field };
  }
  if (activeElement.closest('[data-event-form-submit]')) return { field: 'submit' };
  if (activeElement.closest('[data-event-form-cancel]')) return { field: 'cancel' };

  return null;
}

function findEventFormFocusTarget(
  host: HTMLElement,
  target: EventFormFocusTarget,
): HTMLElement | null {
  const selector =
    target.field === 'submit'
      ? '[data-event-form-submit]'
      : target.field === 'cancel'
        ? '[data-event-form-cancel]'
        : `[data-event-field="${target.field}"]`;
  return host.querySelector<HTMLElement>(selector);
}

function readCustomerSelectorFocusTarget(
  host: HTMLElement | null,
): CustomerSelectorFocusTarget | null {
  if (typeof document === 'undefined' || !host) return null;

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !host.contains(activeElement)) return null;

  const option = activeElement.closest<HTMLElement>('[data-customer-selector-option]');
  const customerId = option?.dataset.customerId;
  return customerId ? { customerId } : null;
}

function findCustomerSelectorFocusTarget(
  host: HTMLElement,
  target: CustomerSelectorFocusTarget,
): HTMLElement | null {
  return (
    Array.from(
      host.querySelectorAll<HTMLElement>('[data-customer-selector-option][data-customer-id]'),
    ).find((candidate) => candidate.dataset.customerId === target.customerId) ?? null
  );
}

function isWithin(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function isScheduleSurfaceTarget(target: EventTarget | null): boolean {
  return isWithin(target, '[data-major-surface="schedule"]');
}

function isEventFormSubmitTarget(target: EventTarget | null): boolean {
  return isWithin(target, '[data-event-form-submit]');
}

function isEventFormTarget(target: EventTarget | null): boolean {
  return isWithin(target, '[data-event-form]');
}

function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

function isKeyboardNavigationKey(key: string): boolean {
  return (
    key === 'Tab' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'Home' ||
    key === 'End'
  );
}

function decodePathSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRouteInfo(pathname: string, state: unknown): RouteInfo {
  const navigationState = readAdaptiveNavigationState(state);
  const eventCreateMatch = matchPath({ path: APP_ROUTE_PATHS.eventCreate, end: true }, pathname);
  if (eventCreateMatch) {
    return { kind: 'event-create', navigationState };
  }

  const eventMatch = matchPath({ path: APP_ROUTE_PATHS.eventDetail, end: true }, pathname);
  if (eventMatch) {
    return {
      kind: 'event',
      eventId: decodePathSegment(eventMatch.params.eventId),
      navigationState,
    };
  }

  const customerCreateMatch = matchPath(
    { path: APP_ROUTE_PATHS.customerCreate, end: true },
    pathname,
  );
  if (customerCreateMatch) {
    return { kind: 'customer-form', navigationState };
  }

  const customerEditMatch = matchPath({ path: APP_ROUTE_PATHS.customerEdit, end: true }, pathname);
  if (customerEditMatch) {
    return {
      kind: 'customer-form',
      customerId: decodePathSegment(customerEditMatch.params.customerId),
      navigationState,
    };
  }

  const customerDetailMatch = matchPath(
    { path: APP_ROUTE_PATHS.customerDetail, end: true },
    pathname,
  );
  if (customerDetailMatch) {
    return {
      kind: 'customer-detail',
      customerId: decodePathSegment(customerDetailMatch.params.customerId),
      navigationState,
    };
  }

  if (pathname === APP_BASE || pathname === APP_ROUTE_PATHS.schedule) {
    return { kind: 'schedule', navigationState };
  }
  if (pathname === APP_ROUTE_PATHS.customers) {
    return { kind: 'customers', navigationState };
  }

  return { kind: 'other', navigationState };
}

function getActiveRoot(routeInfo: RouteInfo): AdaptiveRoot {
  if (
    routeInfo.kind === 'customers' ||
    routeInfo.kind === 'customer-detail' ||
    routeInfo.kind === 'customer-form'
  ) {
    return 'customers';
  }
  if (routeInfo.kind === 'event') return routeInfo.navigationState.adaptiveRoot ?? 'schedule';
  return 'schedule';
}

function getTwoPaneRoot(routeInfo: RouteInfo, activeRoot: AdaptiveRoot): AdaptiveRoot | null {
  if (routeInfo.kind === 'schedule' || routeInfo.kind === 'event-create') return 'schedule';
  if (routeInfo.kind === 'event') return activeRoot;
  if (
    routeInfo.kind === 'customers' ||
    routeInfo.kind === 'customer-detail' ||
    routeInfo.kind === 'customer-form'
  ) {
    return 'customers';
  }
  return null;
}

function isSelectedRoute(routeInfo: RouteInfo): boolean {
  return (
    routeInfo.kind === 'event' ||
    routeInfo.kind === 'event-create' ||
    routeInfo.kind === 'customer-detail' ||
    routeInfo.kind === 'customer-form'
  );
}

export function AdaptiveHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const activationGuard = useScheduleActivationGuard();
  const lastCreateActivationRef = useRef<ScheduleCreateActivation | null>(null);
  const focusedEventTargetRef = useRef<EventFocusTarget | null>(null);
  const focusedEventFormTargetRef = useRef<EventFormFocusTarget | null>(null);
  const focusedCustomerSelectorTargetRef = useRef<CustomerSelectorFocusTarget | null>(null);
  const focusedCustomerFormTargetRef = useRef<CustomerFormFocusTarget | null>(null);
  const captureFocusedEventTarget = useCallback(() => {
    focusedEventTargetRef.current = readEventFocusTarget(hostRef.current);
    focusedEventFormTargetRef.current = readEventFormFocusTarget(hostRef.current);
    focusedCustomerSelectorTargetRef.current = readCustomerSelectorFocusTarget(hostRef.current);
    focusedCustomerFormTargetRef.current = readCustomerFormFocusTarget(hostRef.current);
  }, []);

  const suppressScheduleCreateActivation = useCallback(
    (event: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      activationGuard.clearPendingScheduleCreateActivation();
    },
    [activationGuard],
  );

  const handleHostClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isEventFormSubmitTarget(event.target) && event.detail > 0) {
        lastCreateActivationRef.current = {
          kind: 'pointer',
          clientX: event.clientX,
          clientY: event.clientY,
        };
      }

      const pending = activationGuard.getPendingScheduleCreateActivation();
      if (!pending || !isScheduleSurfaceTarget(event.target)) return;

      if (pending.kind !== 'pointer') {
        if (pending.kind === 'unknown' && event.detail > 1) {
          suppressScheduleCreateActivation(event);
          return;
        }
        activationGuard.clearPendingScheduleCreateActivation();
        return;
      }

      const sameOriginPoint =
        pending.clientX === event.clientX && pending.clientY === event.clientY;
      if (event.detail > 1 || sameOriginPoint) {
        suppressScheduleCreateActivation(event);
        return;
      }

      // A different pointer activation is a new user action, so it must not
      // inherit the stale transition guard.
      activationGuard.clearPendingScheduleCreateActivation();
    },
    [activationGuard, suppressScheduleCreateActivation],
  );

  const handleHostKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isEventFormTarget(event.target) && isActivationKey(event.key)) {
        lastCreateActivationRef.current = { kind: 'keyboard' };
      }

      const pending = activationGuard.getPendingScheduleCreateActivation();
      if (!pending || !isScheduleSurfaceTarget(event.target)) return;

      if (pending.kind !== 'keyboard') {
        activationGuard.clearPendingScheduleCreateActivation();
        return;
      }

      if (isActivationKey(event.key)) {
        suppressScheduleCreateActivation(event);
        return;
      }

      if (isKeyboardNavigationKey(event.key)) {
        activationGuard.clearPendingScheduleCreateActivation();
      }
    },
    [activationGuard, suppressScheduleCreateActivation],
  );
  const metrics = useViewportMetrics(hostRef, captureFocusedEventTarget);
  const [rootState, setRootState] = useState<AdaptiveRootState>(INITIAL_ROOT_STATE);
  const [isCoVisible, setIsCoVisible] = useState(false);
  const masterPaneRef = useRef<HTMLElement>(null);
  const secondaryPaneRef = useRef<HTMLElement>(null);
  const routeInfo = useMemo(
    () => getRouteInfo(location.pathname, location.state),
    [location.pathname, location.state],
  );
  const activeRoot = getActiveRoot(routeInfo);
  const mode: AdaptiveMode = shouldUseTwoPane(metrics) ? 'two-pane' : 'single';
  const twoPaneRoot = mode === 'two-pane' ? getTwoPaneRoot(routeInfo, activeRoot) : null;
  const hasSecondary = twoPaneRoot !== null && isSelectedRoute(routeInfo);
  const surfacePolicy: AdaptiveSurfacePolicy =
    routeInfo.kind === 'schedule' || routeInfo.kind === 'customers' ? 'scan' : 'readable';

  const navigationState = routeInfo.navigationState;
  const routeEventId = routeInfo.kind === 'event' ? (routeInfo.eventId ?? null) : null;
  const routeCustomerId =
    routeInfo.kind === 'customer-detail' || routeInfo.kind === 'customer-form'
      ? (routeInfo.customerId ?? null)
      : activeRoot === 'customers'
        ? (navigationState.adaptiveCustomerId ?? null)
        : null;
  const selectedCustomerId = routeCustomerId ?? rootState.customerId;
  const selectedCustomerEventId =
    activeRoot === 'customers' && routeEventId ? routeEventId : rootState.customerEventId;
  const selectedScheduleEventId =
    activeRoot === 'schedule' && routeEventId ? routeEventId : rootState.scheduleEventId;
  const selectedScheduleDateKey = navigationState.targetDateKey ?? rootState.scheduleDateKey;

  function selectEvent(eventId: string, options: SelectEventOptions = {}) {
    const root = options.root ?? activeRoot;
    if (root === 'customers') {
      const customerId = options.customerId ?? selectedCustomerId;
      if (!customerId) return;
      setRootState((current) => ({
        ...current,
        customerId,
        customerEventId: eventId,
      }));
      navigate(buildAppEventDetailPath(eventId), {
        state: {
          adaptiveRoot: 'customers',
          adaptiveCustomerId: customerId,
          adaptiveEventId: eventId,
        } satisfies AdaptiveNavigationState,
      });
      return;
    }

    setRootState((current) => ({
      ...current,
      scheduleEventId: eventId,
      ...(options.targetDateKey ? { scheduleDateKey: options.targetDateKey } : {}),
    }));
    navigate(buildAppEventDetailPath(eventId), {
      state: {
        adaptiveRoot: 'schedule',
        adaptiveEventId: eventId,
        ...(options.targetDateKey ? { targetDateKey: options.targetDateKey } : {}),
      } satisfies AdaptiveNavigationState,
    });
  }

  function selectCustomer(customerId: string) {
    setRootState((current) => ({ ...current, customerId, customerEventId: null }));
    navigate(buildAppCustomerDetailPath(customerId), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: customerId,
      } satisfies AdaptiveNavigationState,
    });
  }

  function selectCustomerEvent(customerId: string, eventId: string) {
    selectEvent(eventId, { root: 'customers', customerId });
  }

  function openCustomerFromEvent(customerId: string) {
    selectCustomer(customerId);
  }

  function goBackFromEvent(customerId: string) {
    if (activeRoot === 'customers') {
      navigate(buildAppCustomerDetailPath(customerId), {
        state: {
          adaptiveRoot: 'customers',
          adaptiveCustomerId: customerId,
        } satisfies AdaptiveNavigationState,
      });
      return;
    }
    navigate(buildAppSchedulePath(), {
      state: {
        adaptiveRoot: 'schedule',
        ...(selectedScheduleEventId ? { targetEventId: selectedScheduleEventId } : {}),
      } satisfies AdaptiveNavigationState,
    });
  }

  function returnFromEvent(eventId: string, customerId: string, targetDateKey: string) {
    if (activeRoot === 'customers') {
      lastCreateActivationRef.current = null;
      activationGuard.clearPendingScheduleCreateActivation();
      navigate(buildAppCustomerDetailPath(customerId), {
        state: {
          adaptiveRoot: 'customers',
          adaptiveCustomerId: customerId,
          adaptiveEventId: eventId,
        } satisfies AdaptiveNavigationState,
      });
      return;
    }

    activationGuard.armScheduleCreateActivation(
      lastCreateActivationRef.current ?? { kind: 'unknown' },
    );
    lastCreateActivationRef.current = null;
    setRootState((current) => ({
      ...current,
      scheduleEventId: eventId,
      scheduleDateKey: targetDateKey,
    }));
    navigate(buildAppSchedulePath(), {
      state: {
        adaptiveRoot: 'schedule',
        targetEventId: eventId,
        targetDateKey,
      } satisfies AdaptiveNavigationState,
    });
  }

  const setScheduleDate = useCallback((dateKey: string) => {
    setRootState((current) =>
      current.scheduleDateKey === dateKey ? current : { ...current, scheduleDateKey: dateKey },
    );
  }, []);

  const setScheduleScrollTop = useCallback((scrollTop: number) => {
    setRootState((current) =>
      current.scheduleScrollTop === scrollTop
        ? current
        : { ...current, scheduleScrollTop: scrollTop },
    );
  }, []);

  const setCustomerListScrollTop = useCallback((scrollTop: number) => {
    setRootState((current) =>
      current.customerListScrollTop === scrollTop
        ? current
        : { ...current, customerListScrollTop: scrollTop },
    );
  }, []);

  const setCustomerDetailScrollTop = useCallback((scrollTop: number) => {
    setRootState((current) =>
      current.customerDetailScrollTop === scrollTop
        ? current
        : { ...current, customerDetailScrollTop: scrollTop },
    );
  }, []);

  const setEventDetailScrollTop = useCallback((scrollTop: number) => {
    setRootState((current) =>
      current.eventDetailScrollTop === scrollTop
        ? current
        : { ...current, eventDetailScrollTop: scrollTop },
    );
  }, []);

  const contextValue: AdaptiveHostContextValue = {
    mode,
    availableWidth: metrics.availableWidth,
    isLandscape: metrics.viewportWidth > metrics.viewportHeight,
    isCoVisible,
    activeRoot,
    schedule: {
      selectedDateKey: selectedScheduleDateKey,
      selectedEventId: selectedScheduleEventId,
      scrollTop: rootState.scheduleScrollTop,
    },
    customers: {
      selectedCustomerId,
      selectedEventId: selectedCustomerEventId,
      listScrollTop: rootState.customerListScrollTop,
      detailScrollTop: rootState.customerDetailScrollTop,
    },
    eventDetailScrollTop: rootState.eventDetailScrollTop,
    selectEvent,
    selectCustomer,
    selectCustomerEvent,
    openCustomerFromEvent,
    goBackFromEvent,
    returnFromEvent,
    setScheduleDate,
    setScheduleScrollTop,
    setCustomerListScrollTop,
    setCustomerDetailScrollTop,
    setEventDetailScrollTop,
  };

  const compositionKey = `${mode}:${twoPaneRoot ?? 'single'}:${routeInfo.kind}:${location.key}`;

  const previousModeRef = useRef<AdaptiveMode>(mode);
  useLayoutEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = mode;
    if (previousMode === mode) return;

    const focusTarget = focusedEventTargetRef.current;
    const eventFormFocusTarget = focusedEventFormTargetRef.current;
    const customerSelectorFocusTarget = focusedCustomerSelectorTargetRef.current;
    const customerFormFocusTarget = focusedCustomerFormTargetRef.current;
    focusedEventTargetRef.current = null;
    focusedEventFormTargetRef.current = null;
    focusedCustomerSelectorTargetRef.current = null;
    focusedCustomerFormTargetRef.current = null;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      activeElement.isConnected
    ) {
      return;
    }

    if (customerFormFocusTarget && routeInfo.kind === 'customer-form') {
      findCustomerFormFocusTarget(hostRef.current!, customerFormFocusTarget)?.focus({
        preventScroll: true,
      });
      return;
    }

    if (eventFormFocusTarget) {
      findEventFormFocusTarget(hostRef.current!, eventFormFocusTarget)?.focus({
        preventScroll: true,
      });
      return;
    }

    if (customerSelectorFocusTarget && routeInfo.kind === 'event-create') {
      findCustomerSelectorFocusTarget(hostRef.current!, customerSelectorFocusTarget)?.focus({
        preventScroll: true,
      });
      return;
    }

    if (!focusTarget || routeInfo.kind !== 'event' || routeEventId !== focusTarget.eventId) return;

    findEventFocusTarget(hostRef.current!, focusTarget)?.focus({ preventScroll: true });
  }, [mode, routeInfo.kind, routeEventId]);

  useEffect(() => {
    if (routeInfo.kind !== 'schedule' && routeInfo.kind !== 'event-create') {
      activationGuard.clearPendingScheduleCreateActivation();
    }
  }, [activationGuard, routeInfo.kind]);

  useLayoutEffect(() => {
    const updateCoVisibility = () => {
      const next =
        mode === 'two-pane' &&
        hasSecondaryMajorSurface(masterPaneRef.current) &&
        hasSecondaryMajorSurface(secondaryPaneRef.current);
      setIsCoVisible((current) => (current === next ? current : next));
    };

    updateCoVisibility();
    const composition = hostRef.current?.querySelector<HTMLElement>('[data-adaptive-composition]');
    if (!composition) return undefined;

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(updateCoVisibility)
        : undefined;
    mutationObserver?.observe(composition, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoVisibility) : undefined;
    if (resizeObserver) resizeObserver.observe(composition);

    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [compositionKey, hasSecondary, mode]);

  const children = <Outlet />;
  // The secondary slot is intentionally limited to existing Event/Customer surfaces.
  // A future AI surface can occupy this slot without adding a third pane, but RPL-61
  // does not create AI state, requests, or content.
  const composition =
    mode !== 'two-pane' || !twoPaneRoot ? (
      <div
        data-adaptive-single-frame
        data-adaptive-single-frame-policy={surfacePolicy}
        className={cn(
          'mx-auto h-full w-full min-w-0 md:max-w-[520px]',
          surfacePolicy === 'scan' ? 'lg:max-w-none' : 'lg:max-w-[560px]',
        )}
      >
        <section
          ref={masterPaneRef}
          data-adaptive-pane="master"
          aria-label="주요 화면"
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          {children}
        </section>
      </div>
    ) : (
      <div
        data-adaptive-composition
        data-two-pane-root={twoPaneRoot}
        data-adaptive-composition-layout={hasSecondary ? 'two-pane' : 'single'}
        className={cn('grid h-full min-h-0 min-w-0', hasSecondary ? 'grid-cols-2' : 'grid-cols-1')}
      >
        <section
          ref={masterPaneRef}
          data-adaptive-pane="master"
          aria-label="주요 목록"
          className={cn(
            'border-border-default min-h-0 min-w-0 overflow-hidden',
            hasSecondary && 'border-r',
          )}
        >
          {routeInfo.kind === 'schedule' || routeInfo.kind === 'customers' ? (
            children
          ) : twoPaneRoot === 'schedule' ? (
            <SchedulePage />
          ) : (
            <CustomersPage />
          )}
        </section>
        {hasSecondary ? (
          <section
            ref={secondaryPaneRef}
            data-adaptive-pane="secondary"
            aria-label="선택한 상세"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            {children}
          </section>
        ) : null}
      </div>
    );

  return (
    <AdaptiveHostProvider value={contextValue}>
      <div
        ref={hostRef}
        data-adaptive-host
        data-adaptive-mode={mode}
        data-available-width={metrics.availableWidth}
        data-landscape={metrics.viewportWidth > metrics.viewportHeight}
        data-is-co-visible={isCoVisible}
        data-major-surface-count={hasSecondary ? 2 : 1}
        data-active-root={activeRoot}
        className="h-full min-h-0 min-w-0 flex-1 overflow-hidden"
        onClickCapture={handleHostClickCapture}
        onKeyDownCapture={handleHostKeyDownCapture}
      >
        <main data-adaptive-main className="h-full min-h-0 min-w-0">
          {composition}
        </main>
      </div>
    </AdaptiveHostProvider>
  );
}

function hasSecondaryMajorSurface(
  pane: RefObject<HTMLElement | null> | HTMLElement | null,
): boolean {
  const element = pane && 'current' in pane ? pane.current : pane;
  return hasVisibleMajorSurface(element);
}
