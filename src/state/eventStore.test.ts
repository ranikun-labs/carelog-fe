import { describe, expect, it } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import {
  cancelEventById,
  createEventStoreState,
  editEventById,
  eventStoreReducer,
  occurEventById,
} from '@/state/eventStore';

const planned: CustomerEvent = {
  id: 'event-1',
  customerId: 'customer-1',
  status: 'PLANNED',
  scheduledAt: '2026-08-12T09:00:00+09:00',
  descriptor: '예정 상담',
  note: '기존 메모',
};

describe('event store transitions', () => {
  it('keeps one canonical record while preserving identity through edit and transition', () => {
    const state = createEventStoreState([planned, planned]);
    const edited = editEventById(state.events, planned.id, {
      scheduledAt: '2026-08-15T11:00:00+09:00',
      descriptor: '변경 상담',
    });
    expect(edited).toMatchObject({
      id: planned.id,
      status: 'PLANNED',
      scheduledAt: '2026-08-15T11:00:00+09:00',
      descriptor: '변경 상담',
    });

    const occurred = occurEventById(state.events, planned.id, '2026-08-15T12:00:00+09:00');
    expect(occurred).toMatchObject({
      id: planned.id,
      status: 'OCCURRED',
      scheduledAt: planned.scheduledAt,
      occurredAt: '2026-08-15T12:00:00+09:00',
    });

    expect(occurEventById(state.events, planned.id)).toMatchObject({
      id: planned.id,
      status: 'OCCURRED',
      scheduledAt: planned.scheduledAt,
      occurredAt: planned.scheduledAt,
    });
  });

  it('cancels without deleting the record or inventing an occurrence coordinate', () => {
    const cancelled = cancelEventById([planned], planned.id);
    expect(cancelled).toMatchObject({
      id: planned.id,
      status: 'CANCELLED',
      scheduledAt: planned.scheduledAt,
    });
    expect(cancelled).not.toHaveProperty('occurredAt');
  });

  it('rejects duplicate creates and ignores unknown replacements', () => {
    const state = createEventStoreState([planned]);
    const duplicate = eventStoreReducer(state, { type: 'create', event: planned });
    expect(duplicate.events).toHaveLength(1);
    expect(
      eventStoreReducer(state, { type: 'replace', event: { ...planned, id: 'missing' } }),
    ).toBe(state);
  });
});
