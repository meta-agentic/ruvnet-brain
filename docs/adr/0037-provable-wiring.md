---
id: ADR-037
title: Provable wiring — an exemption must name an invoker the machine can find
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [gates, wiring, release, allowlist, verification, ci]
supersedes: []
relates: [ADR-024, ADR-011, ADR-035]
---

**Status**: Proposed (2026-07-22)

**Related**: ADR-024, ADR-011, ADR-035

---

## 1. What happened

`scripts/wired-check.mjs` shipped on 2026-07-22 (v3.9.5) to end a failure that had recurred seven
times in one session: a module built, tested, and invoked by nothing. Its own header says it plainly:

> *"Seven repetitions of one mistake is not a discipline problem. Discipline is what failed."*

The gate anticipated the obvious way it could die — an allowlist that quietly becomes where unwired
code hides — and required a REASON on every exemption. That was the right instinct. It was also
insufficient, and it failed the same day it shipped.

**Three** exemptions assert an invoker that does not exist:

| Module | Stated reason | Verified |
|---|---|---|
| `check-legibility` | "CI check invoked from the workflow, not from source" | no invoker in `.github/` (5 workflows), no npm script, no ship-path caller |
| `check-indexation` | "CI check invoked from the workflow, not from source" | same |
| `status-honesty` | "CI check invoked from the workflow, not from source" | same |
| ~~`claims-verify`~~ | "run by CI" | **TRUE** — `npm run claims:verify` → `node scripts/claims-verify.mjs` |

The `claims-verify` row is recorded here as a correction, not deleted, because of how it was
produced. The first draft of this ADR listed it as false alongside the other three. The check behind
that verdict grepped `.github/` only; `package.json` was never read for it. **A claim about
unverified claims was itself asserted from a channel incapable of observing the answer** — the same
defect, one level up, inside the document written to name it. It is left visible because an ADR that
quietly edits away its own error teaches nothing.

`docs/CONVENTIONS-AUDIT.md:187` had **already** recorded `check-legibility` as `BUILT, UNWIRED`. The
allowlist entry then asserted the opposite, and closed the case. The audit and the gate disagreed in
writing, in the same repository, and the gate won because the gate is the thing that runs.

A fifth defect, smaller and diagnostic of the same cause: `memory-doctor` appears twice in
`STANDALONE` (lines 50 and 64). A duplicate object key is silently last-wins in JavaScript. Nothing
noticed, because nothing reads the allowlist except a human eye.

## 2. The actual cause — not carelessness

The reasons were not invented to smuggle code through. They were written by someone reasoning
correctly about a gate whose search path they had not read.

`callersOf()` greps these roots only:

```js
base, 'scripts', 'plugin', 'console', 'bin', 'kb',
```

`.github/` is not in that list. Neither is the root `package.json`. So a module invoked **only** by a
GitHub workflow, or **only** by an npm script, is structurally invisible to the scanner and reports
as unwired no matter how thoroughly it is wired.

Faced with a module the gate calls unwired that you believe CI runs, the allowlist is the only door
the gate offers. Four people-moments took that door. **The allowlist absorbed a blind spot in the
scanner and disguised it as a policy decision.** That is the finding: this is not seven-plus-one
instances of sloppiness, it is one missing search path wearing four different sentences.

Which is why the fix is not "be more careful when writing reasons."

## 3. The principle

ADR-024 established that status must be **derived, never asserted**. This is the same principle one
level up, applied to the gate itself:

> **An exemption is a claim. A claim that a machine cannot check is a comment.**

A reason string that says "invoked by CI" reads exactly like verification and performs none. Adding
prose to an allowlist made it *more* convincing without making it *more* true — which is strictly
worse than a bare list, because a bare list at least looks like something nobody checked.

## 4. Options considered

**A — Machine-verify the reason strings.** Parse phrases like "invoked by CI" out of the prose and
confirm an invoker exists.
*Rejected.* Natural-language parsing of a free-text field, where a reworded reason silently stops
being checked. It makes the *prose* load-bearing, which is the defect, not the cure.

