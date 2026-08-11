import { render, screen } from '@testing-library/react';

import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it.each([
    ['planned', '예정', 'bg-accent-primary-bg', 'text-accent-primary-deep'],
    ['prepared', '준비됨', 'bg-accent-primary-bg', 'text-accent-primary-deep'],
    ['overdue', '정리 필요', 'bg-warning-bg', 'text-warning'],
    ['cancelled', '취소됨', 'bg-subtle', 'text-status-neutral-foreground'],
    ['neutral', '중립', 'bg-subtle', 'text-status-neutral-foreground'],
  ] as const)('renders the %s tone with a visible label', (tone, label, background, foreground) => {
    render(<Badge tone={tone}>{label}</Badge>);
    expect(screen.getByText(label)).toHaveClass(background, foreground, 'shrink-0');
  });
});
