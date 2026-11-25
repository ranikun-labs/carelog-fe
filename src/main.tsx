import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import type { AppInitialization } from '@/app/appInitialization';
import type { AuthPort } from '@/auth/authTypes';
import type { ProductStateProvider } from '@/components/layout/ProductionStateProviders';
import { readTestInitialization } from '@/app/testBootstrap';
import { LeaveGuardDataRouterScope } from '@/components/common/LeaveGuard';
import { shouldHydrate } from '@/prerender/shouldHydrate';
import { getProductionCarelogAuthRuntime } from '@/integrations/carelog/productionAuthRuntime';
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
  } else {
    authPort = getProductionCarelogAuthRuntime().authPort;
  }

  const initialization: AppInitialization | undefined = testInitialization
    ? {
        initialCustomers: testInitialization.initialCustomers,
        initialEvents: testInitialization.initialEvents,
        assistantAdapter,
      }
    : undefined;
  // 이탈 보호(useBlocker)는 Data Router가 필요하다. 라우트 정의는 AppRouter 안에 그대로 두고 catch-all로 감싸며,
  // LeaveGuardDataRouterScope가 Data Router 표식을 내려 보낸다(UNSAFE 내부 context에 의존하지 않는다).
  const router = createBrowserRouter([
    {
      path: '*',
      element: (
        <LeaveGuardDataRouterScope>
          <AppRouter {...initialization} authPort={authPort} stateProviders={stateProviders} />
        </LeaveGuardDataRouterScope>
      ),
    },
  ]);
  const tree = (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );

  if (shouldHydrate(rootElement)) hydrateRoot(rootElement, tree);
  else createRoot(rootElement).render(tree);
}

void startApplication();
