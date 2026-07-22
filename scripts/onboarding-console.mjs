#!/usr/bin/env node
// onboarding-console.mjs — the Onboarding Console server (ADR-0013 / DDD-0002).
//
// A locally-served page that renders RuvNet Brain's view of YOUR machine from real, measured state,
// and — only when you explicitly click, and only after telling you in plain words what it does —
// applies reversible fixes.
//
// The design law, encoded here rather than promised:
//   • READ-ONLY BY DEFAULT. Serving the page and building /api/state writes nothing. (The stack
//     audit reaches the npm registry over the network but mutates no user file.) Provable by running
//     against a read-only filesystem: nothing in the render path opens a file for writing.
//   • THE ONLY WRITER is the apply/save path, reached only by an authenticated POST the user triggered.
//   • RE-VERIFY BEFORE WRITE. Apply re-measures the world and refuses any item that is no longer true
//     (already fixed, or the machine moved) — the stale-read-then-write pattern that clobbered a memory
//     checkpoint on 2026-07-12 is structurally avoided.
//   • RECORD THE INVERSE FIRST. The undo is journalled before the mutation runs.
//   • NEVER RE-IMPLEMENT A MUTATION. Every machine change dispatches to a script that already backs up,
//     verifies against disk, and is idempotent (stack-sync.mjs --sync, reconcile-project.mjs --apply).
//   • Bind 127.0.0.1 only; mint a random per-launch token; every mutating POST must echo it (else 403).

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync, spawn } from 'node:child_process';

import { auditModel, installedVersion } from './stack-sync.mjs';
import { findStores, diagnose } from './memory-doctor.mjs';
import { buildStackRecommendations, buildWiringRecommendations, summarizeWiring, scoreMemoryHealth, buildHealthRecommendations } from './console-engine.mjs';
import { planFor } from './remedy-registry.mjs';
import { loadCatalog as engineCatalog, catalogSource as engineCatalogSource, loadProfile as engineProfile, applyProfile, PROFILE_PATH } from './model-router-engine.mjs';
import { effectivePrices, loadLabelledRows, MIN_LABELS, OUTCOMES } from './metaharness-router.mjs';
import { utilization } from './router-utilization.mjs';
import { loadCatalog, detectProvider, frontierFor } from './model-catalog.mjs';
import { learnings } from './learnings.mjs';
import { gatesSurvey } from './gates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(__dirname);
const CONSOLE_DIR = path.join(REPO, 'console');
const HOME = os.homedir();
const NPM_PREFIX = path.join(HOME, '.npm-global');
const CONFIG_DIR = path.join(HOME, '.claude/ruvnet-brain');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const UNDO_JOURNAL = path.join(HOME, '.cache/ruvnet-brain/console-undo.jsonl');
const TOKEN = crypto.randomBytes(24).toString('hex');

const NPX_RUV = /npx\s+(?:-y\s+|--yes\s+)?(?:@claude-flow\/[\w-]+|claude-flow|ruflo|ruvector|ruv-swarm|flow-nexus|metaharness|@metaharness\/[\w-]+|agentic-qe|aqe)(?:@[\w.-]+)?/;

