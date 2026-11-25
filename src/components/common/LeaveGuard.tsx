import { createContext, useContext, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useTranslation } from '@/i18n/I18nContext';

interface LeaveGuardProps {
  /** 이동 시점에 호출된다. 입력이 남아 있으면 true. 저장 중에는 호출부가 true를 돌려준다. */
  shouldBlock: () => boolean;
  /** "나가기"를 확정했을 때(이동 직전) 임시 초안을 버리는 데 쓴다. */
  onLeave?: () => void;
  /** "계속 작성"이면 입력 중이던 요소로 포커스를 돌려준다. */
  restoreFocusTo?: () => HTMLElement | null | undefined;
}

/**
 * Data Router 트리 표식. 이탈 보호(useBlocker)는 Data Router에서만 동작한다.
 * `UNSAFE_DataRouterContext` 대신 이 공개 마커로 판별하므로, Data Router의 최상위 route element를
 * `LeaveGuardDataRouterScope`로 한 번 감싸야 한다. 마커가 없는 트리(MemoryRouter, SSR)에서는 보호가 꺼진다.
 */
const DataRouterScopeContext = createContext(false);

export function LeaveGuardDataRouterScope({ children }: { children: ReactNode }) {
  return <DataRouterScopeContext.Provider value>{children}</DataRouterScopeContext.Provider>;
}

/** 이탈 보호가 실제로 동작하는 트리(Data Router 표식 아래)인지. */
// eslint-disable-next-line react-refresh/only-export-components -- 폼이 표식 여부를 읽는 공개 훅이다.
export function useLeaveGuardAvailable(): boolean {
  return useContext(DataRouterScopeContext);
}

/**
 * 폼 옆에 두면 이탈 보호와 확인 Dialog가 붙는다. 표식이 없는 트리에서는 보호 없이 아무것도 그리지 않는다.
 */
export function LeaveGuard(props: LeaveGuardProps) {
  return useLeaveGuardAvailable() ? <ActiveLeaveGuard {...props} /> : null;
}

function ActiveLeaveGuard({ shouldBlock, onLeave, restoreFocusTo }: LeaveGuardProps) {
  const { t } = useTranslation();
  const blocker = useLeaveGuard(shouldBlock);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('leaveGuard.title')}
      description={t('leaveGuard.description')}
      cancelLabel={t('leaveGuard.stay')}
      confirmLabel={t('leaveGuard.leave')}
      restoreFocusTo={restoreFocusTo}
      onCancel={() => blocker.reset?.()}
      onConfirm={() => {
        onLeave?.();
        blocker.proceed?.();
      }}
    />
  );
}
