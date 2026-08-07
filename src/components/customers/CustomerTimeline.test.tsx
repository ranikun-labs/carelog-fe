import { render, screen } from '@testing-library/react';

import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import type { TimelineEntry } from '@/types/customer';

function renderTimeline(entries: readonly TimelineEntry[]) {
  render(
    <I18nProvider locale="ko">
      <CustomerTimeline entries={entries} />
    </I18nProvider>,
  );
}

describe('CustomerTimeline', () => {
  it('orders entries by occurredAt descending without mutating the input array', () => {
    const original = [...landlordTenantScenario.timeline];
    renderTimeline(landlordTenantScenario.timeline);

    const labels = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('p')?.textContent);
    expect(labels).toEqual([
      '갱신 조건 안내 문자 발송',
      '계약 갱신 의사 확인 통화',
      '입주 안내 완료',
    ]);

    expect(landlordTenantScenario.timeline).toEqual(original);
  });

  it('orders timestamps with different offsets by their actual instant', () => {
    const entries: TimelineEntry[] = [
      {
        id: 'offset-earlier',
        customerId: 'customer-1',
        occurredAt: '2026-08-01T00:30:00+09:00',
        label: 'offset earlier',
      },
      {
        id: 'utc-later',
        customerId: 'customer-1',
        occurredAt: '2026-07-31T16:00:00Z',
        label: 'utc later',
      },
    ];

    renderTimeline(entries);

    expect(
      screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['utc later', 'offset earlier']);
  });

  it('places invalid timestamps after valid entries in their input order', () => {
    const entries: TimelineEntry[] = [
      {
        id: 'valid-older',
        customerId: 'customer-1',
        occurredAt: '2026-07-31T16:00:00Z',
        label: 'valid older',
      },
      {
        id: 'invalid-first',
        customerId: 'customer-1',
        occurredAt: 'invalid-first',
        label: 'invalid first',
      },
      {
        id: 'valid-newer',
        customerId: 'customer-1',
        occurredAt: '2026-08-01T16:00:00Z',
        label: 'valid newer',
      },
      {
        id: 'invalid-second',
        customerId: 'customer-1',
        occurredAt: 'invalid-second',
        label: 'invalid second',
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
});
