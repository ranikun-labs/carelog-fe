import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionHeader } from '@/components/ui/section-header';

describe('SectionHeader', () => {
  it('renders the title as an h2 by default and as the requested level otherwise', () => {
    const { rerender } = render(<SectionHeader title="최근 기록" />);
    expect(screen.getByRole('heading', { level: 2, name: '최근 기록' })).toBeInTheDocument();

    rerender(<SectionHeader title="최근 기록" headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: '최근 기록' })).toBeInTheDocument();
  });

  it('renders the action beside the heading', () => {
    render(<SectionHeader title="제목" action={<a href="/all">전체 보기</a>} />);
    expect(screen.getByRole('link', { name: '전체 보기' })).toBeInTheDocument();
  });
});