// ── tiny read helpers (all read-only) ────────────────────────────────────────────────────────────
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
// Read-only sqlite scalar with a WAL-safe fallback. A database being actively WRITTEN right now — the
// current project's OWN store, mid-session — can refuse a plain read-only open with SQLITE_CANTOPEN(14)
// because it cannot set up the -wal/-shm shared memory read-only. That is a sign of a LIVE, in-use
// store, NOT a broken one (misreading it as "broken" is the exact false-alarm memory-doctor's header
// warns against). So we retry with immutable=1, which reads the main file directly without WAL/SHM,
// and only give up if BOTH fail. Never throws, never writes. Returns { ok, value, mode }.
function robustRead(db, sql) {
  let lastErr = null;
  for (const mode of ['mode=ro', 'immutable=1']) {
    try {
      const uri = `file:${encodeURI(db)}?${mode}`;
      const v = execFileSync('sqlite3', [uri, sql], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return { ok: true, value: v === '' ? null : v, mode };
    } catch (e) { lastErr = e; }
  }
  return { ok: false, value: null, mode: null, err: String(lastErr && lastErr.message || 'unreadable') };
}
// Row-returning sibling of robustRead: same WAL-safe two-mode ladder, `sqlite3 -json` output.
function robustReadJSON(db, sql) {
  for (const mode of ['mode=ro', 'immutable=1']) {
    try {
      const uri = `file:${encodeURI(db)}?${mode}`;
      const v = execFileSync('sqlite3', ['-json', uri, sql], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return { ok: true, rows: v ? JSON.parse(v) : [], mode };
    } catch { /* try next mode */ }
  }
  return { ok: false, rows: [], mode: null };
}

// ── Wiring survey (read-only): how do this machine's projects launch rUv tools? ───────────────────
// Directories that are somebody else's code sitting on your disk. Their hook wiring is not YOUR
// wiring: you will never "fix" it, and counting it makes the card describe a machine you don't have.
// `ruvnet-repos` was the expensive omission — 98 of 768 sites (13% of the card) came from clones of
// rUv's OWN repos, including a directory literally named tests/init-test, and 18 of the 21 npx call
// sites the card warned about were his test fixtures rather than anything Stuart configured.
const VENDOR = ['/clones/', '/node_modules/', '/vendor/', '/upstream/', '.claude-backup', '_snapshots',
  '/ruvnet-repos/', '/ruvnet_repos/'];

// ── Candidate scan roots (issue #19) ────────────────────────────────────────────────────────────
// A single hardcoded `~/Code` silently reports "0" on any machine that keeps projects somewhere
// else (a reporter's `~/source`, `~/dev`, `~/work`, …) — a confident zero that just means "didn't
// look in the right place". Scan every root that actually exists on THIS machine, plus a user
// override in config.json (`scanRoots`, absolute paths or relative to $HOME) when present.
const DEFAULT_SCAN_ROOTS = ['Code', 'code', 'src', 'source', 'projects', 'dev', 'work'];
function candidateRoots() {
  const cfg = readJSON(CONFIG_PATH) || {};
  const configured = Array.isArray(cfg.scanRoots) && cfg.scanRoots.length > 0
    ? cfg.scanRoots.map((r) => (path.isAbsolute(r) ? r : path.join(HOME, r)))
    : DEFAULT_SCAN_ROOTS.map((d) => path.join(HOME, d));
  const seen = new Set();
  const roots = [];
  for (const r of configured) {
    const resolved = path.resolve(r);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    try { if (fs.statSync(resolved).isDirectory()) roots.push(resolved); } catch { /* doesn't exist on this machine — skip silently */ }
  }
  return roots;
}
function findProjects(root) {
  const out = new Set();
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (VENDOR.some((m) => (p + '/').includes(m))) continue;
      if (e.isDirectory()) {
        if (e.name === '.claude') { out.add(dir); continue; }
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        walk(p, depth + 1);
      } else if (e.name === '.mcp.json') out.add(dir);
    }
  };
  walk(root, 0);
  return [...out].sort();
}
// Text that PRINTS the word npx is not an npx call site. Two of the sites this card warned about were
// `echo "Session ended. Run: npx aqe learn status"` — advice being displayed to the user, matched as
// though the machine were executing it. Strip quoted echo/printf payloads before classifying.
const stripPrinted = (cmd) => String(cmd)
  .replace(/\b(?:echo|printf)\s+(['"])(?:\\.|(?!\1)[\s\S])*?\1/g, ' ')
  .replace(/\b(?:echo|printf)\s+[^|;&]*/g, ' ');
function classifyCommand(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return null;
  if (NPX_RUV.test(stripPrinted(cmd))) return 'NPX';
  if (/\.npm-global\/bin\/(ruflo|ruvector|ruv-swarm|flow-nexus)/.test(cmd) || /hook-handler\.cjs/.test(cmd)) return 'GLOBAL_BINARY';
  if (/CLAUDE_PLUGIN_ROOT/.test(cmd)) return 'PLUGIN';
  return null;
}
function wiringSurvey() {
  const sites = [];
  // Scan every candidate root (issue #19), de-duped by resolved path — a symlinked or nested root
  // must never count the same project twice.
  const seenProjects = new Set();
  const projects = [];
  for (const root of candidateRoots()) {
    for (const proj of findProjects(root)) {
      const resolved = path.resolve(proj);
      if (seenProjects.has(resolved)) continue;
      seenProjects.add(resolved);
      projects.push({ proj, root });
    }
  }
  for (const { proj, root } of projects) {
    // Relative to the root it was actually found under, so "myproj" stays "myproj" instead of
    // becoming an ugly full path when the machine only has one root (the common case).
    const projName = path.relative(root, proj);
    for (const f of ['.claude/settings.json', '.claude/settings.local.json']) {
      const s = readJSON(path.join(proj, f));
      if (!s?.hooks) continue;
      for (const [event, groups] of Object.entries(s.hooks)) {
        const list = Array.isArray(groups) ? groups : [groups];
        for (const g of list) {
          const hookArr = Array.isArray(g?.hooks) ? g.hooks : (g?.command ? [g] : []);
          for (const h of hookArr) {
            const mech = classifyCommand(h?.command);
            if (mech) sites.push({ scope: 'project', project: projName, file: f, event, matcher: g?.matcher ?? '*', spec: String(h.command).slice(0, 160), mechanism: mech });
          }
        }
      }
    }
    const mcp = readJSON(path.join(proj, '.mcp.json'));
    for (const [name, v] of Object.entries(mcp?.mcpServers || {})) {
      const full = [v.command, ...(v.args || [])].join(' ');
      const mech = NPX_RUV.test(full) ? 'NPX' : (/\bnpx\b/.test(full) ? null : 'MCP');
      if (mech) sites.push({ scope: 'project', project: projName, file: '.mcp.json', event: 'MCP', matcher: name, spec: full.slice(0, 160), mechanism: mech });
    }
  }
  return { sites, summary: summarizeWiring(sites) };
}

// ── Memory health (read-only probes for the project the console was launched from) ────────────────
function sessionHookExists() {
  return fs.existsSync(path.join(HOME, '.claude/hooks/agentdb-ensure.sh')) || fs.existsSync(path.join(HOME, '.claude/hooks'));
}
function probeMemory(projectDir) {
  const db = path.join(projectDir, '.swarm/memory.db');
  const probes = {};
  // compaction survival + session surfacing are filesystem facts, always checkable
  const snap = fs.existsSync(path.join(projectDir, 'agentdb-sessions.jsonl')) || fs.existsSync(path.join(projectDir, '.swarm/agentdb-sessions.jsonl'));
  probes.compactionSurvival = snap ? { status: 'ok', detail: 'a PreCompact snapshot file is present' } : { status: 'warn', detail: 'no PreCompact snapshot found for this project yet' };
  probes.sessionSurfacing = sessionHookExists() ? { status: 'ok', detail: 'the global SessionStart hook surfaces project state at launch' } : { status: 'warn', detail: 'no SessionStart recall hook found' };
  // recall quality: honestly NOT probed at render (a true probe needs an embedding query; left for an explicit deep test)
  probes.recallQuality = { status: 'notTested', detail: 'not checked this session — a real recall probe needs an embedding round-trip, which render deliberately avoids' };

  if (!fs.existsSync(db)) {
    probes.liveness = { status: 'fail', detail: 'this project has no memory store (.swarm/memory.db) yet' };
    probes.coverage = { status: 'warn', detail: 'no checkpoint — no store has been created here' };
    return probes;
  }
  // Liveness from a WAL-safe read. Existing-but-unopenable means the store is being written RIGHT NOW
  // (a live store) — reported as "not checked this instant", never as a capping failure. Only a real
  // corruption (integrity_check ≠ ok) is a fail.
  const integ = robustRead(db, 'PRAGMA integrity_check;');
  if (!integ.ok) {
    probes.liveness = { status: 'notTested', detail: 'store is in active use right now — could not open a read-only snapshot this instant (normal for a live database being written; not a failure)' };
    probes.coverage = { status: 'notTested', detail: 'store busy this instant — checkpoint presence not checked' };
    return probes;
  }
  const integrity = (integ.value || '').split('\n')[0] || 'unknown';
  const totalR = robustRead(db, 'SELECT count(*) FROM memory_entries;');
  const embR = robustRead(db, "SELECT count(*) FROM memory_entries WHERE embedding IS NOT NULL AND length(embedding)>0;");
  const total = totalR.ok ? (totalR.value === null ? 0 : parseInt(totalR.value, 10)) : null;
  const embedded = embR.ok && embR.value !== null ? parseInt(embR.value, 10) : null;
  const liveNote = integ.mode === 'immutable=1' ? ' and in active use' : '';
  if (integrity !== 'ok') probes.liveness = { status: 'fail', detail: `store is corrupt (integrity_check: ${integrity})` };
  else if (total === null) probes.liveness = { status: 'notTested', detail: 'store opened but counts were unavailable this instant' };
  else if (total > 0) probes.liveness = { status: 'ok', detail: `store is live${liveNote}, integrity ok, ${total} entries${embedded != null && total ? `, ${Math.round((embedded / total) * 100)}% embedded` : ''} (read-only)` };
  else probes.liveness = { status: 'warn', detail: 'store exists but is empty' };

  const cp = robustRead(db, "SELECT max(updated_at) FROM memory_entries WHERE key LIKE 'project-state-current%';");
  if (cp.ok && cp.value) {
    const ageH = (Date.now() - Number(cp.value) * (String(cp.value).length <= 10 ? 1000 : 1)) / 3.6e6;
    probes.coverage = Number.isFinite(ageH) && ageH < 48
      ? { status: 'ok', detail: `project checkpoint present, ~${Math.max(0, ageH).toFixed(0)}h old` }
      : { status: 'warn', detail: 'project checkpoint present but stale (>2 days)' };
  } else if (cp.ok) {
    probes.coverage = { status: 'warn', detail: 'no project-state checkpoint found in this store' };
  } else {
    probes.coverage = { status: 'notTested', detail: 'store busy this instant — checkpoint presence not checked' };
  }
  return probes;
}
// The fleet-wide scan opens and queries every memory store on the machine — ~90ms each, and a real
// machine has 100+. That is far too slow to sit on the page's first paint, so it is its own endpoint
// (/api/memory) and hydrates late, exactly like the stack audit does.
function scanFleet() {
  // memory-doctor.mjs's findStores() defaults to ~/Code and cannot be edited here (issue #19) — so
  // pass it every candidate root explicitly and de-dupe (it also always appends a couple of known
  // extra paths regardless of root, which the Set below folds together instead of duplicating).
  const seen = new Set();
  const stores = [];
  for (const root of candidateRoots()) {
    for (const db of findStores(root)) {
      const resolved = path.resolve(db);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      stores.push(db);
    }
  }
  const fleet = [];
  for (const db of stores) {
    const d = diagnose(db);
    if (d.unreadable || d.schemaless) { fleet.push({ name: d.name, unreadable: d.unreadable || 'no memory schema', total: 0, learns: false, findings: d.findings }); continue; }
    if ((d.total || 0) === 0) continue;
    fleet.push({ name: d.name, total: d.total, embedded: d.embedded, coverPct: +(d.cover * 100).toFixed(1), patterns: d.patterns ?? 0, learns: !!d.learns, findings: d.findings });
  }
  fleet.sort((a, b) => (b.total || 0) - (a.total || 0));
  return fleet;
}
function gatherMemory(cwd, { fleet = true } = {}) {
  // health = for the project the console was launched from (fall back to this repo)
  const project = fs.existsSync(path.join(cwd, '.swarm/memory.db')) ? cwd : REPO;
  const projName = project.replace(HOME + '/Code/', '').replace(HOME + '/', '~/');
  const health = scoreMemoryHealth({ project: projName, probes: probeMemory(project) });
  return { fleet: fleet ? scanFleet() : null, health };
}

// ── Savings ledger (receipts only) ────────────────────────────────────────────────────────────────
function gatherSavings() {
  // Primary source is the real routing-receipts ledger written by scripts/route-cheap.mjs.
  const files = [
    path.join(HOME, '.claude/metaharness/routing-receipts.jsonl'),
    path.join(HOME, '.cache/ruvnet-brain/metaharness-receipts.jsonl'),
    // Canonical user-level ledger (issue #36 — the hooks no longer scatter per-CWD copies).
    path.join(HOME, '.cache/ruvnet-brain/token-ledger.jsonl'),
    // Legacy location, still read so an existing user's history is not orphaned by the move.
    path.join(REPO, 'plugin/scripts/.ruvnet-brain/token-ledger.jsonl'),
  ];
  const receipts = [];
  let baselineUsd = 0;
  let skippedUnmeasured = 0; // rows with neither a $ nor a time saving — counted so labels can say so
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = (() => { try { return JSON.parse(line); } catch { return null; } })();
      if (!r) continue;
      // MEASURED $ saved: explicit field, else frontier cost minus chosen cost.
      let usd = Number(r.measuredUsd ?? r.savedUsd ?? r.usd ?? r.saved);
      if (!Number.isFinite(usd) && Number.isFinite(Number(r.est_frontier_cost)) && Number.isFinite(Number(r.est_cost))) {
        usd = Number(r.est_frontier_cost) - Number(r.est_cost);
      }
      // MEASURED time saved: explicit field, else baseline duration minus routed duration.
      let ms = Number(r.measuredMs ?? r.savedMs ?? r.ms);
      if (!Number.isFinite(ms) && Number.isFinite(Number(r.baseline_duration_ms)) && Number.isFinite(Number(r.duration_ms))) {
        ms = Number(r.baseline_duration_ms) - Number(r.duration_ms);
      }
      if (!Number.isFinite(usd) && !Number.isFinite(ms)) { skippedUnmeasured += 1; continue; }
      const base = Number(r.est_frontier_cost);
      if (Number.isFinite(base)) baselineUsd += base;
      receipts.push({
        at: r.at ?? r.ts ?? null,
        capability: r.capability ?? r.tool ?? r.source ?? 'routing',
        task: r.task ?? r.label ?? '',
        chosenTier: r.chosenTier ?? r.tier ?? r.model ?? '',
        baselineTier: r.baselineTier ?? r.baseline ?? r.frontier_ref ?? '',
        measuredMs: Number.isFinite(ms) ? ms : null,
        measuredUsd: Number.isFinite(usd) ? usd : null,
      });
    }
  }
  const usdSaved = +receipts.reduce((a, r) => a + (r.measuredUsd || 0), 0).toFixed(4);
  const totals = receipts.length ? {
    count: receipts.length,
    usdSaved,
    msSaved: receipts.reduce((a, r) => a + (r.measuredMs || 0), 0),
    baselineUsd: +baselineUsd.toFixed(4),
    pctSaved: baselineUsd > 0 ? Math.round((usdSaved / baselineUsd) * 100) : null,
  } : null;
  return { totals, note: 'receipts only — no modelled, projected, or “up to” savings', skippedUnmeasured, receipts: receipts.slice(-25).reverse() };
}

// ── Config (user-level) ──────────────────────────────────────────────────────────────────────────
const CONFIG_SCHEMA = [
  { key: 'openrouterKey', label: 'OpenRouter API key', type: 'secret', secret: true, help: 'Unlocks cheap-model routing and the self-improvement loop. Stored only in your user folder.' },
  { key: 'provider', label: 'Your model house', type: 'enum', options: ['auto', 'anthropic', 'openai', 'codex', 'google', 'xai'], help: 'Which stack is yours? Sets your frontier model + savings baseline — Claude → Fable 5, ChatGPT → GPT-5.6 Sol, Codex → Sol, Gemini → 3.1 Pro, Grok → 4.5. “auto” detects from your keys.' },
  { key: 'nightly', label: 'Nightly brain refresh', type: 'bool', help: 'Rebuild the knowledge base from pinned versions overnight so answers stay current.' },
  { key: 'routing', label: 'Token-smart routing', type: 'enum', options: ['auto', 'off'], help: 'Send cheap, mechanical tasks to smaller, cheaper models automatically.' },
  { key: 'qeFleet', label: 'On-demand QE test fleet', type: 'bool', help: 'Let RuvNet Brain spin up an Agentic-QE test fleet when you ask it to.' },
];
function gatherConfig() {
  const cfg = readJSON(CONFIG_PATH) || {};
  const hasKey = !!(cfg.openrouterKey && String(cfg.openrouterKey).length > 8) || !!process.env.OPENROUTER_API_KEY;
  return {
    path: CONFIG_PATH.replace(HOME, '~'),
    exists: fs.existsSync(CONFIG_PATH),
    values: {
      openrouterKey: hasKey,                               // boolean only — never the secret itself
      provider: cfg.provider || 'auto',                    // model house — 'auto' detects from keys
      nightly: cfg.nightly !== false,                      // default on
      routing: cfg.routing === 'off' ? 'off' : 'auto',     // default auto
      qeFleet: cfg.qeFleet === true,                       // default off
    },
    schema: CONFIG_SCHEMA,
  };
}

// ── Brain activity read-model (ADR-0018) — read-only, file reads + sqlite3 CLI only ──────────────
// Fleet scan is cached for 10 min: ~50 stores × a CLI spawn each is fine once, not per poll.
// 2026-07-17 (Stuart: "work faster" — measured 49s cold vs 1.8s warm): the cache now PERSISTS to
// disk and hydrates at boot, so a fresh server paints real data instantly with its honest
// "scanned at HH:MM" stamp; an expired cache is served stale while the re-scan runs BEHIND the
// response (setImmediate), never on the request that triggered it. First-ever run (no disk cache
// at all) still scans inline — there is nothing older to serve, and no number beats a fake one.
let ACTIVITY_MACHINE_CACHE = null;
let FLEET_REFRESHING = false;
const CONSOLE_CACHE_PATH = path.join(HOME, '.cache/ruvnet-brain/console-cache.json');

// ── Warm-cache serving (2026-07-17, the demo-hang fix) ─────────────────────────────────────────────
// Every read-model here does multi-second synchronous work: gatherState ~13s, gatherStack ~22s,
// scanFleet ~40s+ (each opens 100+ SQLite stores or walks ~/Code). Node is single-threaded, so a
// SINGLE inline compute freezes the WHOLE server — which is exactly why fresh loads returned nothing
// (curl saw 000) roughly one request in three while a scan held the event loop. setImmediate does
// NOT help: deferring synchronous work still blocks the loop when it finally runs.
// The fix: the request handler NEVER computes inline once a cache exists. It serves the last cache
// (instant, a file read) and kicks a DETACHED CHILD PROCESS (`--refresh-cache`) to recompute off the
// server's event loop entirely. A truly cold machine (no cache at all) eats ONE inline compute to
// seed the cache, then is warm forever. Caches persist across restarts, so cold is rare.
const STATE_CACHE  = path.join(CONFIG_DIR, 'state-cache.json');
const STACK_CACHE  = path.join(CONFIG_DIR, 'stack-audit-cache.json');
const MEMORY_CACHE = path.join(CONFIG_DIR, 'memory-cache.json');
const SELF = fileURLToPath(import.meta.url);
let LAST_REFRESH_KICK = 0;
function writeCache(file, at, data) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ at, data })); }
  catch { /* a cache write must never break a response */ }
}
function kickRefresh() {
  const now = Date.now();
  if (now - LAST_REFRESH_KICK < 15000) return;   // debounce: at most one background refresh / 15s
  LAST_REFRESH_KICK = now;
  try {
    const child = spawn(process.execPath, [SELF, '--refresh-cache'], { detached: true, stdio: 'ignore', cwd: REPO });
    child.unref();   // let it outlive this request; it writes the caches and exits on its own
  } catch { /* best-effort: a failed spawn just means the cache ages until the next kick */ }
}
// Serve <file>'s cached data instantly; on a cold miss, compute once via <compute>, seed the cache,
// and serve that. Always kicks a background refresh so the next reader gets fresher data.
function serveCached(res, file, compute, decorate = (d) => d) {
  let c = readJSON(file);
  if (!c || !c.data) {
    try { const { at, data } = compute(); writeCache(file, at, data); c = { at, data }; }
    catch (e) { return sendJSON(res, 200, decorate({ warming: true, error: String(e && e.message || e) })); }
  } else {
    kickRefresh();
  }
  return sendJSON(res, 200, { ...decorate(c.data), fromCache: true, cachedAt: c.at });
}
/**
 * @returns {boolean} whether anything was actually restored — the caller uses this to decide
 * whether to warn a first-run user that the page starts empty. It used to return undefined, so a
 * truthiness check on it was always false; reporting what it really did keeps the caller honest.
 */
