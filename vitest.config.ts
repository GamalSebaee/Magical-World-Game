import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': r('src/app'),
      '@features': r('src/features'),
      '@game': r('src/game'),
      '@services': r('src/services'),
      '@shared': r('src/shared'),
      '@content': r('src/content'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/game/core/**', 'src/services/**', 'src/shared/**', 'src/features/**'],
    },
  },
});
