/**
 * hook-registry-lint.test.mjs — the MESH invariants over the MERGED registry (ADR-055 build item 1).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: the suite could not see five sixths of the machine.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `hook-contract.test.mjs` — the file written after a Stop hook looped every turn in every project
 * on this machine — reads exactly one registry: `plugin/hooks/hooks.json` (its line 43). That file
 * holds 15 of the 42 hook registrations a session here actually loads. The other 27 live in
 * `~/.claude/settings.json`, this project's `.claude/settings.json`, and three third-party plugins,
 * and NOTHING in this repo had ever read them. ADR-055 F16 names it exactly: "the test suite cannot
 * see the merged registry". A suite that cannot see a layer cannot go red on it, and everything
 * that went wrong in those layers — an untimed blocking wall, a stale Stop override, thirteen
 * handlers on the host's 600s default — went wrong there for months, in the open, unread.
 *
 * So this file does not test a hook. It tests the MESH: `scripts/hook-registry.mjs` enumerates every
 * registration across every registry and normalizes it to one record, and the invariants below are
 * evaluated over all of them at once.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * BORN RED — verbatim, before a single fix, 2026-07-27, spine gen 22 / 3.9.85-dev.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `node scripts/hook-registry.mjs --lint` on this laptop, with the invariants written and NOTHING
 * else changed:
 *
 *     Merged hook registry — 42 active registrations in the mesh, 30 in code-copy mirrors
 *      15   plugin            · 11 user · 2 project
 *       9   third-party:security-guidance · 4 third-party:vercel · 1 third-party:superpowers
 *
 *     M1: 3 FINDING(S)
 *        PreToolUse::Task::route-dispatch.sh      roots ["spine","marketplace-clone"]      blocking
 *        PreToolUse::TaskStop::route-dispatch.sh  roots ["spine","marketplace-clone"]      blocking
 *        Stop::*::continuation-gate.mjs           roots ["plugin-root", "<repo>/plugin/scripts"]
 *     M3: 14 FINDING(S)   (1 wrong-unit: security-guidance SessionStart timeout 180;
 *                          13 missing: 8 security-guidance, 4 vercel, 1 superpowers)
 *     M5: 18 FINDING(S)   (6 plugin, 1 project, 5 user, 6 third-party — unanchored tool matchers)
 *     M5-stale: clean
 *     M6: 28 FINDING(S)   (plugin Stop, both project entries, all 11 user, all 14 third-party —
 *                          no declared offBehavior anywhere outside the shim's table)
 *
 *     63 finding(s) over 42 mesh registrations
 *
 * That is the ADR's predicted born-red set, found independently by the lint rather than by reading
 * the ADR: F5 (Stop bypasses the spine — no mode, no offBehavior) · F6 (double continuation-gate
 * from two code roots, its own removal condition satisfied 50 versions earlier) · F3 (route-dispatch
 * registered blocking from two code copies, and unanchored `Task` also selecting TaskStop) ·
 * F4 (unanchored matchers; NotebookEdit reaching four hooks by substring accident) ·
 * F14 (offBehavior declared for the shim's eleven and nothing else) · F18 (thirteen third-party
 * handlers with no timeout at all, plus a 180s SessionStart dominating every cold start).
 * F16 is not a finding here — it is the defect this file's existence closes, and the census
 * assertion below measures it: 42 registrations visible where the old test could see 15.
 *
 * NOT COVERED, said plainly rather than implied: F17 (Codex's plugin parser rejects hooks.json's
 * `_note`) is a cross-host PARSER question, not a registry-shape one — ADR-055 §7.14, and it
 * belongs to the artifact/battery items, not to these four invariants. F20 (held-open stdin) and
 * F11 (learn-flush's 48s worst case inside a 30s timeout) are BUDGET facts about hook BODIES; a
 * registry census cannot see them and this file does not pretend to. Battery v2 (item 2) owns both.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FIXED IN THE REPO vs DOCUMENTED AS MACHINE-LOCAL — and why the split is where it is.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * FIXED (all repo-owned, all shipped by this branch):
 *   • F5 — Stop now dispatches `hook-shim.mjs continuation-gate`, with mode `advisory` (behaviourally
 *     identical to the `|| true` it replaces) and offBehavior `run`, reasoned in the shim's table.
 *     ADR-055 left this "undecided today"; the decision and its discriminator are recorded there,
 *     and the two assertions at the bottom of this file prove the declaration is HONOURED — the
 *     gate still fires under a live brain-off sentinel, while a `silence` entry under the same
 *     sentinel writes zero bytes. A declaration nothing checks is the ceremony ADR-055 §4 refuses.
 *   • F6 — this project's Stop override is deleted. Its own `_note` said "REMOVE once the spine
 *     ships >=3.9.34"; the spine was at 3.9.85.
 *   • F14, repo half — `plugin/hooks/hook-contracts.json` now carries the out-of-shim contract for
 *     the one repo-owned registration outside the table (the project's version-bump-gate).
 *   • F4/F3, recorded not hidden — every unanchored matcher this repo ships is in that file's
 *     `matcherAllowlist`, each with its reason and the ADR-055 build item that retires it. ADR-055
 *     orders battery v2 (item 2) BEFORE any registration change (item 3), so anchoring them today
 *     would be fixing them out of order, against the ADR, with no battery to catch the fallout.
 *     The allowlist is a ratchet, not an amnesty: a NEW unanchored matcher is red on arrival, and
 *     a stale entry is itself a failure (`M5-stale`).
 *
 * DOCUMENTED, NOT FIXED — every one of these is a file this repo does not own:
 *   `~/.claude/settings.json` is the machine owner's; the three third-party plugins are Anthropic's
 *   and Vercel's. Inventing an offBehavior for someone else's hook, or editing a stranger's
 *   registry from a test run, is precisely the fiction this lint exists to prevent. They stay
 *   RED on this laptop, by name, in the block below — and are skipped where those files do not
 *   exist (CI), so the ship gate stays honest without the lint going quiet. This is the one thing
 *   worth being pedantic about: the machine block is NOT expected to pass here. It is expected to
 *   FAIL here and to be skipped in CI. A green run on this laptop means someone silenced it.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildRegistry, discoverSources, census, lintM1, lintM3, lintM5, lintAllowlistStale, lintM6,
  matchedTools, isAnchored, hasFailsafe, mesh, OFF_BEHAVIORS,
} from '../../scripts/hook-registry.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const SHIM = path.join(REPO, 'plugin/scripts/hook-shim.mjs');

/** Repo-owned layers only — exactly what a CI runner has. Must be, and stay, clean. */
const repoReg = buildRegistry({ repo: REPO, includeMachine: false });
/** The full merged mesh, including this machine's user + third-party registries. */
const fullReg = buildRegistry({ repo: REPO, includeMachine: true });

