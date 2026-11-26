import {
  isCustomerEventOverdue,
  type CustomerEvent,
  type PlannedCustomerEvent,
} from '@/domain/customerEvent';
import { parseExistingLocalDateTime } from '@/components/schedule/localDateTime';
import type { ScheduleCustomer } from '@/types/customer';
import { formatDate } from '@/lib/utils';

export type AgendaRail = 'planned' | 'warning' | 'neutral';
export type AgendaBadge = 'overdue' | 'cancelled' | undefined;

export interface AgendaSection {
  dateKey: string;
  events: readonly CustomerEvent[];
}

export interface AgendaStatusPresentation {
  rail: AgendaRail;
  badge: AgendaBadge;
  meta: 'planned' | 'overdue' | 'occurred' | 'cancelled';
}

export function getAgendaCoordinate(event: CustomerEvent): string {
  return event.status === 'OCCURRED' ? event.occurredAt : event.scheduledAt;
}

export function getAgendaDateKey(event: CustomerEvent): string {
  return formatDate(getAgendaCoordinate(event));
}

export function getEventTitle(event: CustomerEvent): string | undefined {
  return event.descriptor ?? event.note;
}

export function compareEventsByAgendaCoordinate(
  first: CustomerEvent,
  second: CustomerEvent,
): number {
  const firstInstant = Date.parse(getAgendaCoordinate(first));
  const secondInstant = Date.parse(getAgendaCoordinate(second));
  const firstInvalid = Number.isNaN(firstInstant);
  const secondInvalid = Number.isNaN(secondInstant);

  if (firstInvalid || secondInvalid) {
    if (firstInvalid && secondInvalid) return first.id.localeCompare(second.id);
    return firstInvalid ? 1 : -1;
  }

  return firstInstant - secondInstant || first.id.localeCompare(second.id);
}

export function sortEventsByAgendaCoordinate(events: readonly CustomerEvent[]): CustomerEvent[] {
  return [...events].sort(compareEventsByAgendaCoordinate);
}

export function buildAgendaSections(
  events: readonly CustomerEvent[],
  todayDateKey: string,
  selectedDateKey?: string,
): AgendaSection[] {
  const eventsByDate = new Map<string, CustomerEvent[]>();
  for (const event of events) {
    const dateKey = getAgendaDateKey(event);
    const dateEvents = eventsByDate.get(dateKey) ?? [];
    dateEvents.push(event);
    eventsByDate.set(dateKey, dateEvents);
  }

  if (selectedDateKey && !eventsByDate.has(selectedDateKey)) {
    eventsByDate.set(selectedDateKey, []);
  }

  return [...eventsByDate.keys()]
    .sort(compareDateKeys)
    .map((dateKey) => ({
      dateKey,
      events: sortEventsByAgendaCoordinate(eventsByDate.get(dateKey) ?? []),
    }))
    .filter(
      (section) =>
        section.events.length > 0 ||
        section.dateKey === todayDateKey ||
        section.dateKey === selectedDateKey,
    );
}

export function getOverdueEvents(
  events: readonly CustomerEvent[],
  now: string | number | Date,
): CustomerEvent[] {
  return events
    .filter(
      (event): event is PlannedCustomerEvent =>
        event.status === 'PLANNED' && isCustomerEventOverdue(event, now),
    )
    .sort((first, second) => {
      const firstInstant = Date.parse(first.scheduledAt);
      const secondInstant = Date.parse(second.scheduledAt);
      return secondInstant - firstInstant || first.id.localeCompare(second.id);
    });
}

export function formatOverdueCount(count: number): string {
  return count >= 10 ? '9+' : String(count);
}

export function getAgendaStatusPresentation(
  event: CustomerEvent,
  now: string | number | Date,
): AgendaStatusPresentation {
  if (event.status === 'PLANNED') {
    const overdue = isCustomerEventOverdue(event, now);
    return {
      rail: overdue ? 'warning' : 'planned',
      badge: overdue ? 'overdue' : undefined,
      meta: overdue ? 'overdue' : 'planned',
    };
  }

  if (event.status === 'CANCELLED') {
    return { rail: 'neutral', badge: 'cancelled', meta: 'cancelled' };
  }

  return { rail: 'neutral', badge: undefined, meta: 'occurred' };
}

export function hasSameInstant(first: string, second: string): boolean {
  const firstInstant = Date.parse(first);
  const secondInstant = Date.parse(second);
  if (Number.isNaN(firstInstant) || Number.isNaN(secondInstant)) return first === second;
  return firstInstant === secondInstant;
}

export function getDateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface WeekDay {
  dateKey: string;
  dayOfMonth: number;
  isToday: boolean;
}

