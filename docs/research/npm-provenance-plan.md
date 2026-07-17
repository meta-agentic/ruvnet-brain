Updated: 2026-07-17 | Version 1.0.0
Created: 2026-07-17

# npm provenance plan for `ruvnet-brain`

Research only — **nothing in this document has been executed**. No trusted publisher was registered, no
workflow was added, and no `npm publish` was run as part of this work. This is the plan; a human (Stuart)
still owns clicking "Add trusted publisher" on npmjs.com and merging the workflow.

## Verified facts (checked live, 2026-07-17 — not recalled)

- **`ruvnet-brain` is already published on npm** — currently `2.9.1` (15 versions published,
  `2026-07-04` → `2026-07-15`), *behind* the repo's `package.json` (`3.2.13`). This is a retrofit onto an
  existing package, not a first publish. Confirmed live: `npm view ruvnet-brain version` /
  `npm view ruvnet-brain time --json`.
- **No GitHub Actions workflow publishes today.** `.github/workflows/` has four workflows
  (`ci.yml`, `gists-nightly.yml`, `integration-linux.yml`, `ntfy-alerts.yml`) — none run `npm publish`
  (checked: `grep -n publish .github/workflows/*.yml` matches nothing but a comment). Publishing is a
  manual, local `npm publish` today, almost certainly authenticated with a classic npm token / npm login
  session on Stuart's machine. That token is exactly what trusted publishing removes the need for.
