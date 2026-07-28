// tests/unit/zip-extract.test.mjs
//
// kb/zip-extract.mjs replaced a shelled-out `unzip` in the two places this product extracts an
// archive (bin/install.mjs unzipInto, kb/forge-update.mjs --apply), because on Windows the binary is
// either absent (PowerShell) or present-and-broken by backslash paths reaching an MSYS2 build
// through cmd.exe — both measured on the stranger-machine matrix.
//
// Swapping a battle-tested extractor for our own is only defensible if the replacement is held to
// the original's OUTPUT, so the central test here is a byte-for-byte differential against `unzip`
// itself on a real archive: same tree, same sizes, same 0755/0644 modes, same symlinks. The rest
// assert the property the task cares about most — that a bad archive fails LOUDLY, naming the
// offending entry, rather than quietly leaving a half-empty directory behind.
//
// The differential and mode/symlink cases need the `zip`/`unzip` CLIs, so they skip where those do
// not exist (Windows runners). The corruption, truncation and zip-slip cases build their inputs
// from a zip made by the same `zip` CLI, so they carry the same guard. Nothing here is asserted
// about Windows behaviour — that is stated in the change's report as reasoned-from-source, not run.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { extractZip } = await import(path.join(ROOT, 'kb', 'zip-extract.mjs'));

const hasTool = (t) => spawnSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32' ? [t] : ['-c', `command -v -- ${t}`], { stdio: 'ignore' }).status === 0;
const CAN_ZIP = hasTool('zip') && hasTool('unzip');

let tmp;
let goodZip;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-zipx-'));
  if (!CAN_ZIP) return;
  const stage = path.join(tmp, 'stage');
  const src = path.join(stage, 'ruvnet-brain');
  fs.mkdirSync(path.join(src, 'nested', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(src, 'forge-mcp-all.mjs'), '// mcp\n'.repeat(5000)); // compresses well
  fs.writeFileSync(path.join(src, 'empty.txt'), ''); // zero-length entry: no data range to stream
  fs.writeFileSync(path.join(src, 'nested', 'deep', 'a.json'), JSON.stringify({ b: 'x'.repeat(300) }));
  // Incompressible bytes, so at least one entry is genuinely stored rather than deflated.
  fs.writeFileSync(path.join(src, 'bin.dat'), Buffer.from(Array.from({ length: 200_000 }, (_, i) => (i * 7919) % 256)));
  fs.writeFileSync(path.join(src, 'exec.sh'), '#!/bin/sh\necho hi\n');
  fs.chmodSync(path.join(src, 'exec.sh'), 0o755);
  fs.symlinkSync('forge-mcp-all.mjs', path.join(src, 'link.mjs'));
  goodZip = path.join(tmp, 'good.zip');
  execFileSync('zip', ['-q', '-r', '-y', goodZip, 'ruvnet-brain'], { cwd: stage });
});

afterAll(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

/** Everything about a tree that a user would notice if the extractor got it wrong. */
function describeTree(root) {
  const acc = [];
  const rec = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) acc.push(`L ${r} -> ${fs.readlinkSync(p)}`);
      else if (e.isDirectory()) { acc.push(`D ${r}`); rec(p, r); }
      else {
        const st = fs.statSync(p);
        const sha = createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
        acc.push(`F ${r} size=${st.size} mode=${(st.mode & 0o777).toString(8)} sha=${sha}`);
      }
    }
  };
  rec(root, '');
  return acc.join('\n');
}

