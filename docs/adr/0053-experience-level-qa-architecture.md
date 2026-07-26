---
id: ADR-053
title: Experience-level QA — test the journey a user actually has, on every host, OS, and install path
status: Proposed
date: 2026-07-26
updated: 2026-07-26
authors: [Stuart Kerr, Claude Code]
tags: [qa, testing, experience, cross-platform, codex, agentic-qe, ci]
supersedes: []
relates: [ADR-028, ADR-050, ADR-051]
governs:
  - tests/experience/
  - .github/workflows/ci.yml
  - scripts/qe/
---

# ADR-053: Experience-level QA

**Status**: Proposed
**Date**: 2026-07-26
**Related**: ADR-028 (test classes), ADR-050 (issue pipeline), ADR-051 (Codex wiring)

## Context — the owner's mandate, verbatim in spirit

Issues #42 and #43 (Henrik Pettersen) were both the same failure at different layers: everything
worked **on the machine that built it** and was dead on the surface a real user touched. #42: the
server shipped, the Codex registration didn't. #43: the registration code shipped, the npm tarball
didn't carry its file. Both passed 1,700 unit tests, because every test exercised the source
checkout. Separately, CI ran red for five days (2026-07-21 → 26) on Windows-only and
fresh-checkout-only failures — meaning the suite was structurally blind to two of the three OSes
and to every machine that is not the author's Mac.

The owner's standing instruction (2026-07-26): *don't just fix the issue — zoom out. The test
surface must be larger, more mature, and aimed at the **experience**: Claude Code and Codex, Mac
and Linux and Windows, every install path a real user takes. Hundreds of people use this; one bad
experience and they delete it.*

This ADR is that zoom-out. ADR-028's five test classes (low/medium/high/numeric/qualitative)
remain the grammar of individual tests; this ADR adds the missing **dimension**: whose machine,
which host, which artifact, which journey.

## Decision

### 1. The experience matrix is the unit of coverage

Coverage is counted in **scenarios**, not lines. A scenario is one cell of:

| Axis | Values |
|---|---|
| **Host** | Claude Code plugin · Codex (`~/.codex/config.toml` + MCP) |
| **OS** | macOS (dev) · ubuntu (CI) · windows (CI) |
| **Artifact** | npm registry tarball · `npx github:` checkout · marketplace clone · `--update` release bundle |
| **Journey** | install → doctor → first grounded answer → configure → update → uninstall-clean |

Not every cell is reachable in CI (no real Claude Code binary on a runner); every cell must be
**classified**: `gated` (a real automated test), `probed` (a cheaper structural check, e.g. the
tarball manifest), or `manual` (documented, with the doctor as the user-side instrument). A cell
silently in no class is the defect this ADR exists to kill — the report script fails if the matrix
has an unclassified cell.

### 2. Artifact-first testing (the #43 rule, generalized)

Any test that can run against a **built artifact** must not run against the checkout.
`tests/unit/npm-tarball-codex.test.mjs` is the pattern: `npm pack` → unpack → exercise with
default resolution. This extends to: the release bundle (unzip → doctor → forge-ask round trip)
and the marketplace layout (plugin dir → hooks.json paths resolve). The checkout is where bugs
hide; the artifact is what users receive.

### 3. Journey tests live in `tests/experience/`

A new suite, `vitest run tests/experience`, one file per journey stage, each hermetic (builds its
own fixture home, never reads the developer's machine — the console-honesty lesson, 2026-07-26).
Stage tests assert **user-visible outcomes** ("`--doctor` prints Codex: wired within 30s", "a
fresh install answers one grounded question with a citation"), not internals. CI runs it on ubuntu
AND windows; the pre-push path runs it on macOS — three OSes on every ship.

### 4. agentic-qe is the generator and the auditor, with a hard budget

The fleet's role (grounded in `agentic-qe/src/mcp/tools/index.ts`): `qe/tests/generate` for
scenario drafts against the matrix, `qe/coverage/gaps` (risk-weighted) to rank unclassified
cells, quality-criteria recommendation (HTSM) once per quarter to challenge the matrix's axes.
Generated tests are **reviewed and committed as ordinary code** — the fleet proposes, the repo's
gates dispose. Budget rule (the $1,600 lesson, agentic-qe#557): fleet runs are local/subscription
only, capped, never an unattended API loop.

### 5. CI is the arbiter, and red CI blocks shipping — mechanically

The 5-day red streak shipped six releases past a red required check because release.mjs never
asked CI. Gate C++ (new): `release.mjs --publish` queries the latest completed `ci` run on
origin/main and refuses to publish while it is red or missing. A human can still ship a hotfix
with an explicit `--ci-override "<reason>"` that is printed into the release log.

## DDD sketch (bounded contexts)

- **Artifact** context: builds/unpacks the four artifact kinds; owns "what did the user receive".
  Aggregate: `Artifact` (kind, version, byte manifest). Invariant: assembled only from published
  or packed bytes, never the checkout.
- **Journey** context: drives a stage against an Artifact in a fixture Home. Aggregate:
  `Scenario` (host, os, artifact, stage) with a `classification` (gated/probed/manual). Domain
  event: `ScenarioVerdict` (pass/fail/skip + evidence line).
- **Matrix** context: the report script folds `ScenarioVerdict`s into the matrix; invariant: no
  unclassified cell. This is the surface the owner reads.
- Anti-corruption: journey tests speak to the product only through its public faces (CLI flags,
  doctor output, MCP protocol, files a user can see) — never by importing internals.

## Consequences

- Ship time grows by the experience suite's runtime (target < 90s on CI; artifact builds cached).
- Windows and ubuntu become first-class: any journey stage that cannot run on an OS must carry an
  explicit `probed`/`manual` classification with a reason, visible in the matrix report.
- The doctor (`--doctor`) doubles as the manual-cell instrument, so "manual" still has a check a
  real user can run and paste.
- ADR-028's classes apply within each journey test; nothing about existing suites changes.

## Rollout

- **Phase 1 (now)**: matrix report script + `tests/experience/` with the highest-risk gated
  cells — npm-artifact × {install, doctor, codex-wire} on all three OSes; release bundle × doctor
  probe; gate C++ in release.mjs. Adversarial duel (F5 × GPT-5.6) on this ADR before Accepted.
- **Phase 2**: `npx github:` + marketplace artifact cells; uninstall-clean stage; aqe
  `qe/coverage/gaps` pass to rank remaining cells.
- **Phase 3**: quarterly HTSM criteria review via aqe; flaky-detection on the experience suite.
