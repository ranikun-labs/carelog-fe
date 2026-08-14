/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { classifyCarelogError } from '@/integrations/carelog/errorMapping';
import { createInMemoryCustomerPort } from '@/integrations/carelog/inMemoryPorts';
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
    () => providedPort ?? createInMemoryCustomerPort(initialCustomers ?? []),
    [initialCustomers, providedPort],
  );
  const seed = initialCustomers ?? [];
  const [state, dispatch] = useReducer(customerStoreReducer, seed, createCustomerStoreState);
  const [loadState, setLoadState] = useState<CustomerLoadState>(
    isExplicitPort && initialCustomers === undefined ? 'loading' : 'ready',
  );
  const [detailLoadState, setDetailLoadState] = useState<CustomerLoadState>('idle');
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [errorCode, setErrorCode] = useState<ReturnType<typeof classifyCarelogError> | null>(null);
  const mountedRef = useRef(true);
  const listReadGenerationRef = useRef(0);
  const detailReadGenerationRef = useRef(0);
  const mutationEpochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    const readGeneration = ++listReadGenerationRef.current;
    const mutationEpoch = mutationEpochRef.current;
    setLoadState('loading');
    setError(null);
    setErrorCode(null);
    try {
      const customers = await port.list();
      if (
        !mountedRef.current ||
        readGeneration !== listReadGenerationRef.current ||
        mutationEpoch !== mutationEpochRef.current
      ) {
        return;
      }
      dispatch({ type: 'replace-all', customers });
      setLoadState('ready');
    } catch (nextError) {
      if (
        !mountedRef.current ||
        readGeneration !== listReadGenerationRef.current ||
        mutationEpoch !== mutationEpochRef.current
      ) {
        return;
      }
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
          if (!customer) throw new Error('Customer name is required.');
          mutationEpochRef.current += 1;
          dispatch({ type: 'create', customer });
          return customer;
        }
        const customer = await port.create(input);
        mutationEpochRef.current += 1;
        dispatch({ type: 'create', customer });
        return customer;
      } catch (nextError) {
        if (!mountedRef.current) throw nextError;
        recordError(nextError);
        throw nextError;
      } finally {
        if (mountedRef.current) setMutationPending(false);
      }
    },
    [isExplicitPort, port, recordError, state.customers],
  );

  const loadCustomer = useCallback(
    async (customerId: string) => {
      const readGeneration = ++detailReadGenerationRef.current;
      const mutationEpoch = mutationEpochRef.current;
      setDetailLoadState('loading');
      setError(null);
      setErrorCode(null);
      try {
        const customer = await port.get(customerId);
        if (
          !mountedRef.current ||
          readGeneration !== detailReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          return customer;
        }
        dispatch({ type: 'upsert', customer });
        setDetailLoadState('ready');
        return customer;
      } catch (nextError) {
        if (
          !mountedRef.current ||
          readGeneration !== detailReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          throw nextError;
        }
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
        mutationEpochRef.current += 1;
        dispatch({ type: 'replace', customer });
        return customer;
      } catch (nextError) {
        if (!mountedRef.current) throw nextError;
        recordError(nextError);
        throw nextError;
      } finally {
        if (mountedRef.current) setMutationPending(false);
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
    if (!isExplicitPort) {
      // Keep legacy synchronous consumers' enumerable surface stable; these values are closures,
      // not ref reads. The hooks lint rule cannot distinguish this descriptor construction.
      // eslint-disable-next-line react-hooks/refs
      Object.defineProperties(base, {
        refresh: { value: refresh, enumerable: false },
        loadCustomer: { value: loadCustomer, enumerable: false },
        detailLoadState: { value: detailLoadState, enumerable: false },
        remoteReadsEnabled: { value: remoteReadsEnabled, enumerable: false },
        loadState: { value: loadState, enumerable: false },
        mutationPending: { value: mutationPending, enumerable: false },
        error: { value: error, enumerable: false },
        errorCode: { value: errorCode, enumerable: false },
        clearError: { value: clearError, enumerable: false },
      });
      return base as CustomerStoreValue;
    }
    return {
      ...base,
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
