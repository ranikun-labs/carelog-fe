import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import type { CustomerEventPort } from '@/integrations/carelog/customerEventPort';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import { I18nProvider } from '@/i18n/I18nContext';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider } from '@/state/EventStoreContext';

const TEST_NOW = new Date('2026-08-11T12:00:00+09:00');

function createEventPort(overrides: Partial<CustomerEventPort> = {}): CustomerEventPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function renderRemotePage(port: CustomerEventPort) {
  render(
    <MemoryRouter initialEntries={['/app/events/remote-event']}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider port={port}>
            <Routes>
              <Route path="/app/events/:eventId" element={<EventDetailPage now={TEST_NOW} />} />
            </Routes>
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function renderValidPage() {
  const event = SCHEDULE_FIXTURE.events.find((candidate) => candidate.id === 'followup-tenant-1');
  if (!event) throw new Error('Expected planned fixture event is missing.');

  render(
    <MemoryRouter initialEntries={[`/app/events/${event.id}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <Routes>
            <Route
              path="/app/events/:eventId"
              element={
                <EventDetailPage
                  now={TEST_NOW}
                  events={[event]}
                  customers={CUSTOMER_FIXTURE_RECORDS.map(({ id, displayName }) => ({
                    id,
                    displayName,
                  }))}
                />
              }
            />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('EventDetailPage state matrix', () => {
  it('renders Event loading without falling through to not-found', () => {
    renderRemotePage(
      createEventPort({
        get: vi.fn(() => new Promise<CustomerEvent>(() => {})),
      }),
    );

    expect(screen.getByRole('status')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
  });

  it('renders Event error without falling through to not-found', async () => {
    renderRemotePage(
      createEventPort({
        get: vi.fn().mockRejectedValue(new CarelogHttpError(503)),
      }),
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
  });

  it('renders the valid planned status projection from the current event contract', () => {
    renderValidPage();

    expect(screen.getByRole('heading', { name: '계약 갱신 여부 재확인' })).toBeVisible();
    expect(document.querySelector('[data-event-detail]')).toHaveAttribute(
      'data-event-status',
      'PLANNED',
    );
    expect(screen.getAllByText('예정').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
