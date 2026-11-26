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

type HarnessProps = {
  /** 저장할 고객 */
  customerId?: string;
  /** 알림 영역의 고객 범위(고객 상세). 생략하면 일정 화면처럼 전체. */
  noticeCustomerId?: string;
  /** 처음부터 알림 영역을 붙일지 */
  noticeMounted?: boolean;
};

/** 저장할 때마다 시각이 한 시간씩 늦어지는 최소 화면. 시작은 8월 12일 10:00. */
function Harness({
  customerId = 'customer-1',
  noticeCustomerId,
  noticeMounted = true,
}: HarnessProps) {
  const store = useEventStore();
  const [saves, setSaves] = useState(0);
  const [onScreen, setOnScreen] = useState(noticeMounted);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setSaves((value) => value + 1);
          void store
            .createEvent({
              status: 'PLANNED',
              customerId,
              scheduledAt: new Date(2026, 7, 12, 10 + saves, 0, 0).toISOString(),
              descriptor: '상담',
            })
            .catch(() => undefined);
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

function ui(props: HarnessProps, port?: Parameters<typeof EventStoreProvider>[0]['port']) {
  return (
    <I18nProvider locale="ko">
      <EventStoreProvider port={port}>
        <Harness {...props} />
      </EventStoreProvider>
    </I18nProvider>
  );
}

function renderHarness(props: HarnessProps = {}) {
  return render(ui(props));
}

function noticeRegion() {
  return document.querySelector('[data-event-saved-notice]')!;
}

function saveButton() {
  return screen.getByRole('button', { name: '저장' });
}

function toggleScreen() {
  fireEvent.click(screen.getByRole('button', { name: '이동' }));
}

/** 가짜 시계(타이머·Date·rAF). 프레임은 vi.advanceTimersToNextFrame으로 직접 넘긴다. */
function useFrameClock() {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
}

/** 저장 요청(비동기 port)이 스토어에 들어갈 때까지 마이크로태스크를 비운다. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => undefined);
  }
}

function nextFrame() {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

/** 프레임 두 번과 짧은 대기. 가짜 시계 없이 쓴다. */
async function nextFrames() {
  await act(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      }),
  );
}

describe('EventSavedNotice', () => {
  it('keeps the role=status live region in the DOM even when empty', () => {
    renderHarness();
    expect(noticeRegion()).toHaveAttribute('role', 'status');
    expect(noticeRegion()).toBeEmptyDOMElement();
  });

  it('(1) creates a request only after a real successful save, not after a failed one', async () => {
    const port = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn().mockRejectedValue(new Error('save failed')),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    };
    render(ui({}, port as unknown as Parameters<typeof EventStoreProvider>[0]['port']));
    fireEvent.click(saveButton());
    await nextFrames();
    expect(port.create).toHaveBeenCalledTimes(1);
    expect(noticeRegion().querySelector('p')).toBeNull();
  });

  it('shows one sentence after a successful save with the saved time', async () => {
    renderHarness();
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(noticeRegion()).toHaveTextContent('8월 12일 (수) 10:00 일정을 저장했어요.'),
    );
  });

  it('(7) the second save replaces the sentence with its own time, not the same one', async () => {
    renderHarness();
    fireEvent.click(saveButton());
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('10:00 일정을 저장했어요.'));
    fireEvent.click(saveButton());
    await waitFor(() => expect(noticeRegion()).toHaveTextContent('11:00 일정을 저장했어요.'));
    expect(noticeRegion()).not.toHaveTextContent('10:00 일정');
    expect(document.querySelectorAll('[data-event-saved-notice] p')).toHaveLength(1);
  });

  it('(4) a region that unmounts before the sentence is shown does not lose the request', async () => {
    useFrameClock();
    try {
      renderHarness({ noticeMounted: false });
      fireEvent.click(saveButton());
      await settle();
      toggleScreen(); // 들어와서 표시 프레임을 예약한다
      toggleScreen(); // 프레임 전에 나간다
      toggleScreen(); // 다시 들어온다
      nextFrame();
      expect(screen.getByText(/일정을 저장했어요/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(5) does not show the same notice again after leaving and re-entering the screen', async () => {
    renderHarness();
    fireEvent.click(saveButton());
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    toggleScreen();
    toggleScreen();
    await waitFor(() => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument());
    toggleScreen();
    toggleScreen();
    await nextFrames();
    expect(noticeRegion().querySelector('p')).toBeNull();
  });

  it('(2)(6) a customer-scoped region ignores another customer and keeps the request for its own screen', async () => {
    const { rerender } = render(ui({ customerId: 'customer-2', noticeCustomerId: 'customer-1' }));
    fireEvent.click(saveButton());
    await nextFrames();
    expect(noticeRegion().querySelector('p')).toBeNull();
    rerender(ui({ customerId: 'customer-2', noticeCustomerId: 'customer-2' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
  });

  it('(6) switching the customer in the same region clears the previous customer sentence at once', async () => {
    const { rerender } = render(ui({ customerId: 'customer-1', noticeCustomerId: 'customer-1' }));
    fireEvent.click(saveButton());
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    rerender(ui({ customerId: 'customer-1', noticeCustomerId: 'customer-3' }));
    expect(noticeRegion().querySelector('p')).toBeNull();
  });

  it('(7) an earlier request timer does not clear a newer request', async () => {
    useFrameClock();
    try {
      renderHarness({ noticeMounted: false });
      fireEvent.click(saveButton());
      await settle();
      act(() => {
        vi.advanceTimersByTime(SAVED_NOTICE_MAX_AGE_MS - 4000);
      });
      fireEvent.click(saveButton()); // 두 번째 저장: 첫 요청 만료 시각(10초)을 넘긴다
      await settle();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      toggleScreen();
      nextFrame();
      expect(screen.getByText(/11:00 일정을 저장했어요/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(8) a request is still valid just before the lifetime', async () => {
    // 프레임 한 칸(약 16ms)을 남겨 둔다: 표시 시점도 수명 안이어야 한다.
    useFrameClock();
    try {
      renderHarness({ noticeMounted: false });
      fireEvent.click(saveButton());
      await settle();
      act(() => {
        vi.advanceTimersByTime(SAVED_NOTICE_MAX_AGE_MS - 100);
      });
      toggleScreen();
      nextFrame();
      expect(screen.getByText(/일정을 저장했어요/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(8) drops the request exactly at the lifetime', async () => {
    useFrameClock();
    try {
      renderHarness({ noticeMounted: false });
      fireEvent.click(saveButton());
      await settle();
      act(() => {
        vi.advanceTimersByTime(SAVED_NOTICE_MAX_AGE_MS);
      });
      toggleScreen();
      expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument();
      expect(noticeRegion().querySelector('p')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(9) unmounting the provider clears its pending lifetime timer', async () => {
    useFrameClock();
    try {
      const { unmount } = renderHarness({ noticeMounted: false });
      fireEvent.click(saveButton());
      await settle();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes the sentence after 6 seconds and leaves an empty zero-height region', async () => {
    renderHarness();
    fireEvent.click(saveButton());
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument(), {
      timeout: 7000,
    });
    expect(noticeRegion()).toBeEmptyDOMElement();
  }, 10000);
});
