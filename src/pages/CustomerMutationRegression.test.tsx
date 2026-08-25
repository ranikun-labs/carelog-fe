import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

import { CustomerCreatePage } from '@/pages/CustomerCreatePage';
import { CustomerEditPage } from '@/pages/CustomerEditPage';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import type { CustomerRecord } from '@/types/customer';

const existingCustomer: CustomerRecord = {
  id: 'customer-edit-1',
  displayName: '기존 고객',
  customerMemo: '기존 메모',
};

function createPort(overrides: Partial<CustomerPort> = {}): CustomerPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(existingCustomer),
    create: vi.fn().mockResolvedValue({ id: 'customer-created-1', displayName: '생성 고객' }),
    edit: vi.fn().mockResolvedValue({ ...existingCustomer, displayName: '수정 고객' }),
    ...overrides,
  };
}

function renderCustomerRoute(
  path: string,
  port: CustomerPort,
  initialCustomers: readonly CustomerRecord[],
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={initialCustomers} port={port}>
          <Routes>
            <Route path="/app/customers/new" element={<CustomerCreatePage />} />
            <Route path="/app/customers/:customerId/edit" element={<CustomerEditPage />} />
            <Route path="/app/customers/:customerId" element={<p>customer detail route</p>} />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('Customer create and edit mutation regression', () => {
  it('keeps Customer create pending and prevents duplicate mutation calls', () => {
    const pendingCreate = new Promise<CustomerRecord>(() => {});
    const create = vi.fn(() => pendingCreate);
    const port = createPort({ create });
    renderCustomerRoute('/app/customers/new', port, []);

    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '대기 생성 고객' } });
    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '고객 추가' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('keeps Customer create draft after failure and retries with one fresh mutation', async () => {
    const create = vi.fn().mockRejectedValue(new CarelogHttpError(503));
    const port = createPort({ create });
    renderCustomerRoute('/app/customers/new', port, []);

    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '실패 생성 고객' } });
    fireEvent.change(screen.getByLabelText('고객 메모'), { target: { value: '보존 메모' } });
    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('고객 이름')).toHaveValue('실패 생성 고객');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('보존 메모');
    expect(screen.queryByText('customer detail route')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  });

  it('keeps Customer edit in loading until the initial identity read resolves', async () => {
    let resolveGet: ((customer: CustomerRecord) => void) | undefined;
    const get = vi.fn(
      () =>
        new Promise<CustomerRecord>((resolve) => {
          resolveGet = resolve;
        }),
    );
    const port = createPort({ get });
    renderCustomerRoute('/app/customers/customer-edit-1/edit', port, []);

    await waitFor(() => expect(screen.getByRole('status')).toBeVisible());
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();

    resolveGet?.(existingCustomer);
    await waitFor(() => expect(screen.getByLabelText('고객 이름')).toHaveValue('기존 고객'));
    expect(screen.getByLabelText('고객 메모')).toHaveValue('기존 메모');
  });

  it('preserves Customer edit identity and draft after failure for a fresh retry', async () => {
    const edit = vi.fn().mockRejectedValue(new CarelogHttpError(503));
    const port = createPort({ edit });
    renderCustomerRoute('/app/customers/customer-edit-1/edit', port, [existingCustomer]);

    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '실패 수정 고객' } });
    fireEvent.change(screen.getByLabelText('고객 메모'), { target: { value: '수정 보존 메모' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await screen.findByRole('alert');
    expect(document.querySelector('[data-customer-edit-page]')).toHaveAttribute(
      'data-editing-customer-id',
      'customer-edit-1',
    );
    expect(screen.getByLabelText('고객 이름')).toHaveValue('실패 수정 고객');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('수정 보존 메모');

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  });
});
