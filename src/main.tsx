import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import type { AppInitialization } from '@/app/appInitialization';
import type { AuthPort } from '@/auth/authTypes';
import { readTestInitialization } from '@/app/testBootstrap';
import { shouldHydrate } from '@/prerender/shouldHydrate';
import '@/styles/globals.css';

const rootElement = document.getElementById('root')!;

async function startApplication() {
  let testInitialization: ReturnType<typeof readTestInitialization> | undefined;
  let authPort: AuthPort | undefined;
  let assistantAdapter: AppInitialization['assistantAdapter'];

  if (import.meta.env.MODE === 'test') {
    testInitialization = readTestInitialization();
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
        <AppRouter {...initialization} authPort={authPort} />
      </BrowserRouter>
    </StrictMode>
  );

  if (shouldHydrate(rootElement)) hydrateRoot(rootElement, tree);
  else createRoot(rootElement).render(tree);
}

void startApplication();
