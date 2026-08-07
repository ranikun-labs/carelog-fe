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

    const labels = screen.getAllByRole('listitem').map((item) => item.textContent);
    const expectedOrder = [...landlordTenantScenario.timeline]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((entry) => entry.label);
    expectedOrder.forEach((label, index) => {
      expect(labels[index]).toContain(label);
    });

    expect(landlordTenantScenario.timeline).toEqual(original);
  });

  it('renders an empty state when there are no entries', () => {
    renderTimeline([]);
    expect(screen.getByText('아직 기록이 없습니다.')).toBeVisible();
  });
});
