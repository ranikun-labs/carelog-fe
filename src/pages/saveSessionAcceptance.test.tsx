import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Link, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { LeaveGuardDataRouterScope } from '@/components/common/LeaveGuard';
import {
  AdaptiveHostProvider,
  type AdaptiveHostContextValue,
} from '@/components/layout/adaptiveHostContext';
import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';
import {
  createInMemoryCustomerEventPort,
  createInMemoryCustomerPort,
} from '@/integrations/carelog/inMemoryPorts';
import { CustomerCreatePage } from '@/pages/CustomerCreatePage';
import { CustomerEditPage } from '@/pages/CustomerEditPage';
import { EventCreatePage } from '@/pages/EventCreatePage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import { SaveSessionProvider } from '@/state/saveSessionContext';
import type { CustomerRecord } from '@/types/customer';

const now = new Date(2026, 7, 11, 12, 0, 0);
const workspace = { id: 'workspace-1', name: 'Carelog' };
const customerA: CustomerRecord = { id: 'customer-a', displayName: '고객 A', workspace };
const customerB: CustomerRecord = { id: 'customer-b', displayName: '고객 B', workspace };
const eventA: CustomerEvent = {
  id: 'event-a',
  customerId: 'customer-a',
  status: 'PLANNED',
  scheduledAt: '2026-08-12T10:00:00+09:00',
  descriptor: '일정 A',
};
const eventB: CustomerEvent = {
  id: 'event-b',
  customerId: 'customer-a',
  status: 'PLANNED',
  scheduledAt: '2026-08-13T10:00:00+09:00',
  descriptor: '일정 B',
};

/** 응답을 테스트가 직접 늦게 돌려주는 port(생성·수정). */
function delayed<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const fn = vi.fn(
    () =>
      new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return { fn, resolve: (value: T) => resolve(value), reject: (error: unknown) => reject(error) };
}

function delayedCustomerPort() {
  const base = createInMemoryCustomerPort([customerA, customerB]);
  const create = delayed<CustomerRecord>();
  const edit = delayed<CustomerRecord>();
  const port = { ...base, create: create.fn, edit: edit.fn } as unknown as ReturnType<
    typeof createInMemoryCustomerPort
  >;
  return { port, create, edit };
}

function delayedEventPort() {
  const base = createInMemoryCustomerEventPort([eventA, eventB]);
  const create = delayed<CustomerEvent>();
  const edit = delayed<CustomerEvent>();
  const port = { ...base, create: create.fn, edit: edit.fn } as unknown as ReturnType<
    typeof createInMemoryCustomerEventPort
  >;
  return { port, create, edit };
}

const adaptiveHostStub = {
  mode: 'two-pane',
  availableWidth: 1360,
  isLandscape: true,
  isCoVisible: false,
  activeRoot: 'schedule',
  schedule: { selectedDateKey: '2026-08-15', selectedEventId: null, scrollTop: 0 },
  returnFromEvent: vi.fn(),
  setScheduleDate: vi.fn(),
} as unknown as AdaptiveHostContextValue;

/**
 * 실제 배치 순서(제품과 같다): 고객 드래프트 > 저장 세션 > 일정 생성 드래프트 > 라우트.
 * 화면은 key로 재마운트할 수 있다(회전·리사이즈 흉내).
 */
/** 화면 재마운트 핸들(build가 설정한다). */
let bumpRemount: () => void = () => undefined;

/** 화면 요소를 감싸 key를 올리면 같은 라우트 안에서 화면이 새로 마운트된다. */
function Holder({ children }: { children: (key: number) => React.ReactNode }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    bumpRemount = () => setKey((value) => value + 1);
  }, []);
  return <>{children(key)}</>;
}

