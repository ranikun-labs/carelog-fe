import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';
import { SchedulePage } from '@/pages/SchedulePage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

const now = new Date('2026-08-11T12:00:00+09:00');
const customers = [{ id: 'customer-1', displayName: '박세입' }];
const events: CustomerEvent[] = [
  {
    id: 'today',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-11T09:00:00+09:00',
    descriptor: '오늘 일정',
  },
  {
    id: 'far',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-20T10:00:00+09:00',
    descriptor: '먼 날짜 일정',
  },
  {
    id: 'near',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-11T15:00:00+09:00',
    descriptor: '같은 날 다른 일정',
  },
];

/** 일정 화면을 마운트한 채로 라우터 이동(같은 라우트, 새 state)을 한다. 재마운트 없이 대상을 처리해야 한다. */
function Navigator({ to, state }: { to: string; state: Record<string, unknown> | null }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (to) navigate(to, { state });
  }, [navigate, state, to]);
  return null;
}

function renderWithTarget(target: { to: string; state: Record<string, unknown> | null } | null) {
  return render(
    <MemoryRouter initialEntries={['/app/schedule']}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider>
          <Routes>
            <Route
              path="/app/schedule"
              element={<SchedulePage now={now} customers={customers} events={events} />}
            />
          </Routes>
          {target ? <Navigator to={target.to} state={target.state} /> : null}
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('schedule page target navigation without remount (MAJOR-02 regression)', () => {
  let scrollTargets: string[];
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    scrollTargets = [];
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: HTMLElement) {
        scrollTargets.push(this.dataset.eventId ?? this.dataset.dateKey ?? '');
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('scrolls to a target on another date when the page is already mounted', async () => {
    renderWithTarget({
      to: '/app/schedule',
      state: { adaptiveRoot: 'schedule', targetEventId: 'far', targetDateKey: '2026-08-20' },
    });
    await waitFor(() => expect(scrollTargets).toContain('far'));
    expect(screen.getByText('먼 날짜 일정')).toBeInTheDocument();
  });

  it('scrolls to a target on the same date when the page is already mounted', async () => {
    renderWithTarget({
      to: '/app/schedule',
      state: { adaptiveRoot: 'schedule', targetEventId: 'near', targetDateKey: '2026-08-11' },
    });
    await waitFor(() => expect(scrollTargets).toContain('near'));
  });

  it('after a target was handled, a later render does not scroll to it again', async () => {
    const { rerender } = renderWithTarget({
      to: '/app/schedule',
      state: { adaptiveRoot: 'schedule', targetEventId: 'near', targetDateKey: '2026-08-11' },
    });
    await waitFor(() => expect(scrollTargets).toContain('near'));
    const count = scrollTargets.length;
    rerender(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <I18nProvider locale="ko">
          <CustomerStoreProvider>
            <Routes>
              <Route
                path="/app/schedule"
                element={<SchedulePage now={now} customers={customers} events={[...events]} />}
              />
            </Routes>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await act(async () => undefined);
    expect(scrollTargets.length).toBe(count);
  });
});