**B — Widen the caller search to where callers actually live** (`.github/`, root `package.json`).
*Necessary, not sufficient.* This removes the blind spot: the four entries become provably wired or
correctly fail, on evidence. But it leaves every remaining exemption unverified, so the same class of
false reason can reappear for any module a human claims to run by hand.

**C — Structured exemptions: every entry names its invoker, and the invoker is verified.**
*Chosen, combined with B.* An exemption stops being a sentence and becomes a checkable pair.

Option C alone would fail: without B, a genuinely CI-invoked module still cannot prove itself, and
authors would be forced back into the honest-sounding lie. **B makes truth expressible; C makes it
required.** Neither works without the other, which is why they ship together.

## 5. Decision

1. **Widen `callersOf()`** to search `.github/` and the root `package.json` alongside the existing
   roots — **and simultaneously narrow what counts as a match.**

   Widening alone is unsafe. Measured on this repo, 2026-07-22, simulating the widened search with
   the gate's current bare-basename grep:

   | Module | Spurious match | Why it is not a caller |
   |---|---|---|
   | `prove` | `.github/ISSUE_TEMPLATE/idea.yml:1` | the substring inside "im**prove**ment" |
   | `version` | `.github/dependabot.yml:16` | `version: 2` — Dependabot's own schema version |
   | `version` | 8 files total | the commonest word in a CI config |
   | `release` | `.github/workflows/gists-nightly.yml` | the English word, not `scripts/release.mjs` |

   Bare `grep <basename>` over CI config manufactures callers out of English. A gate that invents
   evidence is worse than one with a blind spot: the blind spot fails closed and annoys you, the
   invented caller fails **open** and reassures you.

   Therefore a caller match must be **invocation-shaped** — `<name>.mjs`, not `<name>` — so the
   match names the file rather than merely containing its letters. This also repairs false positives
   in the *existing* search roots, which have the same flaw today and were never measured.

2. **`STANDALONE` entries become structured**, not free text:
   ```js
   'doc-currency': { invoker: 'package.json',        why: 'gate CLI: npm run doc:currency' },
   'ingest-meeting': { invoker: 'human',             why: 'one-shot ingestion, run deliberately' },
   ```
   - `invoker` naming a **path** is a falsifiable claim: the gate confirms that file exists and
     mentions the module. If it does not, the gate fails and names the lie.
   - `invoker: 'human'` is the honest declaration of something **unprovable by construction** — no
     file invokes it because a person does. It is exempt from proof and must be, but it is now
     *visibly* the unprovable category rather than hiding among checkable ones.

3. **Duplicate keys fail the gate.** The allowlist is parsed for repeats rather than trusted to
   JavaScript's last-wins.

4. **The four false exemptions are removed, not rewritten.** After (1), each is judged on evidence.
   Any that still has no caller is genuinely unwired and must fail — that is the gate working, and
   `check-legibility` is expected to fail, correctly, on first run.

## 6. What this costs, honestly

Wiring `check-legibility` is **not** the "one CI line" that `docs/CONVENTIONS-AUDIT.md:276` estimates.
Playwright is not a devDependency (root dev is `@metaharness/darwin`, `vitest`,
`@vitest/coverage-v8`) and appears nowhere in `.github/`. It needs the dependency plus a browser
install step. Recording that here so the next person does not budget it as trivial, start it, and
abandon it half-wired — which would produce exactly the state this ADR exists to make impossible.

This ADR does **not** wire it. It makes its unwired state undeniable.

## 7. Consequences

- The gate can no longer certify its own blind spot.
- An exemption that stops being true starts failing, instead of aging into folklore.
- `invoker: 'human'` is a small permanent hole, deliberately left open and clearly labelled. A gate
  that admits its one unprovable category is more trustworthy than one that pretends to have none.
- Prose in the allowlist becomes commentary for humans, and stops being mistaken for verification.

## 8. Verification

This ADR is satisfied only when the gate **fails on a known-bad allowlist** — an entry claiming a
path invoker that does not invoke it — and passes on the honest set. A gate that cannot fail on
broken input is not a gate, which is the lesson the original seven incidents already charged us for
once.
