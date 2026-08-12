import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';

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

function DraftFormHarness({
  showForm = true,
  draftKey = 'create',
  initialValues = {},
  onSubmit,
  onCancel,
}: {
  showForm?: boolean;
  draftKey?: 'create' | `edit:${string}`;
  initialValues?: { displayName?: string; customerMemo?: string };
  onSubmit?: (values: CustomerFormValues) => boolean | void;
  onCancel?: () => void;
}) {
  const submitHandler = onSubmit ?? vi.fn<(values: CustomerFormValues) => void>();
  const cancelHandler = onCancel ?? vi.fn();

  return (
    <MemoryRouter initialEntries={['/app/customers/new']}>
      <I18nProvider locale="ko">
        <CustomerFormDraftProvider>
          {showForm ? (
            <CustomerForm
              mode={draftKey === 'create' ? 'create' : 'edit'}
              draftKey={draftKey}
              initialValues={initialValues}
              onSubmit={submitHandler}
              onCancel={cancelHandler}
            />
          ) : null}
        </CustomerFormDraftProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('CustomerForm', () => {
  it('rejects a blank displayName and does not submit', () => {
    const onSubmit = renderForm();
    submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent('고객 이름을 입력해 주세요.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows a valid retry after a validation failure', () => {
    const onSubmit = renderForm();
    submitForm();
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '재시도 고객' } });
    submitForm();

    expect(onSubmit).toHaveBeenCalledTimes(1);
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

  it('executes create only once when submit events arrive back-to-back', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '한 번만 생성' } });
    const form = document.querySelector<HTMLFormElement>('[data-customer-form]');
    if (!form) throw new Error('Customer form was not rendered.');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('executes edit only once when submit events arrive back-to-back', () => {
    const onSubmit = renderForm('edit');
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '한 번만 수정' } });
    const form = document.querySelector<HTMLFormElement>('[data-customer-form]');
    if (!form) throw new Error('Customer form was not rendered.');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps an unsaved draft across a form remount and clears it on cancel', () => {
    const onCancel = vi.fn();
    const view = render(<DraftFormHarness onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '보존된 고객' } });
    fireEvent.change(screen.getByLabelText('고객 메모'), { target: { value: '보존된 메모' } });

    view.rerender(<DraftFormHarness showForm={false} onCancel={onCancel} />);
    view.rerender(<DraftFormHarness onCancel={onCancel} />);
    expect(screen.getByLabelText('고객 이름')).toHaveValue('보존된 고객');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('보존된 메모');

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    view.rerender(<DraftFormHarness showForm={false} onCancel={onCancel} />);
    view.rerender(<DraftFormHarness onCancel={onCancel} />);
    expect(screen.getByLabelText('고객 이름')).toHaveValue('');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('');
  });

  it('keeps drafts independent for different customer identities', () => {
    const view = render(<DraftFormHarness />);
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '첫 고객 초안' } });

    view.rerender(
      <DraftFormHarness
        draftKey="edit:customer-b"
        initialValues={{ displayName: '두 번째 고객', customerMemo: '기존 메모' }}
      />,
    );

    expect(screen.getByLabelText('고객 이름')).toHaveValue('두 번째 고객');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('기존 메모');
  });

  it('clears a draft after an accepted submit', () => {
    const onSubmit = vi.fn();
    const view = render(<DraftFormHarness onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('고객 이름'), { target: { value: '제출 고객' } });
    submitForm();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    view.rerender(<DraftFormHarness showForm={false} onSubmit={onSubmit} />);
    view.rerender(<DraftFormHarness onSubmit={onSubmit} />);
    expect(screen.getByLabelText('고객 이름')).toHaveValue('');
    expect(screen.getByLabelText('고객 메모')).toHaveValue('');
  });
});
