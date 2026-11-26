import { getDefaultPlannedDateTimeLocal } from '@/components/schedule/agendaModel';
import { parseExistingLocalDateTime } from '@/components/schedule/localDateTime';

// 이 파일의 NY 케이스는 TZ=America/New_York로 실행해야 의미가 있다.
// 실행: TZ=America/New_York pnpm exec vitest run src/components/schedule/localDateTime.test.ts
const isNewYork = process.env.TZ === 'America/New_York';

describe('parseExistingLocalDateTime (local wall clock, any zone)', () => {
  it('rejects malformed values and impossible calendar dates', () => {
    expect(parseExistingLocalDateTime('')).toBeNull();
    expect(parseExistingLocalDateTime('2026-08-11 12:00')).toBeNull();
    expect(parseExistingLocalDateTime('2026-02-30T10:00')).toBeNull();
    expect(parseExistingLocalDateTime('2026-08-11T24:00')).toBeNull();
  });

  it('accepts an ordinary local time and keeps its wall clock', () => {
    const date = parseExistingLocalDateTime('2026-08-11T12:34');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(12);
    expect(date!.getMinutes()).toBe(34);
  });

  it('default planned time is an existing local time and always after now', () => {
    const at = new Date(2026, 7, 11, 23, 30, 0);
    const value = getDefaultPlannedDateTimeLocal(undefined, at);
    expect(parseExistingLocalDateTime(value)).not.toBeNull();
    expect(new Date(value).getTime()).toBeGreaterThan(at.getTime());
  });
});

describe.runIf(isNewYork)('DST in America/New_York (TZ=America/New_York)', () => {
  // 2026: 봄 전환 3/8 02:00 -> 03:00 (02:00~02:59 없음), 가을 전환 11/1 02:00 -> 01:00 (01:00~01:59 중복)

  it('spring forward: 02:00 and 02:30 do not exist and are rejected', () => {
    expect(parseExistingLocalDateTime('2026-03-08T02:00')).toBeNull();
    expect(parseExistingLocalDateTime('2026-03-08T02:30')).toBeNull();
  });

  it('spring forward: 01:30 (before the gap) and 03:00 (after the gap) exist', () => {
    expect(parseExistingLocalDateTime('2026-03-08T01:30')).not.toBeNull();
    expect(parseExistingLocalDateTime('2026-03-08T03:00')).not.toBeNull();
    expect(parseExistingLocalDateTime('2026-03-08T03:00')!.getHours()).toBe(3);
  });

  it('fall back: 01:30 is ambiguous and resolves to the earlier instant (EDT, -04:00)', () => {
    const date = parseExistingLocalDateTime('2026-11-01T01:30');
    expect(date).not.toBeNull();
    // 먼저 오는 순간 = 전환 전 EDT(UTC-4): 2026-11-01T05:30:00Z
    expect(date!.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('default time on the spring-forward day skips the nonexistent 02:00 hour', () => {
    // 전날 01:30 EST에 기본값을 만들면 다음 정시 02:00이 되는데, 3/8의 02:00은 없으므로 03:00
    const now = new Date(2026, 2, 7, 1, 30, 0);
    expect(getDefaultPlannedDateTimeLocal('2026-03-08', now)).toBe('2026-03-08T03:00');
  });
});
