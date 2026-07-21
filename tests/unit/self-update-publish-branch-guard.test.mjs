// tests/unit/self-update-publish-branch-guard.test.mjs — the nightly must never commit to
// whatever branch happens to be checked out.
//
// Real failure (2026-07-19/20): the nightly fired at 03:15 while feat/meta-proxy-passthrough was
// checked out (a developer mid-task — exactly how this was discovered), and scripts/self-update.mjs's
// `--publish` block's `git commit` + `git push origin main` landed commit 4a10833 "Nightly brain
// refresh v3.4.21-dev" on THAT branch instead of main — a version-bump commit no release will ever
// be cut from, silently mixed into someone's unrelated in-progress work. Confirmed live: 4a10833 is
// NOT an ancestor of main (`git merge-base --is-ancestor 4a10833 main` → false) and only reachable
// from feat/meta-proxy-passthrough.
//
// Fix (see scripts/self-update.mjs, right after flag parsing): refuse to proceed with --publish
// unless HEAD is exactly `main` — checked BEFORE any rebuild work, GitHub Release, or npm publish
// step runs. Deliberately does NOT `git checkout main` to self-correct (that could clobber a
// developer's uncommitted work on whatever branch is checked out — the "clever and destructive"
// move the repo's own CLAUDE.md Rule 19 already warns against, re: defensive wrappers that cause
// the exact failure they're meant to guard against). It aborts loudly instead.
//
// This IS genuinely testable without running a real nightly: the guard fires immediately after
// argument parsing, before self-update.mjs ever reads data/registry.tiers.json, probes a remote, or
// touches the network/npm/GitHub — so a throwaway git repo containing only a copy of the script
// (+ its one relative import, full-hints.mjs) is enough to exercise the real subprocess. No mocking.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SELF_UPDATE_SRC = path.join(REPO_ROOT, 'scripts/self-update.mjs');
const FULL_HINTS_SRC = path.join(REPO_ROOT, 'scripts/full-hints.mjs');

const hasGit = spawnSync('git', ['--version']).status === 0;

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }

// A throwaway repo with self-update.mjs (+ its one relative import) copied in, so ROOT — derived
// inside the script from its OWN file location, not the caller's cwd — resolves to this disposable
// directory and never anywhere near the real ruvnet-brain checkout. An empty-but-valid
// registry.tiers.json lets a main-branch run progress far enough to prove it got PAST the guard
// (rather than merely not crashing for an unrelated reason).
function fixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-update-branch-guard-'));
  execFileSync('git', ['init', '-b', 'main', dir]);
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.copyFileSync(SELF_UPDATE_SRC, path.join(dir, 'scripts/self-update.mjs'));
  fs.copyFileSync(FULL_HINTS_SRC, path.join(dir, 'scripts/full-hints.mjs'));
  fs.writeFileSync(path.join(dir, 'data/registry.tiers.json'),
    JSON.stringify({ tiers: { T0: { repos: [] }, T1: { repos: [] }, T2: { repos: [] }, T3: { repos: [] } } }));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'seed');
  return dir;
}

function runSelfUpdate(dir, args) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts/self-update.mjs'), ...args], {
    encoding: 'utf8', timeout: 15_000,
  });
}

const FATAL_MSG = /requires 'main' to be checked out/;

describe.skipIf(!hasGit || process.platform === 'win32')('self-update.mjs — --publish refuses to run off of anything but main', () => {
  let dir;
  afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

  it('aborts --apply --publish on a feature branch, citing the branch and the real incident, and touches nothing', () => {
    dir = fixtureRepo();
    git(dir, 'checkout', '-b', 'feat/meta-proxy-passthrough');
    const commitsBefore = git(dir, 'rev-list', '--count', 'HEAD').trim();

    const r = runSelfUpdate(dir, ['--apply', '--publish']);

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(FATAL_MSG);
    expect(r.stderr).toMatch(/feat\/meta-proxy-passthrough/);
    expect(r.stderr).toMatch(/4a10833/); // must cite the real incident, not a generic message
    // the whole point of aborting instead of "fixing" it: nothing was touched
    expect(git(dir, 'rev-list', '--count', 'HEAD').trim()).toBe(commitsBefore);
    expect(git(dir, 'branch', '--show-current').trim()).toBe('feat/meta-proxy-passthrough');
  });

  it('does not fire when main is checked out — proceeds past the guard into the real run', () => {
    dir = fixtureRepo(); // fixtureRepo() leaves `main` checked out
    const r = runSelfUpdate(dir, ['--apply', '--publish']);

    expect(r.stderr).not.toMatch(FATAL_MSG);
    // proof of genuine progression past the guard, not a lucky early crash: the plan actually ran
    expect(r.stdout).toMatch(/0 repos in scope/);
  });

  it('does not fire on a feature branch when --publish is absent (plain rebuild runs stay branch-agnostic)', () => {
    dir = fixtureRepo();
    git(dir, 'checkout', '-b', 'feat/some-work');

    const r = runSelfUpdate(dir, ['--apply']);

    expect(r.stderr).not.toMatch(FATAL_MSG);
    expect(r.stdout).toMatch(/0 repos in scope/);
  });

  it('does not fire on a feature branch in dry-run mode (no --apply, even with --publish)', () => {
    dir = fixtureRepo();
    git(dir, 'checkout', '-b', 'feat/some-work');

    const r = runSelfUpdate(dir, ['--publish']);

    expect(r.stderr).not.toMatch(FATAL_MSG);
    expect(r.stdout).toMatch(/dry-run/);
  });
});
