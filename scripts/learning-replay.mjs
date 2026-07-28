#!/usr/bin/env node
/**
 * scripts/learning-replay.mjs — the COUNTERFACTUAL REPLAY TRAP (ADR-058 §D4, DDD-0013 Context 1,
 * aggregate `CounterfactualTrap`). Invariant name: **LEARNING-REPLAY**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS INVERTS, and why it exists at all.
 *
 * `scripts/behavioral-l1-l4.mjs`'s L4 asserts that the brain's own injected prose CONTAINS the words
 * 'take the wheel', 'SPARC', 'swarm'. That is a check on what the brain SAID. It cannot fail on an
 * agent that ignored every word of it, and it certified "behavioral, all pass" for weeks while
 * nothing downstream was measured at all. This file measures the opposite thing and only that thing:
 *
 *     did an agent's PRODUCED ARTIFACT change, against a control that did not receive the lesson.
 *
 * The oracle is a parse of a command string — `plugin/scripts/hook-input.mjs:findInvocations()`,
 * executable-position classification, the same anti-corruption boundary DDD-0013 mandates against
 * the host's Bash envelope. It is never a similarity score and never a model grading a model.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * THE TRAP, concretely (ADR-058 §D4 specifies it so it cannot dissolve into intention).
 *
 *   RECORD, in fixture-project-A: the correction that `ruflo memory search` takes its query with the
 *   `-q` flag and rejects a bare positional. This is a FACT ABOUT THE REAL CLI, verified against the
 *   real global binary (`~/.npm-global/bin/ruflo memory search --help` prints
 *   `-q, --query   Search query (required)`), not recalled. An oracle built on a false premise is
 *   worthless, so the harness RE-VERIFIES it at run time (`verifyRufloFlag()`) and refuses to run
 *   against a CLI whose interface no longer matches.
 *
 *   REPLAY, in fixture-project-B: a fresh session, a DIFFERENTLY-WORDED task ("recall the note about
 *   the caching strategy") that shares no content word with the lesson. String-matching the lesson
 *   text cannot be what carries it; only the flag can.
 *
 *   PASS requires all three:
 *     (a) the lesson is in the transcript BEFORE the first tool call — measured as stream position,
 *         not asserted from the fact that UserPromptSubmit "happens first";
 *     (b) the treated arm's produced command carries the token where the BRAIN-OFF CONTROL's does not;
 *     (c) it still holds after a nightly refresh runs between record and replay — the refresh is
 *         real: a new Stable-Spine generation is installed into the fixture brain home and the
 *         pointer flipped, so the replay's hooks execute from a DIFFERENT code root than the record
 *         did, and `ruflo memory distill run` / `ruflo memory backup` (the two commands
 *         scripts/nightly-wrapper.sh actually runs nightly) are run against project A's store.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * THE INVALIDATION RULE — DDD-0013 invariant 6, and the whole point of the file.
 *
 *     A trap whose CONTROL run also produces the token is INVALID. The result is INCONCLUSIVE.
 *     NEVER a pass.
 *
 * If the model would have got it right anyway, the trap measured nothing — it measured the model's
 * priors. This is encoded as CODE, not as a comment: `aggregate()` computes `controlTokenRuns`
 * FIRST and the PASS branch is unreachable while it is non-zero, and a final assertion throws if a
 * PASS verdict is ever paired with a successful control. A check that can report PASS on a
 * meaningless measurement is the L4 defect rebuilt one file to the left.
 *
 * (DDD-0013 invariant 6 words the invalid outcome as `UNKNOWN`; ADR-058 §D4 words it `INCONCLUSIVE`.
 * This file emits INCONCLUSIVE and treats it as strictly non-PASS, which satisfies both — the two
 * documents disagree on the LABEL, never on the consequence.)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * A RATE, NEVER A VERDICT. N runs, PASS at >= 2/3 of them, transcripts archived. One run of a
 * stochastic system is an anecdote; the artifact records k/n and every arm's classification.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE ARMS ACTUALLY DIFFER BY — the product's OWN switch, not a harness flag.
 *
 * Both arms run the identical fixture, the identical prompt, the identical hook registration
 * (`hook-shim.mjs unprompted-speech UserPromptSubmit`, exactly as plugin/hooks/hooks.json registers
 * it). The ONLY difference is the presence of the `brain-off` sentinel in the arm's
 * RUVNET_BRAIN_STATE_DIR — ADR-054's real consent switch, whose `offBehavior: 'silence'` contract
 * for the unprompted plane means the control receives ZERO bytes. That is why mutant 2 ("run the
 * treated arm brain-disabled") is not a separate code path: it IS the control condition.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * COST. Real model tokens, priced in the open (ADR-058 §D4: "the one standing spend"). Default model
 * is haiku — the trap measures whether CONTEXT REACHES the agent, not whether the agent is clever.
 * Measured 2026-07-27 on this machine: ~$0.10 and ~8s of wall clock per arm, 2 arms per run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * USAGE
 *   node scripts/learning-replay.mjs                 # N=3 replay, real tokens, writes the artifact
 *   node scripts/learning-replay.mjs --n 1           # one run
 *   node scripts/learning-replay.mjs --check         # NO tokens: gate on the committed artifact
 *   node scripts/learning-replay.mjs --dry-run       # NO tokens: build fixtures, prove the wire, UNKNOWN
 *   node scripts/learning-replay.mjs --mutant <name> # delete-lesson | brain-off-treated | seed-control
 * Exit: 0 = PASS. 1 = FAIL. 3 = INCONCLUSIVE. 4 = UNKNOWN. (Only 0 is a pass, by construction.)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findInvocations } from '../plugin/scripts/hook-input.mjs';
import { makeLesson, saveLessons, loadLessons } from './lesson-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The invariant name the release-gate vector in scripts/claims-verify.mjs consumes. */
export const INVARIANT = 'LEARNING-REPLAY';

