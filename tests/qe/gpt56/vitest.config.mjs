import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/qe/**/*.test.mjs'],
    testTimeout: 30_000,
    hookTimeout: 240_000,
  },
});
