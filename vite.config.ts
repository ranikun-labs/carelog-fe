import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

function realApiE2eProxy(command: string, mode: string) {
  const rawTarget = process.env.CARELOG_E2E_GATEWAY_TARGET?.trim();
  if (command !== 'serve' || mode !== 'real-api-e2e' || !rawTarget) {
    return undefined;
  }

  let target: URL;
  try {
    target = new URL(rawTarget);
  } catch {
    throw new Error('Real API E2E requires a loopback-only HTTP Gateway.');
  }

  const authority = rawTarget.slice('http://'.length).split(/[/?#]/, 1)[0] ?? '';
  if (
    target.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    !target.port ||
    authority.includes('@') ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('Real API E2E requires a loopback-only HTTP Gateway.');
  }

  return {
    '/api/v1': {
      target: target.origin,
      changeOrigin: false,
      secure: false,
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: realApiE2eProxy(command, mode),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    // Playwright specs use a separate runner and are excluded from Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-real/**'],
  },
}));
