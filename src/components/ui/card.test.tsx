import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders children and merges a custom className', () => {
    render(
      <Card className="w-full" data-testid="card">
        <CardHeader>
          <CardTitle>제목</CardTitle>
          <CardDescription>설명</CardDescription>
        </CardHeader>
        <CardContent>본문</CardContent>
        <CardFooter>푸터</CardFooter>
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card.className).toContain('w-full');
    expect(card.className).toContain('rounded-card');
    // Foundation v1: 카드는 테두리·그림자 없음.
    expect(card.className).not.toMatch(/\bborder\b|shadow/);
    expect(screen.getByText('제목')).toBeInTheDocument();
    expect(screen.getByText('설명')).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(screen.getByText('푸터')).toBeInTheDocument();
  });

  it('renders an inset variant with the inset radius', () => {
    render(<Card inset data-testid="inset" />);
    const card = screen.getByTestId('inset');
    expect(card.className).toContain('rounded-inset');
    expect(card.className).toContain('bg-inset');
  });
});
