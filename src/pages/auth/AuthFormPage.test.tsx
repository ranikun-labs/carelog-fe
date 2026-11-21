import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { vi } from 'vitest';
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

it('shows registration completion and requires a separate login', async () => {
  renderAuth('/auth/signup', {}, []);
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
  fireEvent.change(screen.getByLabelText('이메일'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '테스트' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'fixture-secret' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), {
    target: { value: 'fixture-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  expect(await screen.findByRole('status')).toHaveTextContent('회원가입이 완료되었습니다');
  expect(screen.getAllByRole('link', { name: '로그인' })[0]).toHaveAttribute('href', '/auth/login');
  expect(document.querySelector('[data-app-shell]')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: '로그인' }));
  expect(await screen.findByRole('heading', { name: 'Carelog 로그인' })).toBeVisible();
  expect(screen.getByLabelText('계정')).toHaveValue('');
  expect(screen.getByLabelText('비밀번호')).toHaveValue('');
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
  fireEvent.change(screen.getByLabelText('이메일'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '테스트' } });
  fireEvent.change(account, { target: { value: 'fixture-account' } });
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

it('reuses the attempt key for an unchanged retry after an uncertain failure', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'anonymous' });
  const signup = vi
    .spyOn(port, 'signup')
    .mockResolvedValue({ ok: false, failure: { kind: 'NETWORK' } });
  render(
    <MemoryRouter initialEntries={['/auth/signup']}>
      <AppRouter authPort={port} stateProviders={FixtureStateProviders} />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'test-user' } });
  fireEvent.change(screen.getByLabelText('이메일'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '테스트' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret-value' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'secret-value' } });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  await screen.findByRole('alert');
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: ' changed ' } });
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: ' 테스트 ' } });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  await waitFor(() => expect(signup).toHaveBeenCalledTimes(2));
  expect(signup.mock.calls[0][0].idempotencyKey).toBeTruthy();
  expect(signup.mock.calls[1][0].idempotencyKey).toBe(signup.mock.calls[0][0].idempotencyKey);
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '다른 이름' } });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  await waitFor(() => expect(signup).toHaveBeenCalledTimes(3));
  expect(signup.mock.calls[2][0].idempotencyKey).not.toBe(signup.mock.calls[0][0].idempotencyKey);
});

it('hides signup entry and blocks direct registration when capability is disabled', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'anonymous' });
  Object.defineProperty(port, 'signupAvailable', { value: false });
  const first = render(
    <MemoryRouter initialEntries={['/auth/entry']}>
      <AppRouter authPort={port} stateProviders={FixtureStateProviders} />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '로그인' });
  expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument();
  first.unmount();
  render(
    <MemoryRouter initialEntries={['/auth/signup']}>
      <AppRouter authPort={port} stateProviders={FixtureStateProviders} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('현재 회원가입을 사용할 수 없습니다.')).toBeVisible();
  expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument();
});

it('reports a missing random generator without leaving the form busy', async () => {
  const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    throw new Error('unavailable');
  });
  try {
    renderAuth('/auth/signup');
    fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'test-user' } });
    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'synthetic@example.test' },
    });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '테스트' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret-value' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'secret-value' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: '회원가입' })).toBeEnabled();
  } finally {
    uuid.mockRestore();
  }
});
