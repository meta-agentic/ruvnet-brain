import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBudget, measureFirings, runSessionStartGate } from '../../scripts/qe/session-start-gate.mjs';

const resolved = {
  surface: { source: 'checkout', root: path.resolve('plugin') },
  reg: { timeout: 5 },
  command: 'fixture-session-start',
};

const measurement = (elapsedMs, extra = {}) => ({
  elapsedMs,
  stdoutBytes: 0,
  stderr: '',
  status: 0,
  timedOut: false,
  ...extra,
});

describe('session-start hard gate', () => {
  it('isolates shell and Node home/state authorities to the same temporary root', async () => {
    let seen;
    await measureFirings({
      n: 1,
      resolved,
      fireFn: async (input) => {
        seen = input.env;
        return measurement(10);
      },
    });

    expect(seen.USERPROFILE).toBe(seen.HOME);
    expect(seen.XDG_CACHE_HOME).toBe(path.join(seen.HOME, '.cache'));
    expect(seen.RUVNET_BRAIN_HOME).toBe(path.join(seen.HOME, '.cache', 'ruvnet-brain'));
    expect(seen.RUVNET_BRAIN_STATE_DIR).toBe(path.join(seen.HOME, '.config', 'ruvnet-brain'));
  });

  it('fails when the cold first fire times out even if every steady-state sample is fast', async () => {
    let calls = 0;
    const result = await runSessionStartGate({
      resolved,
      fireFn: async () => {
        calls += 1;
        return calls === 1
          ? measurement(5000, { timedOut: true, status: null })
          : measurement(10);
      },
    });

    expect(result.warmupTimedOut).toBe(true);
    expect(result.p95).toBe(10);
    expect(result.pass).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/COLD-START FAIL/);
  });

  it('fails when the cold first fire exceeds absoluteFailMs without timing out', async () => {
    const budget = loadBudget();
    const coldMs = budget.absoluteFailMs + 1;
    expect(coldMs).toBeLessThan(resolved.reg.timeout * 1000);

    let calls = 0;
    const result = await runSessionStartGate({
      resolved,
      fireFn: async () => {
        calls += 1;
        return measurement(calls === 1 ? coldMs : 10);
      },
    });

    expect(result.warmupTimedOut).toBe(false);
    expect(result.warmupMs).toBe(coldMs);
    expect(result.p95).toBe(10);
    expect(result.pass).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/COLD-START ABSOLUTE FAIL/);
  });
});
