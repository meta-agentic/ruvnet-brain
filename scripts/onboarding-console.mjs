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
import { spawnSync, execFileSync } from 'node:child_process';

import { auditModel, installedVersion } from './stack-sync.mjs';
import { findStores, diagnose } from './memory-doctor.mjs';
import { buildStackRecommendations, buildWiringRecommendations, summarizeWiring, scoreMemoryHealth } from './console-engine.mjs';
import { optimize } from './router-optimizer.mjs';
import { utilization } from './router-utilization.mjs';
import { loadCatalog, detectProvider, frontierFor } from './model-catalog.mjs';
import { learnings } from './learnings.mjs';

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

// ── Wiring survey (read-only): how do this machine's projects launch rUv tools? ───────────────────
const VENDOR = ['/clones/', '/node_modules/', '/vendor/', '/upstream/', '.claude-backup', '_snapshots'];
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
function classifyCommand(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return null;
  if (NPX_RUV.test(cmd)) return 'NPX';
  if (/\.npm-global\/bin\/(ruflo|ruvector|ruv-swarm|flow-nexus)/.test(cmd) || /hook-handler\.cjs/.test(cmd)) return 'GLOBAL_BINARY';
  if (/CLAUDE_PLUGIN_ROOT/.test(cmd)) return 'PLUGIN';
  return null;
}
function wiringSurvey() {
  const sites = [];
  const projects = findProjects(path.join(HOME, 'Code'));
  for (const proj of projects) {
    const projName = proj.replace(HOME + '/Code/', '');
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
function gatherMemory(cwd) {
  const stores = findStores();
  const fleet = [];
  for (const db of stores) {
    const d = diagnose(db);
    if (d.unreadable || d.schemaless) { fleet.push({ name: d.name, unreadable: d.unreadable || 'no memory schema', total: 0, learns: false, findings: d.findings }); continue; }
    if ((d.total || 0) === 0) continue;
    fleet.push({ name: d.name, total: d.total, embedded: d.embedded, coverPct: +(d.cover * 100).toFixed(1), patterns: d.patterns ?? 0, learns: !!d.learns, findings: d.findings });
  }
  fleet.sort((a, b) => (b.total || 0) - (a.total || 0));
  // health = for the project the console was launched from (fall back to this repo)
  const project = fs.existsSync(path.join(cwd, '.swarm/memory.db')) ? cwd : REPO;
  const projName = project.replace(HOME + '/Code/', '').replace(HOME + '/', '~/');
  const health = scoreMemoryHealth({ project: projName, probes: probeMemory(project) });
  return { fleet, health };
}

// ── Savings ledger (receipts only) ────────────────────────────────────────────────────────────────
function gatherSavings() {
  // Primary source is the real routing-receipts ledger written by scripts/route-cheap.mjs.
  const files = [
    path.join(HOME, '.claude/metaharness/routing-receipts.jsonl'),
    path.join(HOME, '.cache/ruvnet-brain/metaharness-receipts.jsonl'),
    path.join(REPO, 'plugin/scripts/.ruvnet-brain/token-ledger.jsonl'),
  ];
  const receipts = [];
  let baselineUsd = 0;
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
      if (!Number.isFinite(usd) && !Number.isFinite(ms)) continue;
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
  return { totals, note: 'receipts only — no modelled, projected, or “up to” savings', receipts: receipts.slice(-25).reverse() };
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

// ── Assemble the read-models ─────────────────────────────────────────────────────────────────────
function gatherState(cwd) {
  const wiring = wiringSurvey();
  const memory = gatherMemory(cwd);
  try { memory.learnings = learnings(); } catch { memory.learnings = null; }
  const savings = gatherSavings();
  const cfgNow = readJSON(CONFIG_PATH) || {};
  try { savings.routerProfiles = optimize({ provider: cfgNow.provider }); } catch { savings.routerProfiles = null; }
  try {
    const cat = loadCatalog();
    const det = detectProvider(cat, { provider: cfgNow.provider });
    savings.utilization = utilization({ frontier: frontierFor(cat, det.provider) });
  } catch { try { savings.utilization = utilization({}); } catch { savings.utilization = null; } }
  const config = gatherConfig();
  const recommendations = buildWiringRecommendations({ sites: wiring.sites });
  // A cheap fingerprint of the state the page is about to render. The page echoes it back on apply;
  // apply's authoritative guard is still per-recommendation re-verification (currentValidIds), but
  // this lets the UI reason about staleness too.
  const preStateHash = crypto.createHash('sha1')
    .update(JSON.stringify({ recs: recommendations.map((r) => r.id).sort(), wiring: wiring.summary }))
    .digest('hex').slice(0, 16);
  return {
    token: TOKEN,
    generatedAt: new Date().toISOString(),
    preStateHash,
    host: { user: os.userInfo().username, platform: process.platform, node: process.version, npmPrefix: NPM_PREFIX.replace(HOME, '~') },
    sections: { wiring, memory, savings, config, recommendations },
  };
}
function gatherStack() {
  const a = auditModel();
  const rows = a.rows.map((r) => ({ name: r.name, installed: r.installed, target: r.target, tag: r.tag, state: r.state }));
  const shadows = a.shadows.map((s) => ({ name: s.name, version: s.version, global: s.global, dir: String(s.dir).replace(HOME, '~'), stale: !!(s.global && s.version !== s.global) }));
  const by = (st) => rows.filter((r) => r.state === st).length;
  const summary = { total: rows.length, behind: by('BEHIND'), broken: by('BROKEN'), ahead: by('AHEAD'), current: by('CURRENT'), unresolved: by('UNRESOLVED'), shadows: shadows.length, stale: a.stale.length };
  const recommendations = buildStackRecommendations({ rows: a.rows, stale: a.stale });
  return { error: a.error, packages: rows, shadows, summary, recommendations };
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

// Re-derive the currently-valid recommendation set, so apply can only ever act on something STILL true.
function currentValidIds() {
  const ids = new Set();
  for (const r of buildWiringRecommendations({ sites: wiringSurvey().sites })) ids.add(r.id);
  const a = auditModel();
  for (const r of buildStackRecommendations({ rows: a.rows, stale: a.stale })) ids.add(r.id);
  return { ids, auditRows: a.rows };
}
function apply(ids) {
  const { ids: validNow, auditRows } = currentValidIds();
  const results = [];
  for (const id of ids) {
    if (!validNow.has(id)) { results.push({ id, ok: false, skipped: true, error: 'worldMoved', log: 'Skipped — this is already resolved, or your machine changed since the page loaded. Nothing was done. Reload to see the current state.' }); continue; }

    if (id.startsWith('sync:') || id.startsWith('repair:') || id === 'purge:shadows') {
      // Record the inverse FIRST: for a version bump, the inverse is the version currently on disk.
      const pkg = id.split(':')[1];
      const prev = pkg && pkg !== 'shadows' ? installedVersion(pkg) : null;
      const undoToken = journalUndo({ kind: prev ? 'reinstall-version' : 'auto-rebuild', pkg, prevVersion: prev, id });
      const res = runNode('scripts/stack-sync.mjs', ['--sync']);
      results.push({ id, ...res, undoToken });
    } else if (id.startsWith('reconcile:')) {
      const project = id.slice('reconcile:'.length);
      const undoToken = journalUndo({ kind: 'restore-backup', project, id });
      const res = runNode('scripts/reconcile-project.mjs', ['--apply', '--project', path.join(HOME, 'Code', project)]);
      results.push({ id, ...res, undoToken });
    } else {
      results.push({ id, ok: false, log: `Unknown recommendation id: ${id}` });
    }
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
    const dir = path.join(HOME, 'Code', entry.project);
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
  return { ok: true, log: 'nothing to undo (the change reverses itself automatically)' };
}

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
      if (req.method === 'GET' && url === '/api/state') return sendJSON(res, 200, gatherState(cwd));
      if (req.method === 'GET' && url === '/api/stack') return sendJSON(res, 200, gatherStack());
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
    if (open) {
      const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      try { spawnSync(opener, [url], { stdio: 'ignore' }); } catch { /* headless is fine */ }
    }
  });
  return server;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]).endsWith('onboarding-console.mjs')) {
  const args = process.argv.slice(2);
  if (args.includes('--print-state')) { console.log(JSON.stringify(gatherState(process.cwd()), null, 2)); }
  else if (args.includes('--print-stack')) { console.log(JSON.stringify(gatherStack(), null, 2)); }
  else if (args.includes('--serve') || args.length === 0) { startServer({ open: args.includes('--open'), cwd: process.cwd() }); }
  else { console.log(`\n  onboarding-console — the RuvNet Brain configure page\n\n    --serve [--open]   start the local server (and open your browser)\n    --print-state      print the read-only state JSON and exit (for tests)\n    --print-stack      print the stack audit JSON and exit\n`); }
}

export { gatherState, gatherStack, wiringSurvey, probeMemory, apply, saveConfig, undo };
