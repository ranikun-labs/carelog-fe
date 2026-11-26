import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

import { EventSavedNotice } from '@/components/schedule/EventSavedNotice';
import { I18nProvider } from '@/i18n/I18nContext';
import {
  EventStoreProvider,
  SAVED_NOTICE_MAX_AGE_MS,
  useEventStore,
} from '@/state/EventStoreContext';

/** 저장할 때마다 시각이 한 시간씩 늦어지는 최소 화면. 기본 시작은 8월 12일 10:00. */
function Harness({
  customerId = 'customer-1',
  noticeCustomerId,
  noticeMounted = true,
}: {
  customerId?: string;
  noticeCustomerId?: string;
  noticeMounted?: boolean;
}) {
  const store = useEventStore();
  const [saves, setSaves] = useState(0);
  const [onScreen, setOnScreen] = useState(noticeMounted);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setSaves((value) => value + 1);
          void store.createEvent({
            status: 'PLANNED',
            customerId,
            scheduledAt: new Date(2026, 7, 12, 10 + saves, 0, 0).toISOString(),
            descriptor: '상담',
          });
        }}
      >
        저장
      </button>
      <button type="button" onClick={() => setOnScreen((value) => !value)}>
        이동
      </button>
      {onScreen ? <EventSavedNotice customerId={noticeCustomerId} /> : null}
    </div>
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  render(
    <I18nProvider locale="ko">
      <EventStoreProvider>
        <Harness {...props} />
      </EventStoreProvider>
    </I18nProvider>,
  );
}

function noticeRegion() {
  return document.querySelector('[data-event-saved-notice]')!;
}

describe('EventSavedNotice', () => {
  it('keeps the role=status live region in the DOM even when empty', () => {
    renderHarness();
    expect(noticeRegion()).toHaveAttribute('role', 'status');
    expect(noticeRegion()).toBeEmptyDOMElement();
  });

  it('shows one sentence after a successful save', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(noticeRegion()).toHaveTextContent('8월 12일 (수) 10:00 일정을 저장했어요.'),
    );
  });

  it('changes the sentence on consecutive saves with different scheduled times', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('10:00 일정을 저장했어요.'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('11:00 일정을 저장했어요.'));
    expect(noticeRegion()).not.toHaveTextContent('10:00 일정');
    expect(document.querySelectorAll('[data-event-saved-notice] p')).toHaveLength(1);
  });

  it('a second save after the first was consumed is still shown (not lost to the same seq)', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('10:00'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('11:00'));
  });

  it('does not show the same notice again after leaving and re-entering the screen', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await waitFor(() => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument());
    expect(noticeRegion().querySelector('p')).toBeNull();
  });

  it('a save made while the notice was away is shown once when it re-enters, then not again', async () => {
    renderHarness({ noticeMounted: false });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    // 저장 뒤 같은 화면(알림 영역 없음)에서 바로 다시 들어온다.
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await waitFor(() => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument());
  });

  it('a customer-scoped region ignores another customer notice and shows its own', async () => {
    renderHarness({ customerId: 'customer-1', noticeCustomerId: 'customer-2' });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(noticeRegion().querySelector('p')).toBeNull();
  });

  it('a customer-scoped region shows the notice of its own customer', async () => {
    renderHarness({ customerId: 'customer-1', noticeCustomerId: 'customer-1' });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
  });

  it('drops a request that no screen received within the lifetime', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderHarness({ noticeMounted: false });
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      act(() => {
        vi.advanceTimersByTime(SAVED_NOTICE_MAX_AGE_MS + 1);
      });
      // 이제 화면에 들어와도 오래된 저장 알림은 뜨지 않는다.
      fireEvent.click(screen.getByRole('button', { name: '이동' }));
      expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument();
      expect(noticeRegion().querySelector('p')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes the sentence after 6 seconds and leaves an empty zero-height region', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument(), {
      timeout: 7000,
    });
    expect(noticeRegion()).toBeEmptyDOMElement();
  }, 10000);
});
