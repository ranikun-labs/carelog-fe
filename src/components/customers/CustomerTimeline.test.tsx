import { render, screen } from '@testing-library/react';

import { adaptLegacyCustomerEvents } from '@/adapters/legacyCustomerEventAdapter';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import type { CustomerEvent } from '@/domain/customerEvent';
import { landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';

function renderTimeline(events: readonly CustomerEvent[]) {
  render(
    <I18nProvider locale="ko">
      <CustomerTimeline events={events} />
    </I18nProvider>,
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

  it('projects only OCCURRED events onto the timeline', () => {
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

    expect(screen.getByText('아직 기록이 없습니다.')).toBeVisible();
    expect(screen.queryByText('future plan')).not.toBeInTheDocument();
    expect(screen.queryByText('cancelled plan')).not.toBeInTheDocument();
  });
});
