import { render, screen } from '@testing-library/react';

import { Button } from '@/components/ui/button';

const focusVariants = ['default', 'primary', 'secondary', 'text', 'destructive'] as const;

describe('Button', () => {
  it('keeps compact and icon controls at least 44px without enlarging their icons', () => {
    const { rerender } = render(<Button size="sm">Compact</Button>);
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveClass('min-h-11');

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

  it('uses minimum height for text controls so scaled text can expand the target', () => {
    render(<Button>Scalable label</Button>);
    expect(screen.getByRole('button', { name: 'Scalable label' })).toHaveClass('min-h-[46px]');
    expect(screen.getByRole('button', { name: 'Scalable label' })).not.toHaveClass('h-[46px]');
  });

  it.each(focusVariants)('provides the canonical focus foundation on the %s variant', (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    const button = screen.getByRole('button', { name: variant });

    expect(button).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-solid',
      'focus-visible:outline-accent-primary',
    );
    expect(button).not.toHaveClass('focus-visible:outline-destructive');
  });

  it('provides the disabled foundation', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('disabled:opacity-40');
  });

  it('offers primary, secondary, and text action variants', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="text">Text</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-accent-primary');
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-border-default');
    expect(screen.getByRole('button', { name: 'Text' })).toHaveClass('text-accent-primary-deep');
  });
});
