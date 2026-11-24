import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InfoList, InfoRow } from '@/components/ui/info-row';

describe('InfoRow', () => {
  it('pairs label (dt) and value (dd) inside a description list', () => {
    const { container } = render(
      <InfoList>
        <InfoRow label="항목">샘플 값</InfoRow>
        <InfoRow label="메모" layout="stack">
          긴 설명
        </InfoRow>
      </InfoList>,
    );
    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    const terms = within(list as HTMLElement).getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual(['항목', '메모']);
    expect(within(list as HTMLElement).getAllByRole('definition')).toHaveLength(2);
    expect(screen.getByText('샘플 값').tagName).toBe('DD');
  });

  it('exposes the layout (kv-row vs kv-stack)', () => {
    const { container } = render(
      <InfoList>
        <InfoRow label="a">1</InfoRow>
        <InfoRow label="b" layout="stack">
          2
        </InfoRow>
      </InfoList>,
    );
    const rows = container.querySelectorAll('[data-slot="info-row"]');
    expect(rows[0]).toHaveAttribute('data-layout', 'row');
    expect(rows[1]).toHaveAttribute('data-layout', 'stack');
    expect(rows[1].className).toContain('flex-col');
  });
});
