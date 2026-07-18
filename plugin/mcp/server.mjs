#!/usr/bin/env node
// ruvnet-brain MCP server — the Stable Spine's protocol shell (ADR-023 §4, v2 post-red-team).
//
// v1 was a launcher: spawn forge-mcp-all.mjs with stdio:'inherit' and get out of the way. That froze
// search_ruvnet's behavior at session start. v2 makes THIS process the stable protocol owner:
//
//   • The CLIENT connection (Claude Code ⇄ this process) is never proxied, dropped, or replayed.
//     This file answers initialize / ping / tools/list itself and owns every client id.
//   • The BRAIN runs in a warm CHILD (the KB's own forge-mcp-all.mjs, unchanged) that this process
//     supervises over a PRIVATE handshake: parent sends its OWN initialize with parent-allocated
//     ids and forwards tools/call with id remapping — the client's handshake is never replayed to
//     anyone (red-team findings 7/8: no external-handshake replay, ids remapped both directions).
//   • HOT SWAP: between requests (never mid-flight — finding 9: swap only when pendingCount === 0),
//     the child is respawned when the spine generation changes (active.json) or the brain's own
//     code file changed on disk (KB-track update). The NEXT call answers from the new brain; a call
//     in flight completes on the old one. Claude Code notices nothing.
//   • LEASE (finding 23): this process leases the generation it serves (leases/mcp-<pid>.json,
//     refreshed per call) so update-apply.mjs --gc never collects a tree still being served.
//   • Child death: pending calls get a JSON-RPC error (never a parent exit); the child respawns
//     lazily on the next call. If the brain is absent entirely, tools/call returns an honest
//     soft-error tool result with install guidance — the tool stays registered, never vanishes.
//
// Brain location resolution (unchanged from v1):
//   1) $RUVNET_BRAIN_KB   2) $RUVNET_BRAIN_HOME/kb   3) ~/.cache/ruvnet-brain/kb
// Model cache: $KB_MODEL_CACHE, else <home>/models.
//
// SHELL CONTRACT: this file is boot-frozen (CC spawns it once per session). Changing IT — or the
// tool's declared name/schema — is a shell change, honestly flagged requiresRestart by the release
// classifier. Everything it delegates to updates hot.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

const BRAIN_HOME = process.env.RUVNET_BRAIN_HOME || path.join(os.homedir(), '.cache', 'ruvnet-brain');
const KB = process.env.RUVNET_BRAIN_KB || path.join(BRAIN_HOME, 'kb');
const CHILD_MCP = path.join(KB, 'forge-mcp-all.mjs');
const ACTIVE = path.join(BRAIN_HOME, 'active.json');
const LEASES = path.join(BRAIN_HOME, 'leases');
const LEASE = path.join(LEASES, `mcp-${process.pid}.json`);

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'ruvnet-brain', version: '2.0.0' };
// Static fallback tool declaration — same name + inputSchema the brain declares (the SCHEMA is the
// frozen contract; the description is data and is refreshed from the live child when one is up).
const FALLBACK_TOOLS = [{
  name: 'search_ruvnet',
  description: 'Source-grounded knowledge base for the RuvNet ecosystem. (Brain bundle not installed on this machine — calls will return install guidance.)',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language question or keywords about any part of RuvNet.' },
      k: { type: 'integer', description: 'Number of documents to return (default 6).', default: 6 },
    },
    required: ['query'],
  },
}];

const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
const clientOk = (id, result) => out({ jsonrpc: '2.0', id, result });
const clientErr = (id, code, message) => out({ jsonrpc: '2.0', id, error: { code, message } });
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

function currentGeneration() {
  const a = readJSON(ACTIVE);
  let brainMtime = 0;
  try { brainMtime = fs.statSync(CHILD_MCP).mtimeMs; } catch { /* brain absent */ }
  return `${a?.generation ?? 0}:${brainMtime}`;
}
function refreshLease() {
  try {
    fs.mkdirSync(LEASES, { recursive: true });
    fs.writeFileSync(LEASE, JSON.stringify({ pid: process.pid, version: readJSON(ACTIVE)?.version ?? null, at: new Date().toISOString() }));
  } catch { /* lease is best-effort */ }
}
process.on('exit', () => { try { fs.rmSync(LEASE, { force: true }); } catch { /* gone */ } });

