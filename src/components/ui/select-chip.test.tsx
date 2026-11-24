import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectChip } from '@/components/ui/select-chip';

describe('SelectChip', () => {
  it('is a button whose pressed state is only aria-pressed (label never changes)', () => {
    const { rerender } = render(<SelectChip pressed={false}>선택</SelectChip>);
    const chip = screen.getByRole('button', { name: '선택' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    rerender(<SelectChip pressed>선택</SelectChip>);
    expect(screen.getByRole('button', { name: '선택' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a check mark (not color alone) when pressed', () => {
    const { container, rerender } = render(<SelectChip pressed={false}>필터</SelectChip>);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<SelectChip pressed>필터</SelectChip>);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('calls onClick when enabled', () => {
    const onClick = vi.fn();
    render(
      <SelectChip pressed={false} onClick={onClick}>
        필터
      </SelectChip>,
    );
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses aria-disabled (stays focusable) + aria-describedby and blocks clicks when disabled', () => {
    const onClick = vi.fn();
    render(
      <>
        <SelectChip pressed={false} disabled disabledReasonId="why" onClick={onClick}>
          필터
        </SelectChip>
        <p id="why">기록이 없어 선택할 수 없습니다.</p>
      </>,
    );
    const chip = screen.getByRole('button', { name: '필터' });
    expect(chip).toHaveAttribute('aria-disabled', 'true');
    expect(chip).not.toBeDisabled();
    expect(chip).toHaveAccessibleDescription('기록이 없어 선택할 수 없습니다.');

    chip.focus();
    expect(chip).toHaveFocus();
    fireEvent.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a 44px touch target and is a non-submitting button', () => {
    render(<SelectChip pressed={false}>필터</SelectChip>);
    const chip = screen.getByRole('button', { name: '필터' });
    expect(chip.className).toContain('min-h-11');
    expect(chip).toHaveAttribute('type', 'button');
  });
});
