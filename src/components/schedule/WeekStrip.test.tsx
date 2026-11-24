import { fireEvent, render, screen } from '@testing-library/react';

import { getWeekDaysForDate } from '@/components/schedule/agendaModel';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date('2026-08-11T12:00:00+09:00');

function renderStrip(selectedDateKey: string, eventDateKeys: ReadonlySet<string>) {
  const onSelect = vi.fn();
  render(
    <I18nProvider locale="ko">
      <WeekStrip
        days={getWeekDaysForDate(selectedDateKey, now)}
        selectedDateKey={selectedDateKey}
        eventDateKeys={eventDateKeys}
        onSelect={onSelect}
      />
    </I18nProvider>,
  );
  return onSelect;
}

describe('WeekStrip', () => {
  it('keeps a cross-week selected date inside the visible seven-day window', () => {
    const onSelect = renderStrip('2026-08-18', new Set(['2026-08-18']));

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getAllByRole('button', { current: 'date' })).toHaveLength(1);
    expect(screen.getByRole('button', { current: 'date' })).toHaveAttribute(
      'data-date-key',
      '2026-08-18',
    );

    fireEvent.click(screen.getByRole('button', { current: 'date' }));
    expect(onSelect).toHaveBeenCalledWith('2026-08-18');
  });

  it('keeps today indication and event existence as separate marks', () => {
    renderStrip('2026-08-11', new Set(['2026-08-11']));

    const todayButton = document.querySelector('[data-date-key="2026-08-11"]');
    expect(todayButton?.querySelector('[data-event-dot]')).not.toBeNull();
    expect(todayButton?.querySelector('[data-today-indicator]')).not.toBeNull();
    expect(todayButton?.querySelectorAll('[data-event-dot], [data-today-indicator]')).toHaveLength(
      2,
    );
  });

  it('keeps weekday letters at 12px and cells touch-sized without gaps that shrink them', () => {
    renderStrip('2026-08-11', new Set());

    const strip = document.querySelector('[data-week-strip]') as HTMLElement;
    // 7칸이 가장자리까지 나눠 갖도록 gap·좌우 padding이 없다(320에서도 칸 ≥ 44).
    expect(strip.className).not.toMatch(/\bpx-\d/);
    expect(strip.querySelector('ol')?.className).not.toMatch(/\bgap-/);
    const buttons = [...strip.querySelectorAll('button')];
    expect(buttons).toHaveLength(7);
    for (const button of buttons) {
      expect(button).toHaveClass('min-h-14', 'min-w-11');
    }
    // 11px(text-[0.6875rem]) 회귀 방지: 요일·날짜 글자는 type-* 역할만 쓴다.
    expect(strip.innerHTML).not.toMatch(/text-\[/);
    expect(strip.querySelector('button span')).toHaveClass('type-label');
  });
});
