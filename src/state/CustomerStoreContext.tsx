/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import type { CustomerRecord, Workspace } from '@/types/customer';
import {
  buildCreatedCustomer,
  createCustomerId,
  createCustomerStoreState,
  customerStoreReducer,
  editCustomerById,
  EMPTY_CUSTOMER_WORKSPACE,
  type CustomerCreateInput,
  type CustomerEditInput,
  type CustomerStorePort,
} from '@/state/customerStore';

export type CustomerStoreValue = CustomerStorePort;

const CustomerStoreContext = createContext<CustomerStoreValue | null>(null);

export function CustomerStoreProvider({
  children,
  initialCustomers,
  defaultWorkspace,
}: {
  children: ReactNode;
  initialCustomers?: readonly CustomerRecord[];
  defaultWorkspace?: Workspace;
}) {
  const seed = initialCustomers ?? CUSTOMER_FIXTURE_RECORDS;
  const [state, dispatch] = useReducer(customerStoreReducer, seed, createCustomerStoreState);
  const workspace = defaultWorkspace ?? state.customers[0]?.workspace;

  const getCustomer = useCallback(
    (customerId: string) => state.customers.find((customer) => customer.id === customerId),
    [state.customers],
  );

  const createCustomer = useCallback(
    (input: CustomerCreateInput) => {
      const nextWorkspace = workspace ?? EMPTY_CUSTOMER_WORKSPACE;
      const customer = buildCreatedCustomer(
        createCustomerId(state.customers),
        input,
        nextWorkspace,
      );
      if (!customer) return undefined;
      dispatch({ type: 'create', customer });
      return customer;
    },
    [state.customers, workspace],
  );

  const editCustomer = useCallback(
    (customerId: string, changes: CustomerEditInput) => {
      const customer = editCustomerById(state.customers, customerId, changes);
      if (!customer) return undefined;
      dispatch({ type: 'replace', customer });
      return customer;
    },
    [state.customers],
  );

  const value = useMemo<CustomerStoreValue>(
    () => ({
      customers: state.customers,
      getCustomer,
      createCustomer,
      editCustomer,
    }),
    [createCustomer, editCustomer, getCustomer, state.customers],
  );

  return <CustomerStoreContext.Provider value={value}>{children}</CustomerStoreContext.Provider>;
}

export function useOptionalCustomerStore(): CustomerStoreValue | null {
  return useContext(CustomerStoreContext);
}

export function useCustomerStore(): CustomerStoreValue {
  const context = useOptionalCustomerStore();
  if (!context) throw new Error('useCustomerStore must be used within CustomerStoreProvider.');
  return context;
}
