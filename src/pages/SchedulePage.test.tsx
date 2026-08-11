import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';
import { SchedulePage } from '@/pages/SchedulePage';

const now = new Date('2026-08-11T12:00:00+09:00');
const customers = [{ id: 'customer-1', displayName: '박세입' }];
const events: CustomerEvent[] = [
  {
    id: 'past',
    customerId: 'customer-1',
    status: 'OCCURRED',
    occurredAt: '2026-08-10T10:00:00+09:00',
    descriptor: '지난 기록',
  },
  {
    id: 'today',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-11T09:00:00+09:00',
    descriptor: '오늘 일정',
  },
  {
    id: 'future',
    customerId: 'customer-1',
    status: 'CANCELLED',
    scheduledAt: '2026-08-12T10:00:00+09:00',
    descriptor: '미래 취소 일정',
  },
];

function renderPage(props: React.ComponentProps<typeof SchedulePage> = {}) {
  return render(
    <MemoryRouter initialEntries={['/app/schedule']}>
      <I18nProvider locale="ko">
        <Routes>
          <Route
            path="/app/schedule"
            element={
              <SchedulePage
                {...props}
                now={now}
                customers={props.customers ?? customers}
                events={props.events ?? events}
              />
            }
          />
          <Route path="/app/events/:eventId" element={<p>event detail route</p>} />
          <Route path="/app/customers/:customerId" element={<p>customer detail route</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('SchedulePage', () => {
  it('renders past, today, and future sections in agenda order', () => {
    renderPage();

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['8월 10일 (월)', '8월 11일 (화) 오늘', '8월 12일 (수)']);
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-agenda-row]')].map((row) =>
        row.getAttribute('data-event-id'),
      ),
    ).toEqual(['past', 'today', 'future']);
  });

  it('keeps the overdue cue conditional and selects the latest overdue date', () => {
    renderPage({
      events: [
        ...events,
        {
          id: 'overdue-latest',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: '2026-08-11T11:00:00+09:00',
          descriptor: '가장 최근 지난 일정',
        },
      ],
    });
    expect(screen.getByText('정리 필요한 일정 2개')).toBeVisible();
    expect(screen.getByText('가장 최근 지난 일정')).toBeVisible();
  });

  it('separates empty and error states while keeping the navigation baseline', () => {
    const { unmount } = renderPage({ events: [], customers: [] });
    expect(screen.getByText('아직 일정이 없습니다')).toBeVisible();
    expect(screen.getByRole('link', { name: '고객 보기' })).toHaveAttribute(
      'href',
      '/app/customers',
    );
    expect(screen.queryByText('일정을 불러오지 못했습니다')).not.toBeInTheDocument();
    unmount();

    renderPage({ loadState: 'error' });
    expect(screen.getByText('일정을 불러오지 못했습니다')).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByText('아직 일정이 없습니다')).not.toBeInTheDocument();
  });

  it('opens Event Detail from a row and Customer Detail from the customer target', () => {
    renderPage();
    const row = screen.getByRole('button', { name: '일정 상세 열기: 오늘 일정' });
    fireEvent.click(row);
    expect(screen.getByText('event detail route')).toBeVisible();
  });
});
