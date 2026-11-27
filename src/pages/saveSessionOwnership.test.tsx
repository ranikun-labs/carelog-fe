import { act, fireEvent, render, screen } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { useState } from 'react';
import { vi } from 'vitest';

import { LeaveGuardDataRouterScope } from '@/components/common/LeaveGuard';
import type { CustomerRecord } from '@/types/customer';
import { CustomerCreatePage } from '@/pages/CustomerCreatePage';
import { CustomerEditPage } from '@/pages/CustomerEditPage';
import { I18nProvider } from '@/i18n/I18nContext';
import { createInMemoryCustomerPort } from '@/integrations/carelog/inMemoryPorts';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { SaveSessionProvider } from '@/state/saveSessionContext';

const customerA: CustomerRecord = {
  id: 'customer-a',
  displayName: '고객 A',
  workspace: { id: 'workspace-1', name: 'Carelog' },
};
const customerB: CustomerRecord = {
  id: 'customer-b',
  displayName: '고객 B',
  workspace: { id: 'workspace-1', name: 'Carelog' },
};

/** create·edit 응답을 테스트가 직접 늦게 돌려주는 port. */
function delayedPort() {
  const pending: { resolve: (customer: CustomerRecord) => void } = {
    resolve: () => undefined,
  };
  let rejectCreate: (error: unknown) => void = () => undefined;
  const base = createInMemoryCustomerPort([customerA, customerB]);
  const create = vi.fn(
    () =>
      new Promise<CustomerRecord>((resolve, reject) => {
        pending.resolve = resolve as (customer: CustomerRecord) => void;
        rejectCreate = reject;
      }),
  );
  const edit = vi.fn(
    () =>
      new Promise<CustomerRecord>((resolve) => {
        pending.resolve = resolve as (customer: CustomerRecord) => void;
      }),
  );
  const port = { ...base, create, edit } as unknown as ReturnType<
    typeof createInMemoryCustomerPort
  >;
  return {
    port,
    create,
    edit,
    resolve: (customer: CustomerRecord) => pending.resolve(customer),
    reject: (error: unknown) => rejectCreate(error),
  };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** 화면 요소를 강제 재마운트하는 홀더. remount()는 같은 라우트 안에서 화면 인스턴스를 새로 만든다. */
const remountHandle: { bump: () => void } = { bump: () => undefined };

function remountableScreen(element: (key: number) => React.ReactNode) {
  return function Holder() {
    const [key, setKey] = useState(0);
    remountHandle.bump = () => setKey((value) => value + 1);
    return <>{element(key)}</>;
  };
}

function makeRouter(
  port: ReturnType<typeof createInMemoryCustomerPort>,
  Screen: () => React.ReactNode,
  initialPath: string,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        element: (
          <I18nProvider locale="ko">
            <CustomerStoreProvider initialCustomers={[customerA, customerB]} port={port}>
              <SaveSessionProvider>
                <LeaveGuardDataRouterScope>
                  <Outlet />
                </LeaveGuardDataRouterScope>
              </SaveSessionProvider>
            </CustomerStoreProvider>
          </I18nProvider>
        ),
        children: [
          { path: 'customers/new', element: <Screen /> },
          { path: 'customers/:customerId/edit', element: <Screen /> },
          { path: 'customers/:customerId', element: <p>고객 상세 화면</p> },
          { path: 'schedule', element: <p>일정 화면</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  return { router, remount: () => act(() => remountHandle.bump()) };
}

describe('save session ownership (#53 MAJOR-02)', () => {
  it('A: a save started before a re-mount of the same screen still completes and navigates on success', async () => {
    const { port, create, resolve } = delayedPort();
    // 화면 요소를 key로 감싸 같은 라우트 안에서 재마운트한다.
    const { router, remount } = makeRouter(
      port,
      remountableScreen((key) => <CustomerCreatePage key={key} />),
      '/app/customers/new',
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '새 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    expect(create).toHaveBeenCalledTimes(1);

    // 회전·리사이즈로 같은 화면이 다시 마운트된다.
    remount();
    await flush();

    await act(async () => {
      resolve({
        id: 'new-customer',
        displayName: '새 고객',
        workspace: customerA.workspace,
      } as CustomerRecord);
    });
    await flush();
    await flush();
    expect(router.state.location.pathname).toBe('/app/customers/new-customer');
  });

  it('A: while the save is in flight, the re-mounted screen still locks the fields', async () => {
    const { port, create } = delayedPort();
    const { router, remount } = makeRouter(
      port,
      remountableScreen((key) => <CustomerCreatePage key={key} />),
      '/app/customers/new',
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '잠길 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    remount();
    await flush();
    const name = document.querySelector('[data-customer-field="displayName"]') as HTMLInputElement;
    expect(name).toHaveAttribute('readonly');
    fireEvent.change(name, { target: { value: '잠긴 뒤 바꾼 값' } });
    expect(name).not.toHaveValue('잠긴 뒤 바꾼 값');
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('A: after a failed save on the re-mounted screen the fields are editable again', async () => {
    const { port, create, reject } = delayedPort();
    const { router, remount } = makeRouter(
      port,
      remountableScreen((key) => <CustomerCreatePage key={key} />),
      '/app/customers/new',
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '실패할 고객' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    remount();
    await flush();
    await act(async () => {
      reject(new Error('save failed'));
    });
    await flush();
    const name = document.querySelector('[data-customer-field="displayName"]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '실패 뒤 고침' } });
    expect(name).toHaveValue('실패 뒤 고침');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('B: a save for customer A that resolves after the same screen now shows customer B does not navigate', async () => {
    const { port, edit, resolve } = delayedPort();
    // 같은 라우트 요소가 고객 대상만 바꾼다(고객 A 편집 → 고객 B 편집).
    const { router } = makeRouter(
      port,
      () => <CustomerEditPage />,
      '/app/customers/customer-a/edit',
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
      target: { value: '고객 A 수정' },
    });
    fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
    await flush();
    expect(edit).toHaveBeenCalledTimes(1);
    await act(async () => {
      void router.navigate('/app/customers/customer-b/edit');
    });
    await flush();
    // 저장 중 이탈은 확인을 거친다(#53). 사용자가 "나가기"를 고르면 같은 인스턴스가 고객 B 대상으로 바뀐다.
    const leave = screen.queryByRole('button', { name: '나가기' });
    if (leave) fireEvent.click(leave);
    await flush();
    await act(async () => {
      resolve(customerA);
    });
    await flush();
    await flush();
    expect(router.state.location.pathname).toBe('/app/customers/customer-b/edit');
  });
});
