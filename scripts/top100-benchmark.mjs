#!/usr/bin/env node
// Run the top-100 through the real stable MCP server, sequentially by default so latency means
// user-observed latency rather than queueing under a synthetic fan-out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'evals', 'top-100.json');
const SERVER = path.join(ROOT, 'plugin', 'mcp', 'server.mjs');
const KB = process.env.RUVNET_BRAIN_KB || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'kb');
const DEFAULT_OUT = path.join(ROOT, 'evals', 'runs', 'top-100-latest.json');

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const summarizeLatency = (rows) => {
  const v = rows.map((r) => r.latencyMs).filter(Number.isFinite);
  return {
    n: v.length,
    minMs: v.length ? Math.min(...v) : null,
    p50Ms: percentile(v, 0.50),
    p95Ms: percentile(v, 0.95),
    maxMs: v.length ? Math.max(...v) : null,
    meanMs: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null,
  };
};

export function rpcClient(child, { timeoutMs = 180_000 } = {}) {
  let nextId = 1;
  const pending = new Map();
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const waiter = pending.get(msg.id);
    if (waiter) {
      pending.delete(msg.id);
      clearTimeout(waiter.timer);
      waiter.resolve(msg);
    }
  });
  const rejectAll = (reason) => {
    for (const [, waiter] of pending) {
      clearTimeout(waiter.timer);
      waiter.reject(reason);
    }
    pending.clear();
  };
  child.once('exit', (code, signal) => rejectAll(new Error(`stable MCP server exited (code=${code}, signal=${signal})`)));
  child.once('error', (error) => rejectAll(error));
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`benchmark RPC timeout after ${timeoutMs}ms (${method})`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', (error) => {
      if (!error) return;
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    });
  });
}

