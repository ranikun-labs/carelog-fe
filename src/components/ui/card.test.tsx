import { render, screen } from '@testing-library/react';

import { Card } from '@/components/ui/card';

describe('Card', () => {
  it('uses the canonical surface, border, radius, and shadow-free default', () => {
    render(<Card>Customer surface</Card>);
    expect(screen.getByText('Customer surface')).toHaveClass(
      'bg-surface',
      'border-border-default',
      'rounded-lg',
      'shadow-none',
    );
    expect(screen.getByText('Customer surface')).not.toHaveClass('shadow-sm');
  });
});