const machinePresent = discoverSources({ repo: REPO }).some((s) => s.machineLocal && s.present);
const SKIP_MACHINE = process.env.CI === 'true' || process.env.RUVNET_MESH_LINT_MACHINE === '0' || !machinePresent;

const show = (findings) => findings.map((f) => JSON.stringify(f)).join('\n  ');

describe('the merged census — six registries, not one', () => {
  it('enumerates every registry this repo owns and normalizes each registration to the ADR-055 §6 record', () => {
    const REQUIRED = ['layer', 'file', 'locator', 'event', 'matcher', 'command', 'timeout', 'mode', 'offBehavior', 'reachesStrangers'];
    expect(repoReg.records.length).toBeGreaterThan(0);
    for (const r of repoReg.records) {
      for (const k of REQUIRED) expect(Object.keys(r), `${r.layer} ${r.locator} missing ${k}`).toContain(k);
      expect(r.locator, 'a locator with no line number cannot point anybody at anything').toMatch(/:\d+$/);
    }
    // `reachesStrangers` is not decoration: the plugin registry is the ONLY channel that reaches
    // another machine (ADR-055 §5), and an invariant that treats a local hook and a shipped hook
    // as equally consequential is not reading the same product the users are.
    expect(repoReg.records.filter((r) => r.reachesStrangers).every((r) => r.layer === 'plugin')).toBe(true);
    expect(repoReg.records.some((r) => r.layer === 'project' && !r.reachesStrangers)).toBe(true);
  });

  it('routes EVERY plugin registration through the shim — the F5 regression fixture', () => {
    // Stop was the one exception, for the one event that can force a turn to continue. If a future
    // registration is added to hooks.json pointing straight at a body again, it lands here first.
    const strays = repoReg.records
      .filter((r) => r.layer === 'plugin' && r.contractSource !== 'shim-table')
      .map((r) => `${r.locator} ${r.event} → ${r.handler}`);
    expect(strays, `plugin registration(s) bypassing hook-shim.mjs:\n  ${strays.join('\n  ')}`).toEqual([]);
  });

  it('counts the code-copy MIRRORS separately from the mesh — they are one registration, not two', () => {
    // The installed plugin cache and the marketplace clone are the same registrations delivered to
    // different directories. Folding them into the mesh would invent phantom duplicates and make M1
    // fire on itself; dropping them entirely would erase the axis F3 is about. (The count is read
    // from the plugin registry, never hardcoded — an earlier comment here said "15" and was wrong
    // within a day of signal-watch landing as the 16th.)
    const c = census(fullReg);
    const repoCount = c.rows.find((r) => r.layer === 'plugin').count;
    for (const row of c.rows.filter((r) => !r.inMesh && r.present)) {
      // A DRIFT reading, not a defect reading. A mirror BEHIND the repo is the expected state
      // between a registration landing here and the installed copy being refreshed — so the message
      // has to name which direction it drifted and what closes it, or the next person reads
      // "expected 15 to be 16" as broken code and goes looking in the wrong file.
      expect(
        row.count,
        `${row.layer} mirror has ${row.count} registration(s); the repo declares ${repoCount}. `
          + `${row.count < repoCount
            ? 'The installed copy is BEHIND — publish + restart Claude Code to refresh it.'
            : 'The installed copy is AHEAD of this checkout — you are on an older branch.'}`,
      ).toBe(repoCount);
    }
    expect(c.mesh + c.mirrors).toBe(c.total);
  });

  it('matcher semantics model what Claude Code really does — a SEARCH, which is why the accidents happen', () => {
    // Not a style preference: `Task` selecting TaskStop (F3) and `Write|Edit|MultiEdit` selecting
    // NotebookEdit (F4) are both consequences of substring search, and a lint that modelled full
    // matching would report both registries as clean.
    expect(matchedTools('Task', 'PreToolUse')).toContain('TaskStop');
    expect(matchedTools('Write|Edit|MultiEdit', 'PostToolUse')).toContain('NotebookEdit');
    expect(matchedTools('^(Write|Edit|MultiEdit)$', 'PreToolUse')).not.toContain('NotebookEdit');
    expect(matchedTools('*', 'PreToolUse')).toEqual(['*']);
    expect(matchedTools('startup', 'SessionStart')).toEqual(['*']);   // lifecycle source, not a tool
    expect(isAnchored('^Bash$')).toBe(true);
    expect(isAnchored('Bash')).toBe(false);
    expect(hasFailsafe('node x.mjs || true')).toBe(true);
    expect(hasFailsafe('node x.mjs')).toBe(false);
  });
});