function loadConsoleCache() {
  let restored = false;
  try {
    const j = JSON.parse(fs.readFileSync(CONSOLE_CACHE_PATH, 'utf8'));
    if (j.activity && j.activity.at) { ACTIVITY_MACHINE_CACHE = j.activity; restored = true; }
    if (j.trust && j.trust.at) { TRUST_CACHE = j.trust; restored = true; }
  } catch { /* no cache yet — first ever boot */ }
  return restored;
}
function saveConsoleCache() {
  try {
    fs.mkdirSync(path.dirname(CONSOLE_CACHE_PATH), { recursive: true });
    fs.writeFileSync(CONSOLE_CACHE_PATH, JSON.stringify({ activity: ACTIVITY_MACHINE_CACHE, trust: TRUST_CACHE }));
  } catch { /* cache persistence must never break a read */ }
}
function refreshFleetCache() {
  const projects = [];
  let total = 0;
  const seen = new Set();
  // Scan every candidate root (issue #19) — this is what made machine-wide totals read 0 on a
  // machine whose projects live under ~/source instead of ~/Code.
  for (const root of candidateRoots()) {
    for (const s of findMemoryStores(root)) {
      const resolved = path.resolve(s.project);
      if (seen.has(resolved)) continue; // a project visible under two roots (e.g. a symlink) counts once
      seen.add(resolved);
      const n = Number(robustRead(s.db, "SELECT COUNT(*) FROM memory_entries WHERE status='active'").value || 0);
      if (n > 0) {
        // MAX(updated_at) = when this project was last actively worked — the memory store doubles
        // as the attention signal (relevance ordering, Stuart 2026-07-15).
        const lastTouched = Number(robustRead(s.db, 'SELECT MAX(updated_at) FROM memory_entries').value || 0);
        // rel = the root-relative path — the SAME key reconcile:<id> recommendations use (wiringSurvey
        // computes projName the same way, relative to whichever root the project was found under).
        projects.push({ name: path.basename(s.project), rel: path.relative(root, s.project), memories: n, lastTouched });
        total += n;
      }
    }
  }
  projects.sort((a, b) => b.memories - a.memories);
  ACTIVITY_MACHINE_CACHE = { at: Date.now(), projects, totalMemories: total };
  saveConsoleCache();
}
function findMemoryStores(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (VENDOR.some((m) => (p + '/').includes(m))) continue;
      if (e.name === '.swarm') {
        if (fs.existsSync(path.join(p, 'memory.db'))) out.push({ project: dir, db: path.join(p, 'memory.db') });
        continue;
      }
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      walk(p, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}
function gatherActivity(cwd) {
  const project = fs.existsSync(path.join(cwd, '.swarm/memory.db')) ? cwd : REPO;
  const db = path.join(project, '.swarm/memory.db');
  const out = { generatedAt: new Date().toISOString(), project: path.basename(project), hasStore: fs.existsSync(db) };
  if (!out.hasStore) return out;
  const rows = (sql) => robustReadJSON(db, sql).rows;
  out.totals = {
    memories: Number(robustRead(db, "SELECT COUNT(*) FROM memory_entries WHERE status='active'").value || 0),
    lessons: Number(robustRead(db, "SELECT COUNT(*) FROM memory_entries WHERE namespace='lessons' AND status='active'").value || 0),
  };
  out.lessons = rows("SELECT key, access_count, date(created_at/1000,'unixepoch') AS learned, substr(content,1,600) AS excerpt FROM memory_entries WHERE namespace='lessons' AND status='active' ORDER BY created_at DESC");
  out.recent = rows("SELECT key, namespace, type, datetime(updated_at/1000,'unixepoch','localtime') AS at FROM memory_entries WHERE status='active' ORDER BY updated_at DESC LIMIT 18");
  out.breakdown = rows("SELECT namespace, COUNT(*) AS n FROM memory_entries WHERE status='active' GROUP BY namespace ORDER BY n DESC");
  out.growth = rows("SELECT date(created_at/1000,'unixepoch') AS day, COUNT(*) AS n FROM memory_entries WHERE status='active' GROUP BY 1 ORDER BY 1");
  if (!ACTIVITY_MACHINE_CACHE) {
    refreshFleetCache(); // first-ever run: nothing older to serve honestly
  } else if (Date.now() - ACTIVITY_MACHINE_CACHE.at > 600000 && !FLEET_REFRESHING) {
    // Serve the stale-but-stamped cache NOW; re-scan behind the response. (Single-threaded server:
    // the background scan can still delay a CONCURRENT request — same as before, but never again
    // the request that asked.)
    FLEET_REFRESHING = true;
    setImmediate(() => { try { refreshFleetCache(); } finally { FLEET_REFRESHING = false; } });
  }
  out.machine = {
    projects: ACTIVITY_MACHINE_CACHE.projects,
    totalMemories: ACTIVITY_MACHINE_CACHE.totalMemories,
    scannedAt: new Date(ACTIVITY_MACHINE_CACHE.at).toISOString(),
  };
  return out;
}

// ── Router engine read-model ─────────────────────────────────────────────────────────────────────
// 2026-07-16 (Stuart: "if MetaHarness does all of this then let it do it, but let us add user-
// selected constraints"). This panel previously displayed router-optimizer.mjs — a parallel,
// subscription-blind re-derivation of routing strategy that bypassed the REAL engine wired on
// 2026-07-13 (model-router-engine.mjs → @metaharness/router). The replica is deleted. This
// read-model contains ZERO routing logic: it shows the engine's own inputs (catalog × this user's
// profile → effective marginal prices — the ONLY thing the local layer owns) and the engine's own
// recent decisions from its append-only log. Nothing here can disagree with what actually routes.
function gatherRouterEngine() {
  const profile = engineProfile();
  const candidates = applyProfile(engineCatalog(), profile);
  const prices = effectivePrices(candidates, profile);
  const { rows, unusable } = loadLabelledRows();
  const installed = fs.existsSync(path.join(__dirname, '..', 'node_modules', '@metaharness', 'router', 'package.json'));
  const list = (c) => (typeof c.costPerMTok === 'number' ? c.costPerMTok
    : c.costPerMTok && typeof c.costPerMTok.in === 'number' ? +(((c.costPerMTok.in + c.costPerMTok.out) / 2).toFixed(3))
    : null);
  const decisions = [];
  try {
    const log = path.join(os.homedir(), '.claude', 'metaharness', 'routing-decisions.jsonl');
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    for (const l of lines.slice(-8).reverse()) {
      try { const d = JSON.parse(l); decisions.push({ ts: d.ts, model: d.model, tier: d.tier, routedBy: d.routedBy, reason: d.reason }); } catch { /* skip bad line */ }
    }
  } catch { /* no decisions yet */ }
  const cfg = readJSON(CONFIG_PATH) || {};
  // User-constraint detection (Brain-side by design — a fact about THIS user, not routing logic):
  // an OpenRouter key decides whether metered cross-provider candidates are even reachable.
  let openrouterKey = !!process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) openrouterKey = !!(cfg.openrouterKey && String(cfg.openrouterKey).length > 8);
  // House (issue #21): three mechanisms used to disagree — Settings wrote config.json's `provider`,
  // but the chip strip derived "yours" from whichever pool candidate happened to be
  // subscriptionCovered first, sourced from profile.json (a file nothing in the console writes). The
  // user's Settings choice is now the single source of truth, via the SAME detectProvider() the
  // savings.utilization frontier calc already uses (config → env → catalog default) — so this and
  // the frontier calc can never disagree either.
  let house, providerKeys = {};
  try {
    const hcat = loadCatalog();
    house = detectProvider(hcat, { provider: cfg.provider });
    // Per-provider credential presence (issue #24): the old chip strip hardcoded "not detected" for
    // every provider that wasn't the current house, so it could never tell "not your house" from "no
    // key found". Read each provider's real detect_env vars — minus the CLAUDECODE / CLAUDE_CODE_ENTRYPOINT
    // run-context markers (which are not credentials), exactly as detectProvider() itself filters them —
    // so the UI's "key found / not found" is now true instead of decorative.
    const IGNORE_ENV = new Set(['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']);
    for (const [name, p] of Object.entries(hcat.providers || {})) {
      providerKeys[name] = (p.detect_env || []).some((k) => !IGNORE_ENV.has(k) && !!process.env[k]);
    }
  } catch { house = { provider: cfg.provider && cfg.provider !== 'auto' ? cfg.provider : 'anthropic', source: 'default' }; }
  return {
    engine: {
      package: '@metaharness/router', installed,
      labels: rows.length, needed: MIN_LABELS, unusableLabels: unusable,
      mode: !installed ? 'UNAVAILABLE' : rows.length >= MIN_LABELS ? 'LEARNED' : 'COLD-START',
      outcomesLog: OUTCOMES.replace(os.homedir(), '~'),
    },
    keys: { openrouter: openrouterKey, ...providerKeys },
    // Paid seats, found at USER level. `keys` above is env-var API keys only, which is exactly why a
    // user with ChatGPT Max and Claude Max read as "auto" — neither plan puts a key in the
    // environment. These two fields are what let the UI say "you already have this" instead of
    // asking someone to paste a credential they are already paying not to need.
    subscriptions: detectSubscriptions(),
    preferredSeat: preferredSeat(detectSubscriptions()),
    profile: { present: !!profile, path: PROFILE_PATH.replace(os.homedir(), '~') },
    catalogSource: engineCatalogSource(),   // 'catalog' | 'built-in-fallback' — so the UI never calls the stub a real catalog
    house,
    pool: candidates
      .map((c) => ({
        id: c.id, provider: c.provider, tier: c.tier || null, harness: c.harness || [],
        marginalPerMTok: Number.isFinite(prices[c.id]) ? prices[c.id] : null,
        listPerMTok: list(c),
        // From the profile fact, never inferred from a $0 price — a mispriced metered model must
        // not display as "yours" (exactly the bug this read-model caught on 2026-07-16).
        subscriptionCovered: (c.subscription || []).some((h) => profile?.harnesses?.[h]?.subscription === true),
        verified: c.verified || null, note: c.note || null,
      }))
      .sort((a, b) => (a.marginalPerMTok ?? Infinity) - (b.marginalPerMTok ?? Infinity)),
    decisions,
  };
}

