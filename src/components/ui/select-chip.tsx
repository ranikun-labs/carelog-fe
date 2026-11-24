// upstream: finance-fe@7dd9590:src/components/ui/select-chip.tsx (verbatim)
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type SelectChipProps = Omit<React.ComponentProps<'button'>, 'aria-pressed' | 'disabled'> & {
  /** 선택 여부. aria-pressed로만 전달한다 — 라벨은 상태에 따라 바뀌지 않는다. */
  pressed: boolean;
  /**
   * 비활성. native `disabled`는 포커스를 없애 이유를 알 수 없게 하므로 쓰지 않고
   * `aria-disabled` + 클릭 차단으로 처리한다. 이유 문구가 있으면 `disabledReasonId`로 연결한다.
   */
  disabled?: boolean;
  disabledReasonId?: string;
};

/**
 * Select Chip: 필터·단일/다중 선택 토글. `button` + `aria-pressed`.
 * 선택 상태 = 체크 아이콘 + subtle 면(색만으로 구분하지 않음). 터치 영역 최소 44.
 */
function SelectChip({
  pressed,
  disabled = false,
  disabledReasonId,
  className,
  children,
  onClick,
  ...props
}: SelectChipProps) {
  return (
    <button
      data-slot="select-chip"
      type="button"
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-describedby={disabled ? disabledReasonId : undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        'type-supporting inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-4 font-semibold whitespace-nowrap transition-colors',
        pressed ? 'bg-brand-subtle text-brand-deep' : 'bg-control text-text-secondary',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    >
      {pressed ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} /> : null}
      {children}
    </button>
  );
}

export { SelectChip };
