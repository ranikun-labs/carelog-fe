import {
  buildAgendaSections,
  formatOverdueCount,
  getAgendaCoordinate,
  getAgendaDateKey,
  getAgendaStatusPresentation,
  getOverdueEvents,
  getWeekDaysForDate,
  hasSameInstant,
} from '@/components/schedule/agendaModel';
import type { CustomerEvent } from '@/domain/customerEvent';

const now = new Date(2026, 7, 11, 12);
const localTimestamp = (day: number, hour: number) => new Date(2026, 7, day, hour).toISOString();

const events: CustomerEvent[] = [
  {
    id: 'future-planned',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: localTimestamp(12, 9),
  },
  {
    id: 'today-occurred',
    customerId: 'customer-1',
    status: 'OCCURRED',
    occurredAt: localTimestamp(11, 10),
  },
  {
    id: 'past-planned',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: localTimestamp(10, 9),
  },
  {
    id: 'cancelled',
    customerId: 'customer-1',
    status: 'CANCELLED',
    scheduledAt: localTimestamp(12, 10),
  },
];

describe('agenda model', () => {
  it('uses each canonical status coordinate without changing the source events', () => {
    expect(getAgendaCoordinate(events[0])).toBe(localTimestamp(12, 9));
    expect(getAgendaCoordinate(events[1])).toBe(localTimestamp(11, 10));
    expect(getAgendaCoordinate(events[3])).toBe(localTimestamp(12, 10));
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

  it('groups equivalent timestamps under the same local calendar date', () => {
    const localMidnight = new Date(2026, 10, 1, 0, 30);
    const eastOfUtc = new Date(localMidnight.getTime() + 14 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '+14:00');
    const westOfUtc = new Date(localMidnight.getTime() - 12 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '-12:00');

    for (const scheduledAt of [eastOfUtc, westOfUtc]) {
      expect(Date.parse(scheduledAt)).toBe(localMidnight.getTime());
      expect(
        getAgendaDateKey({
          id: 'same-instant',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt,
        }),
      ).toBe('2026-11-01');
    }
  });

  it('derives overdue only from planned events and keeps the latest scheduled date first', () => {
    const overdue = getOverdueEvents(
      [
        ...events,
        {
          id: 'latest-overdue',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: localTimestamp(11, 11),
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

  it('builds the WeekStrip window from the selected date while preserving today identity', () => {
    const selectedWeek = getWeekDaysForDate('2026-08-18', now);

    expect(selectedWeek.map((day) => day.dateKey)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    expect(selectedWeek.find((day) => day.dateKey === '2026-08-18')?.isToday).toBe(false);

    const todayWeek = getWeekDaysForDate('2026-08-11', now);
    expect(todayWeek.find((day) => day.dateKey === '2026-08-11')?.isToday).toBe(true);
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
