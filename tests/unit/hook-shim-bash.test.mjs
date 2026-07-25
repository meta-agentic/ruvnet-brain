// hook-shim-bash.test.mjs — resolveBash()/skipNoBash() (issue #38: hook-shim.mjs hard-coded
// /bin/bash, so every bash-interpreter hook ENOENT'd on Windows). Unit-tests the resolver
// directly (env/platform/fs/spawnSync are all injectable — see hook-shim-bash.mjs) rather than
// spawning a subprocess, so win32 behavior is exercised from any host OS. The existing
// hook-shim.test.mjs subprocess suite is untouched.
//
// Based on the tested patch contributed by @tkmeownow in #38.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveBash, skipNoBash } from '../../plugin/scripts/hook-shim-bash.mjs';

describe('resolveBash — POSIX', () => {
  it('always returns /bin/bash on non-win32, regardless of env', () => {
    expect(resolveBash({}, 'darwin')).toBe('/bin/bash');
    expect(resolveBash({ RUVNET_BRAIN_BASH: 'C:\\nope\\bash.exe' }, 'linux')).toBe('/bin/bash');
  });
});

describe('resolveBash — win32', () => {
  it('finds Git for Windows at the standard %ProgramFiles% location', () => {
    const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
    const env = { ProgramFiles: 'C:\\Program Files' };
    const deps = { existsSync: (p) => p === gitBash, spawnSync: () => { throw new Error('should not reach PATH search'); } };
    expect(resolveBash(env, 'win32', deps)).toBe(gitBash);
  });

  it('prefers RUVNET_BRAIN_BASH override over every other candidate', () => {
    const custom = 'D:\\tools\\my-bash.exe';
    const env = { RUVNET_BRAIN_BASH: custom, ProgramFiles: 'C:\\Program Files' };
    const deps = { existsSync: (p) => p === custom || p === 'C:\\Program Files\\Git\\bin\\bash.exe' };
    expect(resolveBash(env, 'win32', deps)).toBe(custom);
  });

  it('falls back to CLAUDE_CODE_GIT_BASH_PATH when no plugin-scoped override is set', () => {
    const ccBash = 'C:\\Users\\me\\AppData\\Local\\Programs\\ClaudeCode\\bash.exe';
    const env = { CLAUDE_CODE_GIT_BASH_PATH: ccBash };
    const deps = { existsSync: (p) => p === ccBash };
    expect(resolveBash(env, 'win32', deps)).toBe(ccBash);
  });

  it('falls back to PATH via where.exe when no env override or standard install exists', () => {
    const pathBash = 'C:\\tools\\msys64\\usr\\bin\\bash.exe';
    const env = {};
    const deps = {
      existsSync: (p) => p === pathBash,
      spawnSync: () => ({ stdout: `${pathBash}\r\n` }),
    };
    expect(resolveBash(env, 'win32', deps)).toBe(pathBash);
  });

  it('excludes WSL bash.exe under System32 from the where.exe PATH search', () => {
    const wslBash = 'C:\\Windows\\System32\\bash.exe';
    const gitBash = 'C:\\tools\\Git\\bin\\bash.exe';
    const env = {};
    const deps = {
      existsSync: (p) => p === wslBash || p === gitBash,
      // where.exe lists WSL's shim first, as it typically does — the real one must still win.
      spawnSync: () => ({ stdout: `${wslBash}\r\n${gitBash}\r\n` }),
    };
    expect(resolveBash(env, 'win32', deps)).toBe(gitBash);
  });

  it('returns null when nothing is found anywhere (env, standard locations, PATH)', () => {
    const env = {};
    const deps = { existsSync: () => false, spawnSync: () => ({ stdout: '' }) };
    expect(resolveBash(env, 'win32', deps)).toBeNull();
  });

  it('returns null (never throws) when where.exe itself is unavailable', () => {
    const env = {};
    const deps = {
      existsSync: () => false,
      spawnSync: () => { throw new Error('spawnSync where.exe ENOENT'); },
    };
    expect(resolveBash(env, 'win32', deps)).toBeNull();
  });

  it('returns null when where.exe finds only a System32 (WSL) match', () => {
    const wslBash = 'C:\\Windows\\System32\\bash.exe';
    const env = {};
    const deps = { existsSync: (p) => p === wslBash, spawnSync: () => ({ stdout: `${wslBash}\r\n` }) };
    expect(resolveBash(env, 'win32', deps)).toBeNull();
  });
});

describe('skipNoBash', () => {
  let brainHome;
  beforeEach(() => { brainHome = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-nobash-')); });
  afterEach(() => { fs.rmSync(brainHome, { recursive: true, force: true }); });

  it('returns 0 (never blocks the turn) whether or not a notice was already shown', () => {
    const orig = process.stderr.write;
    process.stderr.write = () => true; // silence the expected once-only notice for this assertion
    try {
      expect(skipNoBash(brainHome)).toBe(0);
      expect(skipNoBash(brainHome)).toBe(0);
    } finally {
      process.stderr.write = orig;
    }
  });

  it('writes the once-only marker file on first call', () => {
    const orig = process.stderr.write;
    process.stderr.write = () => true;
    try {
      expect(fs.existsSync(path.join(brainHome, '.no-bash-notice-shown'))).toBe(false);
      skipNoBash(brainHome);
      expect(fs.existsSync(path.join(brainHome, '.no-bash-notice-shown'))).toBe(true);
    } finally {
      process.stderr.write = orig;
    }
  });

  it('emits the stderr notice once, not on every call', () => {
    const orig = process.stderr.write;
    const lines = [];
    process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
    try {
      skipNoBash(brainHome);
      skipNoBash(brainHome);
      skipNoBash(brainHome);
    } finally {
      process.stderr.write = orig;
    }
    const notices = lines.filter((l) => l.includes('no bash found'));
    expect(notices.length).toBe(1);
  });
});
