import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CustomerUpcoming } from '@/components/customers/CustomerUpcoming';
import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date('2026-08-11T12:00:00+09:00');

function renderUpcoming(events: readonly CustomerEvent[]) {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerUpcoming events={events} now={now} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerUpcoming', () => {
  it('puts the overdue PLANNED first with label, title, time and a single Strong action', () => {
    renderUpcoming([
      {
        id: 'occurred-latest',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-11T11:30:00+09:00',
        descriptor: 'latest occurred',
      },
      {
        id: 'overdue-planned',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T09:30:00+09:00',
        descriptor: 'overdue planned',
      },
      {
        id: 'future-later',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-13T10:00:00+09:00',
        descriptor: 'later planned',
      },
      {
        id: 'future-nearest',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-12T10:00:00+09:00',
        descriptor: 'nearest planned',
      },
    ]);

    const primary = screen.getByRole('link', { name: '일정 상세 열기: overdue planned' });
    expect(primary).toHaveAttribute('href', '/app/events/overdue-planned');
    expect(primary).toHaveTextContent('정리 필요');
    expect(primary).toHaveTextContent('overdue planned');
    expect(primary.querySelector('time')).toHaveAttribute('datetime', '2026-08-11T09:30:00+09:00');
    expect(screen.getByText('정리 필요 1건')).toBeVisible();
    expect(screen.getAllByRole('link', { name: '기록 완료' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: '기록 완료' })).toHaveAttribute(
      'href',
      '/app/events/overdue-planned',
    );
    expect(screen.getByText('이후 예정 2건')).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
  });

  it('uses the nearest future PLANNED as primary without a record action when nothing is overdue', () => {
    renderUpcoming([
      {
        id: 'future-later',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-13T10:00:00+09:00',
        descriptor: 'later planned',
      },
      {
        id: 'future-nearest',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-12T10:00:00+09:00',
        descriptor: 'nearest planned',
      },
    ]);

    const primary = screen.getByRole('link', { name: '일정 상세 열기: nearest planned' });
    expect(primary).toHaveAttribute('href', '/app/events/future-nearest');
    expect(primary).not.toHaveTextContent('정리 필요');
    expect(screen.queryByRole('link', { name: '기록 완료' })).not.toBeInTheDocument();
    expect(screen.queryByText(/정리 필요 \d건/)).not.toBeInTheDocument();
    expect(screen.getByText('이후 예정 1건')).toBeVisible();
  });

  it('shows "다음 일정 없음" only when no PLANNED event exists', () => {
    renderUpcoming([
      {
        id: 'occurred',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-11T11:30:00+09:00',
        descriptor: 'past record',
      },
      {
        id: 'cancelled',
        customerId: 'customer-1',
        status: 'CANCELLED',
        scheduledAt: '2026-08-12T11:00:00+09:00',
        descriptor: 'cancelled plan',
      },
    ]);

    expect(screen.getByText('다음 일정 없음')).toBeVisible();
    expect(screen.queryByText('past record')).not.toBeInTheDocument();
    expect(screen.queryByText('cancelled plan')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '기록 완료' })).not.toBeInTheDocument();
  });

  it('calls onOpenEvent with the occurrence intent from the Strong action', () => {
    const onOpenEvent = vi.fn();
    const overdue: CustomerEvent = {
      id: 'overdue',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-11T09:30:00+09:00',
      descriptor: 'overdue',
    };
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerUpcoming events={[overdue]} now={now} onOpenEvent={onOpenEvent} />
        </I18nProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: '기록 완료' }));
    expect(onOpenEvent).toHaveBeenCalledWith(overdue, { openOccurrence: true });
  });

  it('renders the action inside the Key Block, and keeps it in the empty state too', () => {
    const planned: CustomerEvent = {
      id: 'future',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-12T10:00:00+09:00',
      descriptor: 'next',
    };
    const { unmount } = render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerUpcoming events={[planned]} now={now} action={<button>행동</button>} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-upcoming-key]')).toContainElement(
      screen.getByRole('button', { name: '행동' }),
    );
    unmount();

    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerUpcoming events={[]} now={now} action={<button>행동</button>} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-customer-upcoming-empty]')).toContainElement(
      screen.getByRole('button', { name: '행동' }),
    );
  });

  it('keeps only the action, without heading or empty copy, while not ready', () => {
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerUpcoming events={[]} now={now} ready={false} action={<button>행동</button>} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '행동' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: '다음 일정' })).not.toBeInTheDocument();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
  });
});
