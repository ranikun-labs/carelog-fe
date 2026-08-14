/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { classifyCarelogError } from '@/integrations/carelog/errorMapping';
import { createFixtureCustomerPort } from '@/integrations/carelog/fixturePorts';
import type { CustomerRecord } from '@/types/customer';
import {
  createCustomerStoreState,
  customerStoreReducer,
  buildCreatedCustomer,
  createCustomerId,
  type CustomerCreateInput,
  type CustomerEditInput,
} from '@/state/customerStore';
import type { CustomerPort } from '@/integrations/carelog/customerPort';

export type CustomerLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface CustomerStoreValue {
  customers: readonly CustomerRecord[];
  remoteReadsEnabled: boolean;
  getCustomer: (customerId: string) => CustomerRecord | undefined;
  refresh: () => Promise<void>;
  loadCustomer: (customerId: string) => Promise<CustomerRecord>;
  createCustomer: (input: CustomerCreateInput) => Promise<CustomerRecord>;
  editCustomer: (customerId: string, changes: CustomerEditInput) => Promise<CustomerRecord>;
  loadState: CustomerLoadState;
  detailLoadState: CustomerLoadState;
  mutationPending: boolean;
  error: unknown | null;
  errorCode: ReturnType<typeof classifyCarelogError> | null;
  clearError: () => void;
}

const CustomerStoreContext = createContext<CustomerStoreValue | null>(null);

export function CustomerStoreProvider({
  children,
  initialCustomers,
  port: providedPort,
  onFailure,
  remoteReadsEnabled: remoteReadsEnabledOverride,
}: {
  children: ReactNode;
  initialCustomers?: readonly CustomerRecord[];
  port?: CustomerPort;
  onFailure?: (error: unknown) => void;
  remoteReadsEnabled?: boolean;
}) {
  const isExplicitPort = providedPort !== undefined;
  const remoteReadsEnabled = remoteReadsEnabledOverride ?? isExplicitPort;
  const port = useMemo(
    () => providedPort ?? createFixtureCustomerPort(initialCustomers ?? CUSTOMER_FIXTURE_RECORDS),
    [initialCustomers, providedPort],
  );
  const seed = initialCustomers ?? (isExplicitPort ? [] : CUSTOMER_FIXTURE_RECORDS);
  const [state, dispatch] = useReducer(customerStoreReducer, seed, createCustomerStoreState);
  const [loadState, setLoadState] = useState<CustomerLoadState>(
    isExplicitPort && initialCustomers === undefined ? 'loading' : 'ready',
  );
  const [detailLoadState, setDetailLoadState] = useState<CustomerLoadState>('idle');
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [errorCode, setErrorCode] = useState<ReturnType<typeof classifyCarelogError> | null>(null);

  const recordError = useCallback(
    (nextError: unknown) => {
      setError(nextError);
      setErrorCode(classifyCarelogError(nextError));
      onFailure?.(nextError);
    },
    [onFailure],
  );

  const getCustomer = useCallback(
    (customerId: string) => state.customers.find((customer) => customer.id === customerId),
    [state.customers],
  );

  const refresh = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    setErrorCode(null);
    try {
      const customers = await port.list();
      dispatch({ type: 'replace-all', customers });
      setLoadState('ready');
    } catch (nextError) {
      recordError(nextError);
      setLoadState('error');
      throw nextError;
    }
  }, [port, recordError]);

  useEffect(() => {
    if (!remoteReadsEnabled || initialCustomers !== undefined) return;
    void Promise.resolve()
      .then(() => refresh())
      .catch(() => undefined);
  }, [initialCustomers, refresh, remoteReadsEnabled]);

  const createCustomer = useCallback(
    async (input: CustomerCreateInput) => {
      setMutationPending(true);
      setError(null);
      setErrorCode(null);
      try {
        if (!isExplicitPort) {
          const customer = buildCreatedCustomer(createCustomerId(state.customers), input);
          if (!customer) throw new Error('Fixture customer name is required.');
          dispatch({ type: 'create', customer });
          return customer;
        }
        const customer = await port.create(input);
        dispatch({ type: 'create', customer });
        return customer;
      } catch (nextError) {
        recordError(nextError);
        throw nextError;
      } finally {
        setMutationPending(false);
      }
    },
    [isExplicitPort, port, recordError, state.customers],
  );

  const loadCustomer = useCallback(
    async (customerId: string) => {
      setDetailLoadState('loading');
      setError(null);
      setErrorCode(null);
      try {
        const customer = await port.get(customerId);
        dispatch({ type: 'upsert', customer });
        setDetailLoadState('ready');
        return customer;
      } catch (nextError) {
        recordError(nextError);
        setDetailLoadState('error');
        throw nextError;
      }
    },
    [port, recordError],
  );

  const editCustomer = useCallback(
    async (customerId: string, changes: CustomerEditInput) => {
      const current = state.customers.find((customer) => customer.id === customerId);
      if (!current) throw new Error(`Customer is not available: ${customerId}`);
      setMutationPending(true);
      setError(null);
      setErrorCode(null);
      try {
        const customer = await port.edit(customerId, current, changes);
        dispatch({ type: 'replace', customer });
        return customer;
      } catch (nextError) {
        recordError(nextError);
        throw nextError;
      } finally {
        setMutationPending(false);
      }
    },
    [port, recordError, state.customers],
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const value = useMemo<CustomerStoreValue>(() => {
    const base = {
      customers: state.customers,
      getCustomer,
      createCustomer,
      editCustomer,
    };
    const asyncState = {
      refresh,
      loadCustomer,
      detailLoadState,
      remoteReadsEnabled,
      loadState,
      mutationPending,
      error,
      errorCode,
      clearError,
    };
    if (!isExplicitPort) {
      return Object.defineProperties(
        base,
        Object.fromEntries(
          Object.entries(asyncState).map(([key, value]) => [key, { value, enumerable: false }]),
        ),
      ) as CustomerStoreValue;
    }
    return {
      ...base,
      ...asyncState,
    };
  }, [
    clearError,
    createCustomer,
    detailLoadState,
    editCustomer,
    error,
    errorCode,
    getCustomer,
    isExplicitPort,
    loadCustomer,
    loadState,
    mutationPending,
    refresh,
    state.customers,
    remoteReadsEnabled,
  ]);

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
