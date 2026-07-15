// console-engine.mjs — the PURE core of the Onboarding Console (ADR-0013 / DDD-0002).
//
// No I/O. No network. No filesystem. No process.exit. Everything here is a pure function of its
// inputs, so it is testable by table (see console-engine.test.mjs) and can never, by construction,
// change the machine. The server (onboarding-console.mjs) does the reading and the writing; this
// file only DECIDES. That separation is DDD context 4 (Recommendation is the one context with no
// I/O) and context 8 (Presentation holds no domain logic) made literal.
//
// The one invariant that matters most: a Recommendation CANNOT be constructed without evidence,
// a cost, and an undo — and, if it touches the machine, a plain-English impact statement. This is
// the ADR's principle 4 ("every recommendation carries evidence, cost, and a reversal") and Stuart's
// directive ("never change the machine without explaining, in plain words, what it does") enforced
// by the type factory rather than by a code review that can be forgotten.

import { cmpVersion } from './stack-sync.mjs';

// ── Recommendation factory — the schema gate ─────────────────────────────────────────────────────
// Throws, loudly, on any recommendation that could become an irreversible or unexplained mutation.
// A throw here is a developer error caught at construction, not a runtime surprise for the user.
export function makeRecommendation(spec) {
  const { id, title, rationale, severity, touchesMachine, plainImpact, evidence, cost, change, undo } = spec;
  const err = (m) => { throw new Error(`Recommendation "${id ?? '?'}" invalid: ${m}`); };

  if (!id || typeof id !== 'string') err('missing id');
  if (!title) err('missing title');
  if (!['INFO', 'SUGGESTED', 'IMPORTANT'].includes(severity)) err(`bad severity ${severity}`);
  if (!Array.isArray(evidence) || evidence.length === 0) err('evidence[] must be non-empty (we may only suggest what we SAW)');
  for (const e of evidence) if (!e || !e.observed) err('every evidence item needs an `observed`');
  if (!cost || typeof cost !== 'object') err('cost is required (time/latency/$/risk)');
  if (!change || !change.human) err('change is required and must be human-describable');
  if (!undo || !undo.human) err('undo is required — a change with no recorded inverse may not be offered');
  if (touchesMachine === true && (!plainImpact || plainImpact.length < 40)) {
    err('touchesMachine:true requires a plain-English `plainImpact` (what happens to the computer + why it is safe/reversible)');
  }
  // Design law: nothing above SUGGESTED unless it was measured on THIS machine (evidence present ⇒
  // measured). We allow IMPORTANT only when there is at least one concrete observation, which the
  // non-empty evidence check above already guarantees. Freeze so Presentation cannot mutate it.
  return Object.freeze({
    id, title, rationale: rationale ?? '',
    severity,
    touchesMachine: touchesMachine === true,
    plainImpact: plainImpact ?? null,
    evidence, cost, change, undo,
  });
}

