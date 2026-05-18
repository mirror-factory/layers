import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // The project's tsconfig sets `jsx: preserve` for Next.js, which leaves
  // vitest without a JSX transformer. Vitest 4 uses Rolldown/oxc; configure
  // it to compile JSX as React 17+ `automatic` runtime so `.tsx` test files
  // (and the React components they import) parse cleanly. `.ts` tests are
  // unchanged. See PROD-464.
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/evals/**', 'tests/api/**', 'tests/e2e/**', 'tests/unit/code-review.test.ts'],
    // PROD-385 follow-up: vitest 4's default `forks` pool spawns a fresh Node
    // process per test file, which on this repo (70+ files) made `pnpm test`
    // take ~10 minutes wall and occasionally hit `Timeout starting forks runner`.
    // The `threads` pool reuses workers across files; same suite runs in ~2s.
    // Tests must avoid mutating shared globals across files (none do today).
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts', 'app/**/*.ts'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
