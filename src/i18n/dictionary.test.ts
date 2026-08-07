import { MESSAGES } from '@/i18n/dictionary';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

it('keeps ko and en dictionary shapes aligned', () => {
  expect(keys(MESSAGES.ko)).toEqual(keys(MESSAGES.en));
});