// ── Trust & provenance read-model (v3.3 preview; ADR-0013 follow-on) ─────────────────────────────
// Two measurements are REAL today: the release bundle's published sha256, read live from the latest
// GitHub release's .sha256 asset (read-only metadata — the same class of network touch as the stack
// registry audit), and the local CycloneDX SBOM at sbom/ruvnet-brain.cdx.json (v3.3, `npm run sbom`)
// when it has been generated on this machine. Install channel is read from the plugin cache on disk.
// Advisor Mode is v3.3 and is reported as an honest empty state by the frontend — this read-model
// never fabricates.
const TRUST_REPO = 'stuinfla/ruvnet-brain';
const SBOM_PATH = path.join(REPO, 'sbom', 'ruvnet-brain.cdx.json');
// Local-file read, no network: the SBOM is generated by `npm run sbom` (CycloneDX 1.6 via
// @cyclonedx/cyclonedx-npm, --omit dev) and committed alongside releases. Absent = honest empty
// state, matching the "coming v3.3" language already shipped on the console card.
function readSbom() {
  const rel = path.relative(REPO, SBOM_PATH);
  if (!fs.existsSync(SBOM_PATH)) return { present: false, path: rel };
  try {
    const j = JSON.parse(fs.readFileSync(SBOM_PATH, 'utf8'));
    const components = Array.isArray(j.components) ? j.components : [];
    return {
      present: true,
      path: rel,
      componentCount: components.length,
      specVersion: j.specVersion || null,
      bomFormat: j.bomFormat || null,
      generatedAt: (j.metadata && j.metadata.timestamp) || null,
      mainComponent: (j.metadata && j.metadata.component && j.metadata.component.name) || null,
      mainVersion: (j.metadata && j.metadata.component && j.metadata.component.version) || null,
    };
  } catch (e) {
    return { present: false, path: rel, error: String((e && e.message) || e) };
  }
}
let TRUST_CACHE = null; // successful release reads cached 10 min; failures are never cached
async function fetchReleaseDigest() {
  const ua = { 'user-agent': 'ruvnet-brain-console' };
  const rel = await fetch(`https://api.github.com/repos/${TRUST_REPO}/releases/latest`,
    { headers: { ...ua, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) });
  if (!rel.ok) throw new Error(`GitHub answered HTTP ${rel.status}`);
  const j = await rel.json();
  const assets = Array.isArray(j.assets) ? j.assets : [];
  const shaAsset = assets.find((a) => String(a.name).endsWith('.sha256'));
  const sigAsset = assets.find((a) => String(a.name).endsWith('.sig'));
  let sha256 = null;
  let file = null;
  if (shaAsset) {
    const r2 = await fetch(shaAsset.browser_download_url, { headers: ua, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (r2.ok) {
      const m = (await r2.text()).trim().match(/^([0-9a-f]{64})\s+\*?(\S+)/i);
      if (m) { sha256 = m[1]; file = m[2]; }
    }
  }
  return {
    ok: !!sha256,
    tag: j.tag_name || null,
    publishedAt: j.published_at || null,
    asset: file || (shaAsset ? String(shaAsset.name).replace(/\.sha256$/, '') : null),
    sha256,
    sig: !!sigAsset,
    source: `github.com/${TRUST_REPO}/releases/latest`,
  };
}
function readInstallChannel() {
  const reg = readJSON(path.join(HOME, '.claude/plugins/installed_plugins.json'));
  const entries = reg && reg.plugins && reg.plugins['ruvnet-brain@ruvnet-brain'];
  const e = Array.isArray(entries) ? entries[0] : null;
  if (!e || !e.installPath || !fs.existsSync(e.installPath)) return { installed: false };
  const km = readJSON(path.join(HOME, '.claude/plugins/known_marketplaces.json'));
  const src = km && km['ruvnet-brain'] && km['ruvnet-brain'].source;
  const pinned = !!(src && (src.ref || src.tag || src.commit)); // no pin recorded → tracking latest
  return {
    installed: true,
    version: path.basename(e.installPath) || e.version || null, // the plugin cache version dir IS the truth
    channel: pinned ? 'pinned' : 'latest',
    lastUpdated: e.lastUpdated || null,
    cacheDir: String(e.installPath).replace(HOME, '~'),
    repo: (src && src.repo) || null,
  };
}
async function gatherTrust() {
  if (TRUST_CACHE && Date.now() - TRUST_CACHE.at < 600000) {
    // Disk facts stay live even on a cached release read — the SBOM file and install channel can
    // change (a fresh `npm run sbom`, a plugin update) between two calls inside the 10-min window.
    return { ...TRUST_CACHE.data, channel: readInstallChannel(), sbom: readSbom() };
  }
  let release;
  try { release = await fetchReleaseDigest(); }
  catch (e) { release = { ok: false, error: String((e && e.message) || e) }; }
  const data = { generatedAt: new Date().toISOString(), release };
  if (release.ok) { TRUST_CACHE = { at: Date.now(), data }; saveConsoleCache(); }
  return { ...data, channel: readInstallChannel(), sbom: readSbom() };
}

// ── Assemble the read-models ─────────────────────────────────────────────────────────────────────
/**
 * PAID SUBSCRIPTIONS, detected at USER level — not project level, not from environment variables.
 *
 * WHY THIS EXISTS. A user with BOTH a ChatGPT Max plan and a Claude Max plan showed up as "auto",
 * because the only thing "auto" ever looked at was `detect_env` — API keys in environment
 * variables. Verified on a real machine 2026-07-20: `~/.codex/auth.json` reads
 * `auth_mode: "chatgpt"`, `OPENAI_API_KEY: null`, with live OAuth tokens. A genuine, paid,
 * authenticated ChatGPT subscription with no API key anywhere — completely invisible to the old
 * detector. Claude's own Max session is worse: on macOS it lives in the LOGIN KEYCHAIN, so there is
 * no file to find at all.
 *
 * WHY IT MATTERS BEYOND A WRONG LABEL. A subscription is already paid for at a flat rate; an API
 * key bills per token. Routing to a key while an authenticated seat sits idle spends money the user
 * has already spent. So a subscription always outranks a key — the key is the LAST resort, never
 * the default. (Same principle as the meta-proxy's Passthrough plane: use the subscription you are
 * already paying for, and treat metered capacity as the fallback.)
 *
 * SECRETS ARE NEVER READ. For the keychain we ask only whether the ITEM EXISTS — never `-w`, which
 * would print the secret. For token files we check for the presence of a field, never its value.
 * Nothing here is logged, transmitted, or written anywhere.
 *
 * @returns {Record<string, {subscription: boolean, apiKey: boolean, how: string}>}
 */
export function detectSubscriptions() {
  const home = os.homedir();
  const out = {};
  const seat = (provider, subscription, apiKey, how) => { out[provider] = { subscription, apiKey, how }; };

  // ── Anthropic (Claude Pro/Max) ────────────────────────────────────────────────────────────────
  // macOS keeps the Claude Code OAuth session in the login keychain; Linux/Windows use a file.
  // Existence only — `security find-generic-password` WITHOUT -w prints metadata, never the secret.
  let claudeSub = false; let claudeHow = 'not found';
  const credFile = path.join(home, '.claude', '.credentials.json');
  if (fs.existsSync(credFile)) { claudeSub = true; claudeHow = '~/.claude/.credentials.json'; }
  else if (process.platform === 'darwin') {
    try {
      const r = spawnSync('security', ['find-generic-password', '-s', 'Claude Code-credentials'], { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0) { claudeSub = true; claudeHow = 'macOS login keychain'; }
    } catch { /* absent or locked — treated as not found, never as an error */ }
  }
  seat('anthropic', claudeSub, !!process.env.ANTHROPIC_API_KEY, claudeHow);

  // ── OpenAI / ChatGPT (via the Codex CLI) ──────────────────────────────────────────────────────
  // auth_mode === 'chatgpt' means a ChatGPT plan is signed in; 'apikey' means metered billing.
  let oaSub = false; let oaKey = !!process.env.OPENAI_API_KEY; let oaHow = 'not found';
  const codexAuth = path.join(home, '.codex', 'auth.json');
  if (fs.existsSync(codexAuth)) {
    try {
      const j = JSON.parse(fs.readFileSync(codexAuth, 'utf8'));
      if (j.auth_mode === 'chatgpt' || (j.tokens && j.tokens.access_token)) { oaSub = true; oaHow = '~/.codex/auth.json (ChatGPT plan)'; }
      if (j.OPENAI_API_KEY) oaKey = true;
    } catch { /* unreadable/corrupt — report nothing rather than guess */ }
  }
  seat('openai', oaSub, oaKey, oaHow);
  // Codex is the same seat as the ChatGPT plan above, surfaced separately because the UI lists it
  // as its own "house" — one subscription, two labels, so never counted as two entitlements.
  seat('codex', oaSub, oaKey, oaHow === 'not found' ? 'not found' : `${oaHow} — same seat as OpenAI`);

  // ── Google (Gemini) ───────────────────────────────────────────────────────────────────────────
  // gcloud ADC is a real authenticated credential; a bare ~/.gemini directory is NOT — it holds
  // settings and skills and exists on machines that were never signed in. Claiming a subscription
  // from a config folder would be exactly the fabricated-status this project forbids.
  const adc = path.join(home, '.config', 'gcloud', 'application_default_credentials.json');
  const gSub = fs.existsSync(adc);
  seat('google', gSub, !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), gSub ? '~/.config/gcloud (ADC)' : 'not found');

  // ── xAI (Grok) ────────────────────────────────────────────────────────────────────────────────
  // No CLI writes a discoverable subscription credential today. Say so honestly rather than
  // inventing a detector that always returns false and looks like a real check.
  seat('xai', false, !!process.env.XAI_API_KEY, 'no detectable subscription credential');

  return out;
}

/**
 * What to actually USE, given what was found. Subscription first, always.
 * @returns {{provider: string|null, basis: 'subscription'|'api-key'|'none', detail: string}}
 */
export function preferredSeat(subs) {
  const order = ['anthropic', 'openai', 'codex', 'google', 'xai'];
  for (const p of order) if (subs[p]?.subscription) return { provider: p, basis: 'subscription', detail: subs[p].how };
  for (const p of order) if (subs[p]?.apiKey) return { provider: p, basis: 'api-key', detail: 'environment variable' };
  return { provider: null, basis: 'none', detail: 'nothing detected' };
}

function gatherState(cwd, { fleet = true } = {}) {
  const wiring = wiringSurvey();
  const memory = gatherMemory(cwd, { fleet });
  try { memory.learnings = learnings(); } catch { memory.learnings = null; }
  const savings = gatherSavings();
  const cfgNow = readJSON(CONFIG_PATH) || {};
  // issue #20: the Savings card's "Turn on smart routing" CTA must reflect what was actually saved —
  // same default rule gatherConfig() uses below, so this and the Settings tab never disagree.
  savings.routing = cfgNow.routing === 'off' ? 'off' : 'auto';
  try { savings.routerEngine = gatherRouterEngine(); } catch { savings.routerEngine = null; }
  try {
    const cat = loadCatalog();
    const det = detectProvider(cat, { provider: cfgNow.provider });
    savings.utilization = utilization({ frontier: frontierFor(cat, det.provider) });
  } catch { try { savings.utilization = utilization({}); } catch { savings.utilization = null; } }
  const config = gatherConfig();
  let gates = null;
  try { gates = gatesSurvey({ repo: REPO }); } catch { gates = null; }
  const recommendations = buildWiringRecommendations({ sites: wiring.sites });
  // Relevance order (never alphabetical/walk-order): machine-wide first, then projects by when
  // the user last actually worked in them — read from each project's own memory store.
  {
    const touched = {};
    for (const p of (ACTIVITY_MACHINE_CACHE && ACTIVITY_MACHINE_CACHE.projects) || []) {
      if (p.rel) touched[p.rel] = p.lastTouched || 0;
      touched[p.name] = Math.max(touched[p.name] || 0, p.lastTouched || 0);
    }
    const rank = (r) => r.id.startsWith('reconcile:') ? (touched[r.id.slice('reconcile:'.length)] || 0) : Number.MAX_SAFE_INTEGER;
    recommendations.sort((a, b) => rank(b) - rank(a));
  }
  // A cheap fingerprint of the state the page is about to render. The page echoes it back on apply;
  // apply's authoritative guard is still per-recommendation re-verification (currentValidIds), but
  // this lets the UI reason about staleness too.
  const preStateHash = crypto.createHash('sha1')
    .update(JSON.stringify({ recs: recommendations.map((r) => r.id).sort(), wiring: wiring.summary }))
    .digest('hex').slice(0, 16);
  const result = {
    token: TOKEN,
    generatedAt: new Date().toISOString(),
    preStateHash,
    host: { user: os.userInfo().username, platform: process.platform, node: process.version, npmPrefix: NPM_PREFIX.replace(HOME, '~') },
    sections: { wiring, memory, savings, config, gates, recommendations },
  };
  // Cache the last good state so repeat page-loads paint instantly, same as the stack audit does.
  // TOKEN is per-server-run and must never touch disk — ?fast=1 splices the live one back in.
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const { token, ...safe } = result;
    fs.writeFileSync(path.join(CONFIG_DIR, 'state-cache.json'), JSON.stringify({ at: result.generatedAt, data: safe }));
  } catch { /* cache is best-effort; the live gather is the product */ }
  return result;
}
function gatherStack() {
  const a = auditModel();
  // ISSUE #22 — carry `source` ('npm-global' | 'plugin') + marketplace through so the console can show
  // (and count) tools installed via the Claude Code plugin marketplace, not just `npm install -g` ones.
  const rows = a.rows.map((r) => ({ name: r.name, installed: r.installed, target: r.target, tag: r.tag, state: r.state, source: r.source ?? 'npm-global', marketplace: r.marketplace ?? null }));
  const shadows = a.shadows.map((s) => ({ name: s.name, version: s.version, global: s.global, dir: String(s.dir).replace(HOME, '~'), stale: !!(s.global && s.version !== s.global) }));
  const by = (st) => rows.filter((r) => r.state === st).length;
  const summary = { total: rows.length, behind: by('BEHIND'), broken: by('BROKEN'), ahead: by('AHEAD'), current: by('CURRENT'), unresolved: by('UNRESOLVED'), shadows: shadows.length, stale: a.stale.length };
  const recommendations = buildStackRecommendations({ rows: a.rows, stale: a.stale });
  const result = { error: a.error, packages: rows, shadows, summary, recommendations };
  // Cache the last good audit so repeat page-loads render instantly ("as of HH:MM — re-checking").
  if (!a.error) {
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(path.join(CONFIG_DIR, 'stack-audit-cache.json'), JSON.stringify({ at: new Date().toISOString(), data: result }));
    } catch { /* cache is best-effort; the live audit is the product */ }
  }
  return result;
}

