import { render, screen } from '@testing-library/react';
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
  it('uses the nearest future PLANNED event as the primary card', () => {
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
        scheduledAt: '2026-08-11T11:00:00+09:00',
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

    const primary = screen.getByRole('link', { name: '일정 상세 열기: nearest planned' });
    expect(primary).toHaveAttribute('href', '/app/events/future-nearest');
    expect(primary).toHaveTextContent('nearest planned');
    expect(primary).not.toHaveTextContent('latest occurred');
    expect(primary).not.toHaveTextContent('overdue planned');
    expect(screen.getByText('이후 예정 1건')).toBeVisible();
    expect(screen.getByRole('link', { name: '일정 상세 열기: later planned' })).toHaveAttribute(
      'href',
      '/app/events/future-later',
    );
  });

  it('shows the locked no-upcoming grammar without promoting past events', () => {
    renderUpcoming([
      {
        id: 'occurred',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-11T11:30:00+09:00',
        descriptor: 'past record',
      },
      {
        id: 'overdue',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T11:00:00+09:00',
        descriptor: 'overdue plan',
      },
    ]);

    expect(screen.getByText('다음 일정 없음')).toBeVisible();
    expect(screen.queryByText('past record')).not.toBeInTheDocument();
    expect(screen.queryByText('overdue plan')).not.toBeInTheDocument();
  });
});
