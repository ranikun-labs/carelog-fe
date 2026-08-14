import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { EventStoreProvider, useEventStore } from '@/state/EventStoreContext';

const serverEvent: CustomerEvent = {
  id: 'server-event-id',
  customerId: 'server-customer-id',
  status: 'PLANNED',
  scheduledAt: '2026-08-20T10:00:00+09:00',
};

function Probe() {
  const store = useEventStore();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void store
            .loadSchedule({ from: '2026-08-17T00:00:00+09:00', to: '2026-08-24T00:00:00+09:00' })
            .catch(() => undefined)
        }
      >
        load
      </button>
      <button
        type="button"
        onClick={() =>
          void store
            .createEvent({
              status: 'PLANNED',
              customerId: serverEvent.customerId,
              scheduledAt: '2026-08-20T10:00:00+09:00',
            })
            .catch(() => undefined)
        }
      >
        create
      </button>
      <p data-testid="event-id">{store.events.at(-1)?.id}</p>
      <p data-testid="event-state">{store.scheduleLoadState}</p>
    </div>
  );
}

describe('CustomerEventStore production async boundary', () => {
  it('requests a bounded schedule and reconciles the server event', async () => {
    const port = {
      list: vi.fn().mockResolvedValue([serverEvent]),
      get: vi.fn(),
      create: vi.fn().mockResolvedValue({ ...serverEvent, id: 'server-created-event' }),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    };
    render(
      <EventStoreProvider port={port}>
        <Probe />
      </EventStoreProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'load' }));
    await waitFor(() =>
      expect(screen.getByTestId('event-id')).toHaveTextContent('server-event-id'),
    );
    expect(port.list).toHaveBeenCalledWith({
      from: '2026-08-17T00:00:00+09:00',
      to: '2026-08-24T00:00:00+09:00',
      limit: 100,
    });
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() =>
      expect(screen.getByTestId('event-id')).toHaveTextContent('server-created-event'),
    );
  });
});
