import { useEffect, useState } from 'react';

import { formatAgendaDateTime, getAgendaCoordinate } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useOptionalEventStore } from '@/state/EventStoreContext';

const NOTICE_VISIBLE_MS = 6000;

/**
 * 저장 직후 `role=status` 한 문장("8월 12일 (수) 10:00 일정을 저장했어요.").
 * - 컨테이너는 항상 렌더한다(내용이 없으면 높이 0). 라이브 영역이 나중에 생기면 스크린리더가 놓치기 때문이다.
 * - 저장 요청은 한 번만 소비한다. 스토어의 요청을 받아 지역 상태로 옮기고 즉시 지워, 이동·재진입 뒤 다시 뜨지 않는다.
 * - 연속 저장은 요청 `seq`마다 새 문장으로 바뀐다. 6초 뒤 문장을 지운다.
 */
export function EventSavedNotice({ className }: { className?: string }) {
  const { locale, t } = useTranslation();
  const store = useOptionalEventStore();
  const notice = store?.savedNotice ?? null;
  const consume = store?.consumeSavedNotice;
  const getEvent = store?.getEvent;
  const [shown, setShown] = useState<{ seq: number; text: string } | null>(null);
  const [handledSeq, setHandledSeq] = useState<number | null>(null);
  const [pending, setPending] = useState<{ seq: number; text: string } | null>(null);

  // 새 요청은 렌더 중에 한 번만 문장으로 옮긴다(effect 안 setState를 피한다). 같은 seq는 다시 옮기지 않는다.
  if (notice && notice.seq !== handledSeq) {
    setHandledSeq(notice.seq);
    const event = getEvent?.(notice.eventId);
    if (event) {
      setPending({
        seq: notice.seq,
        text: t('eventForm.savedNotice', {
          when: formatAgendaDateTime(getAgendaCoordinate(event), locale),
        }),
      });
    }
  }

  // 문장은 한 프레임 뒤에 넣는다. 저장 직후 화면 전환·스크롤과 겹쳐 레이아웃이 흔들리는 것을 피하고, 라이브 영역이 먼저 서게 한다.
  useEffect(() => {
    if (!pending) return;
    const frameId = window.requestAnimationFrame(() => setShown(pending));
    return () => window.cancelAnimationFrame(frameId);
  }, [pending]);

  // 요청을 받으면 스토어에서 즉시 지운다. 이동·재진입 뒤 같은 요청이 다시 뜨지 않게 한다.
  useEffect(() => {
    if (notice) consume?.(notice.seq);
  }, [consume, notice]);

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
