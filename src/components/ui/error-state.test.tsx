import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

describe('ErrorState', () => {
  it('announces the error as an alert with the title as text (not color alone)', () => {
    render(<ErrorState title="불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('불러오지 못했습니다');
    expect(alert).toHaveTextContent('잠시 후 다시 시도해 주세요.');
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a recovery action', () => {
    render(<ErrorState title="오류" action={<Button>다시 시도</Button>} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
