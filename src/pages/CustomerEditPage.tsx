import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  CustomerForm,
  type CustomerFormSubmitOptions,
  type CustomerFormValues,
} from '@/components/customers/CustomerForm';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface } from '@/components/layout/adaptiveHostContext';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalSaveSession } from '@/state/saveSessionContext';

export function CustomerEditPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const customerStore = useCustomerStore();
  const customer = customerStore.getCustomer(customerId);
  // 저장 응답이 떠난 뒤 도착할 수 있다. 떠난 화면은 상세로 되돌리지 않는다.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // 저장 세션: 지금 보이는 고객 대상을 등록한다. 대상이 바뀌면 이전 대상의 응답은 소유권을 잃는다.
  const session = useOptionalSaveSession();
  const setActive = session?.setActive;
  const saveKey = `customer:${customerId}`;
  useEffect(() => {
    if (!setActive) return;
    setActive(saveKey, true);
    return () => setActive(saveKey, false);
  }, [saveKey, setActive]);

  useEffect(() => {
    if (!customerStore.remoteReadsEnabled || customer || !customerId) return;
    if (customerStore.detailLoadState !== 'idle') return;
    void customerStore.loadCustomer(customerId).catch(() => undefined);
  }, [customer, customerId, customerStore]);

  if (!customer) {
    if (customerStore.detailLoadState === 'loading' || customerStore.loadState === 'loading') {
      return (
        <div role="status" aria-busy="true" className="p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    if (customerStore.error) {
      return (
        <div role="alert" className="p-6">
          {t(getCarelogMessageKey(customerStore.error))}
        </div>
      );
    }
    return <AppNotFoundPage />;
  }
  const currentCustomer = customer;

  async function handleSubmit(values: CustomerFormValues, options: CustomerFormSubmitOptions) {
    const updatedCustomer = await customerStore.editCustomer(currentCustomer.id, values);
    const current = options.isCurrent ? options.isCurrent() : mountedRef.current;
    if (!current) return true;
    // 저장 성공을 확인한 뒤 상세로 옮기므로 이탈 보호를 먼저 놓는다.
    options.allowLeave();

    navigate(buildAppCustomerDetailPath(updatedCustomer.id), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: updatedCustomer.id,
      },
    });
    return true;
  }

  return (
    <AdaptiveSurface
      majorSurface="customer-form"
      data-customer-edit-page
      data-editing-customer-id={currentCustomer.id}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={t('customers.form.editTitle')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomerDetailPath(currentCustomer.id))}
      />
      <div className="flex-1 scroll-pb-28 overflow-y-auto p-6">
        <CustomerForm
          mode="edit"
          saveKey={saveKey}
          draftKey={`edit:${currentCustomer.id}`}
          initialValues={{
            displayName: currentCustomer.displayName,
            customerMemo: currentCustomer.customerMemo ?? '',
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(buildAppCustomerDetailPath(currentCustomer.id))}
        />
      </div>
    </AdaptiveSurface>
  );
}