// ── Stack recommendations ────────────────────────────────────────────────────────────────────────
// Inputs come from stack-sync.auditModel(): rows[{name,installed,target,state,tag}], stale[{name,version,global,dir}].
// AHEAD is legal and produces NO recommendation — that modelling choice is what makes the
// alpha-vs-latest downgrade war structurally impossible (see stack-sync.mjs header).
export function buildStackRecommendations({ rows = [], stale = [] } = {}) {
  const recs = [];
  const behind = rows.filter((r) => r.state === 'BEHIND');
  const broken = rows.filter((r) => r.state === 'BROKEN' && r.target);

  for (const r of behind) {
    recs.push(makeRecommendation({
      id: `sync:${r.name}`,
      title: `Update ${r.name} — ${r.installed} → ${r.target}`,
      rationale: `A newer version is available on the @${r.tag} track you follow.`,
      severity: 'SUGGESTED',
      touchesMachine: true,
      plainImpact: `This updates ${r.name} on your computer from version ${r.installed} to ${r.target}. ` +
        `It's the very same tool you already use — just the current version, like updating an app. Your ` +
        `existing work and settings are left alone, it never installs an older version, and if anything ` +
        `looks off you can put ${r.installed} back with one click.`,
      evidence: [{ observed: `${r.name} installed at ${r.installed}; @${r.tag} is ${r.target}`, source: 'stack-sync.auditModel' }],
      cost: { time: '~10–40s', latency: 'none after', usd: 0, risk: 'low' },
      change: { kind: 'run-script', human: `install ${r.name}@${r.target} into your one global copy`, cmd: 'stack-sync --sync', target: r.name, to: r.target },
      undo: { kind: 'reinstall-version', human: `reinstall ${r.name}@${r.installed}`, target: r.name, to: r.installed },
    }));
  }
  for (const r of broken) {
    recs.push(makeRecommendation({
      id: `repair:${r.name}`,
      title: `Repair ${r.name} — installed copy is unreadable`,
      rationale: `A copy is present but has no readable version, usually a half-finished install.`,
      severity: 'IMPORTANT',
      touchesMachine: true,
      plainImpact: `Your computer has a broken, half-installed copy of ${r.name}. This cleanly reinstalls ` +
        `the current version (${r.target}) so it works again. Nothing else is affected, and the previous ` +
        `broken files are backed up first.`,
      evidence: [{ observed: `${r.name} present on disk with no readable version; registry has ${r.target}`, source: 'stack-sync.auditModel' }],
      cost: { time: '~10–40s', latency: 'none after', usd: 0, risk: 'low' },
      change: { kind: 'run-script', human: `reinstall ${r.name}@${r.target}`, cmd: 'stack-sync --sync', target: r.name, to: r.target },
      undo: { kind: 'none-needed', human: `the broken copy is backed up; a reinstall is safe to leave in place` },
    }));
  }
  if (stale.length) {
    const names = [...new Set(stale.map((s) => s.name))];
    recs.push(makeRecommendation({
      id: 'purge:shadows',
      title: `Remove ${stale.length} stale duplicate cop${stale.length === 1 ? 'y' : 'ies'}`,
      rationale: `Older duplicate copies in a temporary cache can preempt your up-to-date global copy.`,
      severity: 'IMPORTANT',
      touchesMachine: true,
      plainImpact: `Your computer has ${stale.length} extra, older cop${stale.length === 1 ? 'y' : 'ies'} of ` +
        `RuvNet tools (${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}) tucked away in a temporary ` +
        `folder. Those stale copies can quietly get used instead of your current ones. This removes them — your ` +
        `main, newer copies stay exactly as they are, and the temporary folder rebuilds itself automatically if ` +
        `it's ever needed. Nothing you use stops working.`,
      evidence: stale.slice(0, 8).map((s) => ({ observed: `${s.name}@${s.version} in npx cache while global is ${s.global}`, source: 'stack-sync.findShadows' })),
      cost: { time: '~1s', latency: 'none', usd: 0, risk: 'low' },
      change: { kind: 'run-script', human: 'delete the stale temporary copies', cmd: 'stack-sync --sync' },
      undo: { kind: 'auto-rebuild', human: 'the temporary cache re-fills itself on next use; no manual step needed' },
    }));
  }
  return recs;
}

// ── Wiring recommendations ───────────────────────────────────────────────────────────────────────
// Input: wiring survey sites[{project, mechanism, ...}]. We recommend de-npx-ing a project only when
// it has NPX resolution sites. This reuses reconcile-project.mjs (which backs up + is idempotent).
export function buildWiringRecommendations({ sites = [] } = {}) {
  const byProject = new Map();
  for (const s of sites) {
    if (s.mechanism !== 'NPX') continue;
    if (!byProject.has(s.project)) byProject.set(s.project, []);
    byProject.get(s.project).push(s);
  }
  const recs = [];
  for (const [project, npxSites] of byProject) {
    recs.push(makeRecommendation({
      id: `reconcile:${project}`,
      title: `Speed up “${project}” — ${npxSites.length} tool call${npxSites.length === 1 ? '' : 's'} download a fresh copy each time`,
      rationale: `These launch RuvNet tools via npx, which re-downloads on every run and can silently use a stale copy.`,
      severity: 'SUGGESTED',
      touchesMachine: true,
      plainImpact: `Right now the project “${project}” starts its RuvNet tools by fetching a fresh copy every ` +
        `single time they run — that's slower, and it can quietly run an out-of-date version without telling you. ` +
        `This switches it to use the one copy already installed on your computer: faster, and always the version ` +
        `you expect. We back up the project's settings files first, and you can restore them with one click.`,
      evidence: npxSites.slice(0, 8).map((s) => ({ observed: `${s.file} · ${s.event}: ${String(s.spec).slice(0, 80)}`, source: 'wiring survey' })),
      cost: { time: '~1s', latency: 'faster after (no per-call download)', usd: 0, risk: 'low' },
      change: { kind: 'run-script', human: `rewire “${project}” to the global binary`, cmd: `reconcile-project --apply --project ${project}`, project },
      undo: { kind: 'restore-backup', human: `restore the .bak-reconcile-* settings files written before the change` },
    }));
  }
  return recs;
}

