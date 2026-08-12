import {
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '@/lib/utils';

export type AdaptiveMode = 'single' | 'two-pane';
export type AdaptiveRoot = 'schedule' | 'customers';
export type AdaptiveSurfacePolicy = 'scan' | 'readable';

export interface AdaptiveNavigationState {
  adaptiveRoot?: AdaptiveRoot;
  adaptiveCustomerId?: string;
  adaptiveEventId?: string;
  targetEventId?: string;
  targetDateKey?: string;
}

export interface AdaptiveHostContextValue {
  mode: AdaptiveMode;
  availableWidth: number;
  isLandscape: boolean;
  isCoVisible: boolean;
  activeRoot: AdaptiveRoot;
  schedule: {
    selectedDateKey: string | null;
    selectedEventId: string | null;
    scrollTop: number;
  };
  customers: {
    selectedCustomerId: string | null;
    selectedEventId: string | null;
    listScrollTop: number;
    detailScrollTop: number;
  };
  eventDetailScrollTop: number;
  selectEvent: (eventId: string, options?: SelectEventOptions) => void;
  selectCustomer: (customerId: string) => void;
  selectCustomerEvent: (customerId: string, eventId: string) => void;
  openCustomerFromEvent: (customerId: string) => void;
  goBackFromEvent: (customerId: string) => void;
  returnFromEvent: (eventId: string, customerId: string, targetDateKey: string) => void;
  setScheduleDate: (dateKey: string) => void;
  setScheduleScrollTop: (scrollTop: number) => void;
  setCustomerListScrollTop: (scrollTop: number) => void;
  setCustomerDetailScrollTop: (scrollTop: number) => void;
  setEventDetailScrollTop: (scrollTop: number) => void;
}

export interface SelectEventOptions {
  root?: AdaptiveRoot;
  customerId?: string;
  targetDateKey?: string;
}

const AdaptiveHostContext = createContext<AdaptiveHostContextValue | null>(null);

export function AdaptiveHostProvider({
  value,
  children,
}: {
  value: AdaptiveHostContextValue;
  children: ReactNode;
}) {
  return <AdaptiveHostContext.Provider value={value}>{children}</AdaptiveHostContext.Provider>;
}

export function useOptionalAdaptiveHost(): AdaptiveHostContextValue | null {
  return useContext(AdaptiveHostContext);
}

export function AdaptiveSurface({
  children,
  className,
  majorSurface,
  ref,
  ...props
}: ComponentPropsWithoutRef<'section'> & {
  children: ReactNode;
  majorSurface?: string;
  ref?: Ref<HTMLElement>;
}) {
  const host = useOptionalAdaptiveHost();
  const Tag = host ? 'section' : 'main';

  return (
    <Tag
      {...props}
      ref={ref}
      className={className}
      {...(majorSurface ? { 'data-major-surface': majorSurface } : {})}
    >
      {children}
    </Tag>
  );
}

export function AdaptiveSurfaceContent({
  children,
  policy,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & {
  children: ReactNode;
  policy: AdaptiveSurfacePolicy;
}) {
  return (
    <div
      {...props}
      data-adaptive-surface-content={policy}
      className={cn(
        'mx-auto w-full min-w-0',
        policy === 'scan' ? 'xl:max-w-6xl' : 'xl:max-w-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function readAdaptiveNavigationState(value: unknown): AdaptiveNavigationState {
  if (!value || typeof value !== 'object') return {};
  const state = value as Record<string, unknown>;
  return {
    ...(state.adaptiveRoot === 'schedule' || state.adaptiveRoot === 'customers'
      ? { adaptiveRoot: state.adaptiveRoot }
      : {}),
    ...(typeof state.adaptiveCustomerId === 'string'
      ? { adaptiveCustomerId: state.adaptiveCustomerId }
      : {}),
    ...(typeof state.adaptiveEventId === 'string'
      ? { adaptiveEventId: state.adaptiveEventId }
      : {}),
    ...(typeof state.targetEventId === 'string' ? { targetEventId: state.targetEventId } : {}),
    ...(typeof state.targetDateKey === 'string' ? { targetDateKey: state.targetDateKey } : {}),
  };
}
