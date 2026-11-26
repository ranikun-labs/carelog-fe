import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerRecord } from '@/types/customer';
import { LeaveGuardDataRouterScope } from '@/components/common/LeaveGuard';
import {
  AdaptiveHostProvider,
  type AdaptiveHostContextValue,
} from '@/components/layout/adaptiveHostContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { EventCreatePage } from '@/pages/EventCreatePage';
import { SchedulePage } from '@/pages/SchedulePage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';

const now = new Date(2026, 7, 11, 12, 0, 0);
const customer: CustomerRecord = {
  id: 'customer-1',
  displayName: '박세입',
  workspace: { id: 'workspace-1', name: 'Carelog' },
};

/** 저장 응답을 테스트가 직접 늦게 돌려주는 port. create만 지연된다. */
function delayedPort() {
  let resolveCreate: (event: CustomerEvent) => void = () => undefined;
  const create = vi.fn(
    () =>
      new Promise<CustomerEvent>((resolve) => {
        resolveCreate = resolve;
      }),
  );
  const port = {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create,
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
  return { port, create, resolve: (event: CustomerEvent) => resolveCreate(event) };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('late save response after leaving the create screen (MAJOR-01 #53)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('control: when the screen stays mounted, a successful save does return to the schedule host', async () => {
    const { port, create, resolve } = delayedPort();
    const adaptiveHost = {
      mode: 'two-pane',
      availableWidth: 1360,
      isLandscape: true,
      isCoVisible: false,
      activeRoot: 'schedule',
      schedule: { selectedDateKey: '2026-08-15', selectedEventId: null, scrollTop: 0 },
      returnFromEvent: vi.fn(),
    } as unknown as AdaptiveHostContextValue;
    render(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={[customer]}>
            <EventStoreProvider port={port as never}>
              <EventCreateDraftProvider>
                <AdaptiveHostProvider value={adaptiveHost as never}>
                  <EventCreatePage now={now} />
                </AdaptiveHostProvider>
              </EventCreateDraftProvider>
            </EventStoreProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '박세입' }));
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: '대조 일정' },
    });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({
        id: 'control-event',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T13:00:00+09:00',
        descriptor: '대조 일정',
      });
    });
    await flush();
    await flush();
    expect(adaptiveHost.returnFromEvent).toHaveBeenCalledTimes(1);
  });

  it('does not return the user to the schedule (desktop two-pane host) when the save resolves after they left', async () => {
    const { port, create, resolve } = delayedPort();
    // 데스크톱 두 화면: 어댑티브 호스트(살아 있는 쪽)가 일정 화면으로 되돌리는 경로를 흉내 낸다.
    const adaptiveHost = {
      mode: 'two-pane',
      availableWidth: 1360,
      isLandscape: true,
      isCoVisible: false,
      activeRoot: 'schedule',
      schedule: { selectedDateKey: '2026-08-15', selectedEventId: null, scrollTop: 0 },
      returnFromEvent: vi.fn(),
    } as unknown as AdaptiveHostContextValue;
    const router = createMemoryRouter(
      [
        {
          // 제품과 같이 공급자는 라우트 위에 둔다(화면을 떠나도 스토어는 살아 있다).
          path: '/app',
          element: (
            <I18nProvider locale="ko">
              <CustomerStoreProvider initialCustomers={[customer]}>
                <EventStoreProvider port={port as never}>
                  <EventCreateDraftProvider>
                    <AdaptiveHostProvider value={adaptiveHost as never}>
                      <LeaveGuardDataRouterScope>
                        <Link to="/app/customers/new">고객 등록으로</Link>
                        <Outlet />
                      </LeaveGuardDataRouterScope>
                    </AdaptiveHostProvider>
                  </EventCreateDraftProvider>
                </EventStoreProvider>
              </CustomerStoreProvider>
            </I18nProvider>
          ),
          children: [
            { path: 'events/new', element: <EventCreatePage now={now} /> },
            {
              path: 'schedule',
              element: (
                <SchedulePage now={now} customers={[{ id: 'customer-1', displayName: '박세입' }]} />
              ),
            },
            { path: 'customers/new', element: <p>고객 등록 화면</p> },
          ],
        },
      ],
      { initialEntries: ['/app/events/new'] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('button', { name: '박세입' }));
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: '늦은 응답 일정' },
    });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await flush();
    expect(create).toHaveBeenCalledTimes(1);

    // 저장이 끝나기 전에 다른 화면(고객 등록)으로 떠난다. 저장 중 이탈은 확인을 거친다("나가기").
    fireEvent.click(screen.getByRole('link', { name: '고객 등록으로' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    await flush();
    expect(screen.getByText('고객 등록 화면')).toBeInTheDocument();

    // 늦은 저장 응답이 도착한다. 떠난 화면은 일정 화면으로 되돌리면 안 된다.
    await act(async () => {
      resolve({
        id: 'late-event',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T13:00:00+09:00',
        descriptor: '늦은 응답 일정',
      });
    });
    await flush();
    await flush();
    expect(router.state.location.pathname).toBe('/app/customers/new');
    expect(adaptiveHost.returnFromEvent).not.toHaveBeenCalled();
    expect(screen.getByText('고객 등록 화면')).toBeInTheDocument();
  });
});
