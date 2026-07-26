// codex-wiring.test.mjs — the second host, and the developer path that must never ship again.
//
// WHAT THIS PROTECTS (issue #42, Henrik Pettersen; ADR-051). Three failures, three shapes.
//
// The first is REACHABILITY. We shipped a working MCP server, a .codex/ directory, and no line of
// code connecting them, so on a Codex host the brain was entirely absent. The fix writes
// [mcp_servers.ruvnet-brain] into ~/.codex/config.toml at install time — into a file that is the
// USER's, already carrying their settings, with no TOML library to parse it. So the merge is the
// load-bearing part: it must add when absent, rewrite its own block when present, preserve every
// other byte, refuse to touch a declaration the user wrote themselves, and be idempotent across
// reinstalls. That is asserted at byte level below, against a pure function, so no test ever goes
// near a real ~/.codex.
//
// The second is TRUTHFULNESS of the manifests. A skill.toml that names a tool the server does not
// serve is the product lying about its own capability, and it fails in the most expensive place —
// at the user's keyboard, in the other host, where we are not watching. So every dispatch target
// here is checked against what plugin/mcp/server.mjs actually declares.
//
// The third is the LEAK CLASS. .codex/hooks.json shipped a path inside the maintainer's home
// directory. Its removal is worth nothing if the next edit reintroduces it, so the guard is
// repo-wide over both shipped trees rather than a check on the one file we happened to fix.
//
// The five test classes ADR-028 requires:
//   low         — the merge contract, table-driven, pure, no I/O
//   medium      — real filesystem round trip: wireCodexHost() against a temp HOME
//   high        — the invariants that cost something when broken: byte preservation, idempotency,
//                 refusing to clobber a user's own entry, and a doctor that probes instead of asserts
//   numeric     — the leak guard, asserted as a count over every shipped file under .codex/ + plugin/
//   qualitative — each manifest states what it dispatches to, and names a target that exists

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CODEX_DIR = path.join(ROOT, '.codex');

let mergeCodexConfig, wireCodexHost, codexStatus;
beforeAll(async () => {
  // Same import-only contract the other installer tests use, so main() never runs on import.
  process.env.RUVNET_BRAIN_IMPORT_ONLY = '1';
  ({ mergeCodexConfig, wireCodexHost, codexStatus } = await import('../../bin/install.mjs'));
});

const SERVER = '/some/persistent/home/.claude/ruvnet-brain/mcp/server.mjs';
const START = '# --- ruvnet-brain (managed block, installer-rewritten) ---';
const END = '# --- end ruvnet-brain ---';

// The real shipped config, byte for byte — the thing a reinstall must not damage.
const REAL_CONFIG = '[shell_environment_policy]\ninherit = "core"\n\n[shell_environment_policy.set]\nRUFLO_HARNESS_LOOP = "1"\n';

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'codex-wiring-'));

