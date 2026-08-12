export const AUTH_STATE = {
  BOOTSTRAPPING: 'BOOTSTRAPPING',
  ANONYMOUS: 'ANONYMOUS',
  AUTHENTICATED: 'AUTHENTICATED',
  RECOVERING: 'RECOVERING',
  ERROR: 'ERROR',
} as const;

export type AuthStatus = (typeof AUTH_STATE)[keyof typeof AUTH_STATE];

export const AUTH_ERROR_KIND = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SERVER: 'SERVER',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AuthErrorKind = (typeof AUTH_ERROR_KIND)[keyof typeof AUTH_ERROR_KIND];

export interface AuthFailure {
  kind: AuthErrorKind;
}

export type AuthState =
  | { status: typeof AUTH_STATE.BOOTSTRAPPING }
  | { status: typeof AUTH_STATE.ANONYMOUS }
  | { status: typeof AUTH_STATE.AUTHENTICATED }
  | { status: typeof AUTH_STATE.RECOVERING; attempt: number }
  | { status: typeof AUTH_STATE.ERROR; error: AuthFailure };

/**
 * This is intentionally a product-form fixture, not a Shared Identity wire DTO.
 * The eventual transport adapter can translate its own credential contract here.
 */
export interface AuthCredentialFixture {
  account: string;
  secret: string;
}

export type AuthSignupFixture = AuthCredentialFixture;

export type AuthBootstrapResult =
  | { status: 'authenticated' }
  | { status: 'anonymous' }
  | { status: 'recoverable'; failure: AuthFailure }
  | { status: 'error'; failure: AuthFailure };

export type AuthCommandResult = { ok: true } | { ok: false; failure: AuthFailure };

export interface AuthPort {
  bootstrapSession: () => Promise<AuthBootstrapResult>;
  login: (input: AuthCredentialFixture) => Promise<AuthCommandResult>;
  signup: (input: AuthSignupFixture) => Promise<AuthCommandResult>;
  logout: () => Promise<void>;
  recoverSession: () => Promise<AuthCommandResult>;
}

export type InMemoryAuthCommandOutcome =
  | 'success'
  | 'invalid-credentials'
  | 'generic-failure'
  | 'forbidden'
  | 'server'
  | 'network'
  | 'unknown';

export type InMemoryAuthBootstrapMode = 'anonymous' | 'authenticated' | 'recoverable' | 'error';

/**
 * Serializable configuration used only by the test bootstrap. It gives tests a
 * deterministic adapter without putting a URL, token, cookie, or query switch in
 * the product surface.
 */
export interface InMemoryAuthAdapterOptions {
  bootstrap?: InMemoryAuthBootstrapMode;
  bootstrapFailure?: AuthErrorKind;
  login?: InMemoryAuthCommandOutcome;
  signup?: InMemoryAuthCommandOutcome;
  recovery?: Exclude<InMemoryAuthCommandOutcome, 'invalid-credentials' | 'generic-failure'>;
}
