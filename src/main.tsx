import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';
import { readTestInitialization } from '@/app/testBootstrap';
import { shouldHydrate } from '@/prerender/shouldHydrate';
import '@/styles/globals.css';

const rootElement = document.getElementById('root')!;
const testInitialization = readTestInitialization();
const tree = (
  <StrictMode>
    <BrowserRouter>
      <AppRouter {...testInitialization} />
    </BrowserRouter>
  </StrictMode>
);

if (shouldHydrate(rootElement)) hydrateRoot(rootElement, tree);
else createRoot(rootElement).render(tree);