// ── low: the merge contract ──────────────────────────────────────────────────────────────────────
describe('mergeCodexConfig — the three outcomes, and only three', () => {
  it('writes a fresh block into an empty/absent config', () => {
    const { text, action } = mergeCodexConfig('', SERVER);
    expect(action).toBe('added');
    expect(text).toContain('[mcp_servers.ruvnet-brain]');
    expect(text).toContain('command = "node"');
    expect(text).toContain(`args = [${JSON.stringify(SERVER)}]`);
    expect(text.startsWith(START)).toBe(true);
    expect(text.trimEnd().endsWith(END)).toBe(true);
  });

  it('treats a non-string (never-read file) as empty rather than throwing', () => {
    expect(mergeCodexConfig(undefined, SERVER).action).toBe('added');
    expect(mergeCodexConfig(null, SERVER).action).toBe('added');
  });

  it('appends after existing content, separated by a blank line', () => {
    const { text, action } = mergeCodexConfig(REAL_CONFIG, SERVER);
    expect(action).toBe('added');
    expect(text.startsWith(REAL_CONFIG)).toBe(true);
    expect(text).toMatch(/RUFLO_HARNESS_LOOP = "1"\n\n# --- ruvnet-brain/);
  });

  it('rewrites its own block in place when the server path changes', () => {
    const first = mergeCodexConfig(REAL_CONFIG, '/old/server.mjs').text;
    const { text, action } = mergeCodexConfig(first, SERVER);
    expect(action).toBe('rewritten');
    expect(text).toContain(`args = [${JSON.stringify(SERVER)}]`);
    expect(text).not.toContain('/old/server.mjs');
    // Exactly one block — a rewrite must not stack a second copy.
    expect(text.split(START).length - 1).toBe(1);
    expect(text.split(END).length - 1).toBe(1);
  });

  for (const [label, header] of [
    ['bare', '[mcp_servers.ruvnet-brain]'],
    ['double-quoted', '[mcp_servers."ruvnet-brain"]'],
    ['single-quoted', "[mcp_servers.'ruvnet-brain']"],
    ['indented', '  [mcp_servers.ruvnet-brain]'],
  ]) {
    it(`leaves a user's own ${label} declaration completely alone`, () => {
      const mine = `${REAL_CONFIG}\n${header}\ncommand = "node"\nargs = ["/my/own/choice.mjs"]\n`;
      const { text, action } = mergeCodexConfig(mine, SERVER);
      expect(action).toBe('user-owned');
      expect(text).toBe(mine); // not one byte changed
    });
  }

  it('does not mistake another server for ours', () => {
    const other = `${REAL_CONFIG}\n[mcp_servers.something-else]\ncommand = "node"\n`;
    expect(mergeCodexConfig(other, SERVER).action).toBe('added');
  });
});

// ── high: byte preservation + idempotency, the two things a reinstall can destroy ────────────────
describe('a reinstall is safe — every other section survives, and the result is stable', () => {
  it('preserves the pre-existing sections byte for byte', () => {
    const { text } = mergeCodexConfig(REAL_CONFIG, SERVER);
    // Strip our block back out; what remains must be exactly what we were given.
    const without = text.slice(0, text.indexOf(START)).replace(/\n+$/, '\n');
    expect(without).toBe(REAL_CONFIG);
    expect(text).toContain('[shell_environment_policy]');
    expect(text).toContain('inherit = "core"');
    expect(text).toContain('[shell_environment_policy.set]');
    expect(text).toContain('RUFLO_HARNESS_LOOP = "1"');
  });

  it('is idempotent: a second and third run reproduce the first byte for byte', () => {
    const once = mergeCodexConfig(REAL_CONFIG, SERVER).text;
    const twice = mergeCodexConfig(once, SERVER).text;
    const thrice = mergeCodexConfig(twice, SERVER).text;
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
  });

  it('preserves content the user added AFTER our block', () => {
    const once = mergeCodexConfig(REAL_CONFIG, SERVER).text;
    const withTail = `${once}\n[mcp_servers.theirs]\ncommand = "python"\n`;
    const { text, action } = mergeCodexConfig(withTail, SERVER);
    expect(action).toBe('rewritten');
    expect(text).toContain('[mcp_servers.theirs]');
    expect(text).toContain('command = "python"');
    expect(text).toBe(withTail); // same server path in, same bytes out
  });
});

// ── medium: the real write path, against a temp HOME (never the developer's own ~/.codex) ────────
describe('wireCodexHost — the filesystem round trip', () => {
  it('says nothing and changes nothing when there is no Codex host', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex'); // deliberately not created
    const r = wireCodexHost({ codexDir, serverDir: path.join(home, 'srv'), announce: false });
    expect(r).toEqual({ host: false, action: 'no-host' });
    expect(fs.existsSync(codexDir)).toBe(false);
  });

  it('registers a RESOLVED ABSOLUTE path to a server that really exists', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    const serverDir = path.join(home, '.claude', 'ruvnet-brain', 'mcp');
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, 'config.toml'), REAL_CONFIG);

    const r = wireCodexHost({ codexDir, serverDir, announce: false });
    expect(r.action).toBe('added');
    expect(path.isAbsolute(r.serverPath)).toBe(true);
    // The registration is worthless if the file it names is not there.
    expect(fs.existsSync(r.serverPath)).toBe(true);
    // It is the real supervisor, not a stub.
    expect(fs.readFileSync(r.serverPath, 'utf8')).toContain('search_ruvnet');

    const written = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf8');
    expect(written).toContain('[mcp_servers.ruvnet-brain]');
    expect(written).toContain(`args = [${JSON.stringify(r.serverPath)}]`);
    expect(written).toContain('RUFLO_HARNESS_LOOP = "1"'); // theirs, untouched
  });

  it('creates config.toml when the host exists but has none yet', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const r = wireCodexHost({ codexDir, serverDir: path.join(home, 'srv'), announce: false });
    expect(r.action).toBe('added');
    expect(fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf8')).toContain('[mcp_servers.ruvnet-brain]');
  });

  it('a symlinked config (dotfiles-managed) keeps its identity — the write goes THROUGH the link', (ctx) => {
    // chezmoi/stow/yadm users keep ~/.codex/config.toml as a symlink into a dotfiles repo. The
    // atomic rename swaps inodes, so without realpath resolution it would replace the LINK with a
    // plain file and the user's dotfiles repo would silently stop receiving the config (found by
    // the issue #43 review, 2026-07-26).
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const realConfig = path.join(home, 'dotfiles', 'codex-config.toml');
    fs.mkdirSync(path.dirname(realConfig), { recursive: true });
    fs.writeFileSync(realConfig, REAL_CONFIG);
    const configPath = path.join(codexDir, 'config.toml');
    try { fs.symlinkSync(realConfig, configPath); }
    catch { return ctx.skip(); } // Windows without symlink privilege — POSIX runs keep this honest

    wireCodexHost({ codexDir, configPath, serverDir: path.join(home, 'srv'), announce: false });

    expect(fs.lstatSync(configPath).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(realConfig, 'utf8')).toContain('[mcp_servers.ruvnet-brain]');
    expect(fs.readFileSync(realConfig, 'utf8')).toContain('RUFLO_HARNESS_LOOP = "1"');
  });

  it('preserves the config file mode — a chmod-600 config never comes back world-readable', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const configPath = path.join(codexDir, 'config.toml');
    fs.writeFileSync(configPath, REAL_CONFIG);
    fs.chmodSync(configPath, 0o600);
    // Assert against what THIS platform made of 0o600 (win32 folds it into the read-only bit),
    // so the test is byte-honest everywhere without a platform fork.
    const modeBefore = fs.statSync(configPath).mode & 0o777;

    wireCodexHost({ codexDir, configPath, serverDir: path.join(home, 'srv'), announce: false });

    expect(fs.readFileSync(configPath, 'utf8')).toContain('[mcp_servers.ruvnet-brain]');
    expect(fs.statSync(configPath).mode & 0o777).toBe(modeBefore);
  });

  it('a second install leaves the file byte-identical', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    const serverDir = path.join(home, '.claude', 'ruvnet-brain', 'mcp');
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, 'config.toml'), REAL_CONFIG);
    const opts = { codexDir, serverDir, announce: false };

    wireCodexHost(opts);
    const after1 = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf8');
    const r2 = wireCodexHost(opts);
    const after2 = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf8');

    expect(after2).toBe(after1);
    expect(r2.changed).toBe(false);
    expect(r2.action).toBe('rewritten');
  });
});

