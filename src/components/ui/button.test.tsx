import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';

const emphases = [
  'strong',
  'subtle',
  'neutral',
  'text',
  'text-neutral',
  'danger-text',
  'danger-strong',
] as const;
const aliases = [
  'default',
  'primary',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;

describe('Button', () => {
  it.each([...emphases, ...aliases])('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('keeps compact and icon controls at least 44px without enlarging their icons', () => {
    const { rerender } = render(<Button size="sm">Compact</Button>);
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveClass('min-h-11', 'min-w-11');

    rerender(
      <Button size="icon" aria-label="Back">
        <svg data-testid="icon" />
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('size-11');
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      "[&_svg:not([class*='size-'])]:size-4",
    );
  });

  it('uses minimum height (Compact --control-h 44) so scaled text can expand the target', () => {
    render(<Button>Scalable label</Button>);
    const button = screen.getByRole('button', { name: 'Scalable label' });
    expect(button).toHaveClass('min-h-(--control-h)');
    expect(button.className).not.toMatch(/(^|\s)h-(12|9|\[54px\])(\s|$)/);
  });

  it('uses minimum height on every text size so scaled text never clips', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('min-h-[54px]');
    expect(screen.getByRole('button', { name: 'Small' }).className).not.toMatch(/(^|\s)h-9(\s|$)/);
  });

  it.each([...emphases, ...aliases])(
    'relies on the global focus-visible outline on the %s variant',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      // 전역 :focus-visible(2px brand + offset 2)을 쓰므로 컴포넌트가 outline을 끄거나 덮지 않는다.
      expect(screen.getByRole('button', { name: variant }).className).not.toMatch(/outline/);
    },
  );

  it('is disabled and non-interactive when disabled is set', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    // Foundation 비활성: opacity 50 + 포인터 차단 (RPL-56의 40에서 LOCK 해제로 변경).
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
  });

  it('keeps primary, secondary and text callers on their Foundation emphasis', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="text">Text</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
    );
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('bg-control');
    // Teal strong은 brand-subtle(hover) 위 4.5:1 미달 → 글자는 deep.
    const text = screen.getByRole('button', { name: 'Text' });
    expect(text).toHaveClass('text-brand-deep', 'hover:bg-brand-subtle');
    expect(text).not.toHaveClass('text-primary');
  });

  it('keeps alias variants visually identical to their Foundation emphasis', () => {
    const classesOf = (
      variant: 'strong' | 'default' | 'primary' | 'danger-strong' | 'destructive',
    ) => {
      const { unmount } = render(<Button variant={variant}>V</Button>);
      const value = screen.getByRole('button', { name: 'V' }).className;
      unmount();
      return value;
    };
    expect(classesOf('default')).toBe(classesOf('strong'));
    expect(classesOf('primary')).toBe(classesOf('strong'));
    expect(classesOf('destructive')).toBe(classesOf('danger-strong'));
  });

  it('does not add a default type (submit behaviour of existing callers is unchanged)', () => {
    render(<Button>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).not.toHaveAttribute('type');
  });
});
