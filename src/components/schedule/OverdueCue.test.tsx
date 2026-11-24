import { fireEvent, render, screen } from '@testing-library/react';

import { OverdueCue } from '@/components/schedule/OverdueCue';
import { I18nProvider } from '@/i18n/I18nContext';

function renderCue(count: number, onSelect = vi.fn()) {
  render(
    <I18nProvider locale="ko">
      <OverdueCue count={count} onSelect={onSelect} />
    </I18nProvider>,
  );
  return onSelect;
}

describe('OverdueCue', () => {
  it('renders nothing without overdue events', () => {
    renderCue(0);
    expect(document.querySelector('[data-overdue-cue]')).toBeNull();
  });

  it('is one notice that carries the count in its sentence, without a duplicate count badge', () => {
    const onSelect = renderCue(2);
    const cue = screen.getByRole('button', { name: '정리 필요한 일정 2개' });
    expect(cue).toHaveTextContent('정리 필요한 일정 2개');
    expect(cue.querySelector('[data-slot="badge"]')).toBeNull();
    fireEvent.click(cue);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('caps the displayed count at 9+', () => {
    renderCue(12);
    expect(screen.getByRole('button', { name: '정리 필요한 일정 9+개' })).toBeVisible();
  });
});
