// ux-suite.mjs — the UX-experience QE suite runner (owner request 2026-07-24).
//
// Runs the deterministic UX probes, prints a table of MEASURED numbers, and exits non-zero on a HARD
// failure. Two tiers of "hard failure", deliberately not conflated (ADR-058 D6):
//  1. Environment-sensitive timings (server-ready, console/tips paint, command→explanation, dead-air)
//     stay ADVISORY — WARN only. These are subject to real machine noise (cold node boot, first-paint,
//     disk cache state) that has nothing to do with correctness, and a flaky gate trains people to
//     override it. A missing completion signal or a probe that could not run at all is still a hard
//     failure regardless of tier — silence is not success.
//  2. kb/card-lane.mjs's decision lane is MODEL-FREE, ML-FREE keyword overlap with a measured warm
//     baseline of 0.1158ms. Its budget (kb/card-lane-budget.json, p95 <= 250ms / absolute fail
//     >1000ms — ~2,159x / ~8,600x the baseline) has so much headroom that a breach cannot be
//     scheduler jitter — it can only be a correctness regression. THIS is a genuine hard gate: a
//     breach here fails the suite, not warns it. See scripts/qe/card-lane-gate.mjs for the full
//     reasoning and the in-process (no subprocess per firing) measurement method.
//  3. SESSION-START WALL TIME (added 2026-07-28) is the SAME tier as 2, and is here because tier 2
//     alone was not enough. An independent grader's words: the card-lane gate "measures a
//     0.03–0.22ms in-process function against a 250ms budget (~1000x headroom — it can only catch
//     catastrophic regression classes)", while "everything the user actually FEELS — heavy-lane
//     query seconds, session-start WALL TIME, install minutes, dead air, refusal clarity — is
//     advisory or unmeasured". Session-start wall time is the first of those promoted out of tier 1:
//     it is the hook a stranger's Claude Code fires before their first prompt is answered, it is
//     already measured by scripts/selfcheck.mjs's external process-group watchdog (no second timer
//     was written), and its budget is set from a measured distribution — p95 1000ms is ~3.1x the
//     worst measured p95 (323ms over n=110), NOT 1000x. See scripts/qe/session-start-gate.mjs.
//
// HONESTY (same rules as the product):
//  • Every number is measured on THIS run. Nothing is asserted from memory.
//  • A probe that could not execute is reported "not run" and HARD-fails — silence is not success.
//  • The probes are MODEL-FREE (render + PTY-style timing, plus the in-process card-lane firings).
//    They call no LLM, use no API key, touch no account — the cleanest satisfaction of the owner's
//    "no API keys, run on our account" rule.
//  • aqe orchestration: we OPTIONALLY register this run as an `aqe task` for visibility in
//    `aqe status`, but the MEASUREMENT is a plain deterministic probe, NOT aqe-internal. Verified live
//    2026-07-24: `aqe domain` supports only list/health (not create), so inventing an "onboarding-ux"
//    domain would be fiction. We do not. If aqe isn't present, the suite runs identically and says so.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRenderProbe } from '../../tests/ux/render-probe.mjs';
import { runCommandProbe } from '../../tests/ux/command-probe.mjs';
import { runCardLaneGate } from './card-lane-gate.mjs';
import { runSessionStartGate } from './session-start-gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Frozen 2026-07-24 from the first real run on this Mac — see docs/qe/ux-first-run.md. WARN thresholds,
// not hard gates. Each is the measured value rounded up with headroom, so a WARN means "slower than the
// machine that set the bar", not "broken". Re-freeze if the first-run doc is regenerated.
// First real run on this Mac (2026-07-24, docs/qe/ux-first-run.md): server-ready 1199ms, console
// paint 336ms, tips hero 269ms, tips first-section 202ms, command→explanation 840ms (≈ cold node
// boot + first print), dead-air 2009ms. Thresholds = measured × ~1.5 rounded, so a WARN means
// "slower than the machine that set the bar", not "broken". Re-freeze if ux-first-run.md is regenerated.
const WARN = {
  'server-ready':               2000,   // measured 1199
  'console time-to-visible':    2500,   // measured 336 (huge headroom — first paint is cheap)
  'tips time-to-visible (hero)':2000,   // measured 269
  'tips first-section':         2000,   // measured 202
  'commandToExplanationMs':     1300,   // measured 840; "near-instant" is dominated by node boot
  'maxDeadAirMs':               3000,   // measured 2009; the product's own no-dead-air bar is 3s
};

