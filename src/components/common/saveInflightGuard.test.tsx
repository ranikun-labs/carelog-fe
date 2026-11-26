import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { LeaveGuardDataRouterScope } from '@/components/common/LeaveGuard';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { EventForm } from '@/components/schedule/EventForm';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date(2026, 7, 11, 12, 0, 0);

/** 폼을 데이터 라우터 안에 두고 "다른 화면" 링크로 이동을 시도한다. */
function renderInRouter(form: React.ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: '/form',
        element: (
          <LeaveGuardDataRouterScope>
            {form}
            <Link to="/other">다른 화면</Link>
          </LeaveGuardDataRouterScope>
        ),
      },
      { path: '/other', element: <p>다른 화면 본문</p> },
    ],
    { initialEntries: ['/form'] },
  );
  render(
    <I18nProvider locale="ko">
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  return router;
}

function customerForm(onSubmit: (values: never, options: never) => unknown) {
  return <CustomerForm mode="create" onSubmit={onSubmit as never} onCancel={vi.fn()} />;
}

function eventForm(onSubmit: (values: never, options: never) => unknown) {
  return (
    <EventForm
      mode="create"
      customerName="박세입"
      now={now}
      fixedCreateStatus="PLANNED"
      getNow={() => now}
      onSubmit={onSubmit as never}
      onCancel={vi.fn()}
    />
  );
}

async function flush() {
  await act(async () => undefined);
}

describe('leave guard while a save is in flight (save-inflight)', () => {
  it('CustomerForm: after a successful save the parent may navigate without a dialog', async () => {
    const router = renderInRouter(
      customerForm(async (_values: never, options: { allowLeave: () => void }) => {
        await Promise.resolve();
        options.allowLeave();
        await router.navigate('/other');
        return true;
      }) as React.ReactElement,
    );
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '저장할 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(router.state.location.pathname).toBe('/other');
    expect(screen.queryByText('작성 중인 내용이 사라져요')).not.toBeInTheDocument();
  });

  it('EventForm: after a successful save the parent may navigate without a dialog', async () => {
    const router = renderInRouter(
      eventForm(async (_values: never, options: { allowLeave: () => void }) => {
        await Promise.resolve();
        options.allowLeave();
        await router.navigate('/other');
      }),
    );
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: '저장할 일정' },
    });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(router.state.location.pathname).toBe('/other');
    expect(screen.queryByText('작성 중인 내용이 사라져요')).not.toBeInTheDocument();
  });

  it('CustomerForm: a failed save keeps the input and the guard active again', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('save failed')));
    const router = renderInRouter(customerForm(onSubmit));
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '실패할 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.querySelector('[data-customer-field="displayName"]')).toHaveValue(
      '실패할 고객',
    );
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await flush();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
  });

  it('EventForm: a failed save keeps the input and the guard active again', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('save failed')));
    const router = renderInRouter(eventForm(onSubmit));
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: '실패할 일정' },
    });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.querySelector('[data-event-field="descriptor"]')).toHaveValue('실패할 일정');
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await flush();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
  });

  it('CustomerForm: navigating away while the save is pending asks first and does not leave', async () => {
    const pending = new Promise<void>(() => undefined);
    const onSubmit = vi.fn(() => pending);
    const router = renderInRouter(customerForm(onSubmit));
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '저장 중 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await flush();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
  });

  it('EventForm: navigating away while the save is pending asks first and does not leave', async () => {
    const pending = new Promise<void>(() => undefined);
    const onSubmit = vi.fn(() => pending);
    const router = renderInRouter(eventForm(onSubmit));
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: '저장 중 일정' },
    });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await flush();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    await flush();
    await flush();
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
  });
});
