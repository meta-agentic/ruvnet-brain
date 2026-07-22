// running-version-scope.test.mjs — a dev checkout must never speak for the machine.
//
// THE BUG (2026-07-22, caught by the owner, not by us). `~/.cache/ruvnet-brain/.running-version` is
// the file every project's statusline reads to say which brain version is RUNNING. session-start.sh
// wrote it from `$CLAUDE_PLUGIN_ROOT` — whatever plugin THIS session loaded. In a development
// checkout that is the working tree, so a dev session wrote its uncommitted version into a global
// file, and the owner's OTHER projects displayed the dev tree's version while actually running the
// older installed one. (No literals here: a version literal in any file trips the no-hardcoded-
// version gate — which caught this comment on its first save, correctly.)
//
// He noticed it in a screenshot. We did not, and could not have, because every check we ran was
// from inside the dev repo — the one place the lie is invisible.
//
// It is the same shape as issue #36 (per-CWD ledgers scattered into users' project trees) and the
// same lie the code's own neighbouring comment already warned about: showing a staged version as if
// it were running. The comment was correct and the implementation disagreed with it, which is worse
// than having no comment, because it reads as verified.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const HOOK = path.join(REPO, 'plugin/scripts/session-start.sh');

let home;
beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'runver-')));
  // Pre-seed the rate-limit stamp so the hook never reaches for the network during a test.
  const cache = path.join(home, '.cache', 'ruvnet-brain');
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, '.last-update-check'), String(Math.floor(Date.now() / 1000)));
});
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

/** Build a fake plugin root carrying a given version, at a given location. */
function fakePlugin(root, version) {
  const dir = path.join(root, '.claude-plugin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name: 'ruvnet-brain', version }));
  return root;
}

function runHook(pluginRoot) {
  return spawnSync('bash', [HOOK], {
    cwd: home, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, HOME: home, XDG_CACHE_HOME: path.join(home, '.cache'), CLAUDE_PLUGIN_ROOT: pluginRoot },
  });
}

const runningVersion = () => {
  try { return fs.readFileSync(path.join(home, '.cache/ruvnet-brain/.running-version'), 'utf8').trim(); }
  catch { return null; }
};

describe('.running-version — only a real install may speak for the machine', () => {
  it('an INSTALLED plugin writes the global running version', () => {
    const installed = fakePlugin(path.join(home, '.claude/plugins/marketplaces/ruvnet-brain/plugin'), '9.9.9-installed');
    const r = runHook(installed);
    expect(r.status).toBe(0);
    expect(runningVersion(), 'a real install must record what it is running').toBe('9.9.9-installed');
  });

  it('a DEV CHECKOUT does NOT overwrite the global running version', () => {
    // The exact scenario that misled the owner: a session in the development repo, whose working
    // tree is ahead of the installed copy.
    const installed = fakePlugin(path.join(home, '.claude/plugins/marketplaces/ruvnet-brain/plugin'), '9.9.9-installed');
    runHook(installed);
    expect(runningVersion()).toBe('9.9.9-installed');

    const dev = fakePlugin(path.join(home, 'Code/ruvnet-brain/plugin'), '9.9.9-devtree');
    const r = runHook(dev);
    expect(r.status).toBe(0);
    expect(runningVersion(), 'a dev checkout must NOT claim to be what the machine is running').toBe('9.9.9-installed');
  });

  it('a dev checkout still records itself, separately and unambiguously', () => {
    // Visible, but never mistakable for the machine-wide answer — silence would hide a real fact,
    // and this project's rule is that unknown and off are different states.
    const dev = fakePlugin(path.join(home, 'Code/ruvnet-brain/plugin'), '9.9.9-devtree');
    runHook(dev);
    const devFile = path.join(home, '.cache/ruvnet-brain/.dev-version');
    expect(fs.existsSync(devFile)).toBe(true);
    expect(fs.readFileSync(devFile, 'utf8').trim()).toBe('9.9.9-devtree');
    expect(runningVersion(), 'and it still must not have written the global file').toBeNull();
  });
});