describe.skipIf(!CAN_ZIP)('kb/zip-extract.mjs matches the `unzip` it replaced', () => {
  it('produces a tree byte-for-byte identical to `unzip -q -o`, including modes and symlinks', async () => {
    const mine = path.join(tmp, 'out-node');
    const theirs = path.join(tmp, 'out-unzip');
    const res = await extractZip(goodZip, mine);
    execFileSync('unzip', ['-q', '-o', goodZip, '-d', theirs]);
    expect(describeTree(mine)).toBe(describeTree(theirs));
    // The gate must not pass vacuously on an empty tree.
    expect(res.files).toBeGreaterThan(3);
  });

  it('is idempotent — extracting twice over itself matches extracting once (the `-o` of unzip -o)', async () => {
    const dest = path.join(tmp, 'out-twice');
    await extractZip(goodZip, dest);
    const once = describeTree(dest);
    await extractZip(goodZip, dest);
    expect(describeTree(dest)).toBe(once);
  });
});

describe.skipIf(!CAN_ZIP)('a bad archive fails LOUDLY, naming what was wrong', () => {
  it('corrupt compressed bytes -> throws, naming the archive AND the entry (never a silent empty dir)', async () => {
    const bad = path.join(tmp, 'bad.zip');
    const buf = fs.readFileSync(goodZip);
    for (let i = 200; i < 260; i++) buf[i] ^= 0xff; // damage payload, leave the central directory intact
    fs.writeFileSync(bad, buf);
    let err = null;
    try { await extractZip(bad, path.join(tmp, 'out-bad')); } catch (e) { err = e; }
    expect(err, 'a corrupt archive must throw — extracting nothing and returning success is the failure mode this guards').not.toBeNull();
    expect(err.message).toContain(bad); // the archive is named
    expect(err.message).toMatch(/entry "[^"]+"/); // the offending entry is named
    expect(err.message).toMatch(/corrupt|inflate|CRC/i);
  });

  it('a truncated archive throws rather than extracting a partial tree', async () => {
    const trunc = path.join(tmp, 'trunc.zip');
    fs.writeFileSync(trunc, fs.readFileSync(goodZip).subarray(0, 400));
    await expect(extractZip(trunc, path.join(tmp, 'out-trunc'))).rejects.toThrow(/not a zip archive|truncated/i);
  });

  it('refuses an entry that would escape the destination (zip-slip)', async () => {
    const slipStage = path.join(tmp, 'slip');
    fs.mkdirSync(path.join(slipStage, 'x'), { recursive: true });
    fs.writeFileSync(path.join(slipStage, 'x', 'evil'), 'pwn');
    const slipZip = path.join(tmp, 'slip.zip');
    execFileSync('zip', ['-q', slipZip, 'x/evil'], { cwd: slipStage });
    // Rewrite the stored name in both headers to a traversal of the SAME byte length.
    const sb = fs.readFileSync(slipZip);
    const from = Buffer.from('x/evil');
    const to = Buffer.from('../evi');
    let idx = 0;
    let hits = 0;
    while ((idx = sb.indexOf(from, idx)) !== -1) { to.copy(sb, idx); idx += to.length; hits++; }
    expect(hits, 'the fixture must actually contain a traversal name, or this test guards nothing').toBeGreaterThan(0);
    fs.writeFileSync(slipZip, sb);
    const dest = path.join(tmp, 'out-slip');
    await expect(extractZip(slipZip, dest)).rejects.toThrow(/escape the destination|zip-slip/i);
    expect(fs.existsSync(path.join(path.dirname(dest), 'evi'))).toBe(false);
  });
});

describe('the extractor refuses, by name, what it does not implement', () => {
  it('names the file when handed something that is not a zip at all', async () => {
    const junk = path.join(tmp, 'junk.bin');
    fs.writeFileSync(junk, Buffer.alloc(5000, 0x41));
    await expect(extractZip(junk, path.join(tmp, 'out-junk'))).rejects.toThrow(/junk\.bin: not a zip archive/);
  });

  it('names the file when handed a zero-byte archive', async () => {
    const empty = path.join(tmp, 'empty.zip');
    fs.writeFileSync(empty, Buffer.alloc(0));
    await expect(extractZip(empty, path.join(tmp, 'out-empty'))).rejects.toThrow(/empty\.zip: archive is empty/);
  });
});
