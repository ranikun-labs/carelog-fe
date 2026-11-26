import { useEffect, useState } from 'react';

import { formatAgendaDateTime, getAgendaCoordinate } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import {
  SAVED_NOTICE_MAX_AGE_MS,
  useOptionalEventStore,
  type SavedNoticeRequest,
} from '@/state/EventStoreContext';

const NOTICE_VISIBLE_MS = 6000;

type ShownNotice = { seq: number; customerId: string | undefined; text: string };

/** 이 영역이 이 요청을 받을 수 있는지. 고객 상세는 그 고객만, 일정 화면(고객 미지정)은 모두. */
function isInScope(notice: SavedNoticeRequest, customerId: string | undefined): boolean {
  return customerId === undefined || notice.customerId === customerId;
}

function isExpired(notice: SavedNoticeRequest): boolean {
  return Date.now() - notice.createdAt >= SAVED_NOTICE_MAX_AGE_MS;
}

/**
 * 저장 직후 `role=status` 한 문장("8월 12일 (수) 10:00 일정을 저장했어요.").
 *
 * 요청의 상태 전이:
 * 1. 생성: 실제 저장이 성공한 뒤에만 스토어가 요청을 만든다(seq 단조 증가, createdAt 기록).
 * 2. 확인: 표시 프레임을 예약하기 전에 범위(고객)와 수명을 확인한다. 범위 밖 요청은 건드리지 않고 남긴다.
 * 3. 표시 확정: 문장이 실제로 렌더된 뒤에야 전역 요청을 소비한다. 그 전에는 지우지 않는다.
 * 4. 표시 전 이탈: 프레임 전에 영역이 unmount되면 예약을 취소하므로 요청이 남아 다음 진입에서 뜬다.
 * 5. 재진입: 소비된 요청은 다시 뜨지 않는다.
 * 6. 고객 전환: 같은 영역에서 고객이 바뀌면 이전 고객의 문장을 즉시 지운다.
 * 7·8. 수명: 스토어 타이머가 `SAVED_NOTICE_MAX_AGE_MS` 뒤 요청을 지우고, 표시 직전에도 한 번 더 확인한다.
 *
 * 컨테이너는 항상 렌더한다(내용이 없으면 높이 0). 라이브 영역이 나중에 생기면 스크린리더가 놓치기 때문이다.
 */
export function EventSavedNotice({
  className,
  customerId,
}: {
  className?: string;
  customerId?: string;
}) {
  const { locale, t } = useTranslation();
  const store = useOptionalEventStore();
  const notice = store?.savedNotice ?? null;
  const consume = store?.consumeSavedNotice;
  const getEvent = store?.getEvent;
  const [shown, setShown] = useState<ShownNotice | null>(null);

  // 6. 고객이 바뀌면 이전 고객의 문장을 지운다. render 중 조정이라 effect 안 setState가 아니다.
  if (shown && shown.customerId !== customerId) setShown(null);

  // 2·4. 표시 프레임을 예약한다. 프레임 전에 바뀌거나 unmount되면 예약을 취소하고 요청은 그대로 둔다.
  useEffect(() => {
    if (!notice || !isInScope(notice, customerId)) return;
    if (isExpired(notice)) {
      consume?.(notice.seq);
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (isExpired(notice)) return;
      const event = getEvent?.(notice.eventId);
      if (!event) {
        consume?.(notice.seq);
        return;
      }
      setShown({
        seq: notice.seq,
        customerId,
        text: t('eventForm.savedNotice', {
          when: formatAgendaDateTime(getAgendaCoordinate(event), locale),
        }),
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [consume, customerId, getEvent, locale, notice, t]);

  // 3·5. 문장이 렌더된 뒤에 전역 요청을 소비한다. 소비 뒤에는 같은 요청이 다시 예약되지 않는다.
  useEffect(() => {
    if (shown) consume?.(shown.seq);
  }, [consume, shown]);

  useEffect(() => {
    if (!shown) return;
    const timeoutId = window.setTimeout(() => setShown(null), NOTICE_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [shown]);

  return (
    <div role="status" data-event-saved-notice>
      {shown ? (
        <p
          key={shown.seq}
          className={cn(
            'bg-success-bg text-success rounded-inset type-label px-3 py-2 break-keep',
            className,
          )}
        >
          {shown.text}
        </p>
      ) : null}
    </div>
  );
}
