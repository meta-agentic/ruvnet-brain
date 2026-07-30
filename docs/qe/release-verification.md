# Release verification

This stored QE suite checks the release artifact rather than trusting the source checkout.

Run:

```bash
npx vitest run --config tests/qe/release/vitest.config.mjs
```

The suite verifies:

- GitHub tags and releases are bound to the exact candidate SHA before npm changes.
- Bundle construction and signing precede publication; channel verification is last.
- The release carries the zip, detached signature, and SHA-256 digest.
- A retry reuses the same tag, replaces assets with `--clobber`, and tolerates an already-published npm version.
- A durable release transaction distinguishes `github-published-npm-pending` from fully converged channels.
- The transaction binds the signed bundle digest and refuses changed bytes for the same tag and SHA.
- An unfinished transaction for another candidate blocks a new release instead of being overwritten.
- Retrying a pending candidate reuses its verified signed assets instead of rebuilding timestamped bundle bytes.
- `npm pack` contains the Claude and Codex runtime surfaces while excluding repository-local agents, tests, state, and secrets.
- A clean Codex home is wired from the unpacked tarball and a retry is byte-idempotent.
- The unpacked Claude marketplace and hook declarations are coherent and parseable.
- A stale Stable Spine generation is replaced, a failed candidate preserves the active generation, and rollback/retry paths remain usable.
- A same-version retry is a no-op only for identical payload bytes; changed bytes under the active version are rejected as a collision.

The transaction and same-version retry assertions are deliberately release-blocking. They must not
be weakened into expected failures: a green suite means a partial channel publish is recoverable and
an idempotent update retry still permits rollback to the prior version.

These tests do not publish, push, tag, contact npm publication endpoints, or mutate real user homes.
They complement—not replace—the exact-SHA CI matrix, signed clean-install probe, and live channel
walk performed by the release gate.
