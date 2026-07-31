import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SERVER = path.join(ROOT, 'plugin/mcp/server.mjs');

function waitFor(fn, timeoutMs, description) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const value = fn();
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${description}`));
      }
    }, 20);
    timer.unref?.();
  });
}

describe('Brain worker idle retirement respects concurrent in-flight work', () => {
  it('does not retire during delayed calls, then starts exactly one lazy replacement after quiescence', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ruvnet-qe-concurrent-worker-'));
    const kb = path.join(home, 'kb');
    const starts = path.join(home, 'starts.txt');
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(kb, 'forge-mcp-all.mjs'), `
import fs from 'node:fs';
import readline from 'node:readline';
const file = process.env.QE_STARTS;
const worker = (fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) : 0) + 1;
fs.writeFileSync(file, String(worker));
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const send = (result) => process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id, result,
  }) + '\\n');
  if (request.method === 'initialize') {
    send({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'qe-stub', version: '0' } });
  } else if (request.method === 'brain/warmup') {
    send({ ready: true });
  } else if (request.method === 'tools/list') {
    send({ tools: [{ name: 'search_ruvnet', inputSchema: { type: 'object' } }] });
  } else if (request.method === 'tools/call') {
    setTimeout(() => send({ content: [{ type: 'text', text: 'worker=' + worker + ' query=' + request.params.arguments.query }] }), 300);
  }
});
setInterval(() => {}, 1 << 30);
`);

    const server = spawn(process.execPath, [SERVER], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RUVNET_BRAIN_HOME: home,
        RUVNET_BRAIN_KB: kb,
        RUVNET_BRAIN_CHILD_IDLE_MS: '75',
        RUVNET_BRAIN_CALL_TIMEOUT_MS: '3000',
        QE_STARTS: starts,
        NTFY_TOPIC: '',
      },
    });
    const replies = new Map();
    let stdout = '';
    let stderr = '';
    server.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      let newline;
      while ((newline = stdout.indexOf('\n')) >= 0) {
        const line = stdout.slice(0, newline);
        stdout = stdout.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          replies.set(message.id, message);
        } catch { /* ignore non-protocol output */ }
      }
    });
    server.stderr.on('data', (chunk) => { stderr += String(chunk); });
    const send = (id, method, params = {}) => {
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    };

    try {
      send(1, 'initialize');
      await waitFor(() => replies.get(1), 5_000, 'server initialize');

      send(2, 'tools/call', { name: 'search_ruvnet', arguments: { query: 'first' } });
      send(3, 'tools/call', { name: 'search_ruvnet', arguments: { query: 'second' } });
      const first = await waitFor(() => replies.get(2), 5_000, 'first delayed reply');
      const second = await waitFor(() => replies.get(3), 5_000, 'second delayed reply');

      expect(JSON.stringify(first.result), stderr).toContain('worker=1 query=first');
      expect(JSON.stringify(second.result), stderr).toContain('worker=1 query=second');
      expect(Number(fs.readFileSync(starts, 'utf8'))).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 500));
      send(4, 'tools/call', { name: 'search_ruvnet', arguments: { query: 'after-idle' } });
      const afterIdle = await waitFor(() => replies.get(4), 5_000, 'post-idle reply');
      expect(JSON.stringify(afterIdle.result), stderr).toContain('worker=2 query=after-idle');
      expect(Number(fs.readFileSync(starts, 'utf8'))).toBe(2);
    } finally {
      try { server.kill('SIGKILL'); } catch { /* already gone */ }
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 15_000);
});
