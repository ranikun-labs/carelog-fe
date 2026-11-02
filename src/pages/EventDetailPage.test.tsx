import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { toCanonicalTimestamp } from '@/components/schedule/EventForm';
import { I18nProvider } from '@/i18n/I18nContext';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider, useEventStore } from '@/state/EventStoreContext';
import type { CustomerRecord } from '@/types/customer';

const now = new Date('2026-08-11T12:00:00+00:00');
const customer: CustomerRecord = {
  id: 'customer-1',
  displayName: '박세입',
  workspace: { id: 'workspace-1', name: 'Carelog' },
};
const plannedEvent: CustomerEvent = {
  id: 'event-1',
  customerId: customer.id,
  status: 'PLANNED',
  scheduledAt: '2026-08-11T09:00:00+00:00',
  descriptor: '예정 상담',
  note: '기존 메모',
};

function ScheduleProbe() {
  const { events } = useEventStore();
  const location = useLocation();
  return (
    <main>
      <h1>일정 테스트 화면</h1>
      <p data-testid="return-state">{JSON.stringify(location.state)}</p>
      {events.map((event) => (
        <p key={event.id} data-testid="event-result">
          {JSON.stringify(event)}
        </p>
      ))}
    </main>
  );
}

function renderPage({ event = plannedEvent, port = makePort() } = {}) {
  return {
    ...render(
      <MemoryRouter initialEntries={[`/app/events/${event.id}`]}>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={[customer]}>
            <EventStoreProvider port={port} initialEvents={[event]}>
              <Routes>
                <Route path="/app/events/:eventId" element={<EventDetailPage now={now} />} />
                <Route path="/app/schedule" element={<ScheduleProbe />} />
              </Routes>
            </EventStoreProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    ),
    port,
  };
}

function makePort() {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi
      .fn()
      .mockImplementation(async (current: CustomerEvent, changes: Partial<CustomerEvent>) => ({
        ...current,
        ...changes,
      })),
    occur: vi.fn().mockImplementation(async (eventId: string, occurredAt: string) => ({
      ...plannedEvent,
      id: eventId,
      status: 'OCCURRED' as const,
      occurredAt,
    })),
    cancel: vi.fn().mockImplementation(async (eventId: string) => ({
      ...plannedEvent,
      id: eventId,
      status: 'CANCELLED' as const,
    })),
  };
}

describe('EventDetailPage with an injected event port', () => {
  it('edits a planned event and reschedules through the event store', async () => {
    const { port } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));

    expect(screen.getByLabelText('예정 시각')).toBeVisible();
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '변경 상담' } });
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '새 메모' } });
    fireEvent.change(screen.getByLabelText('예정 시각'), {
      target: { value: '2026-08-15T11:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '일정 테스트 화면' })).toBeVisible(),
    );
    expect(port.edit).toHaveBeenCalledWith(plannedEvent, {
      descriptor: '변경 상담',
      note: '새 메모',
      scheduledAt: toCanonicalTimestamp('2026-08-15T11:30'),
    });
    expect(screen.getByTestId('event-result')).toHaveTextContent('"status":"PLANNED"');
    expect(screen.getByTestId('event-result')).toHaveTextContent('"scheduledAt":"2026-08-15T11:30');
  });

  it('edits an occurred record with occurredAt while preserving its scheduled time', async () => {
    const occurredEvent: CustomerEvent = {
      ...plannedEvent,
      status: 'OCCURRED',
      occurredAt: '2026-08-11T09:10:00+00:00',
    };
    const { port } = renderPage({ event: occurredEvent });
    fireEvent.click(screen.getByRole('button', { name: '수정' }));

    expect(screen.getByLabelText('기록 시각')).toBeVisible();
    fireEvent.change(screen.getByLabelText('기록 시각'), {
      target: { value: '2026-08-11T09:25' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '일정 테스트 화면' })).toBeVisible(),
    );
    expect(port.edit).toHaveBeenCalledWith(occurredEvent, {
      descriptor: '예정 상담',
      note: '기존 메모',
      occurredAt: toCanonicalTimestamp('2026-08-11T09:25'),
    });
    expect(screen.getByTestId('event-result')).toHaveTextContent('"status":"OCCURRED"');
    expect(screen.getByTestId('event-result')).toHaveTextContent(
      '"scheduledAt":"2026-08-11T09:00:00+00:00"',
    );
  });

  it('records actual occurrence time through the occur transition', async () => {
    const { port } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: '기록 완료' }));
    fireEvent.change(screen.getByLabelText('실제'), {
      target: { value: '2026-08-11T09:45' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '일정 테스트 화면' })).toBeVisible(),
    );
    expect(port.occur).toHaveBeenCalledWith(
      plannedEvent.id,
      toCanonicalTimestamp('2026-08-11T09:45'),
    );
    expect(screen.getByTestId('event-result')).toHaveTextContent('"status":"OCCURRED"');
    expect(screen.getByTestId('event-result')).toHaveTextContent(
      '"scheduledAt":"2026-08-11T09:00:00+00:00"',
    );
  });

  it('cancels a planned event through the cancel transition and retains its planned coordinate', async () => {
    const { port } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: '취소 처리' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '일정 테스트 화면' })).toBeVisible(),
    );
    expect(port.cancel).toHaveBeenCalledWith(plannedEvent.id);
    expect(screen.getByTestId('event-result')).toHaveTextContent('"status":"CANCELLED"');
    expect(screen.getByTestId('event-result')).toHaveTextContent(
      '"scheduledAt":"2026-08-11T09:00:00+00:00"',
    );
    expect(screen.getByTestId('event-result')).not.toHaveTextContent('"occurredAt"');
  });
});