// ── The ONLY writer: apply / save / undo ─────────────────────────────────────────────────────────
function journalUndo(entry) {
  fs.mkdirSync(path.dirname(UNDO_JOURNAL), { recursive: true });
  const token = crypto.randomBytes(9).toString('hex');
  fs.appendFileSync(UNDO_JOURNAL, JSON.stringify({ token, at: new Date().toISOString(), ...entry }) + '\n');
  return token;
}
function runNode(scriptRelPath, args) {
  const r = spawnSync(process.execPath, [path.join(REPO, scriptRelPath), ...args], { encoding: 'utf8', timeout: 16 * 60 * 1000, cwd: REPO });
  return { ok: r.status === 0, code: r.status, log: `${r.stdout || ''}${r.stderr || ''}`.trim().slice(-4000) };
}

// A wiring recommendation's `project` id is relative to whichever candidate root it was found under
// (issue #19) — reconstruct the absolute path by checking each root, so reconcile/undo can act on a
// project under ~/source just as well as one under ~/Code.
function resolveProjectDir(project) {
  for (const root of candidateRoots()) {
    const p = path.join(root, project);
    if (fs.existsSync(p)) return p;
  }
  return path.join(HOME, 'Code', project); // last-resort fallback: the previous fixed behavior
}
// Re-derive the currently-valid recommendation set, so apply can only ever act on something STILL true.
/**
 * Observe the learner's REAL state, for the health recommendations.
 *
 * Deliberately reads the GLOBAL learner (`cwd: HOME`), because that is the store the capture flush
 * actually writes to. Reading the project-local `.claude-flow/neural` instead is exactly the mistake
 * that made the console display a dead learner (5 trajectories, last trained 6 days earlier) while
 * the live one held 412 — rUv documents this fragmentation as issue #2245, "four contradictory
 * sources". Until it is unified upstream we read the store that learning writes, never the corpse.
 */