describe('mesh invariants over the layers this repo OWNS (must stay clean — this is the CI gate)', () => {
  it('M1 — no handler is registered twice from two different code roots on an overlapping (event, tool)', () => {
    const f = lintM1(repoReg.records);
    expect(f, `duplicate handler across code copies:\n  ${show(f)}`).toEqual([]);
  });

  it('M3 — every registration declares a timeout, and any value >60 is a wrong-unit bug by fiat', () => {
    const f = lintM3(repoReg.records);
    expect(f, `timeout defects:\n  ${show(f)}`).toEqual([]);
  });

  it('M5 — every tool-event matcher is anchored, or named in the checked-in allowlist with a reason', () => {
    const f = lintM5(repoReg.records, repoReg.matcherAllowlist);
    expect(f, `unanchored matcher(s) not on the allowlist:\n  ${show(f)}`).toEqual([]);
  });

  it('M5 — and the allowlist carries no fiction: every entry matches a live registration', () => {
    // An amnesty list that outlives the thing it excused is how a ratchet turns into permission.
    const f = lintAllowlistStale(repoReg.records, repoReg.matcherAllowlist);
    expect(f, `stale allowlist entr(ies):\n  ${show(f)}`).toEqual([]);
    expect(repoReg.matcherAllowlist.length, 'an allowlist with no reasons recorded is not an allowlist').toBeGreaterThan(0);
    for (const a of repoReg.matcherAllowlist) {
      expect(a.reason, `allowlist entry ${a.layer}/${a.event}/${a.matcher} has no reason`).toBeTruthy();
      expect(a.retiredBy, `allowlist entry ${a.layer}/${a.event}/${a.matcher} names no exit condition`).toBeTruthy();
    }
  });

  it('M6 — every registration declares an offBehavior, through the shim table or hook-contracts.json', () => {
    const f = lintM6(repoReg.records);
    expect(f, `no declared brain-OFF behaviour:\n  ${show(f)}`).toEqual([]);
    for (const r of mesh(repoReg.records)) expect(OFF_BEHAVIORS).toContain(r.offBehavior);
  });

  it('M6 — the out-of-shim contracts are real contracts, not a checkbox file', () => {
    // ADR-055 §6 lists what a per-hook contract must carry. A file that declared only `offBehavior`
    // would satisfy the lint above and tell an operator nothing.
    const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'plugin/hooks/hook-contracts.json'), 'utf8'));
    expect(doc.contracts.length).toBeGreaterThan(0);
    for (const c of doc.contracts) {
      for (const k of ['mode', 'offBehavior', 'offReason', 'failureBehavior', 'timeoutSeconds', 'reachesStrangers', 'owner']) {
        expect(c[k], `contract ${c.id} is missing ${k}`).not.toBe(undefined);
      }
      expect(['advisory', 'blocking']).toContain(c.mode);
      expect(OFF_BEHAVIORS).toContain(c.offBehavior);
    }
  });

  it('exactly ONE Stop-plane registration in the layers this repo owns (ADR-055 §3.4: no second Stop hook)', () => {
    const stops = mesh(repoReg.records).filter((r) => r.event === 'Stop');
    expect(stops.map((r) => `${r.layer} ${r.locator} ${r.handler}`)).toHaveLength(1);
  });
});

