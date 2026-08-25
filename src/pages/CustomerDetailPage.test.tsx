import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import type { CustomerEventPort } from '@/integrations/carelog/customerEventPort';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage, type CustomerDetailPageProps } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import type { CustomerRecord } from '@/types/customer';

const TEST_NOW = new Date('2026-08-11T12:00:00+09:00');

function renderAt(customerId: string, props: CustomerDetailPageProps = {}) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${customerId}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <Routes>
            <Route
              path="/app/customers/:customerId"
              element={
                <CustomerDetailPage
                  {...props}
                  now={props.now ?? TEST_NOW}
                  events={props.events ?? SCHEDULE_FIXTURE.events}
                />
              }
            />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function createEventPort(list: CustomerEventPort['list']): CustomerEventPort {
  return {
    list,
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
}

function renderRemoteEventDetail(port: CustomerEventPort) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${landlordTenantScenario.customer.id}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider port={port}>
            <Routes>
              <Route
                path="/app/customers/:customerId"
                element={<CustomerDetailPage now={TEST_NOW} />}
              />
            </Routes>
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function renderRemoteCustomerDetail(port: CustomerPort) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${landlordTenantScenario.customer.id}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={[]} port={port} remoteReadsEnabled>
          <Routes>
            <Route
              path="/app/customers/:customerId"
              element={<CustomerDetailPage now={TEST_NOW} />}
            />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerDetailPage', () => {
  it('renders customer loading without falling through to not-found', () => {
    const port: CustomerPort = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(() => new Promise<CustomerRecord>(() => {})),
      create: vi.fn(),
      edit: vi.fn(),
    };
    renderRemoteCustomerDetail(port);

    expect(screen.getByRole('status')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
  });

  it('renders customer error without falling through to not-found', async () => {
    const port: CustomerPort = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockRejectedValue(new CarelogHttpError(503)),
      create: vi.fn(),
      edit: vi.fn(),
    };
    renderRemoteCustomerDetail(port);

    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
  });

  it('renders identity, workspace badge, and context for a known customer', () => {
    renderAt(landlordTenantScenario.customer.id);
    expect(
      screen.getByRole('heading', { name: landlordTenantScenario.customer.displayName }),
    ).toBeVisible();
    expect(screen.getByText(landlordTenantScenario.workspace.name)).toBeVisible();
    expect(screen.getByText(landlordTenantScenario.context.summary)).toBeVisible();
    for (const entry of landlordTenantScenario.timeline) {
      expect(screen.getByText(entry.label)).toBeVisible();
    }
    expect(screen.getByRole('button', { name: '일정 추가' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '다음 일정' })).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '일정 상세 열기: 계약 갱신 여부 재확인' }),
    ).toHaveAttribute('href', '/app/events/followup-tenant-1');
    expect(screen.queryByRole('heading', { name: '메모' })).not.toBeInTheDocument();
  });

  it('renders the app not-found surface for an unknown customer id', () => {
    renderAt('does-not-exist');
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.queryByText('does-not-exist')).not.toBeInTheDocument();
  });

  it('renders only explicit memo evidence with bounded presentation', () => {
    renderAt(landlordTenantScenario.customer.id, {
      memo: '고객이 요청한 긴 메모 '.repeat(20),
    });

    expect(screen.getByRole('heading', { name: '메모' })).toBeVisible();
    expect(screen.getByTestId('customer-memo-copy')).toHaveClass('line-clamp-3');
  });

  it('keeps Event loading mutually exclusive with empty-derived projections', async () => {
    const port = createEventPort(vi.fn(() => new Promise<readonly CustomerEvent[]>(() => {})));

    renderRemoteEventDetail(port);

    await waitFor(() => expect(screen.getByRole('status')).toBeVisible());
    expect(screen.getByRole('heading', { name: '박세입' })).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 기록이 없습니다.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('customer-memo-copy')).not.toBeInTheDocument();
    expect(document.querySelector('[data-customer-upcoming-empty]')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '타임라인' })).not.toBeInTheDocument();
  });

  it('keeps Event error mutually exclusive with empty-derived projections', async () => {
    const port = createEventPort(vi.fn().mockRejectedValue(new Error('event read failed')));

    renderRemoteEventDetail(port);

    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(screen.getByRole('heading', { name: '박세입' })).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 기록이 없습니다.')).not.toBeInTheDocument();
    expect(document.querySelector('[data-customer-upcoming-empty]')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '타임라인' })).not.toBeInTheDocument();
  });

  it('renders canonical empty Upcoming and History after Event success with zero events', async () => {
    const port = createEventPort(vi.fn().mockResolvedValue([]));

    renderRemoteEventDetail(port);

    await waitFor(() => expect(screen.getByText('다음 일정 없음')).toBeVisible());
    expect(screen.getByText('아직 기록이 없습니다.')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders normal Upcoming and History projections after populated Event success', async () => {
    const upcoming: CustomerEvent = {
      id: 'remote-upcoming',
      customerId: landlordTenantScenario.customer.id,
      status: 'PLANNED',
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: '원격 예정 일정',
    };
    const history: CustomerEvent = {
      id: 'remote-history',
      customerId: landlordTenantScenario.customer.id,
      status: 'OCCURRED',
      occurredAt: '2026-08-10T10:00:00+09:00',
      descriptor: '원격 기록 일정',
    };
    const port = createEventPort(
      vi.fn((query) => Promise.resolve(query.from ? [upcoming] : [history])),
    );

    renderRemoteEventDetail(port);

    await waitFor(() => expect(screen.getByText('원격 예정 일정')).toBeVisible());
    expect(screen.getByText('원격 기록 일정')).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 기록이 없습니다.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
