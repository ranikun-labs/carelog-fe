import {
  buildCreatedCustomer,
  createCustomerStoreState,
  editCustomerById,
  EMPTY_CUSTOMER_WORKSPACE,
  isValidCustomerDisplayName,
  customerStoreReducer,
} from '@/state/customerStore';
import { landlordTenantScenario } from '@/fixtures/scenarios';
import type { CustomerRecord } from '@/types/customer';

const existingCustomer: CustomerRecord = {
  ...landlordTenantScenario.customer,
  workspace: landlordTenantScenario.workspace,
  context: landlordTenantScenario.context,
  interaction: landlordTenantScenario.interaction,
};

describe('CustomerStore application port', () => {
  it('keeps an explicit empty seed empty and preserves existing seeds', () => {
    expect(createCustomerStoreState([]).customers).toEqual([]);
    expect(createCustomerStoreState([existingCustomer]).customers).toEqual([existingCustomer]);
  });

  it('creates a stable customer record with a trimmed required name', () => {
    const customer = buildCreatedCustomer(
      'customer-new',
      { displayName: '  새 고객  ', customerMemo: '  직접 남긴 메모  ' },
      EMPTY_CUSTOMER_WORKSPACE,
    );

    expect(customer).toMatchObject({
      id: 'customer-new',
      displayName: '새 고객',
      customerMemo: '직접 남긴 메모',
    });
    expect(
      customerStoreReducer(createCustomerStoreState([]), { type: 'create', customer: customer! })
        .customers,
    ).toHaveLength(1);
  });

  it('rejects a blank displayName and allows an omitted memo', () => {
    expect(isValidCustomerDisplayName(' \n\t')).toBe(false);
    expect(
      buildCreatedCustomer('customer-blank', { displayName: '  ' }, EMPTY_CUSTOMER_WORKSPACE),
    ).toBeUndefined();

    const customer = buildCreatedCustomer(
      'customer-without-memo',
      { displayName: '메모 없는 고객' },
      EMPTY_CUSTOMER_WORKSPACE,
    );
    expect(customer).not.toHaveProperty('customerMemo');
  });

  it('edits displayName and memo in place without changing identity or legacy context', () => {
    const seeded = { ...existingCustomer, customerMemo: '기존 메모' };
    const updated = editCustomerById([seeded], seeded.id, {
      displayName: '수정된 고객',
      customerMemo: '수정된 메모',
    });

    expect(updated).toMatchObject({
      id: seeded.id,
      displayName: '수정된 고객',
      customerMemo: '수정된 메모',
      context: seeded.context,
      interaction: seeded.interaction,
    });
  });

  it('clears an empty memo without synthesizing one from CustomerContext', () => {
    const seeded = { ...existingCustomer, customerMemo: '지울 메모' };
    const cleared = editCustomerById([seeded], seeded.id, {
      displayName: seeded.displayName,
      customerMemo: '   ',
    });

    expect(cleared).not.toHaveProperty('customerMemo');
    expect(cleared).toMatchObject({ context: existingCustomer.context });
  });

  it('never promotes legacy CustomerContext summary into customerMemo', () => {
    const customer = buildCreatedCustomer(
      'customer-context-only',
      { displayName: '맥락만 있는 고객' },
      EMPTY_CUSTOMER_WORKSPACE,
    );

    expect(customer).not.toHaveProperty('customerMemo');
    expect(landlordTenantScenario.context.summary).not.toBe(customer?.customerMemo);
  });

  it('does not expose delete or archive actions in the reducer boundary', () => {
    const state = createCustomerStoreState([existingCustomer]);
    expect(Object.keys(state)).toEqual(['customers']);
    expect(
      Object.keys(customerStoreReducer(state, { type: 'replace', customer: existingCustomer })),
    ).toEqual(['customers']);
  });
});
