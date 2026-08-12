import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';

function renderAuth(
  path: string,
  options: Parameters<typeof createInMemoryAuthPort>[0] = {},
  initialCustomers?: readonly [],
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter
        authPort={createInMemoryAuthPort({ bootstrap: 'anonymous', ...options })}
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

it('routes signup success to the canonical Customers empty flow', async () => {
  renderAuth('/auth/signup', {}, []);
  fireEvent.change(await screen.findByLabelText('계정'), { target: { value: 'fixture-account' } });
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
