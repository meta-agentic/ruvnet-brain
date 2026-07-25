// hook-shim-bash.mjs — bash resolution for hook-shim.mjs (issue #38).
//
// Pulled out of hook-shim.mjs (which runs CLI dispatch with process.exit at import time,
// making it awkward to unit-test directly) so resolveBash()/skipNoBash() can be exercised
// in isolation with a mocked platform/fs/spawnSync. hook-shim.mjs imports this module; its
// own subprocess tests are unaffected.
//
// Based on the tested patch contributed by @tkmeownow in #38.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Locate a usable bash. POSIX: /bin/bash, as ever. Windows: Git for Windows bash — env override,
 *  standard install locations, then PATH via where.exe. WSL's System32 bash.exe is excluded: it
 *  boots a Linux VM whose filesystem view does not contain this plugin's Windows paths.
 *  `env`/`platform`/`deps` are injectable so this can be unit-tested for win32 behavior from any
 *  host OS; production callers use the defaults (real process.env/platform/fs/spawnSync). */
export function resolveBash(env = process.env, platform = process.platform, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const spawn = deps.spawnSync || spawnSync;
  if (platform !== 'win32') return '/bin/bash';
  const candidates = [
    env.RUVNET_BRAIN_BASH,
    env.CLAUDE_CODE_GIT_BASH_PATH,
    path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.win32.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    env.LOCALAPPDATA ? path.win32.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : null,
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (existsSync(c)) return c; } catch { /* keep looking */ }
  }
  try {
    const r = spawn('where.exe', ['bash.exe'], { encoding: 'utf8' });
    for (const line of String(r.stdout || '').split(/\r?\n/)) {
      const p = line.trim();
      if (p && !/\\system32\\/i.test(p) && existsSync(p)) return p;
    }
  } catch { /* no where.exe result */ }
  return null;
}

/** No usable bash on this machine. Skip the hook — an unsupported platform must not turn every
 *  tool call into an error. Notice is emitted once (marker file), not per invocation. */
export function skipNoBash(brainHome) {
  const marker = path.join(brainHome, '.no-bash-notice-shown');
  if (!fs.existsSync(marker)) {
    try {
      fs.mkdirSync(brainHome, { recursive: true });
      fs.writeFileSync(marker, new Date().toISOString() + '\n');
    } catch { /* best effort */ }
    process.stderr.write('[hook-shim] no bash found — bash-based hooks are disabled on this machine (install Git for Windows, or set RUVNET_BRAIN_BASH to a bash.exe, to enable them)\n');
  }
  return 0;
}