// ── high: the doctor probes disk; it never asserts from "we ran once" ────────────────────────────
describe('codexStatus — the three doctor states, each derived from disk', () => {
  it('no host', () => {
    const home = tmpdir();
    const s = codexStatus({ codexDir: path.join(home, '.codex'), configPath: path.join(home, '.codex', 'config.toml') });
    expect(s).toMatchObject({ host: false, wired: false });
  });

  it('host detected but NOT wired — no entry at all', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const configPath = path.join(codexDir, 'config.toml');
    fs.writeFileSync(configPath, REAL_CONFIG);
    expect(codexStatus({ codexDir, configPath })).toMatchObject({ host: true, wired: false, serverPath: null });
  });

  it('host detected but NOT wired — entry present, server MISSING (the worse case)', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const configPath = path.join(codexDir, 'config.toml');
    fs.writeFileSync(configPath, mergeCodexConfig(REAL_CONFIG, path.join(home, 'deleted', 'server.mjs')).text);
    const s = codexStatus({ codexDir, configPath });
    // An entry pointing at nothing must NOT read as wired — Codex would fail at spawn time.
    expect(s).toMatchObject({ host: true, wired: false, serverExists: false });
    expect(s.serverPath).toContain('server.mjs');
  });

  it('wired — entry present AND the server it names exists', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    const serverDir = path.join(home, '.claude', 'ruvnet-brain', 'mcp');
    fs.mkdirSync(codexDir, { recursive: true });
    wireCodexHost({ codexDir, serverDir, announce: false });
    const s = codexStatus({ codexDir, configPath: path.join(codexDir, 'config.toml') });
    expect(s).toMatchObject({ host: true, wired: true, serverExists: true });
  });

  it('the probe can FAIL on a broken config — deleting the server flips wired to false', () => {
    const home = tmpdir();
    const codexDir = path.join(home, '.codex');
    const serverDir = path.join(home, '.claude', 'ruvnet-brain', 'mcp');
    fs.mkdirSync(codexDir, { recursive: true });
    const r = wireCodexHost({ codexDir, serverDir, announce: false });
    const configPath = path.join(codexDir, 'config.toml');
    expect(codexStatus({ codexDir, configPath }).wired).toBe(true);
    fs.rmSync(r.serverPath);
    expect(codexStatus({ codexDir, configPath }).wired).toBe(false);
  });
});

