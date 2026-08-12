import { fireEvent, render, screen } from '@testing-library/react';

import { CustomerForm } from '@/components/customers/CustomerForm';
import { I18nProvider } from '@/i18n/I18nContext';

function renderForm(mode: 'create' | 'edit' = 'create', onSubmit = vi.fn()) {
  render(
    <I18nProvider locale="ko">
      <CustomerForm
        mode={mode}
        initialValues={
          mode === 'edit' ? { displayName: '기존 고객', customerMemo: '기존 메모' } : {}
        }
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    </I18nProvider>,
  );
  return onSubmit;
}

function submitForm() {
  const form = document.querySelector<HTMLFormElement>('[data-customer-form]');
  if (!form) throw new Error('Customer form was not rendered.');
  fireEvent.submit(form);
}

describe('CustomerForm', () => {
  it('rejects a blank displayName and does not submit', () => {
    const onSubmit = renderForm();
    submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent('고객 이름을 입력해 주세요.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the required name and optional explicit memo', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '  새 고객  ' } });
    submitForm();

    expect(onSubmit).toHaveBeenCalledWith({ displayName: '새 고객', customerMemo: '' });
  });

  it('loads and submits edit fields without changing the customer identity', () => {
    const onSubmit = renderForm('edit');
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '수정 고객' } });
    fireEvent.change(screen.getByLabelText('고객 메모'), { target: { value: '' } });
    submitForm();

    expect(onSubmit).toHaveBeenCalledWith({ displayName: '수정 고객', customerMemo: '' });
    expect(screen.getByRole('button', { name: '저장' })).toBeVisible();
  });
});
