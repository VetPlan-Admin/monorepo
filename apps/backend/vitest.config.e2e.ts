import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // NODE_ENV=test makes ConfigModule skip .env files, so tests never touch real credentials or Neon
    env: { NODE_ENV: 'test' },
    // Each file boots PGlite + Nest; allow for WASM start-up
    hookTimeout: 60_000,
  },
});
