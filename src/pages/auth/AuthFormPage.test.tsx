import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { AUTH_ERROR_KIND, type AuthPort } from '@/auth/authTypes';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { FixtureStateProviders } from '@/components/layout/FixtureStateProviders';

function renderAuth(
  path: string,
  options: Parameters<typeof createInMemoryAuthPort>[0] = {},
  initialCustomers?: readonly [],
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter
        authPort={createInMemoryAuthPort({ bootstrap: 'anonymous', ...options })}
        stateProviders={FixtureStateProviders}
        {...(initialCustomers ? { initialCustomers, initialEvents: [] } : {})}
      />
    </MemoryRouter>,
  );
}

it('routes login success to Schedule when canonical Customer state has records', async () => {
  renderAuth('/auth/entry');
  fireEvent.click(await screen.findByRole('link', { name: '로그인' }));
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'fixture-secret' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
});

function fillSignupIdentity() {
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '김치료' } });
  fireEvent.change(screen.getByLabelText('이메일'), {
    target: { value: 'fixture@example.test' },
  });
}

it('routes signup success to the canonical Customers empty flow', async () => {
  renderAuth('/auth/signup', {}, []);
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
  fillSignupIdentity();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'fixture-secret' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), {
    target: { value: 'fixture-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  expect(await screen.findByText('아직 고객이 없습니다')).toBeVisible();
});

it('shows a generic fixture failure and preserves entered values', async () => {
  renderAuth('/auth/login', { login: 'invalid-credentials' });
  const account = await screen.findByLabelText('계정');
  const secret = screen.getByLabelText('비밀번호');
  fireEvent.change(account, { target: { value: 'wrong-account' } });
  fireEvent.change(secret, { target: { value: 'wrong-secret' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('계정 정보를 확인할 수 없습니다');
  expect(account).toHaveValue('wrong-account');
  expect(secret).toHaveValue('wrong-secret');
});

it('marks only the field that failed local validation as invalid', async () => {
  renderAuth('/auth/login');
  const account = await screen.findByLabelText('계정');
  const secret = screen.getByLabelText('비밀번호');
  fireEvent.submit(document.querySelector('[data-auth-form]')!);

  expect(account).toHaveAttribute('aria-invalid', 'true');
  expect(secret).not.toHaveAttribute('aria-invalid');
  expect(account).toHaveAttribute('aria-describedby');
});

it('keeps global authentication failures from invalidating every field', async () => {
  renderAuth('/auth/login', { login: 'invalid-credentials' });
  const account = await screen.findByLabelText('계정');
  const secret = screen.getByLabelText('비밀번호');
  fireEvent.change(account, { target: { value: 'wrong-account' } });
  fireEvent.change(secret, { target: { value: 'wrong-secret' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  await screen.findByRole('alert');

  expect(account).not.toHaveAttribute('aria-invalid');
  expect(secret).not.toHaveAttribute('aria-invalid');
});

it('marks only the confirmation field for a signup mismatch', async () => {
  renderAuth('/auth/signup');
  const account = await screen.findByLabelText('계정');
  const secret = screen.getByLabelText('비밀번호');
  const confirmation = screen.getByLabelText('비밀번호 확인');
  fireEvent.change(account, { target: { value: 'fixture-account' } });
  fillSignupIdentity();
  fireEvent.change(secret, { target: { value: 'fixture-secret' } });
  fireEvent.change(confirmation, { target: { value: 'different-secret' } });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  await screen.findByRole('alert');

  expect(account).not.toHaveAttribute('aria-invalid');
  expect(secret).not.toHaveAttribute('aria-invalid');
  expect(confirmation).toHaveAttribute('aria-invalid', 'true');
});

it('does not render protected product content during anonymous direct navigation', async () => {
  renderAuth('/app/schedule');
  expect(document.querySelector('[data-app-shell]')).not.toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: '고객 맥락을 업무 가까이에 두세요' }),
  ).toBeVisible();
  await waitFor(() =>
    expect(document.querySelector('[data-schedule-page]')).not.toBeInTheDocument(),
  );
});

function renderSignupWithPort(authPort: AuthPort) {
  return render(
    <MemoryRouter initialEntries={['/auth/signup']}>
      <AppRouter
        authPort={authPort}
        stateProviders={FixtureStateProviders}
        initialCustomers={[]}
        initialEvents={[]}
      />
    </MemoryRouter>,
  );
}

function exhaustedThenSucceedingPort() {
  const base = createInMemoryAuthPort({ bootstrap: 'anonymous' });
  const signup = vi
    .fn<AuthPort['signup']>()
    .mockResolvedValueOnce({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.SERVER, reason: 'registration-retry-exhausted' },
    })
    .mockResolvedValueOnce({ ok: true });
  return { port: { ...base, signup }, signup };
}

async function fillValidSignup() {
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
  fillSignupIdentity();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'fixture-secret' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), {
    target: { value: 'fixture-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
}

it('offers a same-content retry after the registration retry budget runs out', async () => {
  const { port, signup } = exhaustedThenSucceedingPort();
  renderSignupWithPort(port);
  await fillValidSignup();

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '지금은 회원가입을 처리할 수 없습니다',
  );
  fireEvent.click(screen.getByRole('button', { name: '같은 내용으로 다시 시도' }));

  expect(await screen.findByText('아직 고객이 없습니다')).toBeVisible();
  expect(signup).toHaveBeenCalledTimes(2);
  expect(signup.mock.calls[1]).toEqual(signup.mock.calls[0]);
});

it('warns that edited details start a new request and hides the same-content retry', async () => {
  const { port, signup } = exhaustedThenSucceedingPort();
  renderSignupWithPort(port);
  await fillValidSignup();
  await screen.findByRole('alert');

  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '이치료' } });

  expect(screen.queryByRole('button', { name: '같은 내용으로 다시 시도' })).not.toBeInTheDocument();
  expect(screen.getByText(/새 가입 요청으로 처리됩니다/)).toBeVisible();
  expect(signup).toHaveBeenCalledTimes(1);
});

it('rejects a password outside the registration policy before calling the port', async () => {
  const { port, signup } = exhaustedThenSucceedingPort();
  renderSignupWithPort(port);
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
  fillSignupIdentity();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'short' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('8자 이상 20자 이하');
  expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'true');
  expect(signup).not.toHaveBeenCalled();
});
