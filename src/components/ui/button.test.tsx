import { render, screen } from '@testing-library/react';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('keeps compact and icon controls at least 44px without enlarging their icons', () => {
    const { rerender } = render(<Button size="sm">Compact</Button>);
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveClass('h-11');

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

  it('provides the exact focus and disabled foundation on every variant', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary',
      'disabled:opacity-40',
    );
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
