import { AUTH_ERROR_KIND, type AuthPort } from '@/auth/authTypes';

const UNAVAILABLE_FAILURE = { kind: AUTH_ERROR_KIND.UNKNOWN } as const;

/**
 * Safe default for isolated callers that do not inject an AuthPort. Production
 * boot always injects the Carelog API adapter from main.tsx.
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
