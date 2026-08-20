import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import type { AppInitialization } from '@/app/appInitialization';
import type { AuthPort } from '@/auth/authTypes';
import type { ProductStateProvider } from '@/components/layout/ProductionStateProviders';
import { readTestInitialization } from '@/app/testBootstrap';
import { shouldHydrate } from '@/prerender/shouldHydrate';
import '@/styles/globals.css';

const rootElement = document.getElementById('root')!;

async function startApplication() {
  let testInitialization: ReturnType<typeof readTestInitialization> | undefined;
  let authPort: AuthPort | undefined;
  let stateProviders: ProductStateProvider | undefined;
  let assistantAdapter: AppInitialization['assistantAdapter'];

  if (import.meta.env.MODE === 'test') {
    testInitialization = readTestInitialization();
    const fixtureComposition = await import('@/components/layout/FixtureStateProviders');
    stateProviders = fixtureComposition.FixtureStateProviders;
    if (testInitialization?.authAdapterOptions) {
      const { createInMemoryAuthPort } = await import('@/auth/inMemoryAuthAdapter');
      authPort = createInMemoryAuthPort(testInitialization.authAdapterOptions);
    }
    if (testInitialization?.assistantAdapterOptions) {
      const { createDeterministicAssistantAdapter } = await import('@/assistant/assistantAdapter');
      assistantAdapter = createDeterministicAssistantAdapter(
        testInitialization.assistantAdapterOptions,
      );
    }
  }

  const initialization: AppInitialization | undefined = testInitialization
    ? {
        initialCustomers: testInitialization.initialCustomers,
        initialEvents: testInitialization.initialEvents,
        assistantAdapter,
      }
    : undefined;
  const tree = (
    <StrictMode>
      <BrowserRouter>
        <AppRouter {...initialization} authPort={authPort} stateProviders={stateProviders} />
      </BrowserRouter>
    </StrictMode>
  );

  if (shouldHydrate(rootElement)) hydrateRoot(rootElement, tree);
  else createRoot(rootElement).render(tree);
}

void startApplication();
