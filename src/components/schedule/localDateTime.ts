/**
 * datetime-local 값(벽시계 연·월·일·시·분)을 이 기기의 로컬 시각으로 해석한다.
 *
 * DST 처리 규칙(확정):
 * - 존재하지 않는 시각(봄 전환의 건너뛴 구간, 예: 02:30)은 `null`. 브라우저·JS는 조용히 다른 시각(03:30)으로 밀어내므로
 *   입력한 벽시계 값이 되돌아오지 않는 경우를 거부한다. 저장하지 않는다.
 * - 중복 시각(가을 전환, 예: 01:30이 두 번)은 먼저 오는 쪽(전환 전 오프셋, 더 이른 순간)으로 저장한다.
 *   `toCanonicalTimestamp`도 같은 Date를 쓰므로 저장 오프셋과 일치한다.
 */
export function parseExistingLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? '0'),
  ];
  const date = new Date(year, month - 1, day, hour, minute, second);
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second;
  return roundTrips ? date : null;
}
