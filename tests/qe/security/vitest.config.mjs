import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/qe/security/**/*.test.mjs'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
