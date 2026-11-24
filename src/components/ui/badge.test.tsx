import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it.each([
    ['planned', '예정', 'bg-info-bg', 'text-info'],
    ['prepared', '준비됨', 'bg-info-bg', 'text-info'],
    ['overdue', '정리 필요', 'bg-warning-bg', 'text-warning'],
    ['cancelled', '취소됨', 'bg-muted', 'text-text-secondary'],
    ['neutral', '중립', 'bg-muted', 'text-text-secondary'],
  ] as const)('renders the %s tone with a visible label', (tone, label, background, foreground) => {
    render(<Badge tone={tone}>{label}</Badge>);
    expect(screen.getByText(label)).toHaveClass(background, foreground, 'shrink-0');
  });

  it('keeps the info alias on brand-deep (never strong Teal on brand-subtle)', () => {
    render(<Badge tone="info">워크스페이스</Badge>);
    const badge = screen.getByText('워크스페이스');
    expect(badge).toHaveClass('bg-brand-subtle', 'text-brand-deep');
    expect(badge).not.toHaveClass('text-primary');
  });

  it.each(['information', 'success', 'warning', 'danger', 'conflict', 'destructive'] as const)(
    'applies the Foundation %s tone',
    (tone) => {
      render(<Badge tone={tone}>라벨</Badge>);
      expect(screen.getByText('라벨')).toHaveClass('rounded-badge');
    },
  );
});
