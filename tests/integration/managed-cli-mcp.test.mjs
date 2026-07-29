import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVER = path.join(REPO, 'plugin/mcp/server.mjs');
const children = new Set();

afterEach(() => {
  for (const child of children) child.kill('SIGTERM');
  children.clear();
});

function fixture({ withBrain = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-cli-mcp-'));
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const calls = path.join(root, 'calls.jsonl');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  const executable = path.join(bin, 'ruflo');
  fs.writeFileSync(executable, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.MANAGED_CLI_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === 'fail') process.exit(9);
console.log(JSON.stringify(process.argv.slice(2)));
`);
  fs.chmodSync(executable, 0o755);
  const kb = path.join(root, withBrain ? 'kb' : 'absent-kb');
  if (withBrain) {
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(kb, 'forge-mcp-all.mjs'), `import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const msg = JSON.parse(line);
  const result = msg.method === 'tools/list'
    ? { tools: [{ name: 'search_ruvnet', description: 'live child description', inputSchema: { type: 'object' } }] }
    : {};
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) + '\\n');
});
`);
  }
  return { root, home, bin, calls, kb };
}

function startServer(fx) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: REPO,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: fx.home,
      PATH: `${fx.bin}${path.delimiter}${process.env.PATH || ''}`,
      MANAGED_CLI_CALLS: fx.calls,
      RUVNET_BRAIN_HOME: path.join(fx.root, 'brain'),
      RUVNET_BRAIN_KB: fx.kb,
    },
  });
  children.add(child);
  const rl = readline.createInterface({ input: child.stdout });
  let id = 0;
  const waiting = new Map();
  rl.on('line', (line) => {
    const msg = JSON.parse(line);
    const waiter = waiting.get(msg.id);
    if (waiter) {
      waiting.delete(msg.id);
      waiter.resolve(msg);
    }
  });
  child.on('exit', (code) => {
    for (const waiter of waiting.values()) waiter.reject(new Error(`server exited ${code}`));
    waiting.clear();
  });
  return {
    child,
    request(method, params = {}) {
      const requestId = ++id;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(requestId);
          reject(new Error(`timeout waiting for ${method}`));
        }, 10_000);
        waiting.set(requestId, {
          resolve: (msg) => {
            clearTimeout(timer);
            resolve(msg);
          },
          reject,
        });
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`);
      return response;
    },
  };
}

function lines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

describe('ruvnet-brain MCP structured managed-CLI boundary', () => {
  it('advertises the two schema-validated tools through the actual tools/list protocol', async () => {
    const mcp = startServer(fixture());
    await mcp.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    const listed = await mcp.request('tools/list');
    const tools = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
    expect(tools.has('search_ruvnet')).toBe(true);
    expect(tools.has('ruvnet_cli_help')).toBe(true);
    expect(tools.has('ruvnet_cli_run')).toBe(true);
    expect(tools.get('ruvnet_cli_help').inputSchema.properties.executable.enum).toHaveLength(7);
    expect(tools.get('ruvnet_cli_run').inputSchema.properties.argv.type).toBe('array');
  });

  it('merges local tools without replacing the live brain tool declaration', async () => {
    const mcp = startServer(fixture({ withBrain: true }));
    const listed = await mcp.request('tools/list');
    const tools = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
    expect(tools.get('search_ruvnet').description).toBe('live child description');
    expect(tools.has('ruvnet_cli_help')).toBe(true);
    expect(tools.has('ruvnet_cli_run')).toBe(true);
  });

  it('fails closed for unknown names and for a run without a fresh successful help stamp', async () => {
    const fx = fixture();
    const mcp = startServer(fx);
    const unknown = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'unknown-cli', argv: ['memory', 'search'] },
    });
    expect(unknown.result.isError).toBe(true);
    expect(unknown.result.content[0].text).toMatch(/unknown managed executable/i);

    const unstamped = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'ruflo', argv: ['memory', 'search', '-q', 'x'] },
    });
    expect(unstamped.result.isError).toBe(true);
    expect(unstamped.result.content[0].text).toMatch(/read the interface first/i);
    expect(lines(fx.calls)).toEqual([]);
  });

  it('stamps only after successful help, then executes literal argv with shell metacharacters inert', async () => {
    const fx = fixture();
    const mcp = startServer(fx);

    const helped = await mcp.request('tools/call', {
      name: 'ruvnet_cli_help',
      arguments: { executable: 'ruflo', argv: ['memory', 'search'] },
    });
    expect(helped.result.isError).not.toBe(true);
    expect(lines(fx.calls)).toEqual([['memory', 'search', '--help']]);

    const injected = path.join(fx.root, 'must-not-exist');
    const run = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: {
        executable: 'ruflo',
        argv: ['memory', 'search', ';', 'touch', injected, '$(touch nope)', '|', 'cat'],
      },
    });
    expect(run.result.isError).not.toBe(true);
    expect(lines(fx.calls)[1]).toEqual([
      'memory', 'search', ';', 'touch', injected, '$(touch nope)', '|', 'cat',
    ]);
    expect(fs.existsSync(injected)).toBe(false);
    expect(fs.existsSync(path.join(REPO, 'nope'))).toBe(false);
  });

  it('does not stamp a failed help call and rejects a stale stamp', async () => {
    const fx = fixture();
    const mcp = startServer(fx);
    const failed = await mcp.request('tools/call', {
      name: 'ruvnet_cli_help',
      arguments: { executable: 'ruflo', argv: ['fail'] },
    });
    expect(failed.result.isError).toBe(true);

    const afterFailure = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'ruflo', argv: ['fail'] },
    });
    expect(afterFailure.result.isError).toBe(true);

    const helped = await mcp.request('tools/call', {
      name: 'ruvnet_cli_help',
      arguments: { executable: 'ruflo', argv: ['memory', 'search'] },
    });
    expect(helped.result.isError).not.toBe(true);
    const stamp = path.join(fx.root, 'brain', 'help-read', 'ruflo.memory.search');
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(stamp, stale, stale);

    const afterStale = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'ruflo', argv: ['memory', 'search'] },
    });
    expect(afterStale.result.isError).toBe(true);
    expect(afterStale.result.content[0].text).toMatch(/read the interface first/i);
  });

  it('replaces a hostile stamp symlink without following it', async () => {
    const fx = fixture();
    const stampDir = path.join(fx.root, 'brain', 'help-read');
    const stamp = path.join(stampDir, 'ruflo.memory.search');
    const victim = path.join(fx.root, 'victim.txt');
    fs.mkdirSync(stampDir, { recursive: true });
    fs.writeFileSync(victim, 'must remain intact');
    fs.symlinkSync(victim, stamp);

    const mcp = startServer(fx);
    const helped = await mcp.request('tools/call', {
      name: 'ruvnet_cli_help',
      arguments: { executable: 'ruflo', argv: ['memory', 'search'] },
    });

    expect(helped.result.isError).not.toBe(true);
    expect(fs.readFileSync(victim, 'utf8')).toBe('must remain intact');
    expect(fs.lstatSync(stamp).isSymbolicLink()).toBe(false);
    expect(fs.statSync(stamp).isFile()).toBe(true);
  });
});
