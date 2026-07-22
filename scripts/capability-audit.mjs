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
import { readLearnerState, verdict as learnerVerdict, STALE_DAYS } from './learning-enable.mjs';

// NOTE: execFileSync was imported here and never used. It is deliberately not re-added. Shelling out
// to `ruflo` for state is what made a read-only status check start a background daemon and write four
// files into the user's HOME (see capability-registry.rufloBin) — an unused import of the tool that
// causes that is an invitation, and this file is READ-ONLY by intent.

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

/**
 * DETECTOR: is the learner actually learning?
 *
 * ⚠️ THIS DETECTOR PREVIOUSLY SHIPPED A FALSE ALARM, and the correction is the most instructive
 * thing in this file.
 *
 * The first version parsed `ruflo hooks list` and reported "26 learning hooks installed and every
 * one is switched off". That was WRONG, and it was reported to the owner as a headline finding —
 * including as the answer to his direct question about whether learning was on.
 *
 * What actually happens: `ruflo hooks list --format json` returns `{name, type, status:"active"}`
 * and contains NO `enabled` key. The CLI's table renderer draws a column keyed `enabled`, reads
 * `undefined`, and prints "No" 26 times. `ruflo hooks enable` does not exist. The list is a MENU of
 * available hooks, not a dashboard of enabled ones.
 *
 * Meanwhile the real signal said the opposite the whole time: ~/.claude-flow/neural/stats.json held
 * 457 trajectories and 457 patterns, last adapted 106 minutes earlier — DURING the session in which
 * we told the owner learning was off.
 *
 * This is exactly L01 (verify through a channel CAPABLE of observing the truth) committed inside the
 * detector written to catch L01. A human-readable CLI table is a PRESENTATION, and presentations
 * drift from their payloads. Read the state file, or read `--format json` — never scrape a table.
 *
 * ADR-028 sets the false-alarm rate at ZERO and calls it non-negotiable: one false alarm costs more
 * trust than ten true findings earn. So this detector now reports only what a state file proves, and
 * stays SILENT when it cannot tell.
 */
export function detectLearnerIdle() {
  // DELEGATED, for the same reason capability-registry delegates: there must be exactly ONE reading
  // of stats.json on this machine. The hand-rolled version here repeated the registry's schema-drift
  // bug in its most damaging form — `Number(s.trajectoriesRecorded ?? 0)` yields 0 when rUv renames
  // the field, and 0-and-0 fell straight into the IMPORTANT branch below. The result would have been
  // an alarming "Your learner has never recorded anything" fired at every user at once, about a
  // learner that was working perfectly. ADR-028 puts the acceptable false-alarm rate at ZERO and
  // calls it non-negotiable; a detector that turns an upstream rename into a machine-wide accusation
  // is the worst possible way to violate that.
  //
  // readLearnerState's `num()` returns null rather than 0 for an unreadable counter, so drift now
  // arrives as UNKNOWN_SHAPE — and this detector stays SILENT on it, because "I cannot read the
  // counters" is not a dormant capability and there is nothing for the user to act on.
  const learner = readLearnerState({ home: HOME });
  const v = learnerVerdict(learner);
  const { trajectories, patterns } = learner;

  // NO_LEARNER_STATE / CORRUPT / UNKNOWN_SHAPE: nothing provable, so say nothing. Silence here is
  // correct — an audit that speaks up when it cannot see is how false alarms are manufactured.
  if (v.code === 'INITIALISED_EMPTY') {
    // A learner that has genuinely, measurably recorded nothing is dormant and worth saying so.
    return {
      id: 'capability:learner-never-ran',
      title: 'Your learner has never recorded anything',
      severity: 'IMPORTANT',
      evidence: [
        { observed: 'the learner\'s own state file exists, carries the counters this version understands, and both read 0' },
      ],
      why: 'The learning machinery is present and has never been fed, so nothing you do is being turned into reusable experience.',
      detail: { trajectories, patterns },
    };
  }

  if (v.code === 'IDLE') {
    // Recording, but nothing recently — a real, provable dormancy. STALE_DAYS is imported, not
    // re-typed: this file used its own literal 7 while learning-enable used STALE_DAYS, which is two
    // definitions of "idle" waiting to drift apart.
    const idleDays = Math.floor(learner.ageMinutes / 1440);
    return {
      id: 'capability:learner-gone-quiet',
      title: 'Your learner has gone quiet',
      severity: 'SUGGESTED',
      evidence: [
        { observed: `${trajectories} trajectories and ${patterns} patterns recorded, but the last adaptation was ${idleDays} days ago (idle past ${STALE_DAYS})` },
      ],
      why: 'It learned before and stopped, so recent work is not becoming reusable experience.',
      detail: { trajectories, patterns, idleDays },
    };
  }

  // Learning is live, or unreadable. Report NOTHING — a healthy machine must produce no findings at
  // all, and an unreadable one must not be described as unhealthy.
  return null;
}

export const DETECTORS = [detectDormantEvolution, detectFundedButIdle, detectLearnerIdle];

/**
 * Run every detector. Never throws — an advisory surface must not break the thing that calls it.
 *
 * BUT IT NO LONGER SWALLOWS THE FAILURE EITHER, and that distinction is the finding.
 *
 * The old `catch {}` was correct about one thing — a single broken detector must not silence the
 * other two — and catastrophically wrong about what to do next. With all three detectors forced to
 * throw (EACCES / bad JSON / ENOENT), this function returned `[]`, and `[]` is exactly what a
 * perfectly healthy machine returns. The CLI then printed:
 *
 *     "No dormant capability found on this machine. That is a real answer, not a shrug —
 *      every detector reports only what it observed here."
 *
 * Total instrument failure, rendered as a confident all-clear, with copy that explicitly forecloses
 * the doubt. A newcomer whose file permissions differ from ours gets told their machine is fine by a
 * system that could not see their machine at all. That is the unknown-as-a-measurement lie in its
 * purest form — it just arrives as silence instead of as the word "off".
 *
 * So failures are now COUNTED and RETURNED. The caller is obliged to say how many of the checks
 * actually ran before it characterises the result.
 */
export function auditCapabilities(repo = process.cwd()) {
  const findings = [];
  const failures = [];
  for (const d of DETECTORS) {
    try { const f = d(repo); if (f) findings.push(f); }
    catch (e) { failures.push({ detector: d.name || 'anonymous detector', reason: String(e?.message || e).split('\n')[0].slice(0, 120) }); }
  }
  return { findings, failures, ran: DETECTORS.length - failures.length, total: DETECTORS.length };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('capability-audit.mjs');
if (invokedDirectly) {
  const audit = auditCapabilities(argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : process.cwd());
  const { findings, failures, ran, total } = audit;
  if (argv.includes('--json')) { console.log(JSON.stringify(audit, null, 2)); process.exit(0); }

  // Broken instruments are reported BEFORE any verdict, because they change what the verdict means.
  for (const f of failures) console.log(`\n  ! ${f.detector} could not run: ${f.reason}`);

  if (!findings.length) {
    // The all-clear is only offered when every check actually ran. Otherwise the honest line is that
    // we could not look — never "nothing found", which reads identically and is not the same claim.
    console.log(failures.length
      ? `\n  ${ran} of ${total} checks ran, and they found nothing dormant. The ${failures.length} that\n`
        + '  could not run are listed above — this is NOT an all-clear, because part of the machine\n'
        + '  was not examined at all.\n'
      : '\n  No dormant capability found on this machine. That is a real answer, not a shrug —\n'
        + `  all ${ran} of ${total} checks ran, and every detector reports only what it observed here.\n`);
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
