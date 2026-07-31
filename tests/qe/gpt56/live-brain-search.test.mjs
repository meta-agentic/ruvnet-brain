import { afterAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';

const LIVE = process.env.RUVNET_QE_LIVE === '1';
const ROOT = path.resolve(import.meta.dirname, '../../..');
const KB = process.env.RUVNET_QE_BRAIN_KB || path.join(ROOT, 'kb');
const SERVER = path.join(KB, 'forge-mcp-all.mjs');
const DEADLINE_MS = 30_000;

let child;
let stderr = '';
let nextId = 1;
const pending = new Map();

function startServer() {
  child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      KB_DIR: KB,
      RUVNET_BRAIN_METER: '0',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    while (stdout.includes('\n')) {
      const newline = stdout.indexOf('\n');
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('exit', (code) => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error(`Brain worker exited ${code}; stderr: ${stderr}`));
    }
    pending.clear();
  });
}

function request(method, params) {
  if (!child) startServer();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`search_ruvnet exceeded ${DEADLINE_MS}ms; stderr: ${stderr}`));
    }, DEADLINE_MS);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

afterAll(() => child?.kill());

describe.skipIf(!LIVE)('QE-BRN-001 — the real source-grounding door', () => {
  it('returns substantive, cited RuvNet-Brain source through the actual MCP worker', async () => {
    const response = await request('tools/call', {
      name: 'search_ruvnet',
      arguments: {
        query: 'How does RuvNet Brain expose the rvbc console in Claude Code and Codex?',
        k: 3,
      },
    });
    expect(response.error).toBeUndefined();
    const text = response.result?.content?.[0]?.text || '';
    expect(response.result?.isError, text).not.toBe(true);
    expect(text).toMatch(/repo=ruvnet-brain/i);
    expect(text).toMatch(/ruvnet-brain\/plugin\/skills\/rvbc\/SKILL\.md/i);
  }, DEADLINE_MS + 5_000);

  it('serves two concurrent substantive searches without timing either one out', async () => {
    const queries = [
      'How does RuvNet Brain expose the rvbc console in Claude Code and Codex?',
      'What command shows the RuvNet Brain 4.0 upgrade highlights?',
    ];
    const responses = await Promise.all(queries.map((query) => request('tools/call', {
      name: 'search_ruvnet',
      arguments: { query, k: 3 },
    })));
    for (const response of responses) {
      expect(response.error).toBeUndefined();
      const text = response.result?.content?.[0]?.text || '';
      expect(response.result?.isError, text).not.toBe(true);
      expect(text).toMatch(/repo=ruvnet-brain/i);
    }
  }, DEADLINE_MS + 5_000);

  it('answers the broad release-process query that timed out in the installed 4.0.1 Brain', async () => {
    const response = await request('tools/call', {
      name: 'search_ruvnet',
      arguments: {
        query: 'How should RuvNet Brain enforce an exact-artifact deployment process with clean lineage, GitHub checks, Agentic QE, independent graders, and post-publication verification?',
        k: 5,
      },
    });
    expect(response.error).toBeUndefined();
    const text = response.result?.content?.[0]?.text || '';
    expect(response.result?.isError, text).not.toBe(true);
    expect(text).toMatch(/repo=ruvnet-brain/i);
    expect(text).toMatch(/ruvnet-brain\/(?:scripts\/release-vector\.mjs|docs\/adr\/0058-the-95-contract\.md|docs\/qe\/AGENTIC-QE-4\.0-MASTER-PLAN\.md|plugin\/skills\/release-proof\/SKILL\.md)/i);
  }, DEADLINE_MS + 5_000);
});
