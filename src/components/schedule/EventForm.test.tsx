import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { EventForm } from '@/components/schedule/EventForm';
import { I18nProvider } from '@/i18n/I18nContext';
import { CarelogHttpError } from '@/integrations/carelog/errors';

const now = new Date(2026, 7, 11, 12, 0, 0);

beforeEach(() => {
  // 픽스처 시각을 기준 시각으로 고정한다. 과거 시각 검사가 실제 현재 시각(Date.now)을 보기 때문이다.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

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

  it('validates in the app only: noValidate keeps the browser bubble away, same error, focus on the field', () => {
    const onValidationFailure = vi.fn();
    const onSubmit = renderForm(vi.fn(), { onValidationFailure });
    const form = document.querySelector('[data-event-form]') as HTMLFormElement;
    const time = screen.getByLabelText('예정 시각');

    // 브라우저 기본 검증 말풍선을 끄되, 필수 표시(required)는 입력에 그대로 남는다.
    expect(form.noValidate).toBe(true);
    expect(time).toBeRequired();

    fireEvent.change(time, { target: { value: '' } });
    fireEvent.submit(form);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValidationFailure).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('예정 시각');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(time).toHaveFocus();
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

describe('EventForm past time at submit (F3 C-03)', () => {
  it('blocks a new PLANNED event whose time passed while the form stayed open, with focus on the field', () => {
    const onSubmit = renderForm();
    const time = screen.getByLabelText('예정 시각');
    fireEvent.change(time, { target: { value: '2026-08-11T13:00' } });

    // 폼을 열어 둔 채 시간이 흘러 제출 시점에는 같은 입력값이 과거가 된다.
    vi.setSystemTime(new Date(2026, 7, 11, 13, 30, 0));
    fireEvent.submit(document.querySelector('[data-event-form]')!);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('지난 시각으로는 새 일정을 저장할 수 없어요');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(time).toHaveFocus();
  });

  it('clears the past-time error once a new time is entered', () => {
    const onSubmit = renderForm();
    const time = screen.getByLabelText('예정 시각');
    fireEvent.change(time, { target: { value: '2026-08-11T11:00' } });
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    expect(screen.getByRole('alert')).toBeVisible();

    fireEvent.change(time, { target: { value: '2026-08-11T15:00' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps accepting a past scheduled time when editing an existing PLANNED event', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nProvider locale="ko">
        <EventForm
          mode="edit"
          customerName="박세입"
          now={now}
          event={{
            id: 'past-planned',
            customerId: 'customer-1',
            status: 'PLANNED',
            scheduledAt: '2026-08-10T09:00:00+09:00',
          }}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.submit(document.querySelector('[data-event-form]')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
