import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Next.js boundary shims — no-ops under the Node test runner.
      'server-only': new URL('./tests/helpers/empty.ts', import.meta.url).pathname,
      'client-only': new URL('./tests/helpers/empty.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Oracle + RLS tests can hit a live Supabase test project; keep them serial
    // and give them room to run real SQL.
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
