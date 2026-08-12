import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { AUTH_ERROR_KIND, type AuthErrorKind, type AuthFailure } from '@/auth/authTypes';
import { useTranslation } from '@/i18n/I18nContext';
import type { MessageKey } from '@/i18n/dictionary';

function AuthSurfaceFrame({ children }: { children: ReactNode }) {
  return (
    <div data-auth-surface className="bg-page min-h-dvh w-full">
      <main className="mx-auto flex min-h-dvh w-full max-w-[560px] items-center px-5 py-10 sm:px-8">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

function AuthStatusContent({
  title,
  description,
  status,
  action,
}: {
  title: string;
  description: string;
  status: 'status' | 'alert';
  action?: ReactNode;
}) {
  return (
    <section
      data-auth-status-surface
      role={status}
      aria-live={status === 'alert' ? 'assertive' : 'polite'}
      aria-busy={status === 'status' ? true : undefined}
      className="border-border-default bg-surface grid gap-4 rounded-xl border p-6 text-center shadow-sm sm:p-8"
    >
      <div className="bg-accent-primary-bg text-accent-primary mx-auto grid size-12 place-items-center rounded-full font-semibold">
        {status === 'status' ? '…' : '!'}
      </div>
      <div className="grid gap-2">
        <h1 className="text-text-primary text-xl font-bold">{title}</h1>
        <p className="text-text-secondary text-sm leading-6">{description}</p>
      </div>
      {action}
    </section>
  );
}

export function AuthBootstrapScreen() {
  const { t } = useTranslation();
  return (
    <AuthSurfaceFrame>
      <AuthStatusContent
        title={t('auth.bootstrap.title')}
        description={t('auth.bootstrap.description')}
        status="status"
      />
    </AuthSurfaceFrame>
  );
}

export function AuthRecoveryScreen() {
  const { t } = useTranslation();
  return (
    <AuthSurfaceFrame>
      <AuthStatusContent
        title={t('auth.recovery.title')}
        description={t('auth.recovery.description')}
        status="status"
      />
    </AuthSurfaceFrame>
  );
}

export function AuthBootstrapErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <AuthSurfaceFrame>
      <AuthStatusContent
        title={t('auth.bootstrap.errorTitle')}
        description={t('auth.bootstrap.errorDescription')}
        status="alert"
        action={
          <Button type="button" onClick={onRetry} className="w-full">
            {t('auth.bootstrap.retry')}
          </Button>
        }
      />
    </AuthSurfaceFrame>
  );
}

function operationCopy(kind: AuthErrorKind, t: (key: MessageKey) => string) {
  switch (kind) {
    case AUTH_ERROR_KIND.FORBIDDEN:
      return {
        title: t('auth.operation.forbiddenTitle'),
        description: t('auth.operation.forbiddenDescription'),
      };
    case AUTH_ERROR_KIND.SERVER:
      return {
        title: t('auth.operation.serverTitle'),
        description: t('auth.operation.serverDescription'),
      };
    case AUTH_ERROR_KIND.NETWORK:
      return {
        title: t('auth.operation.networkTitle'),
        description: t('auth.operation.networkDescription'),
      };
    case AUTH_ERROR_KIND.UNKNOWN:
    case AUTH_ERROR_KIND.UNAUTHORIZED:
      return {
        title: t('auth.operation.genericTitle'),
        description: t('auth.operation.genericDescription'),
      };
  }
}

export function AuthOperationErrorSurface({
  failure,
  onRetry,
  onDismiss,
}: {
  failure: AuthFailure;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const copy = operationCopy(failure.kind, t);
  return (
    <section
      data-auth-operation-error
      role="alert"
      aria-live="assertive"
      className="border-warning bg-warning-bg text-text-primary grid shrink-0 gap-2 border-b px-4 py-3 sm:flex sm:items-center sm:gap-4 sm:px-6"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold">{copy.title}</h2>
        <p className="text-text-secondary mt-0.5 text-sm">{copy.description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {t('auth.operation.retry')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          {t('auth.operation.dismiss')}
        </Button>
      </div>
    </section>
  );
}