describe('falsifiability — every invariant proven to fail on a seeded violation (ADR-055 §7.15)', () => {
  // An invariant nobody has watched fail is a claim. Each case below feeds the REAL lint function a
  // record set with one seeded defect, and asserts it goes red — and that removing the defect makes
  // it green again, so the rule is bound to the defect and not to the fixture's mere existence.
  const rec = (over = {}) => ({
    layer: 'plugin', file: 'x', locator: 'x:1', event: 'PreToolUse', matcher: '^Bash$', command: 'node a.mjs',
    timeout: 5, mode: 'blocking', offBehavior: 'run', reachesStrangers: true, inMesh: true,
    handler: 'a.mjs', codeRoot: 'spine', effectiveMode: 'blocking', anchored: true, tools: ['Bash'], ...over,
  });

  it('M1 goes red when one handler appears from two code roots — and green from one', () => {
    const clash = [rec(), rec({ layer: 'user', codeRoot: 'marketplace-clone', locator: 'y:2' })];
    expect(lintM1(clash)).toHaveLength(1);
    expect(lintM1(clash)[0].blocking).toBe(true);
    expect(lintM1([rec(), rec({ layer: 'user', locator: 'y:2' })]), 'same root = one behaviour').toEqual([]);
  });

  it('M3 goes red on a missing timeout AND on a milliseconds-intent value in a seconds field', () => {
    expect(lintM3([rec({ timeout: null })])[0].kind).toBe('missing');
    expect(lintM3([rec({ timeout: 5000 })])[0].kind).toBe('wrong-unit');
    expect(lintM3([rec({ timeout: 60 })]), '60 is the boundary and is legal').toEqual([]);
  });

  it('M5 goes red on an unanchored tool matcher, green when allowlisted, green on a lifecycle event', () => {
    const bad = rec({ matcher: 'Bash', anchored: false, tools: ['Bash', 'BashOutput'] });
    expect(lintM5([bad], [])).toHaveLength(1);
    expect(lintM5([bad], [{ layer: 'plugin', event: 'PreToolUse', matcher: 'Bash', handler: 'a.mjs' }])).toEqual([]);
    expect(lintM5([rec({ event: 'SessionStart', matcher: 'startup', anchored: false })], [])).toEqual([]);
  });

  it('M5-stale goes red on an allowlist entry that matches nothing', () => {
    expect(lintAllowlistStale([rec()], [{ layer: 'plugin', event: 'PreToolUse', matcher: 'ghost', reason: 'r' }])).toHaveLength(1);
  });

  it('M6 goes red on an undeclared offBehavior and on a misspelled one', () => {
    expect(lintM6([rec({ offBehavior: null })])).toHaveLength(1);
    expect(lintM6([rec({ offBehavior: 'quiet' })]), 'a value outside the contract is not a declaration').toHaveLength(1);
    expect(lintM6([rec({ offBehavior: 'partial' })])).toEqual([]);
  });

  it('every invariant ignores the code-copy mirrors — otherwise it fires on itself', () => {
    const mirror = rec({ layer: 'marketplace-clone', inMesh: false, timeout: null, offBehavior: null, codeRoot: 'marketplace-clone' });
    expect(lintM1([rec(), mirror])).toEqual([]);
    expect(lintM3([mirror])).toEqual([]);
    expect(lintM6([mirror])).toEqual([]);
  });
});

