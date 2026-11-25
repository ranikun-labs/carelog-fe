import {
  buildAgendaSections,
  formatAgendaDateTime,
  formatAgendaTime,
  formatDisplayDate,
  formatOverdueCount,
  getAgendaCoordinate,
  getAgendaStatusPresentation,
  getOverdueEvents,
  getWeekDaysForDate,
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

describe('24-hour display format (F1-G9)', () => {
  // 실행 환경 시간대와 무관하게 로컬 시각을 만든 뒤 ISO(UTC)로 저장 값 형태를 흉내 낸다.
  const at = (hour: number, minute: number) => new Date(2026, 7, 15, hour, minute).toISOString();

  it('shows ko times as HH:mm without a meridiem marker', () => {
    expect(formatAgendaTime(at(10, 45), 'ko')).toBe('10:45');
    expect(formatAgendaTime(at(9, 5), 'ko')).toBe('09:05');
    expect(formatAgendaTime(at(14, 30), 'ko')).toBe('14:30');
    expect(formatAgendaTime(at(0, 0), 'ko')).toBe('00:00');
    expect(formatAgendaTime(at(23, 59), 'ko')).toBe('23:59');
    expect(formatAgendaTime(at(14, 30), 'ko')).not.toMatch(/오전|오후/);
  });

  it('shows ko date-times as "M월 D일 (요일) HH:mm" without year', () => {
    expect(formatAgendaDateTime(at(10, 0), 'ko', SAME_YEAR)).toBe('8월 15일 (토) 10:00');
    expect(formatAgendaDateTime(at(18, 5), 'ko', SAME_YEAR)).toBe('8월 15일 (토) 18:05');
  });

  it('keeps en as its own 12-hour format', () => {
    expect(formatAgendaTime(at(14, 30), 'en')).toMatch(/2:30\s?PM/);
    expect(formatAgendaDateTime(at(14, 30), 'en')).toMatch(/August 15, 2026.*2:30\s?PM/);
  });

  it('returns the original text for an unparseable timestamp', () => {
    expect(formatAgendaTime('not-a-date', 'ko')).toBe('not-a-date');
    expect(formatAgendaDateTime('not-a-date', 'ko')).toBe('not-a-date');
  });

  it('shows ko dates as "M월 D일 (요일)" from the stored date part, en keeps YYYY-MM-DD', () => {
    // 날짜 부분은 시간대 변환 없이 slice한다(기존 formatDate 계약).
    expect(formatDisplayDate('2026-07-20T09:00:00+09:00', 'ko', SAME_YEAR)).toBe('7월 20일 (월)');
    expect(formatDisplayDate('2026-07-20T09:00:00+09:00', 'en')).toBe('2026-07-20');
  });

  it('prefixes the year in ko when the date is not in the current year', () => {
    // 1년 전 연락·맥락이 올해 날짜처럼 읽히지 않도록 연도를 붙인다.
    const nextYear = new Date(2027, 0, 10, 12);
    expect(formatDisplayDate('2026-07-20T09:00:00+09:00', 'ko', nextYear)).toBe(
      '2026년 7월 20일 (월)',
    );
    expect(formatAgendaDateTime(at(10, 0), 'ko', nextYear)).toBe('2026년 8월 15일 (토) 10:00');
    // en 형식은 원래 연도를 포함하므로 그대로다.
    expect(formatDisplayDate('2026-07-20T09:00:00+09:00', 'en', nextYear)).toBe('2026-07-20');
  });
});

const SAME_YEAR = new Date(2026, 5, 1, 12);
