import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/math/**/*.ts', 'src/measurements/**/*.ts'],
            exclude: ['src/**/*.spec.ts', 'src/**/__fixtures__/**', 'src/**/index.ts'],
            reporter: ['text', 'text-summary'],
            // Surgical math drives clinical decisions: every line and branch must be exercised
            thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
        },
    },
});
