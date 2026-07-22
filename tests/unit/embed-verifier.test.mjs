// tests/unit/embed-verifier.test.mjs — the installer must be able to write kb/verify-citation.mjs
// into a KB bundle that predates it (bundles published before 2026-07-09 lack the file, and telling
// those users "grounding not verifiable — re-run the installer" would send them in a circle).
//
// HOW THIS USED TO WORK, AND WHY IT CHANGED (ADR-038, 2026-07-22): install.mjs carried the module as
// a ~4KB base64 literal, decoded it at runtime, wrote it to disk as .mjs, and dynamically imported
// it. That is the canonical staged-payload chain — an EDR scores write-then-execute on a file the
// same process just created as high-confidence dropper behaviour, and a security reviewer greps the
// installer, finds a long encoded blob being decoded and executed, and reaches for the phone. The
// innocent explanation is real, but it arrives after the alarm.
//
// The capability is now a plain file copy from the shipped package. These tests guard the invariants
// that make that work — and, critically, they FAIL if the dropper pattern is ever reintroduced.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installSrc = fs.readFileSync(path.join(ROOT, 'bin', 'install.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERIFIER_REL = 'kb/verify-citation.mjs';

describe('verifier ships as a file, not an embedded payload', () => {
  it('kb/verify-citation.mjs exists on disk', () => {
    expect(fs.existsSync(path.join(ROOT, VERIFIER_REL))).toBe(true);
  });

  // Without this, `npx ruvnet-brain` installs a package whose installer copies a file that was never
  // published — ensureVerifier() silently returns 'unavailable' and --doctor loses grounding proof.
  it('is actually published: covered by package.json files[]', () => {
    const files = pkg.files || [];
    const covered = files.some((f) => f === VERIFIER_REL || f === 'kb/' || f === 'kb');
    expect(covered, `package.json files[] must publish ${VERIFIER_REL}; got: ${JSON.stringify(files)}`).toBe(true);
  });

  it('ensureVerifier copies the shipped file rather than materialising code', () => {
    expect(installSrc).toMatch(/fs\.copyFileSync\(shipped, p\)/);
  });

  it('still writes into the KB only when absent — a newer bundle copy must win', () => {
    expect(installSrc).toMatch(/function ensureVerifier\(cacheDir\)/);
    expect(installSrc).toMatch(/if \(fs\.existsSync\(p\)\) return 'from-bundle';/);
  });

  it('the shipped module really is the verifier (exports the gate, not some other file)', () => {
    const src = fs.readFileSync(path.join(ROOT, VERIFIER_REL), 'utf8');
    expect(src).toMatch(/export async function verifyGrounding/);
    expect(src).toMatch(/export function parseCitations/);
  });

  // The regression guard with teeth: these are the exact constructs that made the old approach read
  // as malware to a scanner. If someone reintroduces an embedded payload, this fails before it ships.
  it('no base64 payload is decoded and written by the installer', () => {
    expect(installSrc, 'the embedded verifier blob must not come back').not.toMatch(/VERIFY_CITATION_B64/);
    expect(installSrc, 'no decode-then-write chain in the installer').not.toMatch(
      /writeFileSync\([^)]*Buffer\.from\([^)]*'base64'/,
    );
  });

  it('the retired generator is gone, so nothing regenerates the blob', () => {
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'embed-verifier.mjs'))).toBe(false);
    expect(Object.keys(pkg.scripts || {})).not.toContain('embed:verifier');
    expect(Object.keys(pkg.scripts || {})).not.toContain('embed:check');
  });
});
