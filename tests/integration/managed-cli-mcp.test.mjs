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
  const warmup = path.join(root, 'warmup.txt');
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
  for (const name of ['agentic-flow', 'agentic-qe']) {
    fs.symlinkSync('ruflo', path.join(bin, name));
  }
  const kb = path.join(root, withBrain ? 'kb' : 'absent-kb');
  if (withBrain) {
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(kb, 'forge-mcp-all.mjs'), `import readline from 'node:readline';
import fs from 'node:fs';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'brain/warmup') fs.writeFileSync(process.env.WARMUP_MARKER, 'ready');
  const result = msg.method === 'brain/warmup'
    ? { ready: true }
    : msg.method === 'tools/list'
    ? { tools: [{ name: 'search_ruvnet', description: 'live child description', inputSchema: { type: 'object' } }] }
    : {};
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) + '\\n');
});
`);
  }
  return { root, home, bin, calls, kb, warmup };
}

function fatalFixture() {
  const fx = fixture();
  fs.writeFileSync(path.join(fx.bin, 'ruflo'), `#!/usr/bin/env node
if (process.argv.includes('--help')) {
  console.log('memory store help');
  process.exit(0);
}
console.log('[OK] Data stored successfully');
console.error('❌ Invalid PRAGMA command: wal_checkpoint(passive)');
process.exit(0);
`);
  return fx;
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
      WARMUP_MARKER: fx.warmup,
      RUVNET_BRAIN_HOME: path.join(fx.root, 'brain'),
      RUVNET_BRAIN_KB: fx.kb,
      RUVNET_BRAIN_PROJECT_SETTINGS_FILE: path.join(fx.root, 'absent-project-settings.json'),
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
    const fx = fixture({ withBrain: true });
    const mcp = startServer(fx);
    const listed = await mcp.request('tools/list');
    const tools = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
    expect(tools.get('search_ruvnet').description).toBe('live child description');
    expect(fs.readFileSync(fx.warmup, 'utf8')).toBe('ready');
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

  it('enforces live routing and QE-fleet choices before either real executable starts', async () => {
    const fx = fixture();
    const configDir = path.join(fx.home, '.claude', 'ruvnet-brain');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
      routing: 'off',
      qeFleet: false,
    }));
    const mcp = startServer(fx);

    for (const [executable, helpArgv] of [
      ['agentic-flow', []],
      ['agentic-qe', ['fleet', 'run']],
    ]) {
      const helped = await mcp.request('tools/call', {
        name: 'ruvnet_cli_help',
        arguments: { executable, argv: helpArgv },
      });
      expect(helped.result.isError).not.toBe(true);
    }
    const before = lines(fx.calls).length;
    const routedOff = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'agentic-flow', argv: ['--agent', 'researcher', '--task', 'x'] },
    });
    expect(routedOff.result.isError).toBe(true);
    expect(routedOff.result.content[0].text).toMatch(/routing is off/i);
    const fleetOff = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'agentic-qe', argv: ['fleet', 'run', 'test', '--target', '.'] },
    });
    expect(fleetOff.result.isError).toBe(true);
    expect(fleetOff.result.content[0].text).toMatch(/fleet is off/i);
    expect(lines(fx.calls)).toHaveLength(before);

    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
      routing: 'auto',
      qeFleet: true,
    }));
    const routedOn = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'agentic-flow', argv: ['--agent', 'researcher', '--task', 'x'] },
    });
    expect(routedOn.result.isError).not.toBe(true);
    const fleetOn = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'agentic-qe', argv: ['fleet', 'run', 'test', '--target', '.'] },
    });
    expect(fleetOn.result.isError).not.toBe(true);
    expect(lines(fx.calls).slice(-2)).toEqual([
      ['--agent', 'researcher', '--task', 'x'],
      ['fleet', 'run', 'test', '--target', '.'],
    ]);
  });

  it('fails closed when a CLI exits zero but reports a fatal persistence error', async () => {
    const fx = fatalFixture();
    const mcp = startServer(fx);
    const helped = await mcp.request('tools/call', {
      name: 'ruvnet_cli_help',
      arguments: { executable: 'ruflo', argv: ['memory', 'store'] },
    });
    expect(helped.result.isError).not.toBe(true);
    const run = await mcp.request('tools/call', {
      name: 'ruvnet_cli_run',
      arguments: { executable: 'ruflo', argv: ['memory', 'store', '-k', 'proof', '--value', 'x'] },
    });
    expect(run.result.isError).toBe(true);
    expect(run.result.content[0].text).toMatch(/invalid pragma/i);
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
