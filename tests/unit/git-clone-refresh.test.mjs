import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { withSubmoduleSymlinksDetached } from '../../scripts/git-clone-refresh.mjs';

const roots = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-clone-refresh-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitmodules'), [
    '[submodule "vendor/shared"]',
    '\tpath = vendor/shared',
    '\turl = https://example.test/shared',
    '',
  ].join('\n'));
  fs.symlinkSync('/tmp/shared-target', path.join(root, 'vendor/shared'));
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('withSubmoduleSymlinksDetached', () => {
  it('detaches declared submodule symlinks during the operation and restores them', () => {
    const root = fixture();
    const link = path.join(root, 'vendor/shared');

    withSubmoduleSymlinksDetached(root, () => {
      expect(fs.existsSync(link)).toBe(false);
    });

    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(link)).toBe('/tmp/shared-target');
  });

  it('restores detached links when the operation fails', () => {
    const root = fixture();
    const link = path.join(root, 'vendor/shared');

    expect(() => withSubmoduleSymlinksDetached(root, () => {
      throw new Error('fetch failed');
    })).toThrow('fetch failed');

    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });
});
