import {
  buildAgendaSections,
  formatOverdueCount,
  getAgendaCoordinate,
  getAgendaStatusPresentation,
  getOverdueEvents,
  hasSameInstant,
} from '@/components/schedule/agendaModel';
import type { CustomerEvent } from '@/domain/customerEvent';

const now = new Date('2026-08-11T12:00:00+09:00');

const events: CustomerEvent[] = [
  {
    id: 'future-planned',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-12T09:00:00+09:00',
  },
  {
    id: 'today-occurred',
    customerId: 'customer-1',
    status: 'OCCURRED',
    occurredAt: '2026-08-11T10:00:00+09:00',
  },
  {
    id: 'past-planned',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-10T09:00:00+09:00',
  },
  {
    id: 'cancelled',
    customerId: 'customer-1',
    status: 'CANCELLED',
    scheduledAt: '2026-08-12T10:00:00+09:00',
  },
];

describe('agenda model', () => {
  it('uses each canonical status coordinate without changing the source events', () => {
    expect(getAgendaCoordinate(events[0])).toBe('2026-08-12T09:00:00+09:00');
    expect(getAgendaCoordinate(events[1])).toBe('2026-08-11T10:00:00+09:00');
    expect(getAgendaCoordinate(events[3])).toBe('2026-08-12T10:00:00+09:00');
  });

  it('builds chronology from past through today to future and adds only the selected empty date', () => {
    const sections = buildAgendaSections(events, '2026-08-11', '2026-08-13');

    expect(sections.map((section) => section.dateKey)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
    expect(sections.find((section) => section.dateKey === '2026-08-13')?.events).toEqual([]);
  });

  it('derives overdue only from planned events and keeps the latest scheduled date first', () => {
    const overdue = getOverdueEvents(
      [
        ...events,
        {
          id: 'latest-overdue',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: '2026-08-11T11:00:00+09:00',
        },
      ],
      now,
    );

    expect(overdue.map((event) => event.id)).toEqual(['latest-overdue', 'past-planned']);
    expect(getAgendaStatusPresentation(overdue[0], now)).toEqual({
      rail: 'warning',
      badge: 'overdue',
      meta: 'overdue',
    });
    expect(getAgendaStatusPresentation(events[0], now)).toEqual({
      rail: 'planned',
      badge: undefined,
      meta: 'planned',
    });
  });

  it('keeps overdue count compact and distinguishes equal actual/planned instants', () => {
    expect(formatOverdueCount(1)).toBe('1');
    expect(formatOverdueCount(9)).toBe('9');
    expect(formatOverdueCount(10)).toBe('9+');
    expect(hasSameInstant('2026-08-11T10:00:00+09:00', '2026-08-11T01:00:00Z')).toBe(true);
    expect(hasSameInstant('2026-08-11T10:00:00+09:00', '2026-08-11T10:05:00+09:00')).toBe(false);
  });

  it('keeps an invalid coordinate renderable after valid agenda dates', () => {
    const sections = buildAgendaSections(
      [
        events[0],
        {
          id: 'invalid-coordinate',
          customerId: 'customer-1',
          status: 'OCCURRED',
          occurredAt: 'invalid',
        },
      ],
      '2026-08-11',
    );

    expect(sections.map((section) => section.dateKey)).toEqual(['2026-08-12', 'invalid']);
  });
});
