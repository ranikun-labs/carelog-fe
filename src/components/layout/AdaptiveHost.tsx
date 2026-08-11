import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
  type AdaptiveHostContextValue,
  type AdaptiveMode,
  type AdaptiveNavigationState,
  type AdaptiveRoot,
  type SelectEventOptions,
  readAdaptiveNavigationState,
} from '@/components/layout/adaptiveHostContext';

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

type RouteKind = 'schedule' | 'customers' | 'customer-detail' | 'event' | 'other';

interface RouteInfo {
  kind: RouteKind;
  eventId?: string;
  customerId?: string;
  navigationState: AdaptiveNavigationState;
}

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

function useViewportMetrics(hostRef: RefObject<HTMLElement | null>): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => readViewportMetrics(null));

  const measure = useCallback(() => {
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
  }, [hostRef]);

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
  const eventMatch = matchPath({ path: APP_ROUTE_PATHS.eventDetail, end: true }, pathname);
  if (eventMatch) {
    return {
      kind: 'event',
      eventId: decodePathSegment(eventMatch.params.eventId),
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
  if (routeInfo.kind === 'customers' || routeInfo.kind === 'customer-detail') return 'customers';
  if (routeInfo.kind === 'event') return routeInfo.navigationState.adaptiveRoot ?? 'schedule';
  return 'schedule';
}

function getTwoPaneRoot(routeInfo: RouteInfo, activeRoot: AdaptiveRoot): AdaptiveRoot | null {
  if (routeInfo.kind === 'schedule') return 'schedule';
  if (routeInfo.kind === 'event') return activeRoot;
  if (routeInfo.kind === 'customers' || routeInfo.kind === 'customer-detail') {
    return 'customers';
  }
  return null;
}

function isSelectedRoute(routeInfo: RouteInfo): boolean {
  return routeInfo.kind === 'event' || routeInfo.kind === 'customer-detail';
}

export function AdaptiveHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const metrics = useViewportMetrics(hostRef);
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

  const navigationState = routeInfo.navigationState;
  const routeEventId = routeInfo.kind === 'event' ? (routeInfo.eventId ?? null) : null;
  const routeCustomerId =
    routeInfo.kind === 'customer-detail'
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
      navigate(buildAppCustomerDetailPath(customerId), {
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
        className="mx-auto h-full w-full min-w-0 md:max-w-[520px] lg:max-w-[560px]"
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
        className="grid h-full min-h-0 min-w-0 grid-cols-2"
      >
        <section
          ref={masterPaneRef}
          data-adaptive-pane="master"
          aria-label="주요 목록"
          className="border-border-default min-h-0 min-w-0 overflow-hidden border-r"
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
