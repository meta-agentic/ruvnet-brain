#!/usr/bin/env node
/**
 * capability-audit.mjs — the OFFENSIVE half of retrieval.
 *
 * WHY THIS EXISTS, and it is the sharpest failure this project has recorded.
 *
 * For three weeks the brain was queried ONLY defensively. Every consultation was triggered by the
 * `ground-before-write` gate asking "am I about to duplicate something rUv already ships?" That gate
 * is excellent and fired correctly every time. But it only ever fires when code is about to be
 * written, so the question "what should we be USING that we aren't?" was never asked once.
 *
 * On 2026-07-22 the owner asked it manually, and the answer was sitting inside this very repository:
 *
 *     .metaharness/ — Darwin ran here on 2026-07-07.
 *     It lifted the harness score 0.285 -> 0.765 (+168%) by evolving `reviewer`,
 *     `memoryPolicy`, and `scorePolicy` — the exact surfaces we spent that night hand-building.
 *     It promoted nothing, and sat idle for two weeks with OPENROUTER_API_KEY funded the whole time.
 *
 * His words: "If you knew it was out there, why the hell didn't you recommend it already? Why am I
 * having to do this with you at 11:30 at night when we've been working together for three weeks?"
 *
 * The honest answer is that nothing in the system was obliged to look. v3.5 shipped advocacy that
 * audits MEMORY health (corrupt stores, undrained queues, undistilled memories) and had no detector
 * for a dormant capability at all — proactive about one category, blind to the one that mattered.
 *
 * DESIGN RULE, non-negotiable: every detector reports ONLY what it observed on THIS machine, with
 * the observation as evidence. There is no hardcoded list of "cool features to suggest" — such a
 * list would rot the week rUv ships again, and recommending a capability the user does not have is
 * the same lie as any other (ADR-027).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const DAY = 86_400_000;
const argv = process.argv.slice(2);

/** Newest mtime anywhere under a path — "when did this capability last actually do anything?" */
function lastActivity(p, depth = 3) {
  let newest = 0;
  const walk = (d, lvl) => {
    if (lvl > depth) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs > newest) newest = st.mtimeMs;
        if (e.isDirectory()) walk(full, lvl + 1);
      } catch { /* unreadable entry — skip */ }
    }
  };
  try { if (fs.statSync(p).isDirectory()) walk(p, 0); else newest = fs.statSync(p).mtimeMs; } catch { return 0; }
  return newest;
}

const daysSince = (ms) => (ms ? (Date.now() - ms) / DAY : null);

/**
 * DETECTOR: harness self-evolution that ran and then stopped.
 *
 * This is the ground-truth case the audit was built around. Detecting "installed" is worthless —
 * `.metaharness/` existing tells you nothing. What matters is that it RAN, PRODUCED A REAL LIFT, and
 * then went quiet, because that combination is invisible to every other surface and is pure
 * unrealised value the user already paid for.
 */
export function detectDormantEvolution(repo = process.cwd()) {
  const dir = path.join(repo, '.metaharness');
  const archive = path.join(dir, 'archive.json');
  if (!fs.existsSync(archive)) return null;

  let entries = [];
  try {
    const raw = JSON.parse(fs.readFileSync(archive, 'utf8'));
    entries = Array.isArray(raw) ? raw : (Object.values(raw).find(Array.isArray) || []);
  } catch { return null; }
  if (!entries.length) return null;

  const rows = entries
    .map((e) => ({
      id: e?.variant?.id,
      surface: e?.variant?.mutationSurface,
      score: e?.score?.finalScore,
      promoted: e?.score?.promoted === true,
      task: e?.score?.taskSuccess,
    }))
    .filter((r) => typeof r.score === 'number');
  if (!rows.length) return null;

  const baseline = rows.find((r) => r.surface && r.score === Math.min(...rows.map((x) => x.score)));
  const best = rows.reduce((a, b) => (b.score > a.score ? b : a), rows[0]);
  const idleDays = daysSince(lastActivity(dir));
  // EXCLUDE the baseline from the promoted count. The baseline is always "promoted" (it beats a
  // parent score of 0), so counting it reports "1 variant promoted" for a run where every actual
  // IMPROVEMENT was discarded — the precise flavour of confident-but-misleading reporting this
  // whole audit exists to catch. Caught by diffing this detector against the raw archive.
  const improvements = rows.filter((r) => r.id !== 'baseline');
  const promotedCount = improvements.filter((r) => r.promoted).length;
  const surfaces = [...new Set(rows.map((r) => r.surface).filter(Boolean))];

  // ALSO read the MACHINE-WIDE champion, not just this repo's archive.
  //
  // The first version of this detector read only ./.metaharness/archive.json and reported "none of
  // the improvements were kept" — true of that archive, and misleading about the machine, because
  // ~/.claude-flow/harness-active-policy.json held a champion promoted a week LATER by a different
  // run. Stating a repo-scoped fact in machine-scoped language is the same confident-but-wrong
  // shape this whole audit exists to catch, so it gets caught here too.
  let champion = null;
  try {
    const cp = path.join(HOME, '.claude-flow', 'harness-active-policy.json');
    if (fs.existsSync(cp)) {
      const c = JSON.parse(fs.readFileSync(cp, 'utf8'));
      if (c && c.championId) {
        champion = {
          id: String(c.championId).slice(0, 20),
          tier: c.provenanceTier || 'unknown',
          appliedDaysAgo: c.appliedAt ? Math.round(daysSince(c.appliedAt)) : null,
        };
      }
    }
  } catch { /* absent or unreadable — report the repo-scoped truth alone */ }

  // Only a capability that DEMONSTRATED value and then stopped is worth interrupting someone about.
  if (!(idleDays > 3 && best.score > (baseline?.score ?? 0))) return null;

  return {
    id: 'capability:resume-harness-evolution',
    title: 'Your harness improved itself, then stopped — and nobody was told',
    severity: 'IMPORTANT',
    evidence: [
      { observed: `harness self-evolution ran in this repo and reached a score of ${best.score} from a baseline of ${baseline?.score ?? 0}` },
      { observed: `${surfaces.length} policy surfaces were explored (${surfaces.slice(0, 4).join(', ')}${surfaces.length > 4 ? '…' : ''})` },
      { observed: `this repo's run has been idle ${Math.round(idleDays)} days, and ${promotedCount === 0 ? `NONE of its ${improvements.length} improvements were kept — they all plateaued at the same score, so the promotion rule could not choose between them` : `${promotedCount} of ${improvements.length} improvements were kept`}` },
      champion
        ? { observed: `machine-wide, a champion policy IS active (${champion.id}…, provenance ${champion.tier}, applied ${champion.appliedDaysAgo} days ago) — so evolution is not entirely dead, it is just not running HERE` }
        : { observed: 'no machine-wide champion policy is active either — nothing from any run is currently in force' },
    ],
    // Never overstate. A plateau is a known, documented condition with a known fix — say which.
    why: promotedCount === 0
      ? 'Every variant scored the same, so the lightweight promotion rule could not choose between them and kept none. This exact ceiling is documented upstream, and the fix is a graded benchmark gate rather than more evolution.'
      : 'It produced promoted variants and then went quiet.',
    detail: { best: best.score, baseline: baseline?.score ?? 0, idleDays: Math.round(idleDays), surfaces, promotedCount },
  };
}

