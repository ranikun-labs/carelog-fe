import type { CustomerRecord, Workspace } from '@/types/customer';

export interface CustomerCreateInput {
  displayName: string;
  customerMemo?: string;
}

export interface CustomerEditInput {
  displayName: string;
  customerMemo?: string;
}

/** Legacy synchronous fixture helper retained for existing reducer consumers. */
export interface CustomerStorePort {
  customers: readonly CustomerRecord[];
  getCustomer: (customerId: string) => CustomerRecord | undefined;
  createCustomer: (input: CustomerCreateInput) => CustomerRecord | undefined;
  editCustomer: (customerId: string, changes: CustomerEditInput) => CustomerRecord | undefined;
}

export interface CustomerStoreState {
  customers: readonly CustomerRecord[];
}

export type CustomerStoreAction =
  | { type: 'create'; customer: CustomerRecord }
  | { type: 'replace'; customer: CustomerRecord }
  | { type: 'upsert'; customer: CustomerRecord }
  | { type: 'replace-all'; customers: readonly CustomerRecord[] };

export const EMPTY_CUSTOMER_WORKSPACE: Workspace = {
  id: 'workspace-local',
  name: 'Carelog',
};

export function normalizeCustomerDisplayName(value: string): string {
  return value.trim();
}

export function normalizeCustomerMemo(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function isValidCustomerDisplayName(value: string): boolean {
  return normalizeCustomerDisplayName(value).length > 0;
}

export function normalizeCustomerRecords(customers: readonly CustomerRecord[]): CustomerRecord[] {
  const seenIds = new Set<string>();
  return customers.filter((customer) => {
    if (seenIds.has(customer.id)) return false;
    seenIds.add(customer.id);
    return true;
  });
}

export function createCustomerStoreState(customers: readonly CustomerRecord[]): CustomerStoreState {
  return { customers: normalizeCustomerRecords(customers) };
}

export function customerStoreReducer(
  state: CustomerStoreState,
  action: CustomerStoreAction,
): CustomerStoreState {
  if (action.type === 'replace-all') {
    return createCustomerStoreState(action.customers);
  }

  if (action.type === 'upsert') {
    const customerIndex = state.customers.findIndex(
      (customer) => customer.id === action.customer.id,
    );
    if (customerIndex === -1) return { customers: [...state.customers, action.customer] };
    const customers = [...state.customers];
    customers[customerIndex] = action.customer;
    return { customers };
  }

  if (action.type === 'create') {
    if (state.customers.some((customer) => customer.id === action.customer.id)) return state;
    return { customers: [...state.customers, action.customer] };
  }

  const customerIndex = state.customers.findIndex((customer) => customer.id === action.customer.id);
  if (customerIndex === -1) return state;

  const customers = [...state.customers];
  customers[customerIndex] = action.customer;
  return { customers };
}

let generatedCustomerSequence = 0;

export function createCustomerId(
  existingCustomers: readonly CustomerRecord[],
  timestamp = Date.now(),
): string {
  const existingIds = new Set(existingCustomers.map((customer) => customer.id));
  while (true) {
    generatedCustomerSequence += 1;
    const candidate = `customer-${timestamp.toString(36)}-${generatedCustomerSequence.toString(36)}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

export function buildCreatedCustomer(
  id: string,
  input: CustomerCreateInput,
  workspace?: Workspace,
): CustomerRecord | undefined {
  const displayName = normalizeCustomerDisplayName(input.displayName);
  if (!displayName) return undefined;

  const customer: CustomerRecord = {
    id,
    displayName,
    ...(workspace ? { workspace } : {}),
  };
  const customerMemo = normalizeCustomerMemo(input.customerMemo);
  if (customerMemo) customer.customerMemo = customerMemo;
  return customer;
}

export function editCustomerById(
  customers: readonly CustomerRecord[],
  customerId: string,
  changes: CustomerEditInput,
): CustomerRecord | undefined {
  const current = customers.find((customer) => customer.id === customerId);
  const displayName = normalizeCustomerDisplayName(changes.displayName);
  if (!current || !displayName) return undefined;

  if (changes.customerMemo === undefined) return { ...current, displayName };

  const customerMemo = normalizeCustomerMemo(changes.customerMemo);
  if (customerMemo) return { ...current, displayName, customerMemo };

  return {
    id: current.id,
    displayName,
    ...(current.workspace ? { workspace: current.workspace } : {}),
    ...(current.context ? { context: current.context } : {}),
    ...(current.interaction ? { interaction: current.interaction } : {}),
  };
}
