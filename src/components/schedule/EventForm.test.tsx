import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { EventForm } from '@/components/schedule/EventForm';
import { I18nProvider } from '@/i18n/I18nContext';
import { CarelogHttpError } from '@/integrations/carelog/errors';

const now = new Date(2026, 7, 11, 12, 0, 0);

function renderForm(onSubmit = vi.fn(), props: Partial<Parameters<typeof EventForm>[0]> = {}) {
  render(
    <I18nProvider locale="ko">
      <EventForm
        mode="create"
        customerName="박세입"
        now={now}
        fixedCreateStatus="PLANNED"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  );
  return onSubmit;
}

describe('EventForm Field contract (F1)', () => {
  it('labels every control and keeps the 44px action targets', () => {
    renderForm();
    expect(screen.getByLabelText('제목')).toHaveAttribute('data-event-field', 'descriptor');
    expect(screen.getByLabelText('예정 시각')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByLabelText('메모')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByRole('button', { name: /일정 추가/ })).toHaveClass('min-h-(--control-h)');
  });

  it('links the missing-time error to the field with aria-invalid and aria-describedby', () => {
    renderForm();
    const time = screen.getByLabelText('예정 시각');
    fireEvent.change(time, { target: { value: '' } });
    fireEvent.submit(document.querySelector('[data-event-form]')!);

    const alert = screen.getByRole('alert');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(time.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);

    fireEvent.change(time, { target: { value: '2026-08-15T10:00' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(time).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the typed input and shows a danger Notice when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new CarelogHttpError(401));
    renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '계약 재확인' } });
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '방문 전 확인' } });
    fireEvent.submit(document.querySelector('[data-event-form]')!);

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveAttribute('data-slot', 'notice');
    expect(notice).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByLabelText('제목')).toHaveValue('계약 재확인');
    expect(screen.getByLabelText('메모')).toHaveValue('방문 전 확인');
    await waitFor(() =>
      expect(document.querySelector('[data-event-form]')).toHaveAttribute('aria-busy', 'false'),
    );
    expect(screen.getByLabelText('예정 시각')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('uses native radios for the kind choice and keeps the value when switching', () => {
    renderForm(vi.fn(), { fixedCreateStatus: undefined });
    const group = screen.getByRole('group', { name: '기록 방식' });
    const radios = group.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '유지' } });
    fireEvent.click(screen.getByLabelText('지금 기록'));
    expect(screen.getByLabelText('제목')).toHaveValue('유지');
    expect(screen.getByLabelText('기록 시각')).toBeInTheDocument();
  });
});
