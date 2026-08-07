import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    // e2e/는 Playwright 전용 스펙 — Vitest의 기본 include 패턴(*.spec.ts)에 걸려
    // test.describe()가 Vitest 러너 안에서 실행되며 죽는 것을 방지한다.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