describe('the Stop off-contract is HONOURED, not merely declared (ADR-054 §3 applied to F5)', () => {
  // The shim table now says `offBehavior: 'run'` for continuation-gate. That is a string in a file.
  // These two cases drive the REAL shim as a subprocess against a REAL brain-off sentinel, because
  // the only thing that makes an off-contract worth declaring is that the machine obeys it.
  const fire = (id, { off, ledger, home }) => {
    const env = {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: path.join(REPO, 'plugin'),
      RUVNET_BRAIN_HOME: path.join(home, 'brain'),
      RUVNET_BRAIN_STATE_DIR: path.join(home, 'cfg'),
      RUVNET_CONTINUATION_COOLDOWN_MS: '0',
    };
    if (ledger) env.RUVNET_WORK_LEDGER = ledger;
    if (off) fs.writeFileSync(path.join(home, 'cfg', 'brain-off'), '');
    const r = spawnSync('node', [SHIM, id], {
      input: JSON.stringify({ stop_hook_active: false, session_id: `mesh-${Math.random()}` }),
      encoding: 'utf8', env, timeout: 15000,
    });
    return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };

  const scratch = () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-off-'));
    fs.mkdirSync(path.join(home, 'cfg'), { recursive: true });
    const ledger = path.join(home, 'ledger.json');
    fs.writeFileSync(ledger, JSON.stringify({ items: [{ text: 'an open commitment', done: false, at: new Date().toISOString() }] }));
    return { home, ledger };
  };

  it('brain ON: the gate fires through the shim and its envelope reaches STDOUT (the control)', () => {
    const { home, ledger } = scratch();
    const r = fire('continuation-gate', { off: false, ledger, home });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.hookEventName).toBe('Stop');
    expect(r.stdout).toContain('an open commitment');
  });

  it('brain OFF: it STILL fires — honesty about open work is not a retrieval feature', () => {
    const { home, ledger } = scratch();
    const r = fire('continuation-gate', { off: true, ledger, home });
    expect(r.code).toBe(0);
    expect(r.stdout, 'declared run, behaved silent — the declaration would be decoration').toContain('an open commitment');
  });

  it('brain OFF: a `silence` entry under the SAME sentinel writes zero bytes — otherwise "run" proves nothing', () => {
    const { home } = scratch();
    const r = fire('md-stamp', { off: true, home });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THIS BLOCK IS EXPECTED TO FAIL ON THE MAINTAINER'S MACHINE. THAT IS THE POINT.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every finding below is in a file this repo does not own — the machine owner's
 * `~/.claude/settings.json`, or a third-party plugin's own `hooks.json`. Silencing them would make
 * the lint agree with a machine it has just measured to be wrong; "fixing" them would mean editing
 * a stranger's registry from a test run. So they stay red HERE, by name, with the owner action each
 * one needs, and are SKIPPED wherever those files do not exist (CI) so the ship gate stays truthful.
 *
 * If this block ever goes green on this laptop, check that the findings were resolved and not that
 * the skip condition was widened.
 */
describe.skipIf(SKIP_MACHINE)('the FULL merged mesh, this machine — documented expected-red (ADR-055 appendix B)', () => {
  it('the mesh is far larger than the one file the old suite could read (F16, measured)', () => {
    const c = census(fullReg);
    const plugin = c.rows.find((r) => r.layer === 'plugin').count;
    expect(c.mesh, `merged mesh ${c.mesh} vs the ${plugin} hook-contract.test.mjs can see`).toBeGreaterThan(plugin * 2);
  });

  it('F3 — route-dispatch is registered BLOCKING from two code copies (plugin spine + marketplace clone)', () => {
    const f = lintM1(fullReg.records);
    expect(f, [
      'OWNER ACTION (ADR-055 build item 8): distribute the dispatch wall through the plugin with an',
      'anchored `^(Task|Agent)$` matcher and delete the ~/.claude/settings.json copy. Until then two',
      'blocking walls guard one call from two code roots, and only one of them updates with the spine:',
      `  ${show(f)}`,
    ].join('\n')).toEqual([]);
  });

  it('F18 — thirteen third-party handlers run on the host default, and one SessionStart declares 180s', () => {
    const f = lintM3(fullReg.records);
    expect(f, [
      'OWNER ACTION: these are Anthropic\'s and Vercel\'s plugins, not ours — the fix is upstream',
      '(or disabling the plugin), never a local edit to a stranger\'s registry. Recorded because a',
      '600s default on a prompt-path hook is the exact failure ADR-053 shipped a timeout lint for:',
      `  ${show(f)}`,
    ].join('\n')).toEqual([]);
  });

  it('F3/F4 — unanchored tool matchers outside this repo (Task|Agent, Write|Edit|MultiEdit, …)', () => {
    const f = lintM5(fullReg.records, fullReg.matcherAllowlist);
    expect(f, [
      'OWNER ACTION: the user-layer entries are yours to anchor; the third-party ones are upstream.',
      'NOT allowlisted on purpose — this repo\'s allowlist covers registrations this repo ships, and',
      'excusing someone else\'s matcher in our file would be recording a decision we cannot make:',
      `  ${show(f)}`,
    ].join('\n')).toEqual([]);
  });

  it('F14 — no declared brain-OFF behaviour anywhere outside this repo\'s two registries', () => {
    const f = lintM6(fullReg.records);
    expect(f, [
      'OWNER ACTION (ADR-055 build item 8): the two walls that belong to this product',
      '(ground-before-write, route-dispatch) move into the shipped plugin, where the shim table',
      'declares their off-contract natively. The rest are third-party and stay undeclared —',
      'honestly enumerated rather than silently assumed silent:',
      `  ${show(f)}`,
    ].join('\n')).toEqual([]);
  });

  it('F19 — three independent behaviours can act on one completed turn (brain Stop, third-party asyncRewake)', () => {
    const stops = mesh(fullReg.records).filter((r) => r.event === 'Stop');
    expect(stops.map((r) => `${r.layer} ${r.locator} ${r.handler}${r.asyncRewake ? ' [asyncRewake]' : ''}`), [
      'OWNER ACTION: ADR-055 §3.4 converged on NO second Stop hook. This repo\'s duplicate is deleted',
      'as of this branch; what remains is security-guidance\'s asyncRewake reviewer, which can rewake',
      'a turn the continuation gate has already decided about. Upstream, or disable the plugin:',
    ].join('\n')).toHaveLength(1);
  });
});
