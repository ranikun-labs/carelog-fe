export interface ViewportMetrics {
  availableWidth: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function shouldUseTwoPane({
  availableWidth,
  viewportWidth,
  viewportHeight,
}: ViewportMetrics): boolean {
  return availableWidth >= 1100 && viewportWidth > viewportHeight;
}

export function isActuallyVisible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0;
}

export function hasVisibleMajorSurface(pane: HTMLElement | null): boolean {
  if (!isActuallyVisible(pane) || !pane) return false;
  return Array.from(pane.querySelectorAll<HTMLElement>('[data-major-surface]')).some((surface) =>
    isActuallyVisible(surface),
  );
}
