import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMemo } from 'react';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { AUTH_STATE } from '@/auth/authTypes';
import { useOptionalAuth } from '@/auth/AuthProvider';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { FixtureStateProviders } from '@/components/layout/FixtureStateProviders';
import type {
  ProductStateProvider,
  ProductStateProviderProps,
} from '@/components/layout/ProductionStateProviders';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import { toAuthFailure } from '@/integrations/carelog/errorMapping';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import type { CustomerRecord } from '@/types/customer';

const authenticatedAuthPort = createInMemoryAuthPort({ bootstrap: 'authenticated' });

function TestAppRouter(props: React.ComponentProps<typeof AppRouter>) {
  return <AppRouter {...props} stateProviders={FixtureStateProviders} />;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createPostLoginStateProviders(customerPort: CustomerPort): ProductStateProvider {
  return function PostLoginStateProviders({ children }: ProductStateProviderProps) {
    const auth = useOptionalAuth();
    const remoteReadsEnabled = auth?.authState.status === AUTH_STATE.AUTHENTICATED;
    const reportFailure = auth?.reportFailure;
    const onFailure = useMemo(
      () => (error: unknown) => {
        const failure = toAuthFailure(error);
        if (failure) reportFailure?.(failure);
      },
      [reportFailure],
    );

    return (
      <CustomerStoreProvider
        port={customerPort}
        remoteReadsEnabled={remoteReadsEnabled}
        onFailure={onFailure}
      >
        <EventStoreProvider initialEvents={SCHEDULE_FIXTURE.events}>
          <CustomerFormDraftProvider>
            <EventCreateDraftProvider>{children}</EventCreateDraftProvider>
          </CustomerFormDraftProvider>
        </EventStoreProvider>
      </CustomerStoreProvider>
    );
  };
}

function createListCustomerPort(list: CustomerPort['list']): CustomerPort {
  return {
    list,
    get: async (customerId) => {
      const customer = CUSTOMER_FIXTURE_RECORDS.find((candidate) => candidate.id === customerId);
      if (!customer) throw new Error(`Unknown test customer: ${customerId}`);
      return customer;
    },
    create: async (input) => ({ id: 'created-test-customer', displayName: input.displayName }),
    edit: async (customerId, current, input) => ({
      ...current,
      id: customerId,
      displayName: input.displayName,
    }),
  };
}

async function signInFromLoginPage() {
  await screen.findByRole('heading', { name: 'Carelog 로그인' });
  fireEvent.change(screen.getByLabelText('계정'), { target: { value: 'owner@example.test' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'test-secret' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

describe('application router', () => {
  it('renders the schedule at the app entry and schedule path', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
  });

  it('resolves a canonical event id on the event detail route', async () => {
    render(
      <MemoryRouter initialEntries={['/app/events/event-tenant-transitioned']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
    expect(screen.getByText('예정')).toBeVisible();
    expect(screen.getByText('실제')).toBeVisible();
  });

  it('redirects root to the Korean public home', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: /고객 맥락과 후속 업무/ }),
    ).toBeInTheDocument();
  });

  it('renders English and unsupported public locale boundaries', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/en/features']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'A verifiable customer management foundation' }),
    ).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/fr']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  });

  it('marks Customers active while on the customers list route', async () => {
    render(
      <MemoryRouter initialEntries={['/app/customers']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    const activeCustomerLink = (await screen.findAllByRole('link', { name: '고객' })).find(
      (link) => link.getAttribute('aria-current') === 'page',
    );
    expect(activeCustomerLink).toHaveAttribute('aria-current', 'page');
  });

  it('resolves a known customer id on the detail route via the shared fixtures', async () => {
    render(
      <MemoryRouter initialEntries={['/app/customers/customer-tenant-1']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('박세입')).toBeVisible();
    expect(document.querySelectorAll('[data-scroll-surface]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-bottom-navigation]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-side-navigation]')).toHaveLength(1);
  });

  it('renders the app not-found surface for an unknown customer id', async () => {
    render(
      <MemoryRouter initialEntries={['/app/customers/does-not-exist']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  });

  it('renders the customer import and handoff placeholder routes', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/customers/c-1/import']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '고객 가져오기' })).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/app/customers/c-1/handoff']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '인계' })).toBeVisible();
  });

  it('renders the review detail placeholder route', async () => {
    render(
      <MemoryRouter initialEntries={['/app/reviews/r-1']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '검토' })).toBeVisible();
  });

  it('renders the follow-ups placeholder route', async () => {
    render(
      <MemoryRouter initialEntries={['/app/follow-ups']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '후속 업무' })).toBeVisible();
  });

  it('supports first-use create, detail resolution, and edit propagation from one Customer state', async () => {
    render(
      <MemoryRouter initialEntries={['/app/customers']}>
        <TestAppRouter authPort={authenticatedAuthPort} initialCustomers={[]} initialEvents={[]} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('아직 고객이 없습니다')).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: '첫 고객 추가' }));
    expect(await screen.findByRole('heading', { name: '첫 고객 추가' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('고객 이름'), {
      target: { value: '첫 번째 고객' },
    });
    fireEvent.change(screen.getByLabelText('고객 메모'), {
      target: { value: '직접 작성한 메모' },
    });
    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '첫 번째 고객' })).toBeVisible(),
    );
    expect(screen.getByTestId('customer-memo-copy')).toHaveTextContent('직접 작성한 메모');
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일정 추가' })).toBeEnabled();

    const detail = screen.getByTestId('customer-memo-copy').closest('[data-customer-detail-page]');
    const customerId = detail?.getAttribute('data-selected-customer-id');
    expect(customerId).toMatch(/^customer-/);

    fireEvent.click(screen.getByRole('link', { name: '고객 정보 수정' }));
    expect(await screen.findByRole('heading', { name: '고객 정보 수정' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('고객 이름'), {
      target: { value: '수정된 첫 고객' },
    });
    fireEvent.change(screen.getByLabelText('고객 메모'), {
      target: { value: '수정된 메모' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '수정된 첫 고객' })).toBeVisible(),
    );
    expect(
      screen
        .getByTestId('customer-memo-copy')
        .closest('[data-customer-detail-page]')
        ?.getAttribute('data-selected-customer-id'),
    ).toBe(customerId);

    fireEvent.click(screen.getByRole('button', { name: '고객 목록으로 돌아가기' }));
    expect(screen.getByText('수정된 첫 고객')).toBeVisible();
    expect(screen.queryByText('첫 번째 고객')).not.toBeInTheDocument();
  });

  it('routes Schedule Customer=0 to first-customer create without changing Event empty behavior', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <TestAppRouter authPort={authenticatedAuthPort} initialCustomers={[]} initialEvents={[]} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('먼저 고객을 추가해 주세요')).toBeVisible();
    expect(screen.getByRole('link', { name: '첫 고객 추가' })).toHaveAttribute(
      'href',
      '/app/customers/new',
    );
    unmount();

    render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
    expect(screen.queryByText('먼저 고객을 추가해 주세요')).not.toBeInTheDocument();
  });

  it('does not let a URL query override production customer or event seeds', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/customers?customerSeed=empty']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('박세입')).toBeVisible();
    expect(screen.queryByText('아직 고객이 없습니다')).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/app/events/event-tenant-transitioned?eventSeed=empty']}>
        <TestAppRouter authPort={authenticatedAuthPort} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
  });

  it('waits for the post-login customer read before routing a returning customer to Schedule', async () => {
    const request = createDeferred<readonly CustomerRecord[]>();
    const list = vi.fn(() => request.promise);
    const authPort = createInMemoryAuthPort({ bootstrap: 'anonymous' });
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AppRouter
          authPort={authPort}
          stateProviders={createPostLoginStateProviders(createListCustomerPort(list))}
        />
      </MemoryRouter>,
    );

    await signInFromLoginPage();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('고객 정보를 불러오는 중입니다');
    expect(screen.queryByText('아직 고객이 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '일정' })).not.toBeInTheDocument();

    await act(async () => {
      request.resolve(CUSTOMER_FIXTURE_RECORDS.slice(0, 1));
      await request.promise;
    });
    expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
  });

  it('routes a post-login empty customer result to Customers only after the read is ready', async () => {
    const request = createDeferred<readonly CustomerRecord[]>();
    const list = vi.fn(() => request.promise);
    const authPort = createInMemoryAuthPort({ bootstrap: 'anonymous' });
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AppRouter
          authPort={authPort}
          stateProviders={createPostLoginStateProviders(createListCustomerPort(list))}
        />
      </MemoryRouter>,
    );

    await signInFromLoginPage();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('고객 정보를 불러오는 중입니다');
    expect(screen.queryByText('아직 고객이 없습니다')).not.toBeInTheDocument();

    await act(async () => {
      request.resolve([]);
      await request.promise;
    });
    expect(await screen.findByText('아직 고객이 없습니다')).toBeVisible();
    expect(screen.getByRole('link', { name: '첫 고객 추가' })).toBeVisible();
  });

  it('routes a customer read failure to the mapped Customers retry path', async () => {
    const failedRead = createDeferred<readonly CustomerRecord[]>();
    const list = vi
      .fn<CustomerPort['list']>()
      .mockImplementationOnce(() => failedRead.promise)
      .mockResolvedValueOnce(CUSTOMER_FIXTURE_RECORDS.slice(0, 1));
    const authPort = createInMemoryAuthPort({ bootstrap: 'anonymous' });
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AppRouter
          authPort={authPort}
          stateProviders={createPostLoginStateProviders(createListCustomerPort(list))}
        />
      </MemoryRouter>,
    );

    await signInFromLoginPage();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await act(async () => {
      failedRead.reject(new CarelogHttpError(503));
      await failedRead.promise.catch(() => undefined);
    });
    expect(
      await screen.findByText('서비스가 잠시 응답하지 않습니다. 데이터는 보존됩니다.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByRole('link', { name: '첫 고객 추가' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('박세입')).toBeVisible();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing auth recovery flow for a post-login customer 401', async () => {
    const list = vi
      .fn<CustomerPort['list']>()
      .mockRejectedValueOnce(new CarelogHttpError(401))
      .mockResolvedValueOnce(CUSTOMER_FIXTURE_RECORDS.slice(0, 1));
    const authPort = createInMemoryAuthPort({
      bootstrap: 'anonymous',
      recoveryDelayMs: 50,
    });
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AppRouter
          authPort={authPort}
          stateProviders={createPostLoginStateProviders(createListCustomerPort(list))}
        />
      </MemoryRouter>,
    );

    await signInFromLoginPage();
    expect(await screen.findByText('세션을 복구하는 중입니다')).toBeVisible();
    expect(await screen.findByRole('heading', { name: '일정' })).toBeVisible();
    expect(authPort.recoveryAttemptCount).toBe(1);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