export const VERDICT = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNKNOWN: 'UNKNOWN',
  INCONCLUSIVE: 'INCONCLUSIVE',
});
/** Exit codes. PASS is the ONLY zero — UNKNOWN is never a pass, and neither is INCONCLUSIVE. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCONCLUSIVE: 3, UNKNOWN: 4 });

/** The committed, machine-readable result artifact. */
export const RESULT_FILE = path.join(ROOT, 'data', 'learning-replay-result.json');

/**
 * The files whose change invalidates a recorded result. `--check` refuses to call a result CURRENT
 * for a SHA if any of these moved since — ADR-056's currency discipline, applied to a token-priced
 * measurement that cannot be re-run on every commit.
 */
export const LOAD_BEARING = Object.freeze([
  'scripts/learning-replay.mjs',
  'scripts/ci/learning-replay-recorder.mjs',
  'scripts/lesson-store.mjs',
  'scripts/lesson-gate.mjs',
  'plugin/scripts/lesson-hooks.sh',
  'plugin/scripts/unprompted-runtime.mjs',
  'plugin/scripts/hook-shim.mjs',
  'plugin/scripts/hook-input.mjs',
]);

// ── THE ORACLE ──────────────────────────────────────────────────────────────────────────────────
/**
 * Classify ONE produced command against the machine-checkable token.
 *
 *   'flagged'    — a ruflo invocation that delivers its query through `-q` / `--query`.
 *                  THIS IS THE TOKEN — and it is the token ADR-058 §D4 names, verbatim:
 *                  "the produced command uses -q where the brain-off control uses the positional form".
 *   'positional' — a ruflo invocation carrying a bare positional query and no -q/--query. The exact
 *                  wrong form the lesson names.
 *   'other'      — ruflo invoked, but the query arrives some other way (`--topic`, `--project`), or
 *                  no query at all.
 *   'none'       — no ruflo invocation at all.
 *
 * `--query` counts as the token even though the lesson says `-q`: the live `--help` prints them as
 * ONE option (`-q, --query`), so failing the long form would make the oracle reject a command that is
 * correct. An oracle stricter than the interface it models measures its own arbitrariness. The
 * consequence is faced rather than tuned away — a control arm that reaches `--query` on its own
 * INVALIDATES the trap, which is invariant 6 doing its job.
 *
 * ── WHY THE SUBCOMMAND IS *REPORTED* AND NOT *GATED* (corrected 2026-07-27 by running it) ────────
 * The first shipped oracle additionally required the invocation to be `ruflo memory search`. The
 * first real N=3 run measured: treated 3/3 carried `-q` and control 0/3 did — a clean, total
 * separation — and the oracle scored it 0/3 FAIL, because the treated arm spelled the subcommand
 * `ruflo recall -q …` / `ruflo memory recall -q …`.
 *
 * The lesson recorded in project A says the QUERY GOES BEHIND `-q`. It says nothing about which
 * subcommand to use. So the old oracle failed the treatment on a dimension the treatment never
 * carried — measuring the model's prior knowledge of rUv's command tree, not whether the lesson
 * travelled. That is exactly the harness error Rule 22 check (d) exists to catch, and the fix is to
 * the HARNESS, never to the lesson: tuning the lesson to name the subcommand after seeing the
 * result would be fitting the fixture to the answer.
 *
 * `subcommandCorrect()` still records whether the invocation was the real `memory search`, and it
 * lands in the artifact for every arm — observed, never gating. Reporting a measurement you do not
 * gate on is how the next reader can disagree with this call using the same data.
 */
export function classifyCommand(cmd) {
  const invocations = findInvocations(String(cmd || ''), ['ruflo', 'claude-flow']);
  if (!invocations.length) return 'none';
  let sawPositional = false;
  for (const inv of invocations) {
    const args = inv.args.filter((a) => a !== '');
    if (args.some((a) => a === '-q' || a === '--query' || a.startsWith('--query='))) return 'flagged';
    // Bare (non-flag, non-flag-value) tokens. A flag consumes the token after it unless that token
    // is itself a flag — generic, so `--topic "x"` and `-n default` are handled without a whitelist
    // that would rot the moment rUv adds an option.
    const bare = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('-')) { if (!a.includes('=') && args[i + 1] && !args[i + 1].startsWith('-')) i++; continue; }
      bare.push(a);
    }
    // Which bare token is the QUERY rather than a subcommand? A subcommand is one short lowercase
    // word; a query is a phrase. So: a bare token past the first that contains whitespace (or is
    // implausibly long) is a positional query, as is any third bare token.
    // ONLY THE LABEL DEPENDS ON THIS. The verdict keys on `flagged` vs not-`flagged` and on `none`;
    // 'positional' and 'other' are both simply "did not carry the token". A mislabel here can never
    // move PASS/FAIL/INCONCLUSIVE — it can only make the reported description of a control arm less
    // precise, which is why a heuristic is acceptable HERE and nowhere near the token itself.
    const queryish = (t) => /\s/.test(t) || t.length > 24;
    if (bare.length >= 3 || bare.slice(1).some(queryish)) sawPositional = true;
  }
  return sawPositional ? 'positional' : 'other';
}

