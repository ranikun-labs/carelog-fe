import { useContext } from 'react';
import { UNSAFE_DataRouterContext } from 'react-router';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useTranslation } from '@/i18n/I18nContext';

interface LeaveGuardProps {
  /** 이동 시점에 호출된다. 입력이 남아 있고 저장 중이 아니면 true. */
  shouldBlock: () => boolean;
  /** "나가기"를 확정했을 때(이동 직전) 임시 초안을 버리는 데 쓴다. */
  onLeave?: () => void;
  /** "계속 작성"이면 입력 중이던 요소로 포커스를 돌려준다. */
  restoreFocusTo?: () => HTMLElement | null | undefined;
}

/** 이탈 보호가 실제로 동작하는 트리(Data Router)인지. */
export function useLeaveGuardAvailable(): boolean {
  return useContext(UNSAFE_DataRouterContext) !== null;
}

/**
 * 폼 옆에 두면 이탈 보호와 확인 Dialog가 붙는다. useBlocker는 Data Router가 필요해,
 * 그렇지 않은 트리(단위 테스트의 MemoryRouter, 서버 렌더)에서는 보호 없이 아무것도 그리지 않는다.
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
