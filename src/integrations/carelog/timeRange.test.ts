import { describe, expect, it } from 'vitest';

import {
  buildCustomerUpcomingRange,
  buildVisibleScheduleRange,
  formatLocalOffsetTimestamp,
} from '@/integrations/carelog/timeRange';

describe('Carelog bounded local time ranges', () => {
  it('serializes local calendar boundaries with offsets instead of shifting through UTC', () => {
    const range = buildVisibleScheduleRange('2026-03-08');

    expect(range.from).toMatch(/^2026-03-02T00:00:00[+-]\d{2}:\d{2}$/);
    expect(range.to).toMatch(/^2026-03-09T00:00:00[+-]\d{2}:\d{2}$/);
    expect(range.from).not.toContain('2026-03-01');
    expect(range.to).not.toContain('2026-03-10');
  });

  it('keeps DST-capable adjacent local midnights as [from,to)', () => {
    const start = new Date(2026, 2, 8, 0, 0, 0, 0);
    const end = new Date(2026, 2, 9, 0, 0, 0, 0);

    expect(formatLocalOffsetTimestamp(start)).toMatch(/^2026-03-08T00:00:00[+-]\d{2}:\d{2}$/);
    expect(formatLocalOffsetTimestamp(end)).toMatch(/^2026-03-09T00:00:00[+-]\d{2}:\d{2}$/);
  });

  it('bounds customer upcoming queries and uses an offset-bearing lower bound', () => {
    const range = buildCustomerUpcomingRange(new Date(2026, 7, 15, 12, 30, 0), 90);

    expect(range.from).toMatch(/^2026-08-15T12:30:00[+-]\d{2}:\d{2}$/);
    expect(range.to).toMatch(/^2026-11-13T12:30:00[+-]\d{2}:\d{2}$/);
    expect(Date.parse(range.from)).toBeLessThan(Date.parse(range.to));
  });
});