/** Observed, never gating: was the invocation the REAL `ruflo memory search`? */
export function subcommandCorrect(cmd) {
  for (const inv of findInvocations(String(cmd || ''), ['ruflo', 'claude-flow'])) {
    const words = inv.args.filter((a) => a !== '' && !a.startsWith('-'));
    const mi = words.indexOf('memory');
    if (mi !== -1 && words[mi + 1] === 'search') return true;
  }
  return false;
}

/** The token test, isolated so every caller asks it the same way. */
export const carriesToken = (cls) => cls === 'flagged';

/**
 * ONE run's verdict. Order of the branches IS the invariant: the control is judged BEFORE the
 * treated arm can be credited with anything.
 */
export function verdictForRun(run) {
  const { treatedClass, controlClass, lessonBeforeFirstToolCall, error } = run;
  if (error) return { verdict: VERDICT.UNKNOWN, why: `harness could not measure this run: ${error}` };
  // NO COMPARABLE CONTROL ARTIFACT IS NOT A WIN. If the control never invoked ruflo at all, there is
  // no counterfactual to difference against — the treated arm may have "changed" against nothing.
  // Deliberately strict, and it can only ever LOWER the rate: an unopposed treated arm is UNKNOWN.
  if (controlClass === 'none') {
    return { verdict: VERDICT.UNKNOWN, why: 'the control arm produced no ruflo invocation at all — there is no comparable artifact to difference against' };
  }
  if (treatedClass === 'none') {
    return { verdict: VERDICT.FAIL, why: 'the treated arm produced no ruflo invocation at all' };
  }
  // INVARIANT 6, FIRST AND UNCONDITIONALLY.
  if (carriesToken(controlClass)) {
    return {
      verdict: VERDICT.INCONCLUSIVE,
      why: `the CONTROL arm produced the token (${controlClass}) — the model would have got it right without the lesson, so this trap measured nothing`,
    };
  }
  if (!carriesToken(treatedClass)) {
    return { verdict: VERDICT.FAIL, why: `treated arm produced "${treatedClass}", not the token` };
  }
  if (lessonBeforeFirstToolCall !== true) {
    return { verdict: VERDICT.FAIL, why: 'treated arm carried the token but the lesson was NOT observed in the transcript before the first tool call' };
  }
  return { verdict: VERDICT.PASS, why: `treated "${treatedClass}" vs control "${controlClass}", lesson delivered before the first tool call` };
}

/**
 * The RATE. N runs in, one verdict + a k/n out.
 *
 * PASS is structurally unreachable while any control succeeded: `controlTokenRuns` is computed
 * before the branch and the assertion at the bottom re-checks it. Removing either guard and running
 * the `seed-control` mutant is how you prove this is real rather than decorative.
 */
export function aggregate(runs, { threshold = 2 / 3 } = {}) {
  const perRun = runs.map((r) => ({ ...r, ...verdictForRun(r) }));
  const n = perRun.length;
  const passes = perRun.filter((r) => r.verdict === VERDICT.PASS).length;
  const fails = perRun.filter((r) => r.verdict === VERDICT.FAIL).length;
  const unknowns = perRun.filter((r) => r.verdict === VERDICT.UNKNOWN).length;
  const controlTokenRuns = perRun.filter((r) => carriesToken(r.controlClass)).length;

  let verdict, why;
  if (n === 0) {
    verdict = VERDICT.UNKNOWN; why = 'zero runs executed — an empty run is not a pass';
  } else if (controlTokenRuns > 0) {
    verdict = VERDICT.INCONCLUSIVE;
    why = `${controlTokenRuns}/${n} CONTROL run(s) produced the token — DDD-0013 invariant 6: the trap is INVALID, not passed`;
  } else if (passes / n >= threshold) {
    verdict = VERDICT.PASS;
    why = `${passes}/${n} runs passed (bar ${Math.ceil(threshold * n)}/${n})`;
  } else if (unknowns > 0 && passes + fails < n) {
    verdict = VERDICT.UNKNOWN;
    why = `${unknowns}/${n} run(s) could not be measured; ${passes}/${n} passed — below the bar with the reason unknown`;
  } else {
    verdict = VERDICT.FAIL;
    why = `${passes}/${n} runs passed — below the ${Math.ceil(threshold * n)}/${n} bar`;
  }

  // The guard that makes invariant 6 code rather than prose. If this ever throws, the branch order
  // above was edited and the trap is unsafe — that is a stop-the-line event, not a warning.
  if (verdict === VERDICT.PASS && controlTokenRuns > 0) {
    throw new Error('LEARNING-REPLAY: refusing to report PASS while a control arm produced the token (DDD-0013 invariant 6)');
  }
  return { verdict, why, n, passes, fails, unknowns, controlTokenRuns, rate: n ? +(passes / n).toFixed(4) : 0, runs: perRun };
}

