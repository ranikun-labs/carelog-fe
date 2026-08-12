import type { AppInitialization } from '@/app/appInitialization';

declare global {
  interface Window {
    __CARELOG_TEST_INITIALIZATION__?: AppInitialization;
  }
}

export function readTestInitialization(): AppInitialization | undefined {
  if (import.meta.env.MODE !== 'test') return undefined;
  return window.__CARELOG_TEST_INITIALIZATION__;
}
