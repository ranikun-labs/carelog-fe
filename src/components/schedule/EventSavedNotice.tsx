import { useEffect, useState } from 'react';

import { formatAgendaDateTime, getAgendaCoordinate } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';

const NOTICE_VISIBLE_MS = 6000;

/**
 * 저장 직후 `role=status` 한 문장("8월 12일 (수) 10:00 일정을 저장했어요.").
 * 영역을 먼저 그려 두고 문장을 나중에 넣어야 스크린리더가 변화를 읽는다. 새 화면으로 돌아와도 같다.
 */
export function EventSavedNotice({ className }: { className?: string }) {
  const { locale, t } = useTranslation();
  const store = useOptionalEventStore();
  const eventId = store?.savedNoticeEventId ?? null;
  const event = eventId ? store?.getEvent(eventId) : undefined;
  const clearSavedNotice = store?.clearSavedNotice;
  const [message, setMessage] = useState('');
  const when = event ? formatAgendaDateTime(getAgendaCoordinate(event), locale) : null;

  useEffect(() => {
    if (!eventId || !when) return;
    // 영역이 그려진 뒤에 문장을 넣어야 스크린리더가 읽는다. 그래서 effect 안에서 바로 넣지 않고 프레임 뒤에 넣는다.
    const frameId = window.requestAnimationFrame(() =>
      setMessage(t('eventForm.savedNotice', { when })),
    );
    const timeoutId = window.setTimeout(() => {
      setMessage('');
      clearSavedNotice?.(eventId);
    }, NOTICE_VISIBLE_MS);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [clearSavedNotice, eventId, t, when]);

  // 저장 알림이 있을 때만 영역을 둔다(평소에는 다른 status 영역과 겹치지 않게). 영역이 먼저 서고 문장은 다음 프레임에 들어간다.
  if (!eventId) return null;

  return (
    <div role="status" data-event-saved-notice className={className}>
      {message ? (
        <p className="bg-success-bg text-success rounded-inset type-label px-3 py-2 break-keep">
          {message}
        </p>
      ) : null}
    </div>
  );
}
