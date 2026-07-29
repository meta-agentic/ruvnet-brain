import fs from 'node:fs';
import path from 'node:path';

/**
 * Stage one scenario's assembled `--local` bundle into the packed install.
 *
 * Scenarios share the installed package directory, so this must replace the
 * previous scenario's bundle rather than merge into it. A merge can preserve a
 * healthy scenario's files and silently repair the seeded-broken fixture.
 */
export function stageLocalBundle(sourceDir, installedDir) {
  const targetDir = path.join(installedDir, 'dist', 'ruvnet-brain');
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  return targetDir;
}
