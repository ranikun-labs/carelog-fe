import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { EventSavedNotice } from '@/components/schedule/EventSavedNotice';
import { I18nProvider } from '@/i18n/I18nContext';
import { EventStoreProvider, useEventStore } from '@/state/EventStoreContext';

// 로컬 시각으로 만든 순간이라 실행 TZ와 무관하게 같은 벽시계(8월 12일 10:00)로 보인다.
const scheduledAt = new Date(2026, 7, 12, 10, 0, 0).toISOString();

/** 저장 버튼, 화면 이동(알림 영역 unmount/remount) 버튼을 가진 최소 화면. */
function Harness() {
  const store = useEventStore();
  const [onScreen, setOnScreen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void store.createEvent({
            status: 'PLANNED',
            customerId: 'customer-1',
            scheduledAt,
            descriptor: '상담',
          })
        }
      >
        저장
      </button>
      <button type="button" onClick={() => setOnScreen((value) => !value)}>
        이동
      </button>
      {onScreen ? <EventSavedNotice /> : null}
    </div>
  );
}

function renderHarness() {
  render(
    <I18nProvider locale="ko">
      <EventStoreProvider>
        <Harness />
      </EventStoreProvider>
    </I18nProvider>,
  );
}

/** 문장은 한 프레임 뒤에 들어온다. 두 프레임을 기다린다. */
async function flush() {
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
    const region = document.querySelector('[data-event-saved-notice]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows one sentence after a successful save and updates the text on each save', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const region = document.querySelector('[data-event-saved-notice]')!;
    await waitFor(() => expect(region).toHaveTextContent('8월 12일 (수) 10:00 일정을 저장했어요.'));

    // 연속 저장: 두 번째 저장 문장으로 바뀐다(같은 영역 안에서, 문장은 하나).
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(region).toHaveTextContent('일정을 저장했어요.'));
    expect(document.querySelectorAll('[data-event-saved-notice] p')).toHaveLength(1);
  });

  it('does not show the same notice again after leaving and re-entering the screen', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();

    // 이동: 알림 영역이 화면에서 빠졌다가 재진입한다.
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await flush();
    expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-event-saved-notice] p')).toBeNull();
  });

  it('a save made while the notice was away is shown once when it re-enters, then not again', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await flush();
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await flush();
    expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument();
  });

  it('removes the sentence after 6 seconds and leaves an empty zero-height region', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/일정을 저장했어요/)).toBeVisible();
    await waitFor(
      () => expect(screen.queryByText(/일정을 저장했어요/)).not.toBeInTheDocument(),
      { timeout: 7000 },
    );
    expect(document.querySelector('[data-event-saved-notice]')).toBeEmptyDOMElement();
  }, 10000);
});
