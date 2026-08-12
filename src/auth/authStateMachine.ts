import { AUTH_STATE, type AuthFailure, type AuthState } from '@/auth/authTypes';

export const INITIAL_AUTH_STATE: AuthState = { status: AUTH_STATE.BOOTSTRAPPING };

export type AuthStateAction =
  | { type: 'bootstrap-start' }
  | { type: 'bootstrap-authenticated' }
  | { type: 'bootstrap-anonymous' }
  | { type: 'bootstrap-error'; error: AuthFailure }
  | { type: 'recovery-start'; attempt: number }
  | { type: 'recovery-authenticated' }
  | { type: 'recovery-anonymous' }
  | { type: 'login-authenticated' }
  | { type: 'signup-authenticated' }
  | { type: 'logout-anonymous' };

export function authStateReducer(state: AuthState, action: AuthStateAction): AuthState {
  switch (action.type) {
    case 'bootstrap-start':
      return { status: AUTH_STATE.BOOTSTRAPPING };
    case 'bootstrap-authenticated':
      return { status: AUTH_STATE.AUTHENTICATED };
    case 'bootstrap-anonymous':
      return { status: AUTH_STATE.ANONYMOUS };
    case 'bootstrap-error':
      return { status: AUTH_STATE.ERROR, error: action.error };
    case 'recovery-start':
      return { status: AUTH_STATE.RECOVERING, attempt: action.attempt };
    case 'recovery-authenticated':
      return { status: AUTH_STATE.AUTHENTICATED };
    case 'recovery-anonymous':
      return { status: AUTH_STATE.ANONYMOUS };
    case 'login-authenticated':
    case 'signup-authenticated':
      return { status: AUTH_STATE.AUTHENTICATED };
    case 'logout-anonymous':
      return { status: AUTH_STATE.ANONYMOUS };
    default:
      return state;
  }
}
