import { describe, expect, it } from 'vitest';

import {
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
} from '@/integrations/carelog/errors';
import { classifyCarelogError, toAuthFailure } from '@/integrations/carelog/errorMapping';

describe('Carelog error classification', () => {
  it.each([
    [400, 'VALIDATION'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [500, 'SERVER'],
    [503, 'SERVER'],
  ] as const)('classifies HTTP %s by status', (status, expected) => {
    expect(classifyCarelogError(new CarelogHttpError(status))).toBe(expected);
  });

  it('keeps network and protocol failures distinct and only auth-bound failures cross the AuthPort seam', () => {
    expect(classifyCarelogError(new CarelogNetworkError('offline'))).toBe('NETWORK');
    expect(classifyCarelogError(new CarelogProtocolError('malformed'))).toBe('PROTOCOL');
    expect(toAuthFailure(new CarelogHttpError(401))).toEqual({ kind: 'UNAUTHORIZED' });
    expect(toAuthFailure(new CarelogHttpError(403))).toEqual({ kind: 'FORBIDDEN' });
    expect(toAuthFailure(new CarelogHttpError(409))).toBeUndefined();
  });
});