// ── the shipped manifests: valid TOML, and every target real ─────────────────────────────────────
// No TOML dependency in this package, so this is a deliberately small parser: enough to prove the
// files are well-formed key/value TOML with the sections the grounded shape requires, and no more.
function parseToml(src) {
  const out = Object.create(null);
  let section = null;
  let arrayOfTables = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) return;
    let m = /^\[\[([A-Za-z0-9_.-]+)\]\]$/.exec(line);
    if (m) { arrayOfTables = m[1]; (out[m[1]] ||= []).push(Object.create(null)); section = null; return; }
    m = /^\[([A-Za-z0-9_."'-]+)\]$/.exec(line);
    if (m) { section = m[1]; arrayOfTables = null; out[section] ||= Object.create(null); return; }
    m = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!m) throw new Error(`line ${i + 1}: not a TOML key/value or table header: ${raw}`);
    const [, key, rawVal] = m;
    let val = rawVal.trim();
    if (/^".*"$/.test(val)) val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    else if (/^\[.*\]$/.test(val)) val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    const target = arrayOfTables ? out[arrayOfTables][out[arrayOfTables].length - 1] : out[section];
    if (!target) throw new Error(`line ${i + 1}: key outside any table: ${raw}`);
    target[key] = val;
  });
  return out;
}

const manifestDirs = () => {
  const skills = path.join(CODEX_DIR, 'skills');
  return fs.existsSync(skills)
    ? fs.readdirSync(skills, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(skills, e.name, 'skill.toml')))
      .map((e) => ({ name: e.name, file: path.join(skills, e.name, 'skill.toml') }))
    : [];
};

describe('.codex/skills/*/skill.toml — parses, and dispatches somewhere real', () => {
  const served = (() => {
    const src = fs.readFileSync(path.join(ROOT, 'plugin', 'mcp', 'server.mjs'), 'utf8');
    return new Set([...src.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]));
  })();

  it('the tiny parser can actually fail (a test that cannot fail is not a test)', () => {
    expect(() => parseToml('this is not toml')).toThrow();
    expect(() => parseToml('key = "orphan"')).toThrow(/outside any table/);
    expect(parseToml('[a]\nk = "v"\n[[b]]\nn = "1"')).toEqual({ a: { k: 'v' }, b: [{ n: '1' }] });
  });

  it('there are manifests to check (an empty pass proves nothing)', () => {
    expect(manifestDirs().length).toBeGreaterThanOrEqual(2);
  });

  for (const { name, file } of manifestDirs()) {
    describe(name, () => {
      const t = parseToml(fs.readFileSync(file, 'utf8'));

      it('carries [skill] name + description, and name matches its directory', () => {
        expect(t.skill).toBeTruthy();
        expect(t.skill.name).toBe(name);
        expect(typeof t.skill.description).toBe('string');
        expect(t.skill.description.length).toBeGreaterThan(40);
      });

      it('carries the [dispatch] + [command] sections the grounded shape requires', () => {
        expect(t.dispatch).toBeTruthy();
        expect(['mcp_tool', 'shell']).toContain(t.dispatch.type);
        expect(t.command?.name).toBe(name);
        expect(Array.isArray(t.catalog?.tags)).toBe(true);
      });

      it('dispatches to a target that EXISTS — never an aspirational one', () => {
        if (t.dispatch.type === 'mcp_tool') {
          // The server name must be the one the installer registers in ~/.codex/config.toml…
          expect(t.dispatch.server).toBe('ruvnet-brain');
          // …and the tool must be one the server really serves.
          expect(served.has(t.dispatch.tool), `${name} names tool "${t.dispatch.tool}", served: ${[...served]}`).toBe(true);
        } else {
          expect(typeof t.dispatch.command).toBe('string');
          expect(t.dispatch.command.length).toBeGreaterThan(0);
          // A shell dispatch must be portable: no developer home, no absolute interpreter.
          expect(t.dispatch.command).not.toMatch(/\/Users\/|\/home\/[a-z]/);
          expect(t.dispatch.command).not.toMatch(/^\/bin\/(ba)?sh\b/);
        }
      });
    });
  }

  it('search_ruvnet is the tool the server declares, so the mcp_tool manifest is grounded', () => {
    expect(served.has('search_ruvnet')).toBe(true);
  });

  it('the skills that are NOT manifested are documented as a decision, not an oversight', () => {
    const readme = fs.readFileSync(path.join(CODEX_DIR, 'skills', 'README.md'), 'utf8');
    for (const skipped of ['brain-score', 'brain-build', 'brain-prompt']) {
      expect(readme).toContain(skipped);
      expect(fs.existsSync(path.join(CODEX_DIR, 'skills', skipped, 'skill.toml'))).toBe(false);
    }
  });
});

