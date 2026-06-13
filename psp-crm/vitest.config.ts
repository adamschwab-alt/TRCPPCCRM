import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Oracle + RLS tests can hit a live Supabase test project; keep them serial
    // and give them room to run real SQL.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
