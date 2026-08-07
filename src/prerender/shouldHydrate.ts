export const PRERENDER_MARKER_ATTRIBUTE = 'data-render-mode';
export const PRERENDER_MARKER_VALUE = 'prerender';

export function shouldHydrate(rootElement: Element): boolean {
  return rootElement.getAttribute(PRERENDER_MARKER_ATTRIBUTE) === PRERENDER_MARKER_VALUE;
}
