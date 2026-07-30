import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/qe/release/**/*.test.mjs'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
