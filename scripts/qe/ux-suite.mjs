// ux-suite.mjs — the UX-experience QE suite runner (owner request 2026-07-24).
//
// Runs the deterministic UX probes, prints a table of MEASURED numbers, and exits non-zero ONLY on a
// HARD failure: a missing completion signal, or a probe that could not run at all. Timing-threshold
// breaches WARN with the measured number — a flaky timing gate must never block a ship, and a
// threshold nobody measured is a guess (spec §"Measurements & thresholds").
//
// HONESTY (same rules as the product):
//  • Every number is measured on THIS run. Nothing is asserted from memory.
//  • A probe that could not execute is reported "not run" and HARD-fails — silence is not success.
//  • The probes are MODEL-FREE (render + PTY-style timing). They call no LLM, use no API key, touch no
//    account — the cleanest satisfaction of the owner's "no API keys, run on our account" rule.
//  • aqe orchestration: we OPTIONALLY register this run as an `aqe task` for visibility in
//    `aqe status`, but the MEASUREMENT is a plain deterministic probe, NOT aqe-internal. Verified live
//    2026-07-24: `aqe domain` supports only list/health (not create), so inventing an "onboarding-ux"
//    domain would be fiction. We do not. If aqe isn't present, the suite runs identically and says so.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRenderProbe } from '../../tests/ux/render-probe.mjs';
import { runCommandProbe } from '../../tests/ux/command-probe.mjs';

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

  // ── Not run on this host (stated, never faked) ──────────────────────────────────────────────
  console.log('\n  ── not run here (stated, not faked) ──');
  console.log('    Linux / Windows  — execute in CI runners (macOS cannot run them); add to .github/workflows matrix');
  console.log('    Codex host       — command→explanation under Codex needs a Codex runner present; CI-gated, never faked from Claude/Mac');

  // ── Verdict ─────────────────────────────────────────────────────────────────────────────────
  console.log('\n  ── verdict ──');
  if (hardFailures.length === 0) {
    console.log('  PASS — every probe ran; completion signal present. Timing WARNs (if any) are advisory.\n');
    process.exit(0);
  }
  console.log('  FAIL (hard):');
  for (const f of hardFailures) console.log(`    ✗ ${f}`);
  console.log('');
  process.exit(1);
}

main().catch((e) => { console.error('  ux-suite crashed:', e.message); process.exit(2); });
