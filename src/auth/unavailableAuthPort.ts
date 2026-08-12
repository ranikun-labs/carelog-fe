import { AUTH_ERROR_KIND, type AuthPort } from '@/auth/authTypes';

const UNAVAILABLE_FAILURE = { kind: AUTH_ERROR_KIND.UNKNOWN } as const;

/**
 * Production's pre-transport boundary is deliberately anonymous and never
 * grants access. The Shared Identity adapter will replace this port later.
 */
export function createUnavailableAuthPort(): AuthPort {
  return {
    async bootstrapSession() {
      return { status: 'anonymous' } as const;
    },
    async login() {
      return { ok: false, failure: UNAVAILABLE_FAILURE } as const;
    },
    async signup() {
      return { ok: false, failure: UNAVAILABLE_FAILURE } as const;
    },
    async logout() {},
    async recoverSession() {
      return { ok: false, failure: UNAVAILABLE_FAILURE } as const;
    },
  };
}
