import { describe, expect, it } from 'vitest';

import { shouldUseTwoPane } from '@/components/layout/adaptiveHostModel';

describe('adaptive host mode contract', () => {
  it.each([
    [1100, 1180, 800, true],
    [1180, 1180, 800, true],
    [1099, 1180, 800, false],
    [1100, 1180, 1366, false],
    [375, 375, 812, false],
    [688, 768, 1024, false],
    [944, 1024, 1366, false],
  ])(
    'available=%i viewport=%ix%i resolves two-pane=%s',
    (availableWidth, viewportWidth, viewportHeight, expected) => {
      expect(shouldUseTwoPane({ availableWidth, viewportWidth, viewportHeight })).toBe(expected);
    },
  );
});
