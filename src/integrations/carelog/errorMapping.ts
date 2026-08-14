import { AUTH_ERROR_KIND, type AuthFailure } from '@/auth/authTypes';
import {
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
  getCarelogHttpStatus,
} from '@/integrations/carelog/errors';

export type CarelogFailureCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER'
  | 'NETWORK'
  | 'PROTOCOL'
  | 'CONFIGURATION'
  | 'UNKNOWN';

export type CarelogMessageKey =
  | 'carelog.validation'
  | 'carelog.unauthorized'
  | 'carelog.forbidden'
  | 'carelog.notFound'
  | 'carelog.conflict'
  | 'carelog.server'
  | 'carelog.network'
  | 'carelog.protocol'
  | 'carelog.configuration'
  | 'carelog.unknown';

export function classifyCarelogError(error: unknown): CarelogFailureCode {
  const status = getCarelogHttpStatus(error);
  if (status !== undefined) {
    if (status === 400) return 'VALIDATION';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status >= 500) return 'SERVER';
    return 'UNKNOWN';
  }
  if (error instanceof CarelogNetworkError) return 'NETWORK';
  if (error instanceof CarelogProtocolError) return 'PROTOCOL';
  if (error instanceof CarelogHttpError) return 'UNKNOWN';
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { kind?: unknown }).kind === 'CONFIGURATION'
  ) {
    return 'CONFIGURATION';
  }
  return 'UNKNOWN';
}

export function toAuthFailure(error: unknown): AuthFailure | undefined {
  const code = classifyCarelogError(error);
  if (code === 'UNAUTHORIZED') return { kind: AUTH_ERROR_KIND.UNAUTHORIZED };
  if (code === 'FORBIDDEN') return { kind: AUTH_ERROR_KIND.FORBIDDEN };
  if (code === 'SERVER') return { kind: AUTH_ERROR_KIND.SERVER };
  if (code === 'NETWORK') return { kind: AUTH_ERROR_KIND.NETWORK };
  return undefined;
}

export function getCarelogMessageKey(error: unknown): CarelogMessageKey {
  switch (classifyCarelogError(error)) {
    case 'VALIDATION':
      return 'carelog.validation';
    case 'UNAUTHORIZED':
      return 'carelog.unauthorized';
    case 'FORBIDDEN':
      return 'carelog.forbidden';
    case 'NOT_FOUND':
      return 'carelog.notFound';
    case 'CONFLICT':
      return 'carelog.conflict';
    case 'SERVER':
      return 'carelog.server';
    case 'NETWORK':
      return 'carelog.network';
    case 'PROTOCOL':
      return 'carelog.protocol';
    case 'CONFIGURATION':
      return 'carelog.configuration';
    case 'UNKNOWN':
      return 'carelog.unknown';
  }
}
