import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { EventCreatePage } from '@/pages/EventCreatePage';
import { SchedulePage } from '@/pages/SchedulePage';
import { EventCreateActivationProvider } from '@/state/EventCreateActivationContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import type { CustomerRecord } from '@/types/customer';
import { CarelogHttpError } from '@/integrations/carelog/errors';

const now = new Date('2026-08-11T12:00:00+09:00');
const customer: CustomerRecord = {
  id: 'customer-1',
  displayName: '박세입',
  workspace: { id: 'workspace-1', name: 'Carelog' },
};
const initialEvent: CustomerEvent = {
  id: 'existing-event',
  customerId: customer.id,
  status: 'PLANNED',
  scheduledAt: '2026-08-11T09:00:00+09:00',
  descriptor: '기존 일정',
};

function renderPage({ customers = [customer], events = [initialEvent] } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/app/events/new',
          state: { adaptiveRoot: 'schedule', targetDateKey: '2026-08-15' },
        },
      ]}
    >
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={customers}>
          <EventStoreProvider initialEvents={events}>
            <EventCreateDraftProvider>
              <Routes>
                <Route path="/app/events/new" element={<EventCreatePage now={now} />} />
                <Route
                  path="/app/schedule"
                  element={<SchedulePage now={now} customers={customers.map(toScheduleCustomer)} />}
                />
                <Route path="/app/customers/new" element={<p>customer create route</p>} />
              </Routes>
            </EventCreateDraftProvider>
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function toScheduleCustomer({ id, displayName }: CustomerRecord) {
  return { id, displayName };
}

describe('EventCreatePage', () => {
  it('selects a canonical Customer and reuses EventForm as PLANNED-only with the selected date', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '대상 고객 선택' })).toBeVisible();
    const customerOption = screen.getByRole('button', { name: '박세입' });
    expect(customerOption).toHaveAttribute('data-customer-id', 'customer-1');
    fireEvent.click(customerOption);

    expect(document.querySelector('[data-event-form]')).toHaveAttribute(
      'data-event-form-mode',
      'create',
    );
    expect(screen.getByText('박세입 고객')).toBeVisible();
    expect(screen.queryByDisplayValue('OCCURRED')).not.toBeInTheDocument();
    expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-08-15T12:00');
  });

  it('creates exactly one PLANNED event and returns it to the selected agenda date', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '박세입' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '새 일정' } });
    fireEvent.change(screen.getByLabelText('예정 시각'), {
      target: { value: '2026-08-15T10:30' },
    });

    const submit = screen.getByRole('button', { name: '일정 추가' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole('heading', { name: '일정' })).toBeVisible());
    const createdRows = screen
      .getAllByRole('button', { name: '일정 상세 열기: 새 일정' })
      .map((button) => button.closest('[data-agenda-row]'))
      .filter(Boolean);
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0]).toHaveAttribute('data-event-status', 'PLANNED');
    expect(createdRows[0]?.closest('[data-agenda-section]')).toHaveAttribute(
      'data-date-key',
      '2026-08-15',
    );
  });

  it('keeps a failed Event mutation local and allows a fresh retry', async () => {
    const createdEvent: CustomerEvent = {
      id: 'retry-created-event',
      customerId: customer.id,
      status: 'PLANNED',
      scheduledAt: '2026-08-15T10:30:00+09:00',
      descriptor: '실패 후 재시도',
    };
    const port = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi
        .fn()
        .mockRejectedValueOnce(new CarelogHttpError(500))
        .mockResolvedValueOnce(createdEvent),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/app/events/new',
            state: { adaptiveRoot: 'schedule', targetDateKey: '2026-08-15' },
          },
        ]}
      >
        <I18nProvider locale="ko">
          <EventCreateActivationProvider>
            <CustomerStoreProvider initialCustomers={[customer]}>
              <EventStoreProvider port={port} initialEvents={[]}>
                <EventCreateDraftProvider>
                  <Routes>
                    <Route path="/app/events/new" element={<EventCreatePage now={now} />} />
                    <Route
                      path="/app/schedule"
                      element={
                        <SchedulePage now={now} customers={[toScheduleCustomer(customer)]} />
                      }
                    />
                  </Routes>
                </EventCreateDraftProvider>
              </EventStoreProvider>
            </CustomerStoreProvider>
          </EventCreateActivationProvider>
        </I18nProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '박세입' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '실패 후 재시도' } });
    fireEvent.change(screen.getByLabelText('예정 시각'), {
      target: { value: '2026-08-15T10:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(screen.getByRole('heading', { name: '일정 추가', level: 2 })).toBeVisible();
    expect(port.create).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '일정' })).toBeVisible());
    expect(port.create).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: '일정 상세 열기: 실패 후 재시도' })).toBeVisible();
  });

  it('routes Customer=0 to the existing first-customer flow', () => {
    renderPage({ customers: [], events: [] });

    expect(screen.getByText('먼저 고객을 추가해 주세요')).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: '첫 고객 추가' }));
    expect(screen.getByText('customer create route')).toBeVisible();
  });

  it('cancels back to Schedule without creating an event', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '일정으로 돌아가기' }));
    expect(screen.getByRole('heading', { name: '일정' })).toBeVisible();
    expect(screen.queryByText('대상 고객 선택')).not.toBeInTheDocument();
  });
});
