import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.mjs', 'tests/integration/*.test.mjs', 'tests/mutation/*.test.mjs'],
    // Windows runners spawn processes MUCH slower than macOS/Linux (Git Bash startup dominates), and
    // a large slice of this suite deliberately exercises real shell hooks as subprocesses rather than
    // mocking them. vitest's 5s default is marginal there — hook-battery and token-meter timed out on
    // 2026-07-13 with no logic change, pure spawn latency. The assertions are about BEHAVIOUR, not
    // speed, so the honest fix is a timeout that fits the platform, not a weaker test.
    //
    // POSIX 10_000 → 20_000 (2026-07-27): the same rule, applied a second time for the same reason.
    // tests/unit/selfcheck-battery.test.mjs (the post-install hook battery, ADR-053 §2) adds ~19 real
    // process spawns, and it tipped two already-marginal neighbours — hook-battery and
    // verify-interface — into `Test timed out in 10000ms`. MEASURED as a clean A/B on one machine:
    // the full suite WITHOUT that file failed only the 5 expected machine-local hook-registry-lint
    // reds; WITH it, those same 5 plus 3 pure-timeout failures and ZERO assertion failures. Both
    // neighbours pass when run alone. So this is spawn latency, exactly as in 2026-07-13, not a
    // regression — and a weaker test would be the wrong fix.
    //
    // Why raising this does NOT re-hide a real hang: hangs are no longer detected by vitest's clock.
    // selfcheck.mjs asserts each hook against its OWN declared timeout using an external
    // process-group watchdog, so a hook that hangs now fails by CONTRACT with a named budget,
    // whichever way this number moves.
    testTimeout: process.platform === 'win32' ? 30_000 : 20_000,
    hookTimeout: process.platform === 'win32' ? 30_000 : 20_000,
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
      thresholds: { statements: 26, lines: 28, branches: 26, functions: 31 },
    },
  },
});