- **`repository.url`** in `package.json` is `git+https://github.com/stuinfla/ruvnet-brain.git` — already
  matches the live npm listing (`npm view ruvnet-brain repository`), which is a hard requirement for
  provenance (npm cross-checks the published repo field against the workflow's actual source repo).
  Nothing to change here.
- **Local npm CLI here is `10.9.2`** (`npm -v`). That is irrelevant to whether trusted publishing works —
  OIDC-based trusted publishing only runs from a CI runner, never from a local machine — but it's a
  reminder that the *CI runner's* npm version is what must clear the bar, not the dev machine's.
- Sources for the requirements below: [npm docs — Trusted publishers](https://docs.npmjs.com/trusted-publishers/),
  [npm docs — Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/),
  [GitHub Changelog — npm trusted publishing with OIDC is GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/),
  fetched live during this work, not recalled from training data.

## Two mechanisms — and which one this plan targets

npm has **two** overlapping features here; it's easy to conflate them.

| | Classic `--provenance` | Trusted publishing (OIDC) |
|---|---|---|
| Auth | Still needs an `NPM_TOKEN` secret in CI | **No token at all** — GitHub's OIDC identity IS the credential |
| Setup | Add `permissions: id-token: write` + `--provenance` flag | Register a "trusted publisher" on npmjs.com first, **then** just `npm publish` (no flag needed — provenance is automatic) |
| npm CLI | 9.5.0+ | **11.5.1+** (checked live in the docs fetch above) |
| Runner | GitHub-hosted only | GitHub-hosted only (self-hosted not yet supported) |
| Private repos | Provenance unavailable either way | Provenance unavailable either way |

**This plan targets trusted publishing**, not classic `--provenance` with a token — for the same reason
this repo already avoids long-lived secrets elsewhere (SOPS+age for other credentials, no keys committed):
a stolen/rotated `NPM_TOKEN` is a real, standing liability; an OIDC trust relationship scoped to one exact
workflow file in one exact repo is not something that can leak, because there is no secret to leak. The
classic flag is noted only as a fallback if the CI runner's bundled npm ever lags behind 11.5.1 and pinning
it (`npm install -g npm@latest` as a workflow step) is undesirable for some reason.

## Exact steps

### 1. Add a dedicated publish workflow (does not exist yet)

Create `.github/workflows/publish.yml` — deliberately **separate** from `ci.yml`, so publishing is an
explicit, reviewable, git-tag-triggered action, not a side effect of every push:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'          # e.g. v3.3.0 — matches this repo's existing version-tag convention
  workflow_dispatch: {} # manual trigger as an escape hatch

permissions:
  contents: read
  id-token: write        # REQUIRED — this is what lets npm trust the run at all

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v6
        with:
          node-version: '22.14'          # >= the floor trusted publishing requires
          registry-url: 'https://registry.npmjs.org'

      # Belt-and-suspenders: pin npm itself past the 11.5.1 floor, independent of whatever
      # the runner image's bundled npm happens to be on a given day.
      - run: npm install -g npm@latest

      - run: npm ci

      - run: npm run test:unit
      - run: npm run version:check
      - run: npm run sbom          # regenerate sbom/ruvnet-brain.cdx.json so the published
                                    # tarball's dependency claim and its SBOM never drift apart

      # No NPM_TOKEN anywhere in this file. With a trusted publisher registered (step 2),
      # `npm publish` authenticates via the workflow's own OIDC identity and provenance is
      # attached automatically — no --provenance flag needed.
      - run: npm publish
```

Notes on choices, so a reviewer can see the reasoning, not just the YAML:
- **Tag-triggered, not push-to-main-triggered.** `package.json` is currently ahead of the last npm
  publish (`3.2.13` vs `2.9.1` live) — a push-triggered publish would have fired on nearly every commit
  in that gap. A tag is the deliberate "publish this" signal, matching how the release *bundle* (the
  512 MB zip, separate from the npm package) already ships via `keys/` + `scripts/sign-bundle.mjs` on a
  release, not on every push.
  `npm run version:check` before publish (already a script here) so a bad version can't ship silently.
- **`npm run sbom` runs in the same job**, right before publish, so `sbom/ruvnet-brain.cdx.json` — if it
  is committed to the release tag alongside the SBOM work in this change — always describes the exact
  tree that's about to go out, not a stale local snapshot.
- **No `--access public` needed** — the package is already published and public; that flag only matters
  on a brand-new scoped package's first publish.

### 2. Register the trusted publisher on npmjs.com

Done once, by whoever has publish rights on the `ruvnet-brain` npm package (currently the `isovisionai`
npm account) — **not** something this workflow file can do for itself; npm requires it be configured on
the package's settings page before the OIDC identity is trusted:

| Field | Value for this repo |
|---|---|
| Organization or user | `stuinfla` *(the GitHub identity — separate from the `isovisionai` npm account; this is the point of confusion to watch for)* |
| Repository | `ruvnet-brain` |
| Workflow filename | `publish.yml` *(filename only, must already exist on the default branch under `.github/workflows/` — so step 1 must land and merge before this step can be completed)* |
| Environment name | leave blank (not using a GitHub deployment environment for this) |
| Allowed actions | `npm publish` *(2026 config requires selecting at least one explicitly)* |

### 3. Verify without publishing

Before the first real tag-triggered publish:
- `workflow_dispatch` the workflow manually on a throwaway pre-release version bump in a fork/branch, OR
- dry-run locally what the workflow will run (`npm run test:unit && npm run version:check && npm run sbom`)
  to confirm none of those steps fail on the current tree — this is the part of the plan safe to execute
  right now, and running it did not publish anything (see Test results in the task report).
- Confirm the resulting package on npmjs.com shows a "Provenance" badge on its page and that
  `npm view ruvnet-brain --json | jq .dist.attestations` (or the npm website's provenance panel) shows a
  Sigstore-backed attestation referencing the exact `publish.yml` run.

### 4. What this does and doesn't cover

- Covers: the **npm package** (`ruvnet-brain` on the public registry — the installer's `npm install -g` /
  `npx ruvnet-brain` path).
- Does **not** cover: the **~500 MB knowledge-bundle zip** attached to GitHub Releases — that already has
  its own, different, already-shipped integrity story (Ed25519 `.sig` + `.sha256` via
  `scripts/sign-bundle.mjs`, described in [`SECURITY.md`](../../SECURITY.md)). The two are separate
  artifacts on separate distribution channels; provenance here doesn't touch the bundle's signing at all.
- Does **not** cover: the **Claude Code plugin** (installed via the marketplace, source `./plugin` in
  `.claude-plugin/marketplace.json`) — that install path is Claude Code's own plugin-marketplace trust
  model, not npm's.

## Open questions for Stuart (not decided here)

1. Who holds/approves changes to the `isovisionai` npm account's trusted-publisher config going forward —
   worth a note in `CONTRIBUTORS.md` or similar so it isn't tribal knowledge.
2. Whether to also retrofit classic `--provenance` as a fallback path in the same workflow (e.g. behind an
   `if: failure()` on the OIDC-trusted publish) for the transition window before the trusted publisher is
   registered — recommendation: no, keep it to one clean path; a fallback that silently uses a stored
   token defeats the point.
3. Whether `npm publish` should also gate on the same design/quality bars other shipped surfaces in this
   repo use (e.g. `substitution:check`, `claims:verify`) before a tag can trigger a real publish — this
   plan only wires `test:unit`, `version:check`, and `sbom` as the minimum that keeps the published
   artifact honest; extending that list is a product decision, not a provenance one.
