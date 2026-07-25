/**
 * What we do to ~/.claude/CLAUDE.md — held to the exact promise made in the prompt copy.
 *
 * A user on a corporate machine reported this as "rewrote your global Claude instructions file".
 * Content-wise that was an overstatement — it has always been an append — but the concern was
 * legitimate and two things behind it were real:
 *
 *   1. It wrote the WHOLE file back with writeFileSync (not an append), so an interrupted write
 *      could truncate a file we do not own. Now: backup, then atomic temp+rename.
 *   2. It asked even when the plugin was installed, where the block is pure duplication of what
 *      the hooks already do — the old skip-branch message said so itself.
 *
 * These tests run the real exported function against real files in a throwaway HOME.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');
const START = '<!-- ruvnet-brain:start -->';
const END = '<!-- ruvnet-brain:end -->';

let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'claudemd-test-')); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

const claudeMd = () => path.join(home, '.claude', 'CLAUDE.md');

function writeClaudeMd(content) {
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(claudeMd(), content);
}

/** Pretend the Claude Code plugin is installed, by creating the dir the detector looks at. */
function installPluginMarker() {
  const dir = path.join(home, '.claude', 'plugins', 'marketplaces', 'ruvnet-brain', 'plugin', 'commands');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rvbc.md'), '# stub');
}

function runOffer(args = []) {
  const runner = path.join(home, 'runner.mjs');
  fs.writeFileSync(runner, `const m = await import(${JSON.stringify(INSTALLER)});\nawait m.offerClaudeMd();\n`);
  const res = spawnSync(process.execPath, [runner, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, HOME: home, RUVNET_BRAIN_IMPORT_ONLY: '1' },
  });
  return `${res.stdout || ''}${res.stderr || ''}`;
}

const USER_CONTENT = '# My rules\n\nAlways use tabs.\nNever touch prod on a Friday.\n';

describe('~/.claude/CLAUDE.md — append, never replace (corporate-machine report)', () => {
  it('appends at the BOTTOM and preserves every existing byte', () => {
    writeClaudeMd(USER_CONTENT);

    runOffer(['--enhance-claude-md']);

    const after = fs.readFileSync(claudeMd(), 'utf8');
    expect(after.startsWith('# My rules'), 'their content must still lead the file').toBe(true);
    expect(after).toContain('Always use tabs.');
    expect(after).toContain('Never touch prod on a Friday.');
    expect(after.indexOf(START)).toBeGreaterThan(after.indexOf('Never touch prod'));
    expect(after).toContain(END);
  });

  // L5 SURVIVAL (ADR-042 condition 1c, closed 2026-07-24). The compounding loop's last unproven
  // link: a lesson promoted to the user's global instructions (lesson-promote.mjs --apply, the
  // ADR-G008 win-twice block) must survive the brain's update path — whose only CLAUDE.md writer
  // is offerClaudeMd(). Named as its own case, with the REAL block shape, so "promotion survives
  // updates" is a measured claim about the actual artifact, never an inference from the generic
  // append test above.
  it('L5: a promoted cross-project-lessons block survives the update path intact', () => {
    const promo = '## Cross-project lessons (promoted 2026-07-24)\n\n' +
      '- **Prove it works before calling it done** — taught 88 times across 19 independent projects.\n' +
      '- **Use the real tool; never hand-roll a substitute** — taught 5 times across 3 independent projects.\n';
    writeClaudeMd('# My rules\n\n' + promo + '\nTail the user typed after promotion.\n');

    runOffer(['--enhance-claude-md']);

    const after = fs.readFileSync(claudeMd(), 'utf8');
    expect(after).toContain(promo); // the promoted block, byte-for-byte
    expect(after.indexOf(promo), 'promotion stays ABOVE the appended brain block').toBeLessThan(after.indexOf(START));
    expect(after).toContain('Tail the user typed after promotion.');
  });

  it('backs the file up before touching it', () => {
    writeClaudeMd(USER_CONTENT);

    runOffer(['--enhance-claude-md']);

    const backups = fs.readdirSync(path.join(home, '.claude')).filter((n) => n.startsWith('CLAUDE.md.bak-'));
    expect(backups.length, 'a backup of the original must exist').toBe(1);
    expect(fs.readFileSync(path.join(home, '.claude', backups[0]), 'utf8')).toBe(USER_CONTENT);
  });

  it('leaves no temp file behind (the atomic write cleans up after itself)', () => {
    writeClaudeMd(USER_CONTENT);

    runOffer(['--enhance-claude-md']);

    const strays = fs.readdirSync(path.join(home, '.claude')).filter((n) => n.includes('ruvnet-tmp'));
    expect(strays).toEqual([]);
  });

  it('is idempotent — running twice never duplicates the block', () => {
    writeClaudeMd(USER_CONTENT);

    runOffer(['--enhance-claude-md']);
    runOffer(['--enhance-claude-md']);

    const after = fs.readFileSync(claudeMd(), 'utf8');
    expect(after.split(START).length - 1, 'exactly one block').toBe(1);
  });

  it('does NOT touch the file at all when the plugin is installed (the block would be redundant)', () => {
    writeClaudeMd(USER_CONTENT);
    installPluginMarker();

    runOffer(['--enhance-claude-md']);

    expect(fs.readFileSync(claudeMd(), 'utf8'), 'unchanged when it adds nothing').toBe(USER_CONTENT);
  });

  it('does nothing without an explicit flag — `-y` alone must not edit their file', () => {
    writeClaudeMd(USER_CONTENT);

    runOffer(['-y']); // no TTY, no --enhance-claude-md

    expect(fs.readFileSync(claudeMd(), 'utf8')).toBe(USER_CONTENT);
  });

  it('creates a valid file when the user has no CLAUDE.md yet', () => {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });

    runOffer(['--enhance-claude-md']);

    const after = fs.readFileSync(claudeMd(), 'utf8');
    expect(after).toContain(START);
    expect(after).toContain(END);
    expect(after.trim().startsWith(START), 'a fresh file is just the block').toBe(true);
  });
});