function build(
  ports: {
    customer: ReturnType<typeof delayedCustomerPort>;
    event: ReturnType<typeof delayedEventPort>;
  },
  path: string,
  withAdaptiveHost = false,
) {
  const withHost = (node: React.ReactNode) =>
    withAdaptiveHost ? (
      <AdaptiveHostProvider value={adaptiveHostStub}>{node}</AdaptiveHostProvider>
    ) : (
      node
    );
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        element: (
          <I18nProvider locale="ko">
            <CustomerStoreProvider
              initialCustomers={[customerA, customerB]}
              port={ports.customer.port}
            >
              <EventStoreProvider port={ports.event.port as never} initialEvents={[eventA, eventB]}>
                <CustomerFormDraftProvider>
                  <SaveSessionProvider>
                    <EventCreateDraftProvider>
                      <LeaveGuardDataRouterScope>
                        <nav>
                          <Link to="/app/other">다른 화면</Link>
                        </nav>
                        {withHost(<Outlet />)}
                      </LeaveGuardDataRouterScope>
                    </EventCreateDraftProvider>
                  </SaveSessionProvider>
                </CustomerFormDraftProvider>
              </EventStoreProvider>
            </CustomerStoreProvider>
          </I18nProvider>
        ),
        children: [
          {
            path: 'events/new',
            element: <Holder>{(key) => <EventCreatePage key={key} now={now} />}</Holder>,
          },
          {
            path: 'customers/new',
            element: <Holder>{(key) => <CustomerCreatePage key={key} />}</Holder>,
          },
          { path: 'customers/:customerId/edit', element: <CustomerEditPage /> },
          { path: 'events/:eventId', element: <EventDetailPage now={now} /> },
          { path: 'schedule', element: <p>일정 화면</p> },
          { path: 'other', element: <p>다른 화면</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return { router, remount: () => act(() => bumpRemount()) };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('save session acceptance (#53 Delta MAJOR-01)', () => {
  describe('A. same screen re-mount (rotation / resize)', () => {
    it('customer form: fields stay locked and an internal link asks first while the save is in flight', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/customers/new');
      render(<RouterProvider router={router} />);
      fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
        target: { value: '잠길 고객' },
      });
      fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
      await flush();
      expect(ports.customer.create.fn).toHaveBeenCalledTimes(1);
      remount();
      await flush();
      const name = document.querySelector(
        '[data-customer-field="displayName"]',
      ) as HTMLInputElement;
      expect(name).toHaveAttribute('readonly');
      fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
      await flush();
      expect(router.state.location.pathname).toBe('/app/customers/new');
      expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
    });

    it('customer form: beforeunload is still prevented while the save is in flight after a re-mount', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/customers/new');
      render(<RouterProvider router={router} />);
      fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
        target: { value: '새로고침 고객' },
      });
      fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
      await flush();
      remount();
      await flush();
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
    });

    it('customer form: after a successful save the parent navigates without a dialog', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/customers/new');
      render(<RouterProvider router={router} />);
      fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
        target: { value: '성공 고객' },
      });
      fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
      await flush();
      remount();
      await flush();
      await act(async () => {
        ports.customer.create.resolve({ id: 'new-one', displayName: '성공 고객', workspace });
      });
      await flush();
      await flush();
      expect(router.state.location.pathname).toBe('/app/customers/new-one');
      expect(screen.queryByText('작성 중인 내용이 사라져요')).not.toBeInTheDocument();
    });

    it('customer form: after a failed save on the re-mounted screen the input stays and the form can retry', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/customers/new');
      render(<RouterProvider router={router} />);
      fireEvent.change(document.querySelector('[data-customer-field="displayName"]')!, {
        target: { value: '실패 고객' },
      });
      fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
      await flush();
      remount();
      await flush();
      await act(async () => {
        ports.customer.create.reject(new Error('save failed'));
      });
      await flush();
      const name = document.querySelector(
        '[data-customer-field="displayName"]',
      ) as HTMLInputElement;
      expect(name).not.toHaveAttribute('readonly');
      expect(name).toHaveValue('실패 고객');
      fireEvent.click(document.querySelector('[data-customer-form-submit]')!);
      await flush();
      expect(ports.customer.create.fn).toHaveBeenCalledTimes(2);
    });

    it('event create: a re-submit after a re-mount does not send a second request', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/events/new', true);
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByRole('button', { name: '고객 A' }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '중복 일정' },
      });
      fireEvent.change(document.querySelector('[data-event-field="scheduledAt"]')!, {
        target: { value: '2026-12-01T10:00' },
      });
      fireEvent.submit(document.querySelector('[data-event-form]')!);
      await flush();
      expect(ports.event.create.fn).toHaveBeenCalledTimes(1);
      remount();
      await flush();
      fireEvent.submit(document.querySelector('[data-event-form]')!);
      await flush();
      expect(ports.event.create.fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('B. real leave and re-entry', () => {
    it('event create: the header back asks first, and staying keeps the draft', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router, remount } = build(ports, '/app/events/new');
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByRole('button', { name: '고객 A' }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '초안 제목' },
      });
      fireEvent.click(screen.getByRole('button', { name: '일정으로 돌아가기' }));
      await flush();
      expect(screen.getByText('작성 중인 내용이 사라져요')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '계속 작성' }));
      await flush();
      expect(router.state.location.pathname).toBe('/app/events/new');
      // 머무르기를 골랐으므로 초안은 남아 있어야 한다(다시 마운트해도 같은 초안).
      remount();
      await flush();
      expect(document.querySelector('[data-event-field="descriptor"]')).toHaveValue('초안 제목');
    });

    it('event create: a late response of a left visit does not move, clear, or lock the re-entered visit', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router } = build(ports, '/app/events/new');
      render(<RouterProvider router={router} />);
      fireEvent.click(screen.getByRole('button', { name: '고객 A' }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '떠날 일정' },
      });
      fireEvent.change(document.querySelector('[data-event-field="scheduledAt"]')!, {
        target: { value: '2026-12-01T10:00' },
      });
      fireEvent.submit(document.querySelector('[data-event-form]')!);
      await flush();
      expect(ports.event.create.fn).toHaveBeenCalledTimes(1);
      // 저장 중 떠난다: 가드 확인 뒤 "나가기".
      fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
      await flush();
      fireEvent.click(screen.getByRole('button', { name: '나가기' }));
      await flush();
      expect(router.state.location.pathname).toBe('/app/other');
      // 같은 대상(일정 생성)으로 다시 들어온다 = 새 방문.
      await act(async () => {
        await router.navigate('/app/events/new');
      });
      await flush();
      fireEvent.click(screen.getByRole('button', { name: '고객 A' }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '새 방문 제목' },
      });
      fireEvent.change(document.querySelector('[data-event-field="scheduledAt"]')!, {
        target: { value: '2026-12-02T10:00' },
      });
      // 떠난 방문의 늦은 응답이 도착한다.
      await act(async () => {
        ports.event.create.resolve({
          id: 'late-created',
          customerId: 'customer-a',
          status: 'PLANNED',
          scheduledAt: '2026-12-01T10:00:00+09:00',
          descriptor: '떠날 일정',
        });
      });
      await flush();
      await flush();
      expect(router.state.location.pathname).toBe('/app/events/new');
      expect(document.querySelector('[data-event-field="descriptor"]')).toHaveValue('새 방문 제목');
      expect(document.querySelector('[data-event-field="descriptor"]')).not.toHaveAttribute(
        'readonly',
      );
    });
  });

  describe('C. event A saving while event B is shown', () => {
    it('a late response of event A does not close or move the editor of event B', async () => {
      const ports = { customer: delayedCustomerPort(), event: delayedEventPort() };
      const { router } = build(ports, '/app/events/event-a');
      render(<RouterProvider router={router} />);
      fireEvent.click(await screen.findByRole('button', { name: /수정/ }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '수정 A' },
      });
      fireEvent.submit(document.querySelector('[data-event-form]')!);
      await flush();
      expect(ports.event.edit.fn).toHaveBeenCalledTimes(1);
      // 저장 중 일정 B로 전환한다: 가드 확인 뒤 "나가기".
      await act(async () => {
        void router.navigate('/app/events/event-b');
      });
      await flush();
      fireEvent.click(screen.getByRole('button', { name: '나가기' }));
      await flush();
      expect(router.state.location.pathname).toBe('/app/events/event-b');
      // B의 편집창을 연다(B 대상으로 새로 시작) 그리고 입력한다.
      fireEvent.click(await screen.findByRole('button', { name: /수정/ }));
      fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
        target: { value: '수정 B' },
      });
      await act(async () => {
        ports.event.edit.resolve({ ...eventA, descriptor: '수정 A' });
      });
      await flush();
      await flush();
      expect(router.state.location.pathname).toBe('/app/events/event-b');
      const after = document.querySelector(
        '[data-event-field="descriptor"]',
      ) as HTMLInputElement | null;
      expect(after).not.toBeNull();
      expect(after).toHaveValue('수정 B');
    });
  });
});
