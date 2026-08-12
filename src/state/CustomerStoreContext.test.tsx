import { fireEvent, render, screen } from '@testing-library/react';

import { CustomerStoreProvider, useCustomerStore } from '@/state/CustomerStoreContext';

function SharedStateProbe() {
  const store = useCustomerStore();
  const firstCustomer = store.customers[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => store.createCustomer({ displayName: '새 고객', customerMemo: '직접 메모' })}
      >
        create
      </button>
      <p data-testid="list-customer">{store.customers.at(-1)?.displayName}</p>
      <p data-testid="detail-customer">
        {store.getCustomer(store.customers.at(-1)?.id ?? '')?.displayName}
      </p>
      <p data-testid="store-keys">{Object.keys(store).join(',')}</p>
      <p data-testid="seed-customer">{firstCustomer?.displayName}</p>
    </div>
  );
}

describe('CustomerStoreProvider', () => {
  it('supports an empty test seed and makes list/detail consumers read one state boundary', () => {
    render(
      <CustomerStoreProvider initialCustomers={[]}>
        <SharedStateProbe />
      </CustomerStoreProvider>,
    );

    expect(screen.getByTestId('seed-customer')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'create' }));

    expect(screen.getByTestId('list-customer')).toHaveTextContent('새 고객');
    expect(screen.getByTestId('detail-customer')).toHaveTextContent('새 고객');
    expect(screen.getByTestId('store-keys')).toHaveTextContent(
      'customers,getCustomer,createCustomer,editCustomer',
    );
    expect(screen.getByTestId('store-keys')).not.toHaveTextContent(/delete|archive/i);
  });
});
