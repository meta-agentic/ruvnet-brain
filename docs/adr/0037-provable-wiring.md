---
id: ADR-037
title: The wiring gate cannot fail — fixing the predicate, not the allowlist
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [gates, wiring, release, verification, ci, predicate]
supersedes: []
relates: [ADR-024, ADR-011, ADR-035]
---

**Status**: Proposed (2026-07-22)

**Related**: ADR-024, ADR-011, ADR-035

---

## 0. This ADR was rewritten after review, and the first draft was wrong

The first draft blamed a scanner blind spot and proposed a structured-exemption schema. Adversarial
review by two independent models (GPT-5.6-Sol via codex, Fable 5) converged on the same verdict: the
diagnosis was fabricated, the fix was vacuous, and the real defect was untouched. §6 records what
they killed. The draft's errors are kept visible rather than edited away, because this ADR is about
claims asserted without checking, and silently deleting my own would be the same act.

---

## 1. The finding

**`node scripts/wired-check.mjs` reports 62/62 wired, 0 unwired, exit 0. It has never failed on this
repository.** Measured 2026-07-22.

That is not evidence the repo is clean. It is evidence the gate is close to structurally incapable
of failing, for one reason:

> **`callersOf()` matches any mention of the module's name, anywhere in a scanned file. A comment is
> a caller. A word containing the name as a substring is a caller.**

Verified instances:

| Module | "Caller" | Reality |
|---|---|---|
| `capability-registry` (founding failure #1) | `goal-match.mjs:26,119,272,336`, `capability-audit.mjs:38,203` | six **comments**; one real import at `onboarding-console.mjs:33` |
| `prove` | `release.mjs:8` | the substring inside "**prove**n" |
| `version` | any `"version"` JSON key | a manifest field |
| `console-engine` | `scripts/console-engine.test.mjs:5` | **a test** — the exclusion filters `/tests/` paths, not `*.test.mjs` names |

The last one matters most. The gate's own header, line 29: *"A test is explicitly NOT a caller — that
exclusion is the entire point, because every one of the seven above had passing tests."* That
exclusion is violated in-tree today, by a file sitting in `scripts/`.

And `wired-check.mjs:8` — the gate's header, eulogising the seven original failures by name —
**mentions each of them, and therefore permanently "wires" every name it lists.** The memorial keeps
its own dead alive.

## 2. The real root cause, corrected

The first draft claimed the false allowlist entries were caused by the scanner's search path (no
`.github/`, no root `package.json`), so authors hit a false "unwired" and took the only door offered.

**Git refutes this.** All four entries — and the duplicate `memory-doctor` key at lines 50 and 64 —
are present in `f410282`, the commit that *created* `wired-check.mjs`. Gate and allowlist were
written together, in one commit, by one author. Nobody ever ran the gate, saw a false result, and
reached for an exemption. **The entries were pre-written so the gate would pass on day one.**

That is a materially different failure: not a blind spot, but *assert-without-check* — the exact
ADR-024 violation, committed by the gate's own author, in the gate built to stop shipping unverified
claims.

The first draft's narrative ("four people-moments", authors "reasoning correctly about a gate whose
search path they had not read") was invented. It had the right shape and arrived exactly when the
argument needed it, which is what fabrication feels like from the inside.

**And the draft then committed the same defect once more:** its table listed `claims-verify` as a
false claim. `claims-verify` is **true** — `.github/workflows/ci.yml:56` runs `npm run claims:verify`
(since `c15e82d`, 2026-07-09), and `package.json:12` maps it to `scripts/claims-verify.mjs`. The
check behind the draft's verdict grepped for `claims-verify` (hyphen); the npm script is
`claims:verify` (colon). A false verification claim, inside the ADR about false verification claims,
produced by a search shape incapable of seeing the answer.

Three false entries, not four. The failure mode is not schema. **It is asserting a check you did not
run**, and no allowlist design fixes that.

## 3. Why the allowlist was never the load-bearing part

At fixpoint, "provable exemption" is an **empty category**:

- If the named invoker is *inside* the search roots, the ordinary scan already finds it — the module
  is `wired` and the exemption is never consulted.
- If the invoker is *outside* the roots, that proves the roots are incomplete. The fix is to add the
  root, not to record an exemption.

So a structured `{invoker, why}` schema verifies nothing the corrected scanner would not already
establish. What survives it is exactly the `invoker: 'human'` entries — the pre-ADR system with typed
keys. Measured against the current 25 entries: ~9 go straight to `'human'`, and 4 more
(`self-update`, `count-chunks`, `brain-stamp`, `lesson-promote`) are **inexpressible** — they are run
by a launchd plist *outside the repo*, so the taxonomy forces either a false `'human'` or a path the
gate cannot reach. The "small permanent hole" would have been the majority of the allowlist on day
one.

