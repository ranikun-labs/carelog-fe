import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { AUTH_ERROR_KIND, type AuthCommandResult } from '@/auth/authTypes';
import { Button, buttonVariants } from '@/components/ui/button';
import { buildAuthEntryPath, buildAuthLoginPath, buildAuthSignupPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export type AuthFormMode = 'login' | 'signup';

type ErrorField = 'account' | 'secret' | 'secretConfirmation' | 'form';

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
  const { login, signup, signupAvailable } = useAuth();
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [registered, setRegistered] = useState(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const [secretConfirmation, setSecretConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField | null>(null);
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
      setErrorField('account');
      return;
    }
    if (!secret) {
      setError(t('auth.form.secretRequired'));
      setErrorField('secret');
      return;
    }
    if (isSignup && secret !== secretConfirmation) {
      setError(t('auth.form.secretMismatch'));
      setErrorField('secretConfirmation');
      return;
    }

    if (isSignup && (!email.trim() || !name.trim())) {
      setError(t('auth.form.signupFieldsRequired'));
      setErrorField('form');
      return;
    }
    let idempotencyKey: string | undefined;
    if (isSignup) {
      // Keep the submitted values in memory only so an unchanged retry uses the same key.
      const payload = JSON.stringify([normalizedAccount, email.trim(), name.trim(), secret]);
      try {
        if (attempt.current?.payload !== payload)
          attempt.current = { payload, key: crypto.randomUUID() };
        idempotencyKey = attempt.current.key;
      } catch {
        setError(t('auth.form.signupFailure'));
        setErrorField('form');
        return;
      }
    }
    setError(null);
    setErrorField(null);
    setIsSubmitting(true);
    const result = isSignup
      ? await signup({
          account: normalizedAccount,
          secret,
          email: email.trim(),
          name: name.trim(),
          idempotencyKey,
        })
      : await login({ account: normalizedAccount, secret });
    setIsSubmitting(false);
    if (isSignup && result.ok) {
      attempt.current = null;
      setSecret('');
      setSecretConfirmation('');
      setRegistered(true);
      return;
    }
    const messageKey = resultMessageKey(result);
    if (messageKey) {
      setError(t(isSignup ? 'auth.form.signupFailure' : messageKey));
      setErrorField('form');
    }
  }

  if (isSignup && !signupAvailable) {
    return (
      <section data-auth-form-mode="signup">
        <h1>{t('auth.form.signupTitle')}</h1>
        <p role="status">{t('auth.form.signupUnavailable')}</p>
        <Link to={buildAuthLoginPath()}>{t('auth.form.loginLink')}</Link>
      </section>
    );
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

      {registered ? (
        <div role="status" className="grid gap-4">
          <p>{t('auth.form.signupComplete')}</p>
          <Link to={buildAuthLoginPath()} className={buttonVariants()}>
            {t('auth.form.loginLink')}
          </Link>
        </div>
      ) : (
        <form
          data-auth-form
          aria-busy={isSubmitting}
          aria-describedby={error && errorField === 'form' ? errorId : undefined}
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
              onChange={(event) => {
                setAccount(event.target.value);
              }}
              autoComplete="username"
              required
              aria-invalid={errorField === 'account' ? true : undefined}
              aria-describedby={errorField === 'account' ? errorId : undefined}
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
          {isSignup ? (
            <>
              <div className="grid gap-2">
                <label htmlFor="signup-email" className="text-sm font-semibold">
                  {t('auth.form.email')}
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                  className="border-border-default bg-surface min-h-11 rounded-md border px-3"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="signup-name" className="text-sm font-semibold">
                  {t('auth.form.name')}
                </label>
                <input
                  id="signup-name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  className="border-border-default bg-surface min-h-11 rounded-md border px-3"
                />
              </div>
            </>
          ) : null}
          <div className="grid gap-2">
            <label htmlFor={`${mode}-secret`} className="text-sm font-semibold">
              {t('auth.form.secret')}
            </label>
            <input
              id={`${mode}-secret`}
              name="secret"
              type="password"
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value);
              }}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              aria-invalid={errorField === 'secret' ? true : undefined}
              aria-describedby={errorField === 'secret' ? errorId : undefined}
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
                aria-invalid={errorField === 'secretConfirmation' ? true : undefined}
                aria-describedby={errorField === 'secretConfirmation' ? errorId : undefined}
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
      )}

      {(isSignup || signupAvailable) && !registered ? (
        <p className="text-text-secondary text-center text-sm">
          {isSignup ? t('auth.form.haveAccount') : t('auth.form.needAccount')}{' '}
          <Link
            to={isSignup ? buildAuthLoginPath() : buildAuthSignupPath()}
            className="text-accent-primary-deep rounded-md font-semibold underline underline-offset-4"
          >
            {isSignup ? t('auth.form.loginLink') : t('auth.form.signupLink')}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
