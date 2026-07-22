// tests/unit/ping-active-versions.test.mjs
//
// Guards the defect found by adversarial review of ADR-036 (2026-07-22): the ping handler accepted a
// version on every daily `session` ping — which kb/telemetry-ping.mjs has been sending since
// 2026-07-10 — and DISCARDED it, while answering { stored: true }. The owner could therefore see
// what version each machine installed at, never what it was running.
//
// These assertions bound WHICH KEY receives the version, not merely "a command was emitted". Revert
// buildCommands' `session` branch and the first test goes red; swap rb:activever for rb:versions and
// the separation test goes red. A test that only counted commands would survive both.

import { describe, it, expect } from 'vitest';
import { buildCommands, validatePing } from '../../explainer/api/ping.mjs';

const DAY = '2026-07-22';
const findHash = (cmds, key) => cmds.filter((c) => c[0] === 'HINCRBY' && c[1] === key);

describe('buildCommands — a session ping records the version it is RUNNING', () => {
  it('writes the version into the per-day active-version hash', () => {
    const cmds = buildCommands({ event: 'session', v: 'v3.4.22-dev', n: 1 }, DAY);
    const active = findHash(cmds, `rb:activever:${DAY}`);
    expect(active).toHaveLength(1);
    expect(active[0][2]).toBe('v3.4.22-dev'); // field is the version
    expect(active[0][3]).toBe('1');
  });

  it('expires that hash, so the store cannot grow without bound', () => {
    const cmds = buildCommands({ event: 'session', v: 'v3.4.22-dev', n: 1 }, DAY);
    const exp = cmds.find((c) => c[0] === 'EXPIRE' && c[1] === `rb:activever:${DAY}`);
    expect(exp).toBeDefined();
    expect(Number(exp[2])).toBeGreaterThan(0);
  });

  // The two facts are different questions and must not share a key: rb:versions answers "what did
  // people arrive on", rb:activever answers "what are they running now". Collapsing them would make
  // every nightly refresh look like a fresh install.
  it('does NOT pollute the lifetime install-version hash', () => {
    const cmds = buildCommands({ event: 'session', v: 'v3.4.22-dev', n: 1 }, DAY);
    expect(findHash(cmds, 'rb:versions')).toHaveLength(0);
  });

  it('an install ping still records only the install version', () => {
    const cmds = buildCommands({ event: 'install', v: 'v3.4.22-dev', n: 1 }, DAY);
    expect(findHash(cmds, 'rb:versions')).toHaveLength(1);
    expect(findHash(cmds, `rb:activever:${DAY}`)).toHaveLength(0);
  });

  it('a search ping records no version at all — it carries no version claim', () => {
    const cmds = buildCommands({ event: 'search', v: 'v3.4.22-dev', n: 5 }, DAY);
    expect(findHash(cmds, 'rb:versions')).toHaveLength(0);
    expect(findHash(cmds, `rb:activever:${DAY}`)).toHaveLength(0);
  });

  it('every event still increments the lifetime and per-day totals', () => {
    for (const event of ['install', 'search', 'session']) {
      const cmds = buildCommands({ event, v: 'v1', n: 2 }, DAY);
      expect(findHash(cmds, 'rb:totals')[0]).toEqual(['HINCRBY', 'rb:totals', event, '2']);
      expect(findHash(cmds, `rb:day:${DAY}`)[0]).toEqual(['HINCRBY', `rb:day:${DAY}`, event, '2']);
    }
  });

  // An unparseable version must not become a key. validatePing already coerces to 'unknown'; this
  // pins that the coerced value is what reaches the store, so the hash cannot be used to smuggle
  // arbitrary field names (rb:activever is otherwise attacker-influenced on an open endpoint).
  it('a junk version is stored as the coerced "unknown", never raw', () => {
    const p = validatePing({ event: 'session', v: 'no spaces allowed!' });
    expect(p.v).toBe('unknown');
    const active = findHash(buildCommands(p, DAY), `rb:activever:${DAY}`);
    expect(active[0][2]).toBe('unknown');
  });
});
