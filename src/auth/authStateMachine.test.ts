import { AUTH_ERROR_KIND, AUTH_STATE } from '@/auth/authTypes';
import { authStateReducer, INITIAL_AUTH_STATE } from '@/auth/authStateMachine';

it('keeps bootstrap, recovery, anonymous, authenticated, and error states distinct', () => {
  const anonymous = authStateReducer(INITIAL_AUTH_STATE, { type: 'bootstrap-anonymous' });
  expect(anonymous).toEqual({ status: AUTH_STATE.ANONYMOUS });

  const recovering = authStateReducer(anonymous, { type: 'recovery-start', attempt: 1 });
  expect(recovering).toEqual({ status: AUTH_STATE.RECOVERING, attempt: 1 });

  const authenticated = authStateReducer(recovering, { type: 'recovery-authenticated' });
  expect(authenticated).toEqual({ status: AUTH_STATE.AUTHENTICATED });

  const error = authStateReducer(INITIAL_AUTH_STATE, {
    type: 'bootstrap-error',
    error: { kind: AUTH_ERROR_KIND.SERVER },
  });
  expect(error).toEqual({
    status: AUTH_STATE.ERROR,
    error: { kind: AUTH_ERROR_KIND.SERVER },
  });
});