function observeLearning() {
  const queueDir = path.join(os.homedir(), '.cache', 'ruvnet-brain', 'learn');
  let queueDepth = 0;
  try {
    for (const f of fs.readdirSync(queueDir)) {
      if (!f.endsWith('.jsonl')) continue;
      queueDepth += fs.readFileSync(path.join(queueDir, f), 'utf8').split('\n').filter(Boolean).length;
    }
  } catch { /* no queue dir yet — depth stays 0, which is honest */ }

  let lastTrainSeconds = null; let trajectories = 0;
  try {
    const r = spawnSync(path.join(os.homedir(), '.npm-global/bin/ruflo'),
      ['hooks', 'intelligence', '--status'],
      { cwd: os.homedir(), encoding: 'utf8', timeout: 20_000 });
    const out = `${r.stdout || ''}`;
    const t = out.match(/Last Training:\s*(\d+)s ago/);
    const j = out.match(/Trajectories\s*\|\s*(\d+)/);
    if (t) lastTrainSeconds = Number(t[1]);
    if (j) trajectories = Number(j[1]);
  } catch { /* ruflo absent or slow — leave null, and null NEVER produces a recommendation */ }

  // The fleet is what makes ADR-027's North Star recommendation constructible at all — without it,
  // `learning:distill-fleet` can never be built, so it can never be offered, so clicking it would be
  // rejected as "your machine changed". It was missing here, which is exactly how a recommendation
  // ends up existing in code and nowhere else.
  //
  // Read from the cache the /api/memory scan already writes: a live scan opens 100+ SQLite stores at
  // ~90ms each, which is far too slow to sit on this path. A cold cache honestly yields [] — and []
  // produces no recommendation, which is the correct answer when we have not looked.
  const fleet = readJSON(MEMORY_CACHE)?.data?.fleet ?? [];

  return { queueDepth, lastTrainSeconds, trajectories, fleet };
}

