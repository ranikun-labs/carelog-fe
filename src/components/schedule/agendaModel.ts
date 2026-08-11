import {
  isCustomerEventOverdue,
  type CustomerEvent,
  type PlannedCustomerEvent,
} from '@/domain/customerEvent';
import type { ScheduleCustomer } from '@/fixtures/schedule';
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

export function formatAgendaTime(timestamp: string, locale: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatAgendaDateTime(timestamp: string, locale: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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
