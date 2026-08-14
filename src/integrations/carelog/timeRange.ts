export interface CarelogTimeRange {
  from: string;
  to: string;
}

export function buildVisibleScheduleRange(selectedDateKey: string): CarelogTimeRange {
  const selectedDate = parseDateKey(selectedDateKey);
  if (!selectedDate) throw new Error(`Invalid local date key: ${selectedDateKey}`);

  const weekStart = new Date(selectedDate);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { from: formatLocalOffsetTimestamp(weekStart), to: formatLocalOffsetTimestamp(weekEnd) };
}

export function buildCustomerUpcomingRange(now: Date, days: number): CarelogTimeRange {
  if (!Number.isInteger(days) || days <= 0)
    throw new Error('Upcoming range days must be positive.');
  const to = new Date(now);
  to.setDate(to.getDate() + days);
  return { from: formatLocalOffsetTimestamp(now), to: formatLocalOffsetTimestamp(to) };
}

export function formatLocalOffsetTimestamp(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Cannot format an invalid local date.');
  const pad = (part: number) => String(part).padStart(2, '0');
  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function parseDateKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, yearValue, monthValue, dayValue] = match;
  const date = new Date(Number(yearValue), Number(monthValue) - 1, Number(dayValue));
  if (
    date.getFullYear() !== Number(yearValue) ||
    date.getMonth() !== Number(monthValue) - 1 ||
    date.getDate() !== Number(dayValue)
  ) {
    return undefined;
  }
  return date;
}
