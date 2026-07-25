// install-ruvector-db-cwd.test.mjs — issue #39: the ruvector MCP server dropped an empty
// ~1.5MB `ruvector.db` scaffold into whatever project happened to be open, not the plugin's
// own cache dir.
//
// ROOT CAUSE (traced live, 2026-07-24): `ruvector/dist/core/intelligence-engine.js`
// `initVectorDb()` constructs the native VectorDb with `{ dimensions, distanceMetric:
// 'Cosine' }` and NO storagePath — that constructor runs unconditionally from a module-level
// `new Intelligence()` the instant `ruvector mcp start` boots (bin/mcp-server.js:570). The
// native binding then defaults storage to "./ruvector.db" relative to process.cwd(), and
// Claude Code always launches an MCP server with cwd = the current project. Reproduced
// byte-for-byte: starting `ruvector mcp start` from an empty directory wrote a 1,589,248-byte
// `ruvector.db` there containing exactly
// `{"dimensions":384,"distance_metric":"Cosine","storage_path":"./ruvector.db","hnsw_config":null,"quantization":null}`.
//
// `claude mcp add` has no --cwd flag and `ruvector mcp start --help` documents only `-h`
// (verified live) — there is no flag or env var to hand the native binding a storage path
// directly. bin/install.mjs's fix instead registers a `node -e` launcher that pins the
// PROCESS's own `cwd` (child_process's `cwd` option, no shell involved) to a fixed cache dir
// before delegating to the real `npx -y ruvector mcp start` — verified live to relocate the
// exact same scaffold under ~/.cache/ruvnet-brain/ruvector-mcp instead of a consumer project.
//
// This suite is string-level (asserts on the generated command/launcher, not a live MCP spawn
// — that's what the manual live repro above already proved) plus a real filesystem round trip
// for the cleanup mitigation.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');

afterEach(() => {
  delete process.env.RUVNET_BRAIN_IMPORT_ONLY;
});

let seq = 0;
async function freshInstaller() {
  process.env.RUVNET_BRAIN_IMPORT_ONLY = '1';
  return import(pathToFileURL(INSTALLER).href + `?ruvector-cwd-case=${++seq}`);
}

// The exact vulnerable registration issue #39 is about — the ONE THING this fix must never
// produce again, regardless of how the surrounding code is refactored.
const VULNERABLE_ARGS = ['mcp', 'add', 'ruvector', '--scope', 'user', '--', 'npx', '-y', 'ruvector', 'mcp', 'start'];

describe('buildRuvectorMcpAddCommand — registers a cwd-pinned launcher, not the bare cwd-dependent command', () => {
  it('returns shell:null when the claude CLI is absent (nothing to register)', async () => {
    const mod = await freshInstaller();
    const cmd = mod.buildRuvectorMcpAddCommand({ claude: false });
    expect(cmd.shell).toBeNull();
  });

  it('never registers the bare `npx -y ruvector mcp start` args — that IS the bug', async () => {
    const mod = await freshInstaller();
    const cmd = mod.buildRuvectorMcpAddCommand({ claude: true });
    expect(cmd.shell[0]).toBe('claude');
    expect(cmd.shell[1]).not.toEqual(VULNERABLE_ARGS);
  });

  it('registers `claude mcp add ruvector --scope user` fronted by a node launcher', async () => {
    const mod = await freshInstaller();
    const cmd = mod.buildRuvectorMcpAddCommand({ claude: true });
    const args = cmd.shell[1];
    expect(args.slice(0, 5)).toEqual(['mcp', 'add', 'ruvector', '--scope', 'user']);
    expect(args[5]).toBe('--');
    expect(args[6]).toBe('node');
    expect(args[7]).toBe('-e');
    expect(typeof args[8]).toBe('string');
  });

  it('the launcher pins cwd to an explicit path under ~/.cache/ruvnet-brain (the actual fix)', async () => {
    const mod = await freshInstaller();
    const cmd = mod.buildRuvectorMcpAddCommand({ claude: true });
    const launcher = cmd.shell[1][8];
    // Uses child_process's own cwd option — no shell, so it behaves the same on every OS.
    expect(launcher).toMatch(/cwd:\s*d/);
    expect(launcher).toContain('spawnSync("npx"');
    expect(launcher).toContain('"-y"');
    expect(launcher).toContain('"ruvector"');
    expect(launcher).toContain('"mcp"');
    expect(launcher).toContain('"start"');
    // The default cwd is a real, absolute path under the plugin's own cache dir — the exact
    // fix the issue asked for ("write this container under ~/.cache/ruvnet-brain/"), not the
    // invoking project's root.
    const defaultCwd = path.join(os.homedir(), '.cache', 'ruvnet-brain', 'ruvector-mcp');
    expect(launcher).toContain(JSON.stringify(defaultCwd));
    expect(path.isAbsolute(defaultCwd)).toBe(true);
  });

  it('mkdirs the target dir before spawning — first run on a clean machine must not ENOENT', async () => {
    const mod = await freshInstaller();
    const launcher = mod.buildRuvectorMcpAddCommand({ claude: true }).shell[1][8];
    expect(launcher).toContain('mkdirSync(d');
    expect(launcher).toMatch(/mkdirSync\(d,\s*\{\s*recursive:\s*true\s*\}\)/);
  });

  it('a custom cwd is embedded via JSON.stringify — safe even with spaces/quotes (Windows usernames, etc.)', async () => {
    const mod = await freshInstaller();
    const weird = path.join(os.tmpdir(), "ruvnet weird 'dir" + Date.now());
    const launcher = mod.buildRuvectorMcpAddCommand({ claude: true }, weird).shell[1][8];
    // JSON.stringify is what makes embedding a raw path into a JS source string safe (proper
    // quote/backslash escaping) — assert the literal it produces is exactly what's embedded,
    // and that it lands in the `const d=` assignment specifically.
    const literal = JSON.stringify(weird);
    expect(launcher).toContain(`const d=${literal};`);
  });

  it('say mirrors the registered shell command, for the printed/copy-pasteable form', async () => {
    const mod = await freshInstaller();
    const cmd = mod.buildRuvectorMcpAddCommand({ claude: true });
    expect(cmd.say).toContain('claude mcp add ruvector --scope user');
    expect(cmd.say).toContain('node -e');
    expect(cmd.say).not.toContain('-- npx -y ruvector mcp start'); // the old, vulnerable one-liner
  });
});