// ── the real CLI's real interface, re-verified at run time ──────────────────────────────────────
export const RUFLO_BIN = process.env.RUVNET_RUFLO_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'ruflo');

/**
 * Re-verify the premise. Rule 0 applied to the one fact the whole oracle rests on: `ruflo memory
 * search` must still take `-q/--query` and must still mark it REQUIRED. If rUv changes the
 * interface, the honest outcome is UNKNOWN and a loud line — never a silent pass against a lesson
 * that is no longer true.
 */
export function verifyRufloFlag(bin = RUFLO_BIN) {
  if (!fs.existsSync(bin)) return { ok: false, why: `ruflo binary not found at ${bin} (Rule 21: the GLOBAL binary, never npx)` };
  const r = spawnSync(bin, ['memory', 'search', '--help'], { encoding: 'utf8', timeout: 30_000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0 && !out) return { ok: false, why: `ruflo memory search --help exited ${r.status} with no output` };
  const flag = /-q,\s*--query/.test(out);
  const required = /--query[^\n]*required/i.test(out);
  const positionalDocumented = /\bmemory search\s+"[^"]+"\s*$/m.test(out);
  if (!flag) return { ok: false, why: 'live `ruflo memory search --help` no longer advertises `-q, --query` — the lesson this trap records is no longer true', help: out };
  if (positionalDocumented) return { ok: false, why: 'live help now shows a POSITIONAL query example — the trap premise (positional is rejected) is broken', help: out };
  return { ok: true, flag: '-q, --query', required, evidence: out.split('\n').find((l) => /-q,\s*--query/.test(l))?.trim() || '' };
}

// ── the fixture world ───────────────────────────────────────────────────────────────────────────
const CLAUDE_BIN = process.env.RUVNET_CLAUDE_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'claude');

/** Project B's task. Shares no content word with the lesson — the lesson cannot be string-matched into it. */
export const REPLAY_PROMPT =
  'Earlier in this project someone recorded a note about the caching strategy. '
  + "Recall it from this project's agent memory with the ruflo CLI. "
  + 'Run the recall command now, then tell me what you ran.';

/** The correction as it is written down in fixture-project-A, in project A's own words. */
export const LESSON_STATEMENT =
  'When you look something up in agent memory with the ruflo CLI, the query has to be passed with the '
  + '-q flag; a bare quoted phrase placed after the subcommand is rejected.';

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, ...opts });

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* nothing to remove */ } }

/**
 * Build the two fixture projects and the isolated brain world.
 *
 * Everything the product reads is redirected by env — RUVNET_BRAIN_HOME (spine), RUVNET_BRAIN_STATE_DIR
 * (the on/off sentinel), RUVNET_LESSON_STORE, RUVNET_LESSON_GATE_STATE. Nothing here touches the
 * user's real ~/.config/ruvnet-brain, ~/.cache/ruvnet-brain, or any real project's memory.
 */
export function buildFixtures(baseDir) {
  rmrf(baseDir);
  const dirs = {
    base: baseDir,
    projectA: path.join(baseDir, 'fixture-project-a'),
    projectB: path.join(baseDir, 'fixture-project-b'),
    brainHome: path.join(baseDir, 'brain-home'),
    stateOn: path.join(baseDir, 'state-on'),
    stateOff: path.join(baseDir, 'state-off'),
    transcripts: path.join(baseDir, 'transcripts'),
  };
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
  dirs.lessons = path.join(baseDir, 'lessons.json');
  dirs.gateState = path.join(baseDir, 'lesson-gate-state.json');
  // The control's switch: ADR-054's real sentinel, in the control's own state dir.
  fs.writeFileSync(path.join(dirs.stateOff, 'brain-off'), JSON.stringify({ since: new Date().toISOString() }));
  // Each fixture project is its own git repo so lesson-gate's project-scope resolution (which walks
  // up to the nearest .git) sees `fixture-project-b`, not the harness's own repo.
  for (const p of [dirs.projectA, dirs.projectB]) {
    sh('git', ['init', '-q'], { cwd: p });
    fs.mkdirSync(path.join(p, '.swarm'), { recursive: true });
  }
  return dirs;
}

/**
 * RECORD, in fixture-project-A.
 *
 * Two layers, both real:
 *   1. the correction is written into project A's OWN memory with `ruflo memory store` — the real
 *      CLI, the real per-project `.swarm/memory.db` the global memory policy mandates. It is then
 *      READ BACK with `ruflo memory search -q` (the very flag under test, so the record step itself
 *      exercises the true interface), and the retrieved text is what the lesson is built from. The
 *      lesson is DERIVED from project A, not hardcoded beside it.
 *   2. the derived lesson is written into the machine-global lesson store the gate actually reads.
 *
 * SCOPE, stated plainly rather than finessed: the lesson is stored UNSCOPED (`projects: []`), which
 * lesson-gate.mjs treats as "applies anywhere, by declaration". The alternative — scoping it to
 * fixture-project-A — would make the product correctly REFUSE to speak it in project B (its
 * cross-project bar is ADR-029's win-twice: >= 2 independent projects), and the trap would then be
 * measuring the scope rule rather than the learning wire. So this trap does NOT exercise the
 * win-twice promotion bar; it exercises delivery, ratification, refresh-survival and the artifact
 * change. That gap is real and is recorded here rather than hidden.
 */
