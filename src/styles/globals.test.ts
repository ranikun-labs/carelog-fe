import '@/styles/globals.css';

function rootToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function colorToken(name: string): string {
  return rootToken(name).replaceAll(' ', '');
}

describe('Carelog semantic design tokens', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('loads the final light color contract', () => {
    expect(colorToken('--bg-page')).toBe('oklch(97%0.00490)');
    expect(colorToken('--bg-surface')).toBe('oklch(100%00)');
    expect(colorToken('--bg-subtle')).toBe('oklch(96%0.00690)');
    expect(colorToken('--text-primary')).toBe('oklch(22%0.01260)');
    expect(colorToken('--text-secondary')).toBe('oklch(40%0.012260)');
    expect(colorToken('--text-tertiary')).toBe('oklch(53%0.01260)');
    expect(colorToken('--status-neutral-foreground')).toBe('oklch(48%0.012260)');
    expect(colorToken('--border-subtle')).toBe('oklch(94%0.00690)');
    expect(colorToken('--border-default')).toBe('oklch(90%0.00690)');
    expect(colorToken('--accent-primary')).toBe('oklch(52%0.1235)');
    expect(colorToken('--accent-primary-deep')).toBe('oklch(45%0.1235)');
    expect(colorToken('--accent-primary-bg')).toBe('oklch(94%0.025235)');
    expect(colorToken('--accent-primary-rail')).toBe('oklch(70%0.09235)');
    expect(colorToken('--warning')).toBe('oklch(45%0.170)');
    expect(colorToken('--warning-bg')).toBe('oklch(94%0.0370)');
    expect(colorToken('--warning-rail')).toBe('oklch(70%0.1170)');
    expect(colorToken('--rail-neutral')).toBe('oklch(88%0.00690)');
  });

  it('loads the final spacing and shape contract', () => {
    expect(rootToken('--space-1')).toBe('4px');
    expect(rootToken('--space-2')).toBe('8px');
    expect(rootToken('--space-3')).toBe('12px');
    expect(rootToken('--space-4')).toBe('16px');
    expect(rootToken('--space-5')).toBe('20px');
    expect(rootToken('--space-6')).toBe('24px');
    expect(rootToken('--space-8')).toBe('32px');
    expect(rootToken('--radius-badge')).toBe('6px');
    expect(rootToken('--radius-control')).toBe('8px');
    expect(rootToken('--radius-card')).toBe('12px');
    expect(rootToken('--radius-pane')).toBe('16px');
    expect(rootToken('--status-rail-width')).toBe('3px');
    expect(rootToken('--shadow-default')).toBe('none');
  });

  it('reuses an existing semantic value for the undefined dark neutral status palette', () => {
    document.documentElement.classList.add('dark');

    expect(rootToken('--status-neutral-foreground')).toBe('var(--muted-foreground)');
    expect(rootToken('--muted-foreground')).not.toMatch(/^var\(/);
  });
});