function currentValidIds() {
  const ids = new Set();
  for (const r of buildWiringRecommendations({ sites: wiringSurvey().sites })) ids.add(r.id);
  const a = auditModel();
  for (const r of buildStackRecommendations({ rows: a.rows, stale: a.stale })) ids.add(r.id);
  // Health + learning. Previously the console could SEE a corrupt store and score it 49/100 while
  // offering nothing to do about it — detection without a remedy, which ADR-027 prohibits.
  try {
    const project = process.cwd();
    const health = scoreMemoryHealth({ project: path.basename(project), probes: probeMemory(project) });
    for (const r of buildHealthRecommendations({ memory: health, learning: observeLearning() })) ids.add(r.id);
  } catch { /* an advisory surface must never break the apply path */ }
  return { ids, auditRows: a.rows };
}
function apply(ids) {
  const { ids: validNow, auditRows } = currentValidIds();
  const results = [];
  for (const id of ids) {
    if (!validNow.has(id)) { results.push({ id, ok: false, skipped: true, error: 'worldMoved', log: 'Skipped — this is already resolved, or your machine changed since the page loaded. Nothing was done. Reload to see the current state.' }); continue; }

    // ONE dispatch, through the registry (scripts/remedy-registry.mjs). This used to be a chain of
    // `if (id.startsWith(...))` whose handled-id set no code could inspect — so it drifted from the
    // builders and nothing noticed: `learning:enable-fleet` was offered with NO executor and fell
    // through to "Unknown recommendation id", and one reordering silently routed a database repair
    // into a global npm sync. Now the id→executor→inverse binding is a value, an ambiguous id
    // THROWS instead of picking a winner, and remedy-registry.test.mjs proves every offerable id
    // resolves to exactly one runnable remedy with a real undo behind it.
    let plan;
    try { plan = planFor(id); }
    catch (e) { results.push({ id, ok: false, log: e.message }); continue; } // ambiguous — a bug, said out loud
    if (!plan) { results.push({ id, ok: false, log: `Unknown recommendation id: ${id}` }); continue; }

    // Record the inverse BEFORE the change, and fill in the parts only this moment knows.
    const undoSpec = { ...plan.undo, id };
    if (undoSpec.kind === 'reinstall-version') {
      const prev = installedVersion(undoSpec.pkg);
      // No readable previous version ⇒ there is nothing to reinstall. Say that, rather than
      // journalling an inverse that would fail later while looking recorded.
      if (prev) undoSpec.prevVersion = prev; else { undoSpec.kind = 'auto-rebuild'; undoSpec.human = `no previous version of ${undoSpec.pkg} was readable, so there is nothing to roll back to`; }
    }
    if (undoSpec.kind === 'restore-memory-backup') undoSpec.db = path.join(process.cwd(), '.swarm/memory.db');

    let args = [...plan.exec.args];
    if (plan.exec.resolveProject) {
      const i = args.indexOf('--project');
      if (i >= 0) args[i + 1] = resolveProjectDir(args[i + 1]);
    }
    if (plan.exec.needsReceipt) {
      const receipt = path.join(HOME, '.cache', 'ruvnet-brain', 'undo', `${plan.key}-${stamp()}.json`);
      undoSpec.receipt = receipt;
      args = [...args, '--receipt', receipt];
    }

    const undoToken = journalUndo(undoSpec);
    const res = runNode(plan.exec.script, args);
    results.push({ id, ...res, undoToken });
  }
  return { results };
}
function saveConfig(values) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const prev = readJSON(CONFIG_PATH) || {};
  let backup = null;
  if (fs.existsSync(CONFIG_PATH)) { backup = `${CONFIG_PATH}.bak-${stamp()}`; fs.copyFileSync(CONFIG_PATH, backup); fs.chmodSync(backup, 0o600); }
  const undoToken = journalUndo({ kind: 'restore-config', backup, existed: fs.existsSync(CONFIG_PATH) });
  const next = { ...prev };
  for (const s of CONFIG_SCHEMA) {
    const v = values?.[s.key];
    if (v === undefined || v === null) continue;
    if (s.secret) { if (typeof v === 'string' && v.trim() && v !== '••••') next[s.key] = v.trim(); } // only overwrite a secret when a real new value is typed
    else next[s.key] = v;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch { /* best effort on non-posix */ }
  return { ok: true, backup: backup ? backup.replace(HOME, '~') : null, undoToken };
}
function undo(undoToken) {
  if (!fs.existsSync(UNDO_JOURNAL)) return { ok: false, log: 'no undo history' };
  const entry = fs.readFileSync(UNDO_JOURNAL, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find((e) => e.token === undoToken);
  if (!entry) return { ok: false, log: 'that undo token was not found' };
  if (entry.kind === 'restore-config') {
    if (entry.backup && fs.existsSync(entry.backup)) { fs.copyFileSync(entry.backup, CONFIG_PATH); return { ok: true, log: 'restored your previous settings' }; }
    if (!entry.existed && fs.existsSync(CONFIG_PATH)) { fs.rmSync(CONFIG_PATH); return { ok: true, log: 'removed the settings file (there was none before)' }; }
    return { ok: false, log: 'no backup available to restore' };
  }
  if (entry.kind === 'reinstall-version' && entry.pkg && entry.prevVersion) {
    const r = spawnSync('npm', ['install', '-g', '--prefix', NPM_PREFIX, `${entry.pkg}@${entry.prevVersion}`], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    return { ok: r.status === 0, log: r.status === 0 ? `reinstalled ${entry.pkg}@${entry.prevVersion}` : (r.stderr || '').slice(-800) };
  }
  if (entry.kind === 'restore-backup' && entry.project) {
    const dir = resolveProjectDir(entry.project);
    let restored = 0;
    for (const f of ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json']) {
      const target = path.join(dir, f);
      const baks = (() => { try { return fs.readdirSync(path.dirname(target)).filter((n) => n.startsWith(path.basename(target) + '.bak-reconcile-')); } catch { return []; } })();
      if (!baks.length) continue;
      baks.sort();
      fs.copyFileSync(path.join(path.dirname(target), baks[baks.length - 1]), target); restored++;
    }
    return { ok: restored > 0, log: restored ? `restored ${restored} settings file(s) from backup` : 'no reconcile backups found to restore' };
  }
  // THE BRANCH THAT DID NOT EXIST. `repair:memory-index` journalled kind 'restore-memory-backup'
  // and nothing here handled it, so it fell to the default arm below and answered "nothing to undo
  // (the change reverses itself automatically)" — while the recommendation had promised to restore
  // the pre-repair backup. health-repair.mjs writes that backup as `<db>.rescue-<iso>`; this finds
  // the newest one and puts it back.
  if (entry.kind === 'restore-memory-backup' && entry.db) {
    const dir = path.dirname(entry.db);
    const base = `${path.basename(entry.db)}.rescue-`;
    let baks = [];
    try { baks = fs.readdirSync(dir).filter((n) => n.startsWith(base)).sort(); } catch { /* dir gone */ }
    if (!baks.length) return { ok: false, log: `no pre-repair backup found next to ${entry.db.replace(HOME, '~')} — nothing was restored` };
    const from = path.join(dir, baks[baks.length - 1]);
    try { fs.copyFileSync(from, entry.db); }
    catch (e) { return { ok: false, log: `could not restore ${from.replace(HOME, '~')}: ${e.message}` }; }
    return { ok: true, log: `restored your memory store from the snapshot taken before the repair (${baks[baks.length - 1]})` };
  }
  // Fleet distillation touches a set of stores discovered at run time, so its executor writes a
  // receipt naming each store it snapshotted. No receipt ⇒ we do not know what was touched, and we
  // say so instead of guessing — restoring the wrong snapshot over a live store is worse than
  // restoring nothing.
  if (entry.kind === 'restore-store-backups') {
    const rec = entry.receipt && fs.existsSync(entry.receipt) ? readJSON(entry.receipt) : null;
    const stores = Array.isArray(rec?.stores) ? rec.stores : [];
    if (!stores.length) return { ok: false, log: 'no receipt of which stores were distilled — nothing was restored. Each store\'s own snapshot is still in its .swarm/backups folder.' };
    let restored = 0; const failures = [];
    for (const s of stores) {
      let snaps = [];
      try { snaps = fs.readdirSync(s.backupDir).filter((n) => n.endsWith('.db') || n.includes('memory')).sort(); } catch { /* dir gone */ }
      if (!snaps.length) { failures.push(`${s.name}: no snapshot found`); continue; }
      try { fs.copyFileSync(path.join(s.backupDir, snaps[snaps.length - 1]), s.db); restored++; }
      catch (e) { failures.push(`${s.name}: ${e.message}`); }
    }
    return {
      ok: restored > 0,
      log: `${restored} of ${stores.length} store(s) restored from their pre-distill snapshots`
        + (failures.length ? ` — could not restore: ${failures.join('; ')}` : ''),
    };
  }
  // Only kinds that genuinely reverse themselves reach here. Anything else arriving at this arm is
  // a registry/undo drift, and remedy-registry.test.mjs fails the build before it can reach a user.
  if (entry.kind === 'none' || entry.kind === 'auto-rebuild') {
    return { ok: true, log: entry.human || 'nothing to undo (the change reverses itself automatically)' };
  }
  return { ok: false, log: `no undo is implemented for "${entry.kind}" — nothing was changed back. Please report this.` };
}
// The undo kinds this function actually implements. Exported so the closure test can check the
// registry against the REAL handler set rather than a hand-copied list that would drift from it.
export const HANDLED_UNDO_KINDS = Object.freeze([
  'restore-config', 'reinstall-version', 'restore-backup',
  'restore-memory-backup', 'restore-store-backups', 'auto-rebuild', 'none',
]);

// ── HTTP ─────────────────────────────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' };
function serveStatic(req, res) {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(CONSOLE_DIR, rel);
  if (!file.startsWith(CONSOLE_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'text/plain', 'not found');
  let body = fs.readFileSync(file);
  const ext = path.extname(file);
  if (ext === '.html') body = Buffer.from(String(body).replace('</head>', `<script>window.__CONSOLE_TOKEN__=${JSON.stringify(TOKEN)}</script></head>`));
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}
function send(res, code, type, body) { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); }
function sendJSON(res, code, obj) { send(res, code, 'application/json', JSON.stringify(obj)); }
function readBody(req) { return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); }); }

