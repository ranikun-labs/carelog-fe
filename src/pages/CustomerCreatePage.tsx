import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import {
  CustomerForm,
  type CustomerFormSubmitOptions,
  type CustomerFormValues,
} from '@/components/customers/CustomerForm';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface } from '@/components/layout/adaptiveHostContext';
import { buildAppCustomerDetailPath, buildAppCustomersPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomerCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 저장 응답이 떠난 뒤 도착할 수 있다. 떠난 화면은 상세로 되돌리지 않는다.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const customerStore = useCustomerStore();

  async function handleSubmit(values: CustomerFormValues, options: CustomerFormSubmitOptions) {
    const customer = await customerStore.createCustomer(values);
    if (!mountedRef.current) return true;
    // 저장 성공을 확인한 뒤 상세로 옮기므로 이탈 보호를 먼저 놓는다.
    options.allowLeave();

    navigate(buildAppCustomerDetailPath(customer.id), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: customer.id,
      },
    });
    return true;
  }

  return (
    <AdaptiveSurface
      majorSurface="customer-form"
      data-customer-create-page
      className="flex h-full flex-col"
    >
      <PageHeader
        title={t('customers.form.createTitle')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <div className="flex-1 scroll-pb-28 overflow-y-auto p-6">
        <CustomerForm
          mode="create"
          draftKey="create"
          onSubmit={handleSubmit}
          onCancel={() => navigate(buildAppCustomersPath())}
        />
      </div>
    </AdaptiveSurface>
  );
}
