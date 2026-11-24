import type { AssistantAdapter } from '@/assistant/assistantAdapter';
import { AssistantAdapterProvider } from '@/assistant/AssistantAdapterContext';
import { useOptionalAuth } from '@/auth/AuthProvider';
import { AuthOperationErrorSurface } from '@/components/auth/AuthStatusSurface';
import { AuthRecoveryBanner } from '@/components/auth/AuthStatusSurface';
import { AUTH_STATE } from '@/auth/authTypes';
import { AdaptiveHost } from '@/components/layout/AdaptiveHost';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useEventCreateReturnBoundary } from '@/components/layout/EventCreateReturnBoundary';
import {
  ProductionStateProviders,
  type ProductStateProvider,
  type ProductStateProviderProps,
} from '@/components/layout/ProductionStateProviders';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { useOptionalCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import { EventCreateActivationProvider } from '@/state/EventCreateActivationContext';

export function AppShellFrame() {
  const auth = useOptionalAuth();
  const { handleClickCapture, handleKeyDownCapture } = useEventCreateReturnBoundary();

  return (
    // Safe Area: 상·좌우(노치·상태바·가로 회전)는 셸이, 하단은 폰=BottomNavigation / 태블릿=여기서 처리.
    // 패딩 면은 content와 같은 surface로 칠해 가장자리에 page 색 띠가 생기지 않게 한다.
    <div
      data-app-shell
      className="bg-surface flex h-dvh w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:pb-[env(safe-area-inset-bottom)]"
    >
      {auth?.operationError ? (
        <AuthOperationErrorSurface
          failure={auth.operationError.failure}
          onRetry={auth.operationError.retry ? () => void auth.retryOperation() : undefined}
          onDismiss={auth.clearOperationError}
        />
      ) : null}
      {auth?.authState.status === AUTH_STATE.RECOVERING ? <AuthRecoveryBanner /> : null}
      <div
        data-app-host
        className="bg-page min-h-0 w-full flex-1 overflow-hidden"
        onClickCapture={handleClickCapture}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div data-app-frame className="flex h-full w-full min-w-0">
          <SideNavigationRail />
          <div
            data-app-content
            className="bg-surface flex h-full min-w-0 flex-1 flex-col overflow-hidden"
          >
            <AdaptiveHost />
            <BottomNavigation />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Standalone shell export retained for component-level tests and embedders. */
export function AppShell({
  initialCustomers,
  initialEvents,
  stateProviders,
  assistantAdapter,
}: Omit<ProductStateProviderProps, 'children'> & {
  stateProviders?: ProductStateProvider;
  assistantAdapter?: AssistantAdapter;
} = {}) {
  const customerStore = useOptionalCustomerStore();
  const eventStore = useOptionalEventStore();
  const frame = <AppShellFrame />;
  const StateProviders = stateProviders ?? ProductionStateProviders;
  const content =
    customerStore && eventStore ? (
      frame
    ) : (
      <StateProviders {...(stateProviders ? { initialCustomers, initialEvents } : {})}>
        {frame}
      </StateProviders>
    );

  return (
    <AppLocaleProvider>
      <EventCreateActivationProvider>
        <AssistantAdapterProvider adapter={assistantAdapter}>{content}</AssistantAdapterProvider>
      </EventCreateActivationProvider>
    </AppLocaleProvider>
  );
}
