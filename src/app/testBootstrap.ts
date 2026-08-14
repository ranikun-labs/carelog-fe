import type { AppInitialization } from '@/app/appInitialization';
import type { DeterministicAssistantAdapterOptions } from '@/assistant/assistantAdapter';
import type { InMemoryAuthAdapterOptions } from '@/auth/authTypes';

export interface TestAppInitialization extends Omit<AppInitialization, 'assistantAdapter'> {
  /** Test-only serializable adapter configuration; never sourced from a URL. */
  authAdapterOptions?: InMemoryAuthAdapterOptions;
  /** Test-only serializable assistant adapter configuration; never sourced from a URL. */
  assistantAdapterOptions?: DeterministicAssistantAdapterOptions;
}

declare global {
  interface Window {
    __CARELOG_TEST_INITIALIZATION__?: TestAppInitialization;
  }
}

export function readTestInitialization(): TestAppInitialization | undefined {
  if (import.meta.env.MODE !== 'test') return undefined;
  return window.__CARELOG_TEST_INITIALIZATION__;
}
