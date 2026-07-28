import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function submodulePaths(repoDir) {
  const gitmodules = path.join(repoDir, '.gitmodules');
  if (!fs.existsSync(gitmodules)) return [];
  let output = '';
  try {
    output = execFileSync(
      'git',
      ['config', '-f', gitmodules, '--get-regexp', '^submodule\\..*\\.path$'],
      { encoding: 'utf8' },
    );
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  return output.trim().split('\n').filter(Boolean).map((line) => line.replace(/^\S+\s+/, ''));
}

export function withSubmoduleSymlinksDetached(repoDir, operation) {
  const detached = [];
  for (const relativePath of submodulePaths(repoDir)) {
    const absolutePath = path.join(repoDir, relativePath);
    let stat;
    try {
      stat = fs.lstatSync(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isSymbolicLink()) continue;
    detached.push({ absolutePath, target: fs.readlinkSync(absolutePath) });
    fs.unlinkSync(absolutePath);
  }

  try {
    return operation();
  } finally {
    for (const { absolutePath, target } of detached) {
      if (fs.existsSync(absolutePath)) {
        const stat = fs.lstatSync(absolutePath);
        if (!stat.isDirectory() || fs.readdirSync(absolutePath).length > 0) {
          throw new Error(`cannot restore submodule symlink over non-empty path: ${absolutePath}`);
        }
        fs.rmdirSync(absolutePath);
      }
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.symlinkSync(target, absolutePath);
    }
  }
}
