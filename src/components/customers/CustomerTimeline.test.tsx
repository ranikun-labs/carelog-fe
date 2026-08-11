import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { adaptLegacyCustomerEvents } from '@/adapters/legacyCustomerEventAdapter';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import type { CustomerEvent } from '@/domain/customerEvent';
import { landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';

function renderTimeline(events: readonly CustomerEvent[]) {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerTimeline events={events} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerTimeline', () => {
  it('orders entries by occurredAt descending without mutating the input array', () => {
    const events = adaptLegacyCustomerEvents({
      timelineEntries: landlordTenantScenario.timeline,
      followUps: [],
    }).events;
    const original = [...events];
    renderTimeline(events);

    const labels = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('p')?.textContent);
    expect(labels).toEqual([
      '갱신 조건 안내 문자 발송',
      '계약 갱신 의사 확인 통화',
      '입주 안내 완료',
    ]);

    expect(events).toEqual(original);
  });

  it('orders timestamps with different offsets by their actual instant', () => {
    const entries: CustomerEvent[] = [
      {
        id: 'offset-earlier',
        customerId: 'customer-1',
        occurredAt: '2026-08-01T00:30:00+09:00',
        status: 'OCCURRED',
        descriptor: 'offset earlier',
      },
      {
        id: 'utc-later',
        customerId: 'customer-1',
        occurredAt: '2026-07-31T16:00:00Z',
        status: 'OCCURRED',
        descriptor: 'utc later',
      },
    ];

    renderTimeline(entries);

    expect(
      screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['utc later', 'offset earlier']);
  });

  it('places invalid timestamps after valid entries in their input order', () => {
    const entries: CustomerEvent[] = [
      {
        id: 'valid-older',
        customerId: 'customer-1',
        occurredAt: '2026-07-31T16:00:00Z',
        status: 'OCCURRED',
        descriptor: 'valid older',
      },
      {
        id: 'invalid-first',
        customerId: 'customer-1',
        occurredAt: 'invalid-first',
        status: 'OCCURRED',
        descriptor: 'invalid first',
      },
      {
        id: 'valid-newer',
        customerId: 'customer-1',
        occurredAt: '2026-08-01T16:00:00Z',
        status: 'OCCURRED',
        descriptor: 'valid newer',
      },
      {
        id: 'invalid-second',
        customerId: 'customer-1',
        occurredAt: 'invalid-second',
        status: 'OCCURRED',
        descriptor: 'invalid second',
      },
    ];

    renderTimeline(entries);

    expect(
      screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['valid newer', 'valid older', 'invalid first', 'invalid second']);
  });

  it('renders an empty state when there are no entries', () => {
    renderTimeline([]);
    expect(screen.getByText('아직 기록이 없습니다.')).toBeVisible();
  });

  it('projects OCCURRED and CANCELLED events while excluding PLANNED', () => {
    renderTimeline([
      {
        id: 'planned-1',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-12T10:00:00+09:00',
        descriptor: 'future plan',
      },
      {
        id: 'cancelled-1',
        customerId: 'customer-1',
        status: 'CANCELLED',
        scheduledAt: '2026-08-10T10:00:00+09:00',
        descriptor: 'cancelled plan',
      },
    ]);

    expect(screen.getByText('cancelled plan')).toBeVisible();
    expect(screen.queryByText('future plan')).not.toBeInTheDocument();
    expect(screen.getByText('취소됨')).toBeVisible();
    expect(screen.getByRole('link', { name: '일정 상세 열기: cancelled plan' })).toHaveAttribute(
      'href',
      '/app/events/cancelled-1',
    );
  });

  it('reveals history in additional groups of eight', () => {
    renderTimeline(
      Array.from({ length: 17 }, (_, index): CustomerEvent => ({
        id: `occurred-${index}`,
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: `2026-08-${String(17 - index).padStart(2, '0')}T10:00:00+09:00`,
        descriptor: `기록 ${index}`,
      })),
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: '더보기' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(16);
    fireEvent.click(screen.getByRole('button', { name: '더보기' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(17);
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument();
  });
});
