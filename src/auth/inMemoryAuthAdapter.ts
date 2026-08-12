import {
  AUTH_ERROR_KIND,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthErrorKind,
  type AuthFailure,
  type AuthPort,
  type InMemoryAuthAdapterOptions,
  type InMemoryAuthCommandOutcome,
} from '@/auth/authTypes';

export interface InMemoryAuthPort extends AuthPort {
  readonly bootstrapAttemptCount: number;
  readonly recoveryAttemptCount: number;
}

function failure(kind: AuthErrorKind): AuthFailure {
  return { kind };
}

function outcomeFailure(outcome: InMemoryAuthCommandOutcome): AuthFailure {
  switch (outcome) {
    case 'invalid-credentials':
      return failure(AUTH_ERROR_KIND.UNAUTHORIZED);
    case 'forbidden':
      return failure(AUTH_ERROR_KIND.FORBIDDEN);
    case 'server':
      return failure(AUTH_ERROR_KIND.SERVER);
    case 'network':
      return failure(AUTH_ERROR_KIND.NETWORK);
    case 'generic-failure':
    case 'unknown':
      return failure(AUTH_ERROR_KIND.UNKNOWN);
    case 'success':
      return failure(AUTH_ERROR_KIND.UNKNOWN);
  }
}

function commandResult(outcome: InMemoryAuthCommandOutcome): AuthCommandResult {
  return outcome === 'success' ? { ok: true } : { ok: false, failure: outcomeFailure(outcome) };
}

function recoveryOutcomeResult(
  outcome: Exclude<InMemoryAuthCommandOutcome, 'invalid-credentials' | 'generic-failure'>,
): AuthCommandResult {
  return outcome === 'success' ? { ok: true } : { ok: false, failure: outcomeFailure(outcome) };
}

export function createInMemoryAuthPort(options: InMemoryAuthAdapterOptions = {}): InMemoryAuthPort {
  const bootstrapMode = options.bootstrap ?? 'anonymous';
  const loginOutcome = options.login ?? 'success';
  const signupOutcome = options.signup ?? 'success';
  const recoveryOutcome = options.recovery ?? 'success';
  let authenticated = bootstrapMode === 'authenticated';
  let bootstrapAttemptCount = 0;
  let recoveryAttemptCount = 0;

  const port: InMemoryAuthPort = {
    get bootstrapAttemptCount() {
      return bootstrapAttemptCount;
    },
    get recoveryAttemptCount() {
      return recoveryAttemptCount;
    },
    async bootstrapSession(): Promise<AuthBootstrapResult> {
      bootstrapAttemptCount += 1;
      if (authenticated) {
        return { status: 'authenticated' };
      }
      if (bootstrapMode === 'anonymous') {
        return { status: 'anonymous' };
      }
      if (bootstrapMode === 'authenticated') return { status: 'anonymous' };
      const bootstrapFailure = failure(options.bootstrapFailure ?? AUTH_ERROR_KIND.SERVER);
      if (bootstrapMode === 'recoverable')
        return { status: 'recoverable', failure: bootstrapFailure };
      return { status: 'error', failure: bootstrapFailure };
    },
    async login(): Promise<AuthCommandResult> {
      const result = commandResult(loginOutcome);
      if (result.ok) authenticated = true;
      return result;
    },
    async signup(): Promise<AuthCommandResult> {
      const result = commandResult(signupOutcome);
      if (result.ok) authenticated = true;
      return result;
    },
    async logout(): Promise<void> {
      authenticated = false;
    },
    async recoverSession(): Promise<AuthCommandResult> {
      recoveryAttemptCount += 1;
      const result = recoveryOutcomeResult(recoveryOutcome);
      if (result.ok) authenticated = true;
      return result;
    },
  };

  return port;
}