// ── Memory-health scoring ────────────────────────────────────────────────────────────────────────
// DDD context 6. A dimension that was NOT probed is listed in notTested[] and contributes to NEITHER
// the numerator nor the denominator — it can never inflate OR deflate the score. A tested dimension
// that is FAIL caps the whole score below "healthy" (house rule: a known-broken dimension caps it,
// no inflated scores). Nothing is ever scored from an assumption.
export const MEMORY_DIMENSIONS = [
  { key: 'liveness', label: 'Liveness', weight: 25, why: 'a real store→search round-trip on the path actually in use' },
  { key: 'coverage', label: 'Coverage', weight: 20, why: 'a project checkpoint exists and is fresh' },
  { key: 'recallQuality', label: 'Recall quality', weight: 25, why: 'a synthetic question actually surfaces the checkpoint in top-k' },
  { key: 'compactionSurvival', label: 'Compaction survival', weight: 15, why: 'a PreCompact snapshot was written' },
  { key: 'sessionSurfacing', label: 'Session surfacing', weight: 15, why: 'session start puts project state in front of the model' },
];

// probes: { [key]: { status: 'ok'|'warn'|'fail'|'notTested', detail } }. A key absent from probes,
// or explicitly 'notTested', is treated as not probed.
export function scoreMemoryHealth({ project, probes = {} }) {
  const earnedFor = (status, weight) => (status === 'ok' ? weight : status === 'warn' ? weight * 0.5 : 0);
  const dimensions = [];
  const notTested = [];
  let earned = 0, testedWeight = 0, anyFail = false;

  for (const d of MEMORY_DIMENSIONS) {
    const p = probes[d.key];
    const status = p?.status ?? 'notTested';
    if (status === 'notTested') {
      notTested.push(d.key);
      dimensions.push({ key: d.key, label: d.label, status: 'notTested', detail: p?.detail ?? `not checked this session — ${d.why}`, deduction: 0, weight: d.weight });
      continue;
    }
    const e = earnedFor(status, d.weight);
    earned += e; testedWeight += d.weight;
    if (status === 'fail') anyFail = true;
    dimensions.push({ key: d.key, label: d.label, status, detail: p.detail ?? d.why, deduction: +(d.weight - e).toFixed(1), weight: d.weight });
  }

  // No tested dimension ⇒ no score. We refuse to emit a number we did not measure (ADR verification #4).
  const raw = testedWeight === 0 ? null : Math.round((earned / testedWeight) * 100);
  const score = raw === null ? null : (anyFail ? Math.min(raw, 49) : raw);
  const summary = score === null
    ? 'not enough probed to score — nothing measured this session'
    : `${score}/100 across ${MEMORY_DIMENSIONS.length - notTested.length} probed dimension${MEMORY_DIMENSIONS.length - notTested.length === 1 ? '' : 's'}` +
      (notTested.length ? `; ${notTested.length} not checked` : '') + (anyFail ? '; capped by a broken dimension' : '');

  return { project: project ?? null, score, dimensions, notTested, cappedByFailure: anyFail, summary };
}

// ── Wiring summary (pure) ───────────────────────────────────────────────────────────────────────
export function summarizeWiring(sites = []) {
  const s = { npx: 0, global: 0, mcp: 0, plugin: 0, projectsWithNpx: 0 };
  const npxProjects = new Set();
  for (const site of sites) {
    if (site.mechanism === 'NPX') { s.npx++; npxProjects.add(site.project); }
    else if (site.mechanism === 'GLOBAL_BINARY') s.global++;
    else if (site.mechanism === 'MCP') s.mcp++;
    else if (site.mechanism === 'PLUGIN') s.plugin++;
  }
  s.projectsWithNpx = npxProjects.size;
  return s;
}

// Re-export the single comparator so nothing downstream is tempted to compare versions itself.
export { cmpVersion };
