import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import type { AppInitialization } from '@/app/appInitialization';
import type { AuthPort } from '@/auth/authTypes';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { readTestInitialization } from '@/app/testBootstrap';
import { shouldHydrate } from '@/prerender/shouldHydrate';
import '@/styles/globals.css';

const rootElement = document.getElementById('root')!;

async function startApplication() {
  let testInitialization: ReturnType<typeof readTestInitialization> | undefined;
  let authPort: AuthPort | undefined;

  if (import.meta.env.MODE === 'test') {
    testInitialization = readTestInitialization();
    if (testInitialization?.authAdapterOptions) {
      authPort = createInMemoryAuthPort(testInitialization.authAdapterOptions);
    }
  }

  const initialization: AppInitialization | undefined = testInitialization
    ? {
        initialCustomers: testInitialization.initialCustomers,
        initialEvents: testInitialization.initialEvents,
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