/** DETECTOR: a paid capability that is funded and unused — the most wasteful dormancy there is. */
export function detectFundedButIdle(repo = process.cwd()) {
  const funded = Boolean(process.env.OPENROUTER_API_KEY);
  if (!funded) return null;
  const dir = path.join(repo, '.metaharness');
  if (!fs.existsSync(dir)) return null;
  const idleDays = daysSince(lastActivity(dir));
  if (!(idleDays > 7)) return null;
  return {
    id: 'capability:funded-but-idle',
    title: 'You are paying for a capability that has not run in weeks',
    severity: 'SUGGESTED',
    evidence: [
      { observed: 'an OpenRouter key is configured, which is what unlocks the write/evolve layer' },
      { observed: `the last evolution activity in this repo was ${Math.round(idleDays)} days ago` },
    ],
    why: 'The expensive part is already paid for; only the running of it stopped.',
    detail: { idleDays: Math.round(idleDays) },
  };
}

/** DETECTOR: rUv's learning hooks present but not enabled. Reports registration state, nothing more. */
export function detectDisabledLearningHooks() {
  const ruflo = (() => {
    const p = path.join(HOME, '.npm-global/bin/ruflo');
    if (fs.existsSync(p)) return p;
    try {
      const w = execFileSync('sh', ['-lc', 'command -v ruflo'], { encoding: 'utf8', timeout: 8000 }).trim();
      return w && fs.existsSync(w) ? w : null;
    } catch { return null; }
  })();
  if (!ruflo) return null;

  let out = '';
  try { out = execFileSync(ruflo, ['hooks', 'list'], { cwd: HOME, encoding: 'utf8', timeout: 20_000 }); }
  catch { return null; }

  const lines = out.split('\n').filter((l) => /^\|\s*\S/.test(l) && !/^\|\s*Name/.test(l));
  const rows = lines.map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length > 3);
  const total = rows.length;
  const enabled = rows.filter((c) => /yes/i.test(c[3] || '')).length;
  if (!total || enabled > 0) return null;

  return {
    id: 'capability:enable-learning-hooks',
    title: `${total} learning hooks are installed and every one is switched off`,
    severity: 'IMPORTANT',
    evidence: [
      { observed: `${total} hooks are registered on this machine and ${enabled} are enabled` },
      { observed: 'these are the hooks that record what worked so it can be reused — with all of them off, nothing is learned from your sessions' },
    ],
    why: 'Installed-but-dormant is a defect, not a neutral state: the work of installing was done and none of the benefit is being collected.',
    detail: { total, enabled },
  };
}

export const DETECTORS = [detectDormantEvolution, detectFundedButIdle, detectDisabledLearningHooks];

/** Run every detector. Never throws — an advisory surface must not break the thing that calls it. */
export function auditCapabilities(repo = process.cwd()) {
  const findings = [];
  for (const d of DETECTORS) {
    try { const f = d(repo); if (f) findings.push(f); } catch { /* one broken detector must not silence the rest */ }
  }
  return findings;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('capability-audit.mjs');
if (invokedDirectly) {
  const findings = auditCapabilities(argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : process.cwd());
  if (argv.includes('--json')) { console.log(JSON.stringify(findings, null, 2)); process.exit(0); }

  if (!findings.length) {
    console.log('\n  No dormant capability found on this machine. That is a real answer, not a shrug —\n'
      + '  every detector reports only what it observed here.\n');
    process.exit(0);
  }
  const n = findings.length;
  console.log(`\n  ${n} ${n === 1 ? 'capability' : 'capabilities'} you already own ${n === 1 ? 'is' : 'are'} not being used:\n`);
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.title}`);
    for (const e of f.evidence) console.log(`      · ${e.observed}`);
    console.log(`      why: ${f.why}\n`);
  }
}
