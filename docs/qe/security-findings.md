# Release security fault-injection findings

Updated: 2026-07-29

The stored suite is `tests/qe/security/release-abuse-cases.test.mjs`. It exercises the real updater,
archive extractor, signature verifier, and coexistence scanner with hostile inputs.

## Closed in this release candidate

- Stable Spine version traversal and command-shaped version strings fail before deletion or copy.
- Payload-root and nested symlinks fail closed.
- Broken candidates leave the prior generation active.
- ZIP extraction has explicit archive, central-directory, entry-count, per-entry, total-output, and
  compression-ratio ceilings. Deceptive expansion is interrupted and its temporary output removed.
  Archive symlinks are rejected before extraction, preventing symlink-ancestor destination escapes.
- The host updater passes an allowlisted environment to downloaded package code; API keys, GitHub
  tokens, and cloud secrets are not inherited.
- Ed25519 verification rejects missing, wrong-key, and tampered signatures.
- Foreign hooks are enumerated as data and are never executed by diagnostics.

## Open release decision

DDD-0003 INV-5 says every unattended apply requires a product Ed25519 signature. The host package
path currently relies on npm registry integrity plus exact installed-version and structural gates;
an npm package cannot verify itself before npm executes its entrypoint. Reconcile that invariant
explicitly without claiming a product signature exists on a surface that does not carry one.

## Commands

```sh
npx vitest run --config tests/qe/security/vitest.config.mjs
npx vitest run tests/unit/update-apply.test.mjs tests/unit/zip-extract.test.mjs
npm audit --omit=dev
npm pack --dry-run --json
git diff --check
```