export function recordInProjectA(dirs, { ruflo = RUFLO_BIN } = {}) {
  const dbA = path.join(dirs.projectA, '.swarm', 'memory.db');
  const key = 'lesson-ruflo-memory-search-flag';
  const store = sh(ruflo, ['memory', 'store', '-k', key, '--value', LESSON_STATEMENT, '-n', 'default', '--path', dbA],
    { cwd: dirs.projectA });
  // Read it back through the interface under test. If this cannot find the row, the record step did
  // not happen and everything downstream would be measuring a fixture bug.
  const back = sh(ruflo, ['memory', 'search', '-q', 'ruflo CLI memory query flag', '-n', 'default', '--path', dbA, '-t', 'keyword'],
    { cwd: dirs.projectA });
  const recorded = fs.existsSync(dbA);

  const lesson = makeLesson({
    id: 'FX-D4-ruflo-memory-search-flag',
    statement: LESSON_STATEMENT,
    // `assert-fact` is the decision point the real dispatcher requests at UserPromptSubmit
    // (plugin/scripts/lesson-hooks.sh) — i.e. before any tool call, which is PASS-condition (a).
    trigger: 'assert-fact',
    enforcement: 'checklist',
    origin: 'user-stated',
    status: 'ratified',
    severity: 'high',
    repeatCount: 4,
    projects: [],
    check: 'the produced ruflo memory search command delivers its query through -q/--query',
    evidence: [
      { observed: `recorded in fixture-project-A as memory key "${key}" in ${path.relative(dirs.base, dbA)}` },
      { observed: 'live `ruflo memory search --help` prints "-q, --query   Search query (required)"' },
    ],
  });
  saveLessons([lesson], dirs.lessons);
  return {
    ok: recorded && loadLessons(dirs.lessons).length === 1,
    dbA,
    key,
    storeExit: store.status,
    readBackExit: back.status,
    lesson,
  };
}

/**
 * THE NIGHTLY REFRESH, run BETWEEN record and replay. PASS-condition (c).
 *
 * Two real things, not a sleep:
 *   1. a NEW Stable-Spine generation is installed into the fixture brain home and active.json is
 *      flipped to it — so the replay's hooks execute from a code root that did not exist when the
 *      lesson was recorded. This is exactly what scripts/update-apply.mjs does nightly, and it is the
 *      thing a lesson has to survive: the lesson store lives at user level, deliberately OUTSIDE the
 *      bundle a refresh replaces (scripts/lesson-store.mjs says so in its own persistence note).
 *   2. `ruflo memory distill run` and `ruflo memory backup` against project A's store — the two
 *      commands scripts/nightly-wrapper.sh actually runs every night.
 */
export function nightlyRefresh(dirs, { ruflo = RUFLO_BIN } = {}) {
  const gen = `d4-refresh-${Date.now()}`;
  const versionDir = path.join(dirs.brainHome, 'versions', gen);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.cpSync(path.join(ROOT, 'plugin'), versionDir, { recursive: true });
  fs.writeFileSync(path.join(dirs.brainHome, 'active.json'), JSON.stringify({ codeRoot: versionDir, generation: gen }, null, 2));
  fs.writeFileSync(path.join(dirs.brainHome, '.spine-seeded'), gen);

  const dbA = path.join(dirs.projectA, '.swarm', 'memory.db');
  const distill = sh(ruflo, ['memory', 'distill', 'run', '--path', dbA], { cwd: dirs.projectA });
  const backup = sh(ruflo, ['memory', 'backup', '--db', dbA, '--keep', '2'], { cwd: dirs.projectA });

  const survived = loadLessons(dirs.lessons).length === 1;
  // Repo-relative, never absolute: this artifact is COMMITTED, and an absolute path publishes the
  // maintainer's directory layout to every reader. The same disclosure was already found and fixed
  // once in session-start.sh; one bug, found once, must not be left everywhere else.
  return { generation: gen, codeRoot: path.relative(ROOT, versionDir), distillExit: distill.status, backupExit: backup.status, lessonSurvived: survived };
}

/** The fixture settings file — the REAL hook registration from plugin/hooks/hooks.json, plus the tap. */
function writeSettings(file, { dirs, stateDir, attemptsFile }) {
  const settings = {
    env: {
      RUVNET_BRAIN_HOME: dirs.brainHome,
      RUVNET_BRAIN_STATE_DIR: stateDir,
      RUVNET_LESSON_STORE: dirs.lessons,
      RUVNET_LESSON_GATE_STATE: dirs.gateState,
      CLAUDE_PLUGIN_ROOT: path.join(ROOT, 'plugin'),
    },
    hooks: {
      UserPromptSubmit: [{
        matcher: '*',
        hooks: [{
          type: 'command',
          command: `node ${JSON.stringify(path.join(ROOT, 'plugin', 'scripts', 'hook-shim.mjs'))} unprompted-speech UserPromptSubmit`,
          timeout: 20,
        }],
      }],
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{
          type: 'command',
          command: `node ${JSON.stringify(path.join(ROOT, 'scripts', 'ci', 'learning-replay-recorder.mjs'))} ${JSON.stringify(attemptsFile)}`,
          timeout: 20,
        }],
      }],
    },
  };
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  return file;
}

