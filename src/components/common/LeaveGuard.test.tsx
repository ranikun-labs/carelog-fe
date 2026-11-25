import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Link, RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';

import {
  LeaveGuard,
  LeaveGuardDataRouterScope,
} from '@/components/common/LeaveGuard';
import { I18nProvider } from '@/i18n/I18nContext';

function Page({ onLeave }: { onLeave?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <label>
        메모
        <input value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <Link to="/other">다른 화면</Link>
      <LeaveGuard
        shouldBlock={() => value !== ''}
        onLeave={onLeave}
        restoreFocusTo={() => document.querySelector('input')}
      />
    </div>
  );
}

function renderRouter(onLeave?: () => void) {
  const router = createMemoryRouter(
    [
      {
        path: '/form',
        element: (
          <LeaveGuardDataRouterScope>
            <Page onLeave={onLeave} />
          </LeaveGuardDataRouterScope>
        ),
      },
      { path: '/start', element: <p>시작 화면</p> },
      { path: '/other', element: <p>다른 화면 본문</p> },
    ],
    { initialEntries: ['/start', '/form'], initialIndex: 1 },
  );
  render(
    <I18nProvider locale="ko">
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  return router;
}

describe('LeaveGuard', () => {
  it('does not interrupt navigation while the form is untouched', async () => {
    const router = renderRouter();
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await act(async () => undefined);
    expect(router.state.location.pathname).toBe('/other');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before a link leaves a dirty form, and "계속 작성" keeps value, place and focus', async () => {
    const router = renderRouter();
    const input = screen.getByLabelText('메모');
    fireEvent.change(input, { target: { value: '메모 내용' } });
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await act(async () => undefined);

    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByRole('button', { name: '계속 작성' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '계속 작성' }));
    await act(async () => undefined);
    await act(async () => undefined);
    expect(screen.queryByText('작성 중인 내용이 사라져요')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByLabelText('메모')).toHaveValue('메모 내용');
    expect(screen.getByLabelText('메모')).toHaveFocus();
  });

  it('guards browser back (POP) the same way, and "나가기" discards and leaves', async () => {
    const onLeave = vi.fn();
    const router = renderRouter(onLeave);
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'x' } });
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');

    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    await act(async () => undefined);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/start');
  });

  it('ignores same-location navigation (state only)', async () => {
    const router = renderRouter();
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'x' } });
    await act(async () => {
      await router.navigate('/form', { state: { adaptive: true } });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.state).toEqual({ adaptive: true });
  });

  it('beforeunload asks the browser only while the input is dirty', () => {
    renderRouter();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'x' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