// ── numeric: the leak class, dead forever ────────────────────────────────────────────────────────
describe('no shipped file leaks a developer path', () => {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'clones', 'models-cache']);
  function walk(dir, out = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.isFile()) out.push(p);
    }
    return out;
  }

  const shipped = [...walk(CODEX_DIR), ...walk(path.join(ROOT, 'plugin'))];

  // A REAL leak names a real account. Prose that TEACHES this bug class has to be able to show the
  // shape it is warning about — plugin/scripts/session-start.sh's comment does exactly that, and
  // learn-capture.sh illustrates the learner with "cd /Users/me/ClientProject". So the guard flags a
  // concrete home directory and allows a short, explicit list of placeholders. Anything not on that
  // list fails, which is what makes it a guard and not a formality.
  const PLACEHOLDERS = new Set(['me', 'you', 'user', 'username', 'someone', 'your-name', '<maintainer>', '<user>', '<you>']);
  const leakedHomes = (src) => [...src.matchAll(/\/Users\/([^/\s"'`)\]]+)\//g)]
    .map((m) => m[1])
    .filter((seg) => !PLACEHOLDERS.has(seg));

  it('there are shipped files to scan (an empty pass proves nothing)', () => {
    expect(shipped.length).toBeGreaterThan(20);
  });

  it('ZERO files under .codex/ or plugin/ ship a real "/Users/<account>/" path', () => {
    const offenders = [];
    for (const f of shipped) {
      let src;
      try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
      const homes = leakedHomes(src);
      if (homes.length) offenders.push(`${path.relative(ROOT, f)} (${[...new Set(homes)].join(', ')})`);
    }
    // Counted, not just asserted: the number is the claim.
    expect(offenders, `leaked developer paths in: ${offenders.join('; ')}`).toHaveLength(0);
  });

  it('the guard CATCHES a reintroduction — proven by running it on the exact line that shipped', () => {
    // The verbatim defect from .codex/hooks.json:9 as it shipped in 3.9.70-dev.
    const asShipped = '"command": "/bin/bash \\"/Users/stuartkerr/Code/ruvnet-brain/plugin/scripts/version-bump-gate.sh\\""';
    expect(leakedHomes(asShipped)).toEqual(['stuartkerr']);
    // …and it does NOT fire on the placeholders that legitimately appear in explanatory comments.
    expect(leakedHomes('# e.g. "cd /Users/me/ClientProject" records "cd"')).toEqual([]);
    expect(leakedHomes('# (/Users/<maintainer>/Code/ruvnet-brain/...) shipped verbatim')).toEqual([]);
    // The file we fixed is clean under the same rule.
    expect(leakedHomes(fs.readFileSync(path.join(CODEX_DIR, 'hooks.json'), 'utf8'))).toEqual([]);
  });

  it('.codex/hooks.json is valid JSON, carries no unrunnable hook, and explains itself', () => {
    const parsed = JSON.parse(fs.readFileSync(path.join(CODEX_DIR, 'hooks.json'), 'utf8'));
    expect(Object.keys(parsed.hooks)).toHaveLength(0);
    // Assert on the STRUCTURE, not the prose: the _note legitimately discusses /bin/bash to explain
    // why the entry is gone. What must be absent is a runnable command, and there are none.
    expect(JSON.stringify(parsed.hooks)).not.toMatch(/command|\/bin\//);
    expect(parsed._note).toMatch(/installer-populated/i);
  });
});
