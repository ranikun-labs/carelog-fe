import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { EventForm } from '@/components/schedule/EventForm';
import { I18nProvider } from '@/i18n/I18nContext';
import { CarelogHttpError } from '@/integrations/carelog/errors';

const now = new Date(2026, 7, 11, 12, 0, 0);
// 기준 시각을 테스트가 직접 바꾼다(시계 전체 고정 대신 주입). 제출 검사는 이 값을 읽는다.
let clockNow = now;
const getNow = () => clockNow;

beforeEach(() => {
  clockNow = now;
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
        getNow={getNow}
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

function setTime(value: string) {
  fireEvent.change(screen.getByLabelText('예정 시각'), { target: { value } });
}

function submitForm() {
  fireEvent.submit(document.querySelector('[data-event-form]')!);
}

describe('EventForm past or current scheduled time for a new PLANNED event (Owner 2026-11-26)', () => {
  it.each([
    ['same minute as now', '2026-08-11T12:00', true],
    ['one minute before now', '2026-08-11T11:59', true],
    ['one minute after now', '2026-08-11T12:01', false],
  ])('%s is blocked=%s', async (_label, value, blocked) => {
    const onSubmit = renderForm();
    setTime(value);
    submitForm();
    if (blocked) {
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('지난 시각으로는 새 일정을 저장할 수 없어요');
    } else {
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).toBeNull();
    }
  });

  it('compares by minute: a now with seconds still blocks the same minute and allows the next', async () => {
    clockNow = new Date(2026, 7, 11, 12, 0, 30);
    const onSubmit = renderForm();
    setTime('2026-08-11T12:00');
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    setTime('2026-08-11T12:01');
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('handles the date boundary at midnight: the minute before is blocked, the next day 00:00 is allowed once it is later', async () => {
    clockNow = new Date(2026, 7, 11, 23, 59, 30);
    const onSubmit = renderForm();
    setTime('2026-08-11T23:59');
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    setTime('2026-08-12T00:00');
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('blocks exactly the midnight minute when it is the current time', () => {
    clockNow = new Date(2026, 7, 12, 0, 0, 0);
    const onSubmit = renderForm();
    setTime('2026-08-12T00:00');
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeVisible();
  });

  it('blocks a time that was in the future when the form opened but passed before submit', () => {
    const onSubmit = renderForm();
    setTime('2026-08-11T13:00');
    clockNow = new Date(2026, 7, 11, 13, 0, 0);
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('예정 시각')).toHaveFocus();
    expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-08-11T13:00');
  });

  it('keeps the typed input and focus after a past-time block, then allows a corrected time', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '계약 확인' } });
    setTime('2026-08-11T11:00');
    submitForm();
    expect(screen.getByLabelText('제목')).toHaveValue('계약 확인');
    setTime('2026-08-11T14:00');
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('keeps the input when the save itself fails after the time passed the check', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new CarelogHttpError(500));
    renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '저장 실패 일정' } });
    setTime('2026-08-11T15:00');
    submitForm();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('제목')).toHaveValue('저장 실패 일정');
    expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-08-11T15:00');
  });

  it('defaults to a future time even when opened late in the day', () => {
    clockNow = new Date(2026, 7, 11, 23, 30, 0);
    renderForm(vi.fn(), { now: clockNow });
    expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-08-12T00:00');
  });

  it('keeps allowing a past scheduled time when editing an existing PLANNED event', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nProvider locale="ko">
        <EventForm
          mode="edit"
          customerName="박세입"
          now={now}
          getNow={getNow}
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
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps allowing a past occurred time for an immediate record (OCCURRED)', async () => {
    const onSubmit = renderForm(vi.fn(), { fixedCreateStatus: undefined });
    const occurred = document.querySelector<HTMLInputElement>('input[name="event-kind"][value="OCCURRED"]');
    fireEvent.click(occurred!);
    fireEvent.change(document.querySelector('[data-event-field="occurredAt"]')!, {
      target: { value: '2026-08-01T09:00' },
    });
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// DST 경계는 TZ=America/New_York에서만 의미가 있다.
// 실행: TZ=America/New_York pnpm exec vitest run src/components/schedule/EventForm.test.tsx
describe.runIf(process.env.TZ === 'America/New_York')('EventForm DST (TZ=America/New_York)', () => {
  it('rejects a spring-forward gap time for a new PLANNED event, keeps input and focus', () => {
    clockNow = new Date(2026, 2, 7, 12, 0, 0);
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'DST 공백' } });
    setTime('2026-03-08T02:30');
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('이 기기 시간대에는 없는 시각');
    expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-03-08T02:30');
    expect(screen.getByLabelText('예정 시각')).toHaveFocus();
    expect(screen.getByLabelText('제목')).toHaveValue('DST 공백');
  });

  it('rejects the gap time for an OCCURRED record', () => {
    clockNow = new Date(2026, 2, 7, 12, 0, 0);
    const onSubmit = renderForm(vi.fn(), { fixedCreateStatus: undefined });
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="event-kind"][value="OCCURRED"]')!);
    fireEvent.change(document.querySelector('[data-event-field="occurredAt"]')!, {
      target: { value: '2026-03-08T02:00' },
    });
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('이 기기 시간대에는 없는 시각');
  });

  it('accepts the first 03:00 after the gap for a new event', async () => {
    clockNow = new Date(2026, 2, 7, 12, 0, 0);
    const onSubmit = renderForm();
    setTime('2026-03-08T03:00');
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: '2026-03-08T03:00:00-04:00' }),
    );
  });

  it('fall back: the ambiguous 01:30 is saved once, as the earlier instant (-04:00)', async () => {
    clockNow = new Date(2026, 9, 31, 12, 0, 0);
    const onSubmit = renderForm();
    setTime('2026-11-01T01:30');
    submitForm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: '2026-11-01T01:30:00-04:00' }),
    );
  });
});
