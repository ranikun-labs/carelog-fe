import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { AUTH_ERROR_KIND, type AuthCommandResult } from '@/auth/authTypes';
import { Button, buttonVariants } from '@/components/ui/button';
import { buildAuthEntryPath, buildAuthLoginPath, buildAuthSignupPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import type { MessageKey } from '@/i18n/dictionary';
import { cn } from '@/lib/utils';

export type AuthFormMode = 'login' | 'signup';

type ErrorField = 'account' | 'name' | 'email' | 'secret' | 'secretConfirmation' | 'form';

// Mirrors the registration contract: userId/email/name ≤255, password ≤40.
const ACCOUNT_MAX_LENGTH = 255;
const NAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;
const SECRET_MAX_LENGTH = 40;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resultMessageKey(result: AuthCommandResult, isSignup: boolean): MessageKey | null {
  if (result.ok) return null;
  const { kind, reason } = result.failure;
  if (isSignup) {
    if (reason === 'account-conflict') return 'auth.form.signupConflict';
    if (reason === 'invalid-registration') return 'auth.form.signupInvalid';
    if (reason === 'registered-login-required') return 'auth.form.signupRegisteredLoginRequired';
    if (kind === AUTH_ERROR_KIND.SERVER || kind === AUTH_ERROR_KIND.NETWORK) {
      return 'auth.form.signupUnavailable';
    }
    return 'auth.form.genericFailure';
  }
  return kind === AUTH_ERROR_KIND.UNAUTHORIZED
    ? 'auth.form.invalidCredentials'
    : 'auth.form.genericFailure';
}

export function AuthFormPage({ mode }: { mode: AuthFormMode }) {
  const { t } = useTranslation();
  const { login, signup } = useAuth();
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
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

    let result: AuthCommandResult;
    if (isSignup) {
      const normalizedName = name.trim();
      const normalizedEmail = email.trim();
      if (normalizedAccount.length > ACCOUNT_MAX_LENGTH) {
        setError(t('auth.form.accountTooLong'));
        setErrorField('account');
        return;
      }
      if (!normalizedName || normalizedName.length > NAME_MAX_LENGTH) {
        setError(t('auth.form.nameRequired'));
        setErrorField('name');
        return;
      }
      if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
        setError(t('auth.form.emailInvalid'));
        setErrorField('email');
        return;
      }
      if (secret.length > SECRET_MAX_LENGTH) {
        setError(t('auth.form.secretTooLong'));
        setErrorField('secret');
        return;
      }
      if (secret !== secretConfirmation) {
        setError(t('auth.form.secretMismatch'));
        setErrorField('secretConfirmation');
        return;
      }
      setError(null);
      setErrorField(null);
      setIsSubmitting(true);
      result = await signup({
        account: normalizedAccount,
        name: normalizedName,
        email: normalizedEmail,
        secret,
      });
    } else {
      setError(null);
      setErrorField(null);
      setIsSubmitting(true);
      result = await login({ account: normalizedAccount, secret });
    }
    setIsSubmitting(false);
    const messageKey = resultMessageKey(result, isSignup);
    if (messageKey) {
      setError(t(messageKey));
      setErrorField('form');
    }
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
            data-auth-field="account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
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
              <label htmlFor="signup-name" className="text-sm font-semibold">
                {t('auth.form.name')}
              </label>
              <input
                id="signup-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                data-auth-field="name"
                aria-invalid={errorField === 'name' ? true : undefined}
                aria-describedby={errorField === 'name' ? errorId : undefined}
                className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="signup-email" className="text-sm font-semibold">
                {t('auth.form.email')}
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                data-auth-field="email"
                aria-invalid={errorField === 'email' ? true : undefined}
                aria-describedby={errorField === 'email' ? errorId : undefined}
                className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
            data-auth-field="secret"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
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
              data-auth-field="secretConfirmation"
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