/**
 * Open the console AND PUT IT IN FRONT OF THE USER.
 *
 * `open <url>` creates the tab but does NOT raise the browser window. Observed live 2026-07-21:
 * the console had been opened twice and was sitting in two Chrome tabs the whole time, behind
 * VS Code, while the user stared at their editor and reasonably concluded it was broken — and I
 * kept reporting "opened" because the command exited 0. Exit code 0 meant "a tab exists
 * somewhere", never "you can see it".
 *
 * So on macOS we also `activate` the browser. Raising a window the user asked for is not a
 * surprise; leaving them looking at the wrong app while claiming success is.
 */
function openBrowser(url) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { spawnSync(opener, [url], { stdio: 'ignore' }); } catch { /* headless is fine */ }
  if (process.platform !== 'darwin') return;
  // Bring whichever browser now holds the tab to the front. Best-effort and silent: a failure here
  // must never break serving the page.
  try {
    spawnSync('osascript', ['-e', `
      tell application "System Events"
        set brs to name of every application process whose bundle identifier is in ¬
          {"com.google.Chrome","com.apple.Safari","company.thebrowser.Browser","org.mozilla.firefox","com.brave.Browser"}
      end tell
      repeat with b in brs
        try
          tell application (b as text) to activate
          exit repeat
        end try
      end repeat
    `], { stdio: 'ignore', timeout: 8000 });
  } catch { /* no browser scriptable — the tab still exists */ }
}
function startServer({ port = Number(process.env.CONSOLE_PORT) || 7411, open = false, cwd = process.cwd() } = {}) {
  const server = http.createServer(async (req, res) => {
    // DNS-rebinding guard: this server binds 127.0.0.1 only. Reject any request whose Host header
    // isn't loopback, so a malicious web page can't rebind a hostname to 127.0.0.1 and read local state.
    const reqHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (reqHost !== '127.0.0.1' && reqHost !== 'localhost' && reqHost !== '::1' && reqHost !== '[::1]') {
      res.writeHead(403, { 'content-type': 'text/plain' }); res.end('forbidden host'); return;
    }
    try {
      const url = req.url.split('?')[0];
      // Heavy read-models: ALWAYS cache-first (fast=1 or not — both land here now). The handler
      // never blocks the event loop; kickRefresh() recomputes in a detached child. See writeCache/
      // serveCached above and the --refresh-cache CLI mode. TOKEN is injected at serve time so it
      // never has to live in the on-disk cache.
      if (req.method === 'GET' && url === '/api/state') {
        return serveCached(res, STATE_CACHE,
          () => { const st = gatherState(cwd, { fleet: false }); const { token, ...safe } = st; return { at: st.generatedAt, data: safe }; },
          (d) => ({ ...d, token: TOKEN }));
      }
      if (req.method === 'GET' && url === '/api/memory') {
        return serveCached(res, MEMORY_CACHE, () => ({ at: new Date().toISOString(), data: { fleet: scanFleet() } }));
      }
      if (req.method === 'GET' && url === '/api/stack') {
        return serveCached(res, STACK_CACHE, () => ({ at: new Date().toISOString(), data: gatherStack() }));
      }
      if (req.method === 'GET' && url === '/api/activity') return sendJSON(res, 200, gatherActivity(cwd));
      if (req.method === 'GET' && url === '/api/trust') return sendJSON(res, 200, await gatherTrust());
      if (req.method === 'GET' && url === '/tips') { req.url = '/tips.html'; return serveStatic(req, res); }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (body.token !== TOKEN) return sendJSON(res, 403, { error: 'bad or missing token' });
        if (url === '/api/apply') return sendJSON(res, 200, apply(Array.isArray(body.ids) ? body.ids : []));
        if (url === '/api/save-config') return sendJSON(res, 200, saveConfig(body.values || {}));
        if (url === '/api/undo') return sendJSON(res, 200, undo(body.undoToken));
        return sendJSON(res, 404, { error: 'unknown endpoint' });
      }
      if (req.method === 'GET') return serveStatic(req, res);
      return send(res, 405, 'text/plain', 'method not allowed');
    } catch (e) { return sendJSON(res, 500, { error: String(e && e.message || e) }); }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port !== 0) { console.error(`  port ${port} busy — trying a free one…`); startServer({ port: 0, open, cwd }); }
    else { console.error(`  server error: ${e.message}`); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const actual = server.address().port;
    const url = `http://127.0.0.1:${actual}/`;
    console.log(`\n  🧠  RuvNet Brain — Onboarding Console`);
    console.log(`      ${url}`);
    console.log(`      read-only until you click · token-gated · ^C to stop\n`);
    // Cold-start fix (2026-07-17): hydrate last run's fleet/trust caches from disk FIRST — the
    // first page load paints real, honestly-stamped data in ~2s instead of a 25–50s scan — then
    // warm a fresh scan off the request path.
    // Tell a FIRST-RUN user what to expect. With a warm cache the page paints immediately; with no
    // cache at all it is genuinely empty until the detached scan lands, and an empty page with no
    // explanation reads as broken. Measured 2026-07-20: URL is printed in ~0.3s either way, so the
    // wait a user perceives is the page filling in, not the server starting.
    const hadCache = loadConsoleCache();
    if (!hadCache) {
      console.log(`      ${'first run — scanning your setup now; the page fills in as it lands'}`);
      console.log(`      ${'(one-time, up to a minute — later runs are instant)'}\n`);
    }
    kickRefresh();   // warm state/stack/memory caches in a detached child, off the request path
    setTimeout(() => { try { gatherActivity(cwd); } catch { /* warm is best-effort */ } }, 50);
    if (open) openBrowser(url);
  });
  return server;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]).endsWith('onboarding-console.mjs')) {
  const args = process.argv.slice(2);
  if (args.includes('--print-state')) { console.log(JSON.stringify(gatherState(process.cwd()), null, 2)); }
  else if (args.includes('--print-stack')) { console.log(JSON.stringify(gatherStack(), null, 2)); }
  else if (args.includes('--refresh-cache')) {
    // Runs as a DETACHED CHILD of the server (kickRefresh) — or standalone to pre-warm. Computes the
    // heavy read-models HERE, in a separate process, so the server's event loop is never blocked, and
    // writes each cache the moment it is ready (state first — it is what the page paints first).
    try { const st = gatherState(process.cwd(), { fleet: false }); const { token, ...safe } = st; writeCache(STATE_CACHE, st.generatedAt, safe); } catch { /* leave the old cache in place */ }
    try { writeCache(STACK_CACHE, new Date().toISOString(), gatherStack()); } catch { /* keep prior */ }
    try { writeCache(MEMORY_CACHE, new Date().toISOString(), { fleet: scanFleet() }); } catch { /* keep prior */ }
    process.exit(0);
  }
  else if (args.includes('--serve') || args.length === 0) {
    // Hitting the command again should land on the console you already have, not spawn a second
    // server on a random port and a second tab. If one is already up, just point the browser at it.
    const port = Number(process.env.CONSOLE_PORT) || 7411;
    const open = args.includes('--open');
    const url = `http://127.0.0.1:${port}/`;
    const alive = await new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, (res) => {
        let b = ''; res.on('data', (c) => { b += c; if (b.length > 4096) res.destroy(); });
        res.on('end', () => resolve(res.statusCode === 200 && /RuvNet Brain/.test(b)));
        res.on('error', () => resolve(false));
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    if (alive) {
      console.log(`\n  🧠  RuvNet Brain — Onboarding Console (already running)\n      ${url}\n`);
      if (open) openBrowser(url);
    } else { startServer({ port, open, cwd: process.cwd() }); }
  }
  else { console.log(`\n  onboarding-console — the RuvNet Brain configure page\n\n    --serve [--open]   start the local server (and open your browser)\n    --print-state      print the read-only state JSON and exit (for tests)\n    --print-stack      print the stack audit JSON and exit\n`); }
}

export { gatherState, gatherStack, gatherTrust, wiringSurvey, probeMemory, apply, saveConfig, undo };
