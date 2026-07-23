/**
 * Fixture capability registry for tests/integration/anticipate-dial.test.mjs — NOT real
 * source, never imported by anything except that test via RUVNET_CAPABILITY_REGISTRY.
 *
 * Read live (2026-07-23): neither the real scripts/capability-registry.mjs rows nor
 * scripts/goal-match.mjs matches carry a `severity` field today. anticipate.sh's
 * important-only gate reads `best.row.severity` regardless (via `isHigh()`), so against the
 * REAL modules `important-only` cannot currently distinguish anything — every row's severity
 * is `undefined`, which `isHigh()` treats as low. This fixture supplies `severity` explicitly,
 * driven by an env var, so the anticipate-dial tests exercise the DIAL itself rather than an
 * accident of what the real registry happens to emit yet.
 */
export function auditAll() {
  const severity = process.env.RUVNET_ANTICIPATE_DIAL_FIXTURE_SEVERITY || 'normal';
  return [{
    key: 'fixture-vector-cache',
    label: 'Fixture Vector Cache',
    state: 'off',
    severity,
    whatItBuysYou: 'skips a manual reindex step, in this fixture only',
    scope: 'project',
    turnOn: { cmd: 'echo fixture-turn-on' },
  }];
}