describe('cleanupStrayRuvectorDb — removes ONLY the exact empty-scaffold signature', () => {
  let tmp;
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

  const EMPTY_SIGNATURE_BODY =
    '__ruvector_db_config__{"dimensions":384,"distance_metric":"Cosine","storage_path":"./ruvector.db","hnsw_config":null,"quantization":null}';

  function makeTmp() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-ruvector-cleanup-'));
    return tmp;
  }

  it('no file present: false, no error', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(false);
  });

  it('matches the real reproduced empty container (padded to the observed ~1.5MB) and deletes it', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    const p = path.join(dir, 'ruvector.db');
    // Real empty scaffolds are ~1.5MB (redb's own pre-allocated pages) with the config record
    // embedded somewhere inside — pad with zero bytes the same way, rather than writing only
    // the signature, so the size-cap branch is exercised honestly too.
    const padding = Buffer.alloc(1_589_248 - EMPTY_SIGNATURE_BODY.length, 0);
    fs.writeFileSync(p, Buffer.concat([Buffer.from(EMPTY_SIGNATURE_BODY), padding]));
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(true);
    expect(fs.existsSync(p)).toBe(false);
  });

  it('never deletes a file whose content does not carry the exact signature (true negative)', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    const p = path.join(dir, 'ruvector.db');
    // Same shape, but a REAL store would differ on at least one field — here, a different
    // storage_path (the user pointed it somewhere else) is enough to prove this is not a
    // substring-only match on "dimensions":384.
    fs.writeFileSync(p, '__ruvector_db_config__{"dimensions":384,"distance_metric":"Cosine","storage_path":"./my-real-vectors.db","hnsw_config":null,"quantization":null}' + '\x00'.repeat(1000));
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(false);
    expect(fs.existsSync(p)).toBe(true); // untouched
  });

  it('never deletes a file over the size cap, even if it contains the signature (a real, populated store)', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    const p = path.join(dir, 'ruvector.db');
    // A store that grew past the cap plainly has real content beyond the header — refuse it.
    const big = Buffer.concat([Buffer.from(EMPTY_SIGNATURE_BODY), Buffer.alloc(4 * 1024 * 1024, 1)]);
    fs.writeFileSync(p, big);
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(false);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('never deletes a directory named ruvector.db (edge case, must not throw)', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    fs.mkdirSync(path.join(dir, 'ruvector.db'));
    expect(() => mod.cleanupStrayRuvectorDb(dir)).not.toThrow();
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(false);
    expect(fs.existsSync(path.join(dir, 'ruvector.db'))).toBe(true);
  });

  it('a zero-byte file is left alone', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    const p = path.join(dir, 'ruvector.db');
    fs.writeFileSync(p, '');
    expect(mod.cleanupStrayRuvectorDb(dir)).toBe(false);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('defaults to process.cwd() when no dir is given', async () => {
    const mod = await freshInstaller();
    const dir = makeTmp();
    const cwdBefore = process.cwd();
    process.chdir(dir);
    try {
      fs.writeFileSync(path.join(dir, 'ruvector.db'), EMPTY_SIGNATURE_BODY + '\x00'.repeat(1000));
      expect(mod.cleanupStrayRuvectorDb()).toBe(true);
      expect(fs.existsSync(path.join(dir, 'ruvector.db'))).toBe(false);
    } finally {
      process.chdir(cwdBefore);
    }
  });
});