export function getWeekDays(referenceDate: Date, today: Date = referenceDate): WeekDay[] {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);
  const todayDateKey = getDateKeyFromDate(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dateKey: getDateKeyFromDate(date),
      dayOfMonth: date.getDate(),
      isToday: getDateKeyFromDate(date) === todayDateKey,
    };
  });
}

export function getWeekDaysForDate(dateKey: string, today: Date): WeekDay[] {
  return getWeekDays(parseDateKey(dateKey) ?? today, today);
}

export function getCustomerName(
  customers: readonly ScheduleCustomer[],
  customerId: string,
): string | undefined {
  return customers.find((customer) => customer.id === customerId)?.displayName;
}

export function formatAgendaDate(dateKey: string, locale: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function formatAgendaWeekday(dateKey: string, locale: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
  }).format(date);
}

/** ko는 24시간제 `HH:mm`(F1-G9). 저장 값·시간대(실행 환경 로컬)는 그대로 두고 표시만 바꾼다. */
function formatKoClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatAgendaTime(timestamp: string, locale: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  if (locale === 'ko') return formatKoClock(date);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** ko에서 올해가 아닌 날짜는 연도가 빠지면 다른 해와 구분되지 않으므로 `YYYY년 `을 앞에 붙인다. */
function koYearPrefix(date: Date, now: Date): string {
  return date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}년 `;
}

/** ko: `M월 D일 (요일) HH:mm` 24시간제(F1-G9), 올해가 아니면 연도를 앞에 붙인다. en은 별도 형식을 유지한다. */
export function formatAgendaDateTime(
  timestamp: string,
  locale: string,
  now: Date = new Date(),
): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  if (locale === 'ko') {
    const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date);
    return `${koYearPrefix(date, now)}${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday}) ${formatKoClock(date)}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * ISO 타임스탬프의 날짜 부분(`formatDate`와 같은 시간대 무변환 slice)을 화면용으로 표시한다.
 * ko: `M월 D일 (요일)`(F1-G9), 올해가 아니면 `YYYY년 ` 접두. en: 기존 `YYYY-MM-DD` 유지. 파싱 불가하면 원문 slice를 그대로 쓴다.
 */
export function formatDisplayDate(
  isoTimestamp: string,
  locale: string,
  now: Date = new Date(),
): string {
  const dateKey = formatDate(isoTimestamp);
  if (locale !== 'ko') return dateKey;
  const formatted = formatAgendaDate(dateKey, locale);
  const parsed = parseDateKey(dateKey);
  return parsed ? `${koYearPrefix(parsed, now)}${formatted}` : formatted;
}

function compareDateKeys(first: string, second: string): number {
  const firstInstant = Date.parse(`${first}T00:00:00`);
  const secondInstant = Date.parse(`${second}T00:00:00`);
  const firstInvalid = Number.isNaN(firstInstant);
  const secondInvalid = Number.isNaN(secondInstant);

  if (firstInvalid || secondInvalid) {
    if (firstInvalid && secondInvalid) return first.localeCompare(second);
    return firstInvalid ? 1 : -1;
  }

  return firstInstant - secondInstant || first.localeCompare(second);
}

function parseDateKey(dateKey: string): Date | undefined {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return undefined;
  const date = new Date(year, month - 1, day, 12);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/**
 * 새 "예정으로 추가"의 기본 예정 시각(datetime-local 값). 항상 지금보다 미래다.
 * 선택 날짜가 오늘 이후면 그 날짜, 아니면(오늘이거나 지난 날짜) 오늘의 다음 정시다.
 * 기본값 그대로 저장해도 곧바로 "정리 필요"가 되지 않게 하려는 규칙이다.
 */
export function getDefaultPlannedDateTimeLocal(
  selectedDateKey: string | undefined,
  now: Date,
): string {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  const todayKey = getDateKeyFromDate(now);
  const useSelected =
    Boolean(selectedDateKey) &&
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDateKey ?? '') &&
    (selectedDateKey ?? '') > todayKey;
  const dateKey = useSelected && selectedDateKey ? selectedDateKey : getDateKeyFromDate(nextHour);
  // 선택 날짜에 그 정시가 DST 공백(존재하지 않는 시각)이면 다음 정시로 넘긴다. 기본값은 저장 가능해야 한다.
  let hour = nextHour.getHours();
  let candidate = `${dateKey}T${pad(hour)}:00`;
  while (!parseExistingLocalDateTime(candidate) && hour < 23) {
    hour += 1;
    candidate = `${dateKey}T${pad(hour)}:00`;
  }
  return candidate;
}
