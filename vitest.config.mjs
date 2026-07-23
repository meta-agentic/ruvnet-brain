import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.mjs', 'tests/integration/*.test.mjs', 'tests/mutation/*.test.mjs'],
    // Windows runners spawn processes MUCH slower than macOS/Linux (Git Bash startup dominates), and
    // a large slice of this suite deliberately exercises real shell hooks as subprocesses rather than
    // mocking them. vitest's 5s default is marginal there — hook-battery and token-meter timed out on
    // 2026-07-13 with no logic change, pure spawn latency. The assertions are about BEHAVIOUR, not
    // speed, so the honest fix is a timeout that fits the platform, not a weaker test.
    testTimeout: process.platform === 'win32' ? 30_000 : 10_000,
    hookTimeout: process.platform === 'win32' ? 30_000 : 10_000,
    coverage: {
      provider: 'v8',
      // ADR-0011 Phase 0: measure ALL shipped source, not a flattering 8-file subset. `all: true`
      // counts files no test ever imports at 0% — that zero is the honest truth, not a regression.
      all: true,
      // ADR-0011 Phase 1: the denominator is ALL first-party source — scripts/, kb/, bin/, and the
      // shipped plugin MCP server. plugin/test/run-tests.mjs is the plugin's own test battery and
      // kb/test-guard-injection.mjs is a test script (both run directly in CI), so they are test
      // code, not source — excluded from the denominator like tests/.
      include: ['scripts/**/*.mjs', 'kb/*.mjs', 'bin/*.mjs', 'plugin/mcp/*.mjs'],
      exclude: ['kb/node_modules/**', 'kb/clones/**', 'kb/test-guard-injection.mjs'],
      // json-summary writes coverage/coverage-summary.json, which scripts/claims-verify.mjs's
      // verifyCoverageBadge RE-DERIVES the README badge % from (it no longer string-matches a
      // hardcoded "10%" needle — a gate that can't fail isn't a gate). ADR-0020.
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // Regression floor: CI fails below these. Set to the measured value ROUNDED DOWN (see the
      // commit that changed this line for the measured values). Raise as coverage grows; never
      // lower silently.
      thresholds: { statements: 13, lines: 14, branches: 11, functions: 15 },
    },
  },
});