function line(label, measured, unit, warnAt) {
  const val = measured == null ? 'NOT RUN' : `${measured}${unit}`;
  let flag = '';
  if (measured == null) flag = '  ✗ could not measure';
  else if (warnAt != null && measured > warnAt) flag = `  ⚠ over ${warnAt}${unit} (proposed)`;
  else if (warnAt != null) flag = '  ✓';
  return `  ${label.padEnd(30)} ${String(val).padStart(10)}${flag}`;
}

function tryRegisterAqeTask() {
  // Best-effort visibility only. Never fails the suite; never bills a model. `submit` enqueues
  // metadata to the Queen Coordinator; `--no-progress` and no `--wait` keep it fire-and-forget, so no
  // model is invoked. Flags grounded live 2026-07-24 against `aqe task submit --help` (type positional,
  // -p/-d/-t/--payload — there is NO --description).
  const payload = JSON.stringify({ probe: 'ruvnet-brain-ux-time-to-visible', model_free: true });
  const r = spawnSync('aqe', ['task', 'submit', 'quality-assessment', '-p', 'p3', '--payload', payload, '--no-progress'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return { registered: false, why: (r.error && r.error.message) || (r.stderr || '').trim().split('\n').filter(Boolean).pop() || `exit ${r.status}` };
  const id = ((r.stdout || '').match(/task[- ]?id[:\s]+(\S+)/i) || [])[1] || 'submitted';
  return { registered: true, id };
}

async function main() {
  console.log('\n  RuvNet Brain — UX-experience QE suite  (deterministic · model-free · runs on your account)\n');

  const aqe = tryRegisterAqeTask();
  console.log(aqe.registered
    ? `  aqe: registered task ${aqe.id} for orchestration visibility (measurement is a plain probe)\n`
    : `  aqe: not registered (${aqe.why}) — probes run identically; orchestration visibility only\n`);

  const hardFailures = [];

  // ── Probe 1: render time-to-visible ──────────────────────────────────────────────────────────
  console.log('  ── time-to-visible (console + tips) ──');
  const render = await runRenderProbe();
  for (const r of render.results) {
    console.log(line(r.label, r.ms, 'ms', WARN[r.label]));
    if (r.ms == null) hardFailures.push(`${r.label}: could not measure`);
  }
  for (const n of render.notes) { console.log(`  ! ${n}`); hardFailures.push(`render: ${n}`); }
  // Any expected render row missing entirely = not run = hard fail.
  const gotConsole = render.results.some((r) => r.label === 'console time-to-visible' && r.ms != null);
  if (!gotConsole) hardFailures.push('console time-to-visible: NOT RUN');

  // ── Probe 2/3: command → explanation → "it's live" ──────────────────────────────────────────
  console.log('\n  ── command → explanation → completion signal ──');
  const cmd = await runCommandProbe();
  console.log(line('command→explanation', cmd.commandToExplanationMs, 'ms', WARN.commandToExplanationMs));
  console.log(line('command→"it\'s live"', cmd.commandToLiveMs, 'ms', null) + '  (reported, not gated)');
  console.log(line('max dead-air gap', cmd.maxDeadAirMs, 'ms', WARN.maxDeadAirMs));
  console.log(`  completion signal present      ${cmd.completionSignalPresent ? '        YES  ✓' : '         NO  ✗ (GAP)'}`);
  if (cmd.liveSignalText) console.log(`    signal: "${cmd.liveSignalText}"`);

  if (cmd.commandToExplanationMs == null) hardFailures.push('command→explanation: NOT RUN (no explanatory line seen)');
  if (!cmd.completionSignalPresent) hardFailures.push('completion signal MISSING — the "it\'s live, take a look at your page" line never printed');

  // ── Probe 4: decision-lane latency — HARD GATE, not advisory (ADR-058 D6) ───────────────────
  // Deliberately NOT reusing line()'s warnAt/"(proposed)" formatting above: that phrasing is correct
  // for the advisory timings but would misreport a HARD budget breach as merely "proposed".
  console.log('\n  ── decision-lane latency (kb/card-lane.mjs) — HARD GATE, deterministic, model-free ──');
  try {
    const laneResult = await runCardLaneGate();
    const b = laneResult.budget;
    const tag = (ok) => (ok ? '✓' : '✗ HARD FAIL');
    console.log(`  ${'card-lane p50'.padEnd(30)} ${laneResult.p50.toFixed(4).padStart(10)}ms  (reported, not gated)`);
    console.log(`  ${'card-lane p95'.padEnd(30)} ${laneResult.p95.toFixed(4).padStart(10)}ms  budget ${b.p95BudgetMs}ms  ${tag(laneResult.p95 <= b.p95BudgetMs)}`);
    console.log(`  ${'card-lane max'.padEnd(30)} ${laneResult.max.toFixed(4).padStart(10)}ms  absolute-fail ${b.absoluteFailMs}ms  ${tag(laneResult.max <= b.absoluteFailMs)}`);
    console.log(`  firings: ${laneResult.n} in-process (no subprocess per firing — see card-lane-gate.mjs)`);
    if (!laneResult.pass) for (const r of laneResult.reasons) hardFailures.push(`card-lane latency: ${r}`);
  } catch (e) {
    console.log(`  ! could not run the card-lane latency gate: ${e.message}`);
    hardFailures.push(`card-lane latency gate: could not run — ${e.message}`);
  }

  // ── Probe 5: session-start wall time — HARD GATE, the first USER-FELT number (ADR-058 D6) ───
  // Wired exactly like probe 4 above and for the same reason: same tier, same "could not measure is
  // never success" handling, same refusal to reuse line()'s "(proposed)" phrasing, which is correct
  // for an advisory row and would misreport a HARD breach.
  console.log('\n  ── session-start wall time (plugin/hooks/hooks.json SessionStart) — HARD GATE, user-felt ──');
  try {
    const ss = await runSessionStartGate();
    const b = ss.budget;
    const tag = (ok) => (ok ? '✓' : '✗ HARD FAIL');
    console.log(`  ${'session-start warm-up'.padEnd(30)} ${ss.warmupMs.toFixed(0).padStart(10)}ms  (first-ever fire in a virgin HOME — reported, not gated)`);
    console.log(`  ${'session-start p50'.padEnd(30)} ${ss.p50.toFixed(0).padStart(10)}ms  (reported, not gated)`);
    console.log(`  ${'session-start p95'.padEnd(30)} ${ss.p95.toFixed(0).padStart(10)}ms  budget ${b.p95BudgetMs}ms  ${tag(ss.p95 <= b.p95BudgetMs)}`);
    console.log(`  ${'session-start max'.padEnd(30)} ${ss.max.toFixed(0).padStart(10)}ms  absolute-fail ${b.absoluteFailMs}ms  ${tag(ss.max <= b.absoluteFailMs)}`);
    console.log(`  firings: ${ss.n} sequential fires of the REAL registered command via selfcheck.mjs's watchdog, from ${ss.surface.source}`);
    if (!ss.pass) for (const r of ss.reasons) hardFailures.push(`session-start wall time: ${r}`);
  } catch (e) {
    console.log(`  ! could not run the session-start wall-time gate: ${e.message}`);
    hardFailures.push(`session-start wall-time gate: could not run — ${e.message}`);
  }

  // ── Not run on this host (stated, never faked) ──────────────────────────────────────────────
  console.log('\n  ── not run here (stated, not faked) ──');
  console.log('    Linux / Windows  — execute in CI runners (macOS cannot run them); add to .github/workflows matrix');
  console.log('    Codex host       — command→explanation under Codex needs a Codex runner present; CI-gated, never faked from Claude/Mac');

  // ── Verdict ─────────────────────────────────────────────────────────────────────────────────
  console.log('\n  ── verdict ──');
  if (hardFailures.length === 0) {
    console.log('  PASS — every probe ran; completion signal present; decision-lane latency AND session-start wall time inside their HARD budgets. Env-timing WARNs (if any) are advisory.\n');
    process.exit(0);
  }
  console.log('  FAIL (hard):');
  for (const f of hardFailures) console.log(`    ✗ ${f}`);
  console.log('');
  process.exit(1);
}

main().catch((e) => { console.error('  ux-suite crashed:', e.message); process.exit(2); });
