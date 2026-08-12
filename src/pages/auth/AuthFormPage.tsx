import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { AUTH_ERROR_KIND, type AuthCommandResult } from '@/auth/authTypes';
import { Button, buttonVariants } from '@/components/ui/button';
import { buildAuthEntryPath, buildAuthLoginPath, buildAuthSignupPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export type AuthFormMode = 'login' | 'signup';

function resultMessageKey(
  result: AuthCommandResult,
): 'auth.form.invalidCredentials' | 'auth.form.genericFailure' | null {
  if (result.ok) return null;
  return result.failure.kind === AUTH_ERROR_KIND.UNAUTHORIZED
    ? 'auth.form.invalidCredentials'
    : 'auth.form.genericFailure';
}

export function AuthFormPage({ mode }: { mode: AuthFormMode }) {
  const { t } = useTranslation();
  const { login, signup } = useAuth();
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [secretConfirmation, setSecretConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const isSignup = mode === 'signup';

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true });
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedAccount = account.trim();
    if (!normalizedAccount) {
      setError(t('auth.form.accountRequired'));
      return;
    }
    if (!secret) {
      setError(t('auth.form.secretRequired'));
      return;
    }
    if (isSignup && secret !== secretConfirmation) {
      setError(t('auth.form.secretMismatch'));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = isSignup
      ? await signup({ account: normalizedAccount, secret })
      : await login({ account: normalizedAccount, secret });
    setIsSubmitting(false);
    const messageKey = resultMessageKey(result);
    if (messageKey) setError(t(messageKey));
  }

  return (
    <section data-auth-form-mode={mode} className="grid gap-6">
      <div className="grid gap-2">
        <Link
          to={buildAuthEntryPath()}
          className={cn(buttonVariants({ variant: 'text', size: 'sm' }), 'w-fit px-0')}
        >
          ← {t('auth.form.back')}
        </Link>
        <h1 className="text-text-primary text-3xl font-bold tracking-tight">
          {isSignup ? t('auth.form.signupTitle') : t('auth.form.loginTitle')}
        </h1>
        <p className="text-text-secondary leading-7">
          {isSignup ? t('auth.form.signupDescription') : t('auth.form.loginDescription')}
        </p>
      </div>

      <form
        data-auth-form
        aria-busy={isSubmitting}
        aria-describedby={error ? errorId : undefined}
        onSubmit={(event) => void submit(event)}
        className="border-border-default bg-surface grid gap-5 rounded-xl border p-5 sm:p-6"
      >
        <div className="grid gap-2">
          <label htmlFor={`${mode}-account`} className="text-sm font-semibold">
            {t('auth.form.account')}
          </label>
          <input
            id={`${mode}-account`}
            name="account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            autoComplete="username"
            required
            aria-invalid={error ? true : undefined}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${mode}-secret`} className="text-sm font-semibold">
            {t('auth.form.secret')}
          </label>
          <input
            id={`${mode}-secret`}
            name="secret"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            aria-invalid={error ? true : undefined}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
        {isSignup ? (
          <div className="grid gap-2">
            <label htmlFor="signup-secret-confirmation" className="text-sm font-semibold">
              {t('auth.form.secretConfirmation')}
            </label>
            <input
              id="signup-secret-confirmation"
              name="secretConfirmation"
              type="password"
              value={secretConfirmation}
              onChange={(event) => setSecretConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              aria-invalid={error ? true : undefined}
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
        ) : null}

        {error ? (
          <p
            id={errorId}
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="text-warning text-sm font-semibold outline-none"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
          {isSubmitting
            ? t('auth.form.submitting')
            : isSignup
              ? t('auth.form.signupAction')
              : t('auth.form.loginAction')}
        </Button>
      </form>

      <p className="text-text-secondary text-center text-sm">
        {isSignup ? t('auth.form.haveAccount') : t('auth.form.needAccount')}{' '}
        <Link
          to={isSignup ? buildAuthLoginPath() : buildAuthSignupPath()}
          className="text-accent-primary-deep rounded-md font-semibold underline underline-offset-4"
        >
          {isSignup ? t('auth.form.loginLink') : t('auth.form.signupLink')}
        </Link>
      </p>
    </section>
  );
}