Worse, the incentives run the wrong way: a path invoker can fail the gate and block a release;
`'human'` never can. Under deadline pressure `'human'` strictly dominates. The design would have
rewarded choosing the unverifiable branch.

## 4. Decision

Fix the predicate and the scope. Drop the schema.

1. **Invocation-shaped matching.** A caller must reference `<name>.mjs` (or `<name>.sh`), not the
   bare basename. Kills `prove`/"proven", `version`/`"version":`, and most comment prose.

2. **Repair the test exclusion.** Exclude `*.test.mjs` / `*.spec.mjs` by name, anywhere — not only
   files under a `tests/` path. `scripts/console-engine.test.mjs` is a caller today; it must not be.

3. **Correct the search roots *and* the file-type filter, together.** Add `.github/` and root
   `package.json` — **and `--include=*.yml`**, without which adding `.github/` matches nothing,
   because all 5 workflows are YAML. The first draft specified the root and omitted the glob, so its
   own fix would have fixed nothing.

4. **Exclude `kb/` from caller search.** `kb/` holds ~3 MB JSON corpora indexing 68 *other*
   repositories; a foreign repo's filenames currently count as callers here. Measured blast radius
   today: 1 module (`falsify`, which is independently and genuinely wired via `package.json:33`).
   Latent, fails open, and grows with every repo indexed.

5. **Widen the inventory.** `shippableModules()` reads `scripts/*.mjs` only — **40 of 129 first-party
   executables are invisible to it** (18 in `plugin/scripts/`, 13 `scripts/*.sh`, 4 nested, 3
   `console/*.js`, 2 `bin/*.mjs`). Among the invisible: `plugin/scripts/anticipate.sh` — **founding
   failure #4, which this gate could never have caught and cannot catch now.**

6. **Print the exempt set every run.** DDD-0010's invariant says no module may be silently absent
   from the audit; today the 25 exempted modules are never printed at all. An exemption nobody sees
   is the allowlist's real hiding place — not its schema.

7. **Delete the three false entries.** Keep `claims-verify`: it was true. After (3), it needs no
   entry at all.

8. **Make `STANDALONE` injectable.** It is a `const` inside the gate file, so the gate cannot be
   tested against a known-bad allowlist. §8's standard is unmeetable until this changes.

9. **Duplicate keys fail.** Represent the allowlist as entries that can be checked for repeats rather
   than an object literal where last-wins silently discards. (`memory-doctor` is duplicated at 50/64;
   both values are identical, so nothing was actually lost — a real defect, honestly minor.)

## 5. What this will cost, honestly

**Implementing this turns the gate red.** After (1)–(5), modules currently green on comment matches
will correctly report unwired, and 40 newly-visible modules get audited for the first time. That is
the gate starting to work, and it will block the release path until each is wired, exempted with a
true reason, or held.

`check-legibility` specifically is **not** the "one CI line" that `docs/CONVENTIONS-AUDIT.md:276`
estimates: Playwright is absent from devDependencies (`package.json:81–85`) and from `.github/`, and
the script needs a live URL plus a browser install. It also carries a hardcoded machine-specific
fallback path (`/Users/stuartkerr/.npm-global/...`) that will not resolve in CI.

## 6. What review killed

| Proposed in draft 1 | Verdict | Why |
|---|---|---|
| Blind-spot root cause | **refuted** | all entries in the gate's own initial commit (`f410282`) |
| `claims-verify` is false | **refuted** | `ci.yml:56` + `package.json:12` |
| Structured `{invoker, why}` | **dropped** | vacuous at fixpoint (§3); both reviewers, independently |
| `invoker: 'human'` | **dropped** | unverifiable branch that can never fail — dominant under pressure |
| "Widen to `.github/`" | **insufficient** | no `--include=*.yml`; would have matched zero workflows |

Both reviewers independently proposed roughly the same replacement: fix the scanner, delete the false
entries, add a duplicate check. This ADR adopts that, plus the inventory and predicate findings which
neither draft nor reviewer had at the start.

## 7. Verification

Unmet until all three hold:

1. The gate **fails on a known-bad fixture** — an allowlist entry whose claimed invoker does not
   invoke, and a module wired only by a comment. Requires (8); it is currently untestable, and no
   test in `tests/` references `wired-check` at all.
2. `plugin/scripts/anticipate.sh` appears in the audit — the founding failure the gate cannot
   currently see.
3. A run prints wired, exempt, held, and unwired counts that sum to the full inventory.

A gate that has never failed has not been proven correct. It has been proven silent.