// ── the warm child + private protocol ───────────────────────────────────────────────────────────
let child = null;            // { proc, generation, nextId, pending: Map<childId, {resolve, reject}> }
let pendingCount = 0;        // client tools/call requests currently in flight (drain gate for swaps)

function killChild(reason) {
  if (!child) return;
  const c = child; child = null;
  for (const [, p] of c.pending) p.reject(new Error(`brain worker ${reason}`));
  c.pending.clear();
  try { c.proc.kill('SIGTERM'); } catch { /* already dead */ }
}

async function ensureChild() {
  const gen = currentGeneration();
  if (child && child.generation !== gen && pendingCount === 0) killChild('superseded by a newer generation');
  if (child) return child;
  if (!fs.existsSync(CHILD_MCP)) return null;

  const env = { ...process.env, KB_DIR: KB };
  if (!env.KB_MODEL_CACHE) env.KB_MODEL_CACHE = path.join(BRAIN_HOME, 'models');
  const proc = spawn(process.execPath, [CHILD_MCP], { stdio: ['pipe', 'pipe', 'inherit'], env });
  const c = { proc, generation: gen, nextId: 1, pending: new Map() };
  const rl = readline.createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    const waiter = c.pending.get(msg.id);
    if (waiter) { c.pending.delete(msg.id); waiter.resolve(msg); }
  });
  proc.on('exit', () => { if (child === c) child = null; for (const [, p] of c.pending) p.reject(new Error('brain worker exited')); c.pending.clear(); });
  proc.on('error', () => { if (child === c) child = null; });
  child = c;

  // PRIVATE handshake — parent-owned id, never the client's (finding 8).
  try { await childRequest(c, 'initialize', { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'ruvnet-brain-shell', version: SERVER_INFO.version } }, 10_000); }
  catch { killChild('failed initialize'); return null; }
  return c;
}

function childRequest(c, method, params, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const id = c.nextId++;
    const timer = setTimeout(() => { c.pending.delete(id); reject(new Error(`brain worker timeout on ${method}`)); }, timeoutMs);
    c.pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    try { c.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
    catch (e) { clearTimeout(timer); c.pending.delete(id); reject(e); }
  });
}

// ── client protocol ─────────────────────────────────────────────────────────────────────────────
async function handleClient(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notifications need no answer
  switch (method) {
    case 'initialize':
      return clientOk(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case 'ping':
      return clientOk(id, {});
    case 'tools/list': {
      const c = await ensureChild();
      if (c) {
        try { const r = await childRequest(c, 'tools/list', {}, 15_000); if (r.result?.tools?.length) return clientOk(id, r.result); }
        catch { /* fall through to the static declaration */ }
      }
      return clientOk(id, { tools: FALLBACK_TOOLS });
    }
    case 'tools/call': {
      if (params?.name !== 'search_ruvnet') return clientErr(id, -32602, `unknown tool: ${params?.name}`);
      refreshLease();
      const c = await ensureChild();
      if (!c) {
        return clientOk(id, { content: [{ type: 'text', text: `search_ruvnet error: the brain bundle is not installed at ${KB}. Install it with: npx github:stuinfla/ruvnet-brain  (or set RUVNET_BRAIN_KB to your brain's kb dir).` }], isError: true });
      }
      pendingCount++;
      try {
        const r = await childRequest(c, 'tools/call', params);
        if (r.error) return clientErr(id, r.error.code ?? -32603, r.error.message ?? 'brain worker error');
        return clientOk(id, r.result);
      } catch (e) {
        return clientOk(id, { content: [{ type: 'text', text: `search_ruvnet error: ${e.message}` }], isError: true });
      } finally {
        pendingCount--;
      }
    }
    default:
      return clientErr(id, -32601, `unknown method: ${method}`);
  }
}

const clientRl = readline.createInterface({ input: process.stdin });
clientRl.on('line', (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; } // malformed line: ignore, never crash
  handleClient(msg).catch((e) => { if (msg.id !== undefined && msg.id !== null) clientErr(msg.id, -32603, e.message); });
});
clientRl.on('close', () => { killChild('client disconnected'); process.exit(0); });