function parseTop(text) {
  const match = text.match(/#1\s+repo=(\S+)\s+\(relevance ([^;]+);[\s\S]*?\npath\s*:\s*([^\n]+)/);
  return {
    repo: match?.[1] ?? null,
    relevance: match && match[2] !== 'n/a' ? Number(match[2]) : null,
    path: match?.[3]?.trim() ?? null,
  };
}

export function evaluateSemanticEvidence(answer, requiredEvidence) {
  const clauses = Array.isArray(requiredEvidence) ? requiredEvidence : [];
  if (!clauses.length) return { present: false, pass: false, matched: 0, required: 0, clauses: [] };
  const haystack = String(answer || '').toLowerCase();
  const results = clauses.map((clause) => {
    const alternatives = Array.isArray(clause?.anyOf)
      ? clause.anyOf.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
      : [];
    const matchedBy = alternatives.find((value) => haystack.includes(value)) || null;
    return {
      label: String(clause?.label || ''),
      pass: !!matchedBy,
      matchedBy,
    };
  });
  const matched = results.filter((result) => result.pass).length;
  return {
    present: true,
    pass: results.length > 0 && matched === results.length,
    matched,
    required: results.length,
    clauses: results,
  };
}

export function aggregate(rows) {
  const scoreRows = (subset) => {
    const n = subset.length;
    const count = (key) => subset.filter((r) => r[key]).length;
    return {
      n,
      grounded: count('grounded'),
      routed: count('routed'),
      sufficientEvidence: count('sufficientEvidence'),
      groundingReceipts: count('groundingReceipt'),
      enforceableReceipts: count('enforceableReceipt'),
      semanticPassed: count('semanticPassed'),
      errors: count('error'),
      legacyRoutingProxyPct: n ? 100 * subset.reduce((sum, r) =>
        sum + (0.25 * Number(r.grounded) + 0.60 * Number(r.routed) + 0.15 * Number(r.sufficientEvidence)), 0) / n : 0,
      latency: summarizeLatency(subset),
    };
  };
  const levels = {};
  for (const level of ['naive', 'beginner', 'intermediate', 'advanced', 'expert']) {
    levels[level] = scoreRows(rows.filter((r) => r.level === level));
  }
  const axes = {};
  for (const axis of [...new Set(rows.map((r) => r.axis))].sort()) {
    axes[axis] = scoreRows(rows.filter((r) => r.axis === axis));
  }
  return { overall: scoreRows(rows), levels, axes };
}

export function acceptanceGates(metrics, {
  semanticAssertionsPresent = false,
  fullCorpus = metrics.overall.n === 100,
} = {}) {
  const overall = metrics.overall;
  const implementation = metrics.axes['implementation-evidence'];
  const rate = (n) => overall.n ? n / overall.n : 0;
  const implRate = (key) => implementation?.n ? implementation[key] / implementation.n : 0;
  const gates = [
    { id: 'full-corpus-100', pass: fullCorpus && overall.n === 100, actual: overall.n, required: 100 },
    { id: 'no-errors', pass: overall.errors === 0, actual: overall.errors, required: 0 },
    { id: 'grounded-98pct', pass: rate(overall.grounded) >= 0.98, actual: rate(overall.grounded), required: 0.98 },
    { id: 'routed-95pct', pass: rate(overall.routed) >= 0.95, actual: rate(overall.routed), required: 0.95 },
    { id: 'non-weak-evidence-90pct', pass: rate(overall.sufficientEvidence) >= 0.90, actual: rate(overall.sufficientEvidence), required: 0.90 },
    { id: 'provenance-receipts-95pct', pass: rate(overall.groundingReceipts) >= 0.95, actual: rate(overall.groundingReceipts), required: 0.95 },
    {
      id: 'implementation-enforceable-receipts-90pct',
      pass: !!implementation?.n && implRate('enforceableReceipts') >= 0.90,
      actual: implementation?.n ? implRate('enforceableReceipts') : null,
      required: 0.90,
    },
    { id: 'p50-at-most-2s', pass: overall.latency.p50Ms <= 2_000, actual: overall.latency.p50Ms, required: 2_000 },
    { id: 'p95-at-most-5s', pass: overall.latency.p95Ms <= 5_000, actual: overall.latency.p95Ms, required: 5_000 },
    { id: 'max-at-most-30s', pass: overall.latency.maxMs <= 30_000, actual: overall.latency.maxMs, required: 30_000 },
    {
      id: 'semantic-answer-assertions',
      pass: semanticAssertionsPresent,
      actual: semanticAssertionsPresent,
      required: true,
      note: 'Repo routing is not proof that the returned answer contains the required facts.',
    },
    {
      id: 'semantic-answer-accuracy-95pct',
      pass: rate(overall.semanticPassed) >= 0.95,
      actual: rate(overall.semanticPassed),
      required: 0.95,
      note: 'Every question is checked against explicit question-specific facts; routing alone earns no credit.',
    },
  ];
  return { pass: gates.every((gate) => gate.pass), gates };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function artifactFingerprint() {
  const trackedInputs = [
    'plugin/mcp/server.mjs',
    'kb/forge-mcp-all.mjs',
    'kb/forge-ask-all.mjs',
    'kb/forge-rerank.mjs',
    'kb/card-lane.mjs',
    'kb/capability-cards.md',
    'kb/forge-evidence.mjs',
    'scripts/top100-benchmark.mjs',
    'evals/top-100.json',
  ];
  const files = Object.fromEntries(trackedInputs.map((relative) => {
    const file = path.join(ROOT, relative);
    return [relative, fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null];
  }));
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' });
  const manifest = path.join(KB, 'manifest.json');
  return {
    gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: status.trim().length > 0,
    gitStatusSha256: sha256(status),
    sourceFiles: files,
    installedManifestSha256: fs.existsSync(manifest) ? sha256(fs.readFileSync(manifest)) : null,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage: node scripts/top100-benchmark.mjs [options]

Options:
  --ids top-001,top-093   Run an exact diagnostic subset of corpus IDs
  --limit N               Run only the first N selected questions
  --out FILE              Write the JSON artifact to FILE
  --no-write              Verify and print the summary without writing an artifact
  -h, --help              Print this help without starting the MCP worker

The acceptance result always records whether the run covered all 100 questions.
Use --out when a durable evidence artifact is intentional; release checks are pure.`);
    return;
  }
  const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const limit = Number(arg('--limit', 0));
  const selectedIds = new Set(String(arg('--ids', '')).split(',').map((s) => s.trim()).filter(Boolean));
  const noWrite = argv.includes('--no-write');
  if (noWrite && argv.includes('--out')) throw new Error('--no-write and --out are mutually exclusive');
  const outPath = noWrite ? null : path.resolve(arg('--out', DEFAULT_OUT));
  if (!fs.existsSync(CORPUS)) throw new Error(`missing ${CORPUS}; run node scripts/top100-corpus.mjs`);
  if (!fs.existsSync(path.join(KB, 'verify-citation.mjs'))) throw new Error(`brain verifier absent at ${KB}`);
  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  if (corpus.questions.length !== 100) throw new Error(`refusing non-100 corpus (${corpus.questions.length})`);
  const selected = selectedIds.size ? corpus.questions.filter((q) => selectedIds.has(q.id)) : corpus.questions;
  if (selectedIds.size && selected.length !== selectedIds.size) {
    const found = new Set(selected.map((q) => q.id));
    throw new Error(`unknown --ids: ${[...selectedIds].filter((id) => !found.has(id)).join(', ')}`);
  }
  const questions = limit > 0 ? selected.slice(0, limit) : selected;
  const { verifyGrounding } = await import(pathToFileURL(path.join(KB, 'verify-citation.mjs')).href);

  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, RUVNET_BRAIN_KB: KB },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const rpc = rpcClient(child, {
    timeoutMs: Number(process.env.TOP100_RPC_TIMEOUT_MS) || 180_000,
  });
  const init = await rpc('initialize', {});
  if (init?.result?.serverInfo?.name !== 'ruvnet-brain') throw new Error('stable MCP server failed initialize');

  const rows = [];
  for (const [index, q] of questions.entries()) {
    const started = performance.now();
    let response;
    try {
      response = await rpc('tools/call', { name: 'search_ruvnet', arguments: { query: q.query, k: 6 } });
    } catch (error) {
      response = {
        result: {
          content: [{ type: 'text', text: `search_ruvnet error: benchmark transport failure: ${error.message}` }],
          isError: true,
        },
      };
    }
    const latencyMs = performance.now() - started;
    const text = response?.result?.content?.map((c) => c.text || '').join('\n') || '';
    const structured = response?.result?.structuredContent || {};
    const parsed = parseTop(text);
    const top = structured.cardLane
      ? {
          repo: structured.cardLane.repo || null,
          relevance: null,
          path: structured.cardLane.path ? `kb/${structured.cardLane.path}` : null,
        }
      : parsed;
    const verdict = text ? await verifyGrounding(text, KB) : { grounded: false, citations: [] };
    const cardGrounded = !!(structured.cardLane?.repo
      && structured.cardLane?.path
      && fs.existsSync(path.join(KB, String(structured.cardLane.path).split('#')[0]))
      && fs.readFileSync(path.join(KB, String(structured.cardLane.path).split('#')[0]), 'utf8')
        .includes(`## ${structured.cardLane.repo}`));
    const error = !!response?.error || !!response?.result?.isError || /search_ruvnet error:/i.test(text);
    const routed = !!(top.repo && q.expectRepo.includes(top.repo));
    const sufficientEvidence = !/INSUFFICIENT_EVIDENCE|WEAK COVERAGE/i.test(text) && !!top.path;
    const semantic = evaluateSemanticEvidence(text, q.requiredEvidence);
    rows.push({
      ...q,
      latencyMs,
      topRepo: top.repo,
      topPath: top.path,
      relevance: top.relevance,
      grounded: !!verdict.grounded || cardGrounded,
      routed,
      sufficientEvidence,
      groundingReceipt: !!structured.grounding?.sources?.length,
      enforceableReceipt: !!structured.grounding?.sources?.some((s) => s.enforceable),
      retrievalRouting: structured.routing || null,
      semanticPassed: semantic.pass,
      semantic,
      error,
      answer: text,
    });
    process.stderr.write(`\r[top100] ${index + 1}/${questions.length} ${routed ? '✓' : '✗'} ${q.id} ${Math.round(latencyMs)}ms → ${top.repo || '—'}      `);
  }
  process.stderr.write('\n');
  child.stdin.end();

  const metrics = aggregate(rows);
  const semanticAssertionsPresent = questions.every((q) => Array.isArray(q.requiredEvidence) && q.requiredEvidence.length > 0);
  const result = {
    schemaVersion: 2,
    runAt: new Date().toISOString(),
    corpusSha256: corpus.sha256,
    artifact: artifactFingerprint(),
    path: {
      server: SERVER,
      kb: KB,
      mode: selectedIds.size
        ? `one stable MCP process, sequential selected-id diagnostic (${questions.length}/100)`
        : 'one stable MCP process, sequential user-observed calls',
    },
    metrics,
    acceptance: acceptanceGates(metrics, { semanticAssertionsPresent }),
    rows,
  };
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify({ out: outPath, ...result.metrics, acceptance: result.acceptance }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