/**
 * Run ONE arm and return what it produced.
 *
 * The transcript is stream-json with --include-hook-events, so hook delivery and tool calls appear
 * IN ORDER in one array. `lessonIndex` and `firstToolIndex` are positions in that array — condition
 * (a) is a measured ordering, not an argument from how hooks are supposed to work.
 */
export function runArm({ dirs, arm, stateDir, model, appendSystemPrompt = null, tag }) {
  const attempts = path.join(dirs.transcripts, `${tag}.attempts.jsonl`);
  const settings = writeSettings(path.join(dirs.base, `settings-${tag}.json`), { dirs, stateDir, attemptsFile: attempts });
  const streamFile = path.join(dirs.transcripts, `${tag}.stream.jsonl`);

  const argv = [
    '-p', REPLAY_PROMPT,
    '--model', model,
    '--tools', 'Bash',
    '--permission-mode', 'bypassPermissions',
    '--setting-sources', '',
    '--settings', settings,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-hook-events',
    '--no-session-persistence',
    '--max-budget-usd', '0.30',
  ];
  if (appendSystemPrompt) argv.push('--append-system-prompt', appendSystemPrompt);

  const started = Date.now();
  const r = spawnSync(CLAUDE_BIN, argv, { cwd: dirs.projectB, encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
  const wallMs = Date.now() - started;
  fs.writeFileSync(streamFile, r.stdout || '');
  if (r.stderr) fs.writeFileSync(path.join(dirs.transcripts, `${tag}.stderr.txt`), r.stderr);

  const events = (r.stdout || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const probe = LESSON_STATEMENT.slice(0, 60);
  let lessonIndex = -1, firstToolIndex = -1, lessonDelivered = false;
  events.forEach((e, i) => {
    if (lessonIndex === -1 && e.type === 'system' && e.subtype === 'hook_response'
      && typeof e.output === 'string' && e.output.includes(probe)) { lessonIndex = i; lessonDelivered = true; }
    if (firstToolIndex === -1 && e.type === 'assistant'
      && Array.isArray(e.message?.content) && e.message.content.some((c) => c.type === 'tool_use')) firstToolIndex = i;
  });

  const attemptLines = fs.existsSync(attempts)
    ? fs.readFileSync(attempts, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  // THE ARTIFACT is the FIRST command the agent produced — not its best one. A second attempt after
  // the sandbox refusal is a repair, and crediting a repair would let the agent learn the answer
  // from the harness instead of from the lesson.
  const firstCommand = attemptLines.length ? attemptLines[0].command : '';
  const cls = classifyCommand(firstCommand);
  const subOk = subcommandCorrect(firstCommand);

  const result = events.find((e) => e.type === 'result');
  return {
    arm,
    tag,
    class: cls,
    subcommandCorrect: subOk,
    command: firstCommand,
    attempts: attemptLines.map((a) => a.command),
    lessonDelivered,
    lessonIndex,
    firstToolIndex,
    lessonBeforeFirstToolCall: lessonDelivered && firstToolIndex > -1 && lessonIndex < firstToolIndex,
    costUsd: result?.total_cost_usd ?? null,
    wallMs,
    modelUsed: events.find((e) => e.type === 'system' && e.subtype === 'init')?.model
      || events.find((e) => e.type === 'assistant')?.message?.model || model,
    transcript: path.relative(ROOT, streamFile),
    exit: r.status,
    spawnError: r.error ? String(r.error.message) : null,
  };
}

// ── the CLI ─────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

export const MUTANTS = Object.freeze({
  'delete-lesson': 'delete the recorded lesson from the fixture store after the refresh — the treated arm must go red',
  'brain-off-treated': 'run the TREATED arm with the brain disabled — it must produce the control artifact and go red',
  'seed-control': "pre-seed the CONTROL arm's context with the lesson — the harness must report INCONCLUSIVE, never PASS",
});

function headSha() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** `--check`: gate on the committed artifact WITHOUT spending a token. */
export function checkArtifact({ file = RESULT_FILE, repo = ROOT, maxAgeDays = 14 } = {}) {
  if (!fs.existsSync(file)) {
    return { status: VERDICT.UNKNOWN, why: `no result artifact at ${path.relative(repo, file)} — the replay has never been run on this checkout` };
  }
  let a;
  try { a = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { status: VERDICT.UNKNOWN, why: `result artifact unparseable: ${e.message}` }; }
  if (a.invariant !== INVARIANT) return { status: VERDICT.UNKNOWN, why: `artifact declares invariant "${a.invariant}", expected ${INVARIANT}` };
  if (!a.sha) return { status: VERDICT.UNKNOWN, why: 'artifact states no SHA — a result with no SHA is a result about nothing' };

  const head = headSha();
  const stale = [];
  if (head && a.sha !== head) {
    // Not the same commit: the result is still CURRENT only if nothing load-bearing moved.
    const anc = spawnSync('git', ['merge-base', '--is-ancestor', a.sha, head], { cwd: repo });
    if (anc.status !== 0) return { status: VERDICT.UNKNOWN, why: `artifact SHA ${a.sha.slice(0, 8)} is not an ancestor of HEAD ${head.slice(0, 8)} — it measures a different tree` };
    const diff = spawnSync('git', ['diff', '--name-only', `${a.sha}..${head}`, '--', ...LOAD_BEARING], { cwd: repo, encoding: 'utf8' });
    if (diff.status === 0) for (const f of diff.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) stale.push(f);
  }
  if (stale.length) {
    return { status: VERDICT.UNKNOWN, why: `result recorded on ${a.sha.slice(0, 8)}, but ${stale.length} load-bearing file(s) changed since: ${stale.join(', ')} — re-run the replay` };
  }
  const ageDays = a.at ? (Date.now() - Date.parse(a.at)) / 86_400_000 : Infinity;
  if (!(ageDays <= maxAgeDays)) {
    return { status: VERDICT.UNKNOWN, why: `result is ${Number.isFinite(ageDays) ? ageDays.toFixed(1) : '?'} days old (max ${maxAgeDays}) — a nightly trap that has not run is UNKNOWN, never PASS` };
  }
  return {
    status: a.verdict,
    why: `${a.verdict} — ${a.passes}/${a.n} runs, control produced the token in ${a.controlTokenRuns}/${a.n}, recorded on ${a.sha.slice(0, 8)} (${a.model})`,
    artifact: a,
  };
}

async function main() {
  const check = has('--check');
  const dryRun = has('--dry-run');
  const mutant = arg('--mutant', null);
  const n = Math.max(1, parseInt(arg('--n', mutant ? '1' : '3'), 10) || 1);
  const model = arg('--model', 'haiku');
  const outFile = arg('--out', RESULT_FILE);
  const keep = has('--keep-fixtures');

  if (mutant && !MUTANTS[mutant]) {
    console.error(`unknown mutant "${mutant}". known: ${Object.keys(MUTANTS).join(', ')}`);
    process.exit(EXIT.UNKNOWN);
  }

  if (check) {
    const res = checkArtifact();
    console.log(`\n  ${INVARIANT}: ${res.status}\n  ${res.why}\n`);
    process.exit(EXIT[res.status] ?? EXIT.UNKNOWN);
  }

  console.log(`\n=== ${INVARIANT} — counterfactual replay (ADR-058 §D4) ===`);
  const flag = verifyRufloFlag();
  console.log(`  premise: ruflo memory search flag — ${flag.ok ? `VERIFIED live: ${flag.evidence}` : `NOT VERIFIED: ${flag.why}`}`);
  if (!flag.ok) {
    const artifact = writeArtifact(outFile, {
      verdict: VERDICT.UNKNOWN, why: `premise not verified: ${flag.why}`, n: 0, passes: 0, fails: 0, unknowns: 0, controlTokenRuns: 0, rate: 0, runs: [],
    }, { model, mutant });
    console.log(`  → UNKNOWN (never a pass). artifact: ${path.relative(ROOT, outFile)}`);
    process.exit(EXIT.UNKNOWN);
  }

  const base = path.join(ROOT, '.ruvnet-brain', 'learning-replay', `run-${Date.now()}`);
  const dirs = buildFixtures(base);
  const rec = recordInProjectA(dirs);
  console.log(`  record  (fixture-project-A): memory row ${rec.storeExit === 0 ? 'stored' : `store exit ${rec.storeExit}`}, lesson ${rec.ok ? 'derived + ratified' : 'NOT recorded'}`);
  const refresh = nightlyRefresh(dirs);
  console.log(`  refresh (nightly):           spine generation ${refresh.generation} installed + active; distill exit ${refresh.distillExit}, backup exit ${refresh.backupExit}; lesson survived: ${refresh.lessonSurvived}`);

  if (mutant === 'delete-lesson') {
    saveLessons([], dirs.lessons);
    try { fs.rmSync(path.join(dirs.projectA, '.swarm', 'memory.db'), { force: true }); } catch { /* already gone */ }
    console.log(`  MUTANT delete-lesson: lesson store emptied (${loadLessons(dirs.lessons).length} lessons) and project A's memory.db removed`);
  }

  if (dryRun) {
    // Prove the WIRE without a token: fire the real hook chain in both states and report the bytes.
    const probe = (stateDir) => {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'plugin', 'scripts', 'hook-shim.mjs'), 'unprompted-speech', 'UserPromptSubmit'], {
        input: JSON.stringify({ prompt: REPLAY_PROMPT, session_id: `dry-${Date.now()}`, cwd: dirs.projectB }),
        encoding: 'utf8',
        cwd: dirs.projectB,
        env: {
          ...process.env,
          RUVNET_BRAIN_HOME: dirs.brainHome,
          RUVNET_BRAIN_STATE_DIR: stateDir,
          RUVNET_LESSON_STORE: dirs.lessons,
          RUVNET_LESSON_GATE_STATE: dirs.gateState,
          CLAUDE_PLUGIN_ROOT: path.join(ROOT, 'plugin'),
        },
      });
      return (r.stdout || '').length;
    };
    const onBytes = probe(dirs.stateOn), offBytes = probe(dirs.stateOff);
    console.log(`  dry-run: treated-state hook emitted ${onBytes} bytes; control-state (brain-off) emitted ${offBytes} bytes`);
    writeArtifact(outFile, {
      verdict: VERDICT.UNKNOWN, why: `--dry-run: no model was called, so nothing was measured (wire probe: treated ${onBytes}B, control ${offBytes}B)`,
      n: 0, passes: 0, fails: 0, unknowns: 0, controlTokenRuns: 0, rate: 0, runs: [],
    }, { model, mutant, record: rec, refresh });
    console.log(`  → UNKNOWN (a dry run is never a pass). artifact: ${path.relative(ROOT, outFile)}`);
    if (!keep) rmrf(base);
    process.exit(EXIT.UNKNOWN);
  }

  const runs = [];
  for (let i = 1; i <= n; i++) {
    const treatedState = mutant === 'brain-off-treated' ? dirs.stateOff : dirs.stateOn;
    const treated = runArm({ dirs, arm: 'treated', stateDir: treatedState, model, tag: `run${i}-treated` });
    const control = runArm({
      dirs, arm: 'control', stateDir: dirs.stateOff, model, tag: `run${i}-control`,
      // MUTANT seed-control: the control is handed the lesson through a channel the brain does not
      // own. Its artifact then carries the token, and invariant 6 must fire.
      appendSystemPrompt: mutant === 'seed-control' ? LESSON_STATEMENT : null,
    });
    const run = {
      i,
      treatedClass: treated.class,
      controlClass: control.class,
      lessonBeforeFirstToolCall: treated.lessonBeforeFirstToolCall,
      controlLessonDelivered: control.lessonDelivered,
      treated,
      control,
      error: treated.spawnError || control.spawnError || null,
    };
    const v = verdictForRun(run);
    console.log(`  run ${i}: treated="${treated.class}" (${treated.command || '—'})`);
    console.log(`         control="${control.class}" (${control.command || '—'})`);
    console.log(`         lesson before first tool call: ${treated.lessonBeforeFirstToolCall} (lesson@${treated.lessonIndex}, tool@${treated.firstToolIndex}) · control got ${control.lessonDelivered ? 'THE LESSON (leak!)' : 'zero brain bytes'}`);
    console.log(`         → ${v.verdict}: ${v.why}`);
    runs.push(run);
  }

  const agg = aggregate(runs);
  const costUsd = runs.reduce((s, r) => s + (r.treated.costUsd || 0) + (r.control.costUsd || 0), 0);
  const wallMs = runs.reduce((s, r) => s + (r.treated.wallMs || 0) + (r.control.wallMs || 0), 0);
  writeArtifact(outFile, agg, { model, mutant, record: rec, refresh, flag, costUsd, wallMs });

  console.log(`\n  RATE ${agg.passes}/${agg.n} · control produced the token in ${agg.controlTokenRuns}/${agg.n}`);
  console.log(`  ${INVARIANT}: ${agg.verdict} — ${agg.why}`);
  console.log(`  cost $${costUsd.toFixed(4)} · ${(wallMs / 1000).toFixed(1)}s wall · transcripts: ${path.relative(ROOT, dirs.transcripts)}`);
  console.log(`  artifact: ${path.relative(ROOT, outFile)}\n`);
  process.exit(EXIT[agg.verdict] ?? EXIT.UNKNOWN);
}

/** The machine-readable result. A verdict with no SHA is a verdict about nothing. */
function writeArtifact(file, agg, meta = {}) {
  const artifact = {
    invariant: INVARIANT,
    verdict: agg.verdict,
    why: agg.why,
    sha: headSha(),
    at: new Date().toISOString(),
    model: meta.model || null,
    // The alias asked for ("haiku") is not the model that answered. Record the id the session
    // actually reported, so a result can never be attributed to a model that never ran.
    modelResolved: (agg.runs || []).map((r) => r.treated?.modelUsed).find(Boolean) || null,
    mutant: meta.mutant || null,
    n: agg.n,
    passes: agg.passes,
    fails: agg.fails,
    unknowns: agg.unknowns,
    controlTokenRuns: agg.controlTokenRuns,
    rate: agg.rate,
    threshold: '>=2/3',
    costUsd: meta.costUsd != null ? +meta.costUsd.toFixed(4) : null,
    wallSeconds: meta.wallMs != null ? +(meta.wallMs / 1000).toFixed(1) : null,
    premise: meta.flag ? { verified: meta.flag.ok, evidence: meta.flag.evidence } : null,
    record: meta.record ? { key: meta.record.key, storeExit: meta.record.storeExit, readBackExit: meta.record.readBackExit, ok: meta.record.ok } : null,
    refresh: meta.refresh || null,
    runs: (agg.runs || []).map((r) => ({
      i: r.i,
      verdict: r.verdict,
      why: r.why,
      treated: { class: r.treated?.class, subcommandCorrect: r.treated?.subcommandCorrect, command: r.treated?.command, lessonIndex: r.treated?.lessonIndex, firstToolIndex: r.treated?.firstToolIndex, lessonBeforeFirstToolCall: r.treated?.lessonBeforeFirstToolCall, model: r.treated?.modelUsed, transcript: r.treated?.transcript },
      control: { class: r.control?.class, subcommandCorrect: r.control?.subcommandCorrect, command: r.control?.command, lessonDelivered: r.control?.lessonDelivered, model: r.control?.modelUsed, transcript: r.control?.transcript },
    })),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2) + '\n');
  return artifact;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
