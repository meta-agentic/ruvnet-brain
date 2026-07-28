---
id: ADR-058
title: The 95 contract — one observable per dimension, one mutant per observable, and the external-signal watch plane
status: Proposed
date: 2026-07-27
updated: 2026-07-28
impl: wired
authors: [Stuart Kerr, Claude Fable 5, GPT-5.6-Sol (codex)]
tags: [qa, gen2-qe, grading, external-signals, ci-watch, release-gate, mutation]
supersedes: []
relates: [ADR-028, ADR-050, ADR-052, ADR-053, ADR-055, ADR-056, ADR-057]
governs:
  - bin/install.mjs
  - plugin/hooks/hooks.json
  - plugin/hooks/codex-hooks.json
  - plugin/scripts/codex-hook-adapter.mjs
  - plugin/scripts/codex-hook-wrapper.mjs
  - plugin/scripts/verify-interface.sh
  - plugin/scripts/hijack-ruvnet.sh
  - plugin/scripts/session-start.sh
  - scripts/behavioral-l1-l4.mjs
  - scripts/no-silent-substitution.mjs
  - scripts/qe/ux-suite.mjs
  - scripts/claims-verify.mjs
  - kb/card-lane-budget.json
  - scripts/qe/card-lane-gate.mjs
  - scripts/release-vector.mjs
---

# ADR-058: The 95 contract

**Status**: Proposed
**Date**: 2026-07-27 · **Last updated**: 2026-07-28 · **Why**: D3 gained its end-to-end existence
proof — one real CI debt (`learning-replay.yml`, runs 30325577756/30327349291/30327405302) driven
from push → red → surfaced → green → closed, with both mutants killed
**Implementation**: wired, but the release vector is **UNKNOWN at D4** · **Verified in sync**:
2026-07-28 for the deterministic local gates only; the required real N=3 executor replay is still
blocked and earns no pass

Extends ADR-057's build order. ADR-057's diagnosis — the three concealment mechanisms, the five
converged classes — is the incident record and is not restated.

## The law, restated once, because every row below is an instance of it

> A test may only claim what it can observe. A grader awards 95 only to an observable a machine
> checked on the candidate SHA, **plus the named mutant that proves the check is load-bearing.**
> Partial work earns zero credit: an observable without its mutant is an intention, and intentions
> scored 38/100.

**95 means 95 on BOTH graders.** Design target throughout is the harsher reading (GPT-5.6-Sol, who
gave the 18 and the 28). One grader at 95 and the other at 60 is a 60.

## Duel record

Two independent designs, produced from the same brief. **Both converged on the same core**: a
tri-state per-invariant verdict bound to the candidate SHA, a release gate that is a **vector
minimum and never an average**, and a mandatory known-bad mutant per observable. Fable named the
states `green|red|inconclusive`; GPT named them `PASS|FAIL|UNKNOWN`. **GPT's naming is adopted** —
`UNKNOWN` says out loud that the detector could not tell, which is the exact distinction the
`--levels L5` vacuous pass erased.

GPT's honest critical-path estimate: **8–12 engineer-weeks for one engineer.** Recorded here rather
than softened; the per-item costs below sum to roughly that.

**One GPT claim was checked and is FALSE.** It reported *"live `gh auth status` is degraded: the
active `stuinfla` token is invalid"* and built a watch-plane justification on it. Verified
first-hand: `gh auth status` reports `✓ Logged in to github.com account stuinfla`, token valid,
scopes `admin:public_key, gist, read:org, repo, workflow`. The watch-plane requirement stands on its
own evidence (the owner had to report a red pipeline); it does not need and must not cite this.
GPT also could not write its documents — the session was launched `--sandbox read-only`, which was
the operator's configuration error, not a failure of the design.

## Scoreboard of what has ALREADY moved since the graders ran — no credit claimed

Verified first-hand at file:line, not relayed:

| Deduction | State on main today | What still gates the points |
|---|---|---|
| D8 −35 "verification failures do not stop installation" | **Narrowed.** `bin/install.mjs:3240-3248` consumes `runSelfCheck()` and sets `process.exitCode` | No stranger-machine matrix exercises it; no mutant proves the line is load-bearing |
| D8 −20 "grounding smoke never fatal" | Still true **by design** | §D8 decides it explicitly rather than dodging |
| D7 −30 "regex parses shell semantics" | **Narrowed.** `MATCH_RE` is gone as live code — the single remaining occurrence is `verify-interface.sh:173`, a comment reading *"MATCH_RE is gone, not demoted"*. Structural `commandNodes()` classifier at :100 | No seeded incident corpus, no FP/FN mutants — a fifth recurrence is undetectable |
| D1 −4 coverage floor vs badge | **Closed** (floor 26/28, badge 28%, re-derived by claims-verify) | Nothing — but it was only 4 points |
| D1 −8 `REQUIRE_BRAIN` | **Open** — grep confirms **0** workflow files set it | §D1 |
| Vacuous-pass guard | **Closed** — `--levels L5` exits 2 | Nothing |
| Fast lane | **Safety-corrected, performance proof reopened.** Reuven Cohen's 2026-07-28 report exposed that curated capability cards were being treated as built-state proof. The truth gate now forces factual capability/implementation claims to source search (0/19 capability assertions use cards); recommendation-only routing remains fast. | Generate and verify source anchors for cards before restoring fast factual answers; until then correctness wins and D6 gets no capability-latency credit. |
| D6 −22 "latency breaches only warn" | **Closed.** `kb/card-lane-budget.json` (checked-in manifest) + `scripts/qe/card-lane-gate.mjs` (in-process p50/p95/max over 100 firings) wired into `scripts/qe/ux-suite.mjs` as a genuine hard gate; env-sensitive timings unchanged (still advisory) | Nothing — both mutants proven (1,100ms sleep → real FAIL; silent manifest raise → `doc-currency` `presumed-stale` BLOCK once drift accumulates, see build report) |

Everything else in both graders' lists is fully open.

## What 95 requires, per dimension

### D8 — stranger's machine · 18 → 95 · FIRST, because it caps everything

**Observable**: a required `stranger-matrix.yml` that, on the **packed tarball of the candidate
SHA**, in five images (ubuntu, windows Git-Bash, windows PowerShell, macos, and a hostile container:
no `jq`, no `gh`, `sh`-only, HOME containing a space, network denied), installs into a **virgin
HOME** and asserts: (a) healthy → exit 0 **and ≥1 hook fired through the INSTALLED registration**;
(b) seeded-broken (`forge-mcp-all.mjs` removed from the tarball) → exit **non-zero**; (c) **no
author-local `~/.claude/settings.json` exists in any image**, so any README-promised behaviour that
only fires from the owner's layer is caught here as a lie.

**The grounding-smoke decision, made rather than dodged**: a failed smoke stays **non-fatal on a
default install** — a first-run model download or an air-gapped machine is not a broken install, and
blocking there fails every offline user. What changes is that the verdict stops **evaporating**: it
persists as `install-state.json: grounding: unproven`, `--doctor` exits 1 on it, session-start
surfaces it once, and the first real `search_ruvnet` clears or confirms it. The hostile cell runs
`RUVNET_STRICT_INSTALL=1` where smoke failure **is** fatal, so the strict path is tested even though
it is not the default.

**Mutants** — M-D8a delete `forge-mcp-all.mjs` from the tarball → matrix red · M-D8b revert
`process.exitCode = selfcheck.exitCode` to a bare statement → seeded-broken lane exits 0 → red ·
M-D8c register a hook that sleeps past its declared timeout → battery cell red.

**Cost** 3.5 days + Windows CI minutes, no tokens. **Skip cap**: D8 ≤40 and Rule 9 holds OVERALL ≤70.

### D3 — proactive · 53 → 95 · includes the EXTERNAL-SIGNAL WATCH PLANE

The owner's addition, and the purest instance of the rubric row: **CI was failing and the owner told
the brain.** A product whose pitch is "proactive" that must be told about a red pipeline by its user
has failed D3 in the way that matters most.

**Two sources, split by physics — never conflated.**

**W1 OBSERVED (free, no polling).** The model already runs `gh`, `vercel`, `netlify`,
`npm publish`, `git push`. One new shim entry `signal-watch` on **PostToolUse, matcher anchored
`^Bash$`** (GPT's anchoring — an unanchored matcher is F3/F4). It classifies the executed command
with `commandNodes()` in **executable position** — never a grep, so "vercel" inside a commit message
cannot fire — and reads the outcome from `tool_response`.

> **VERIFY-FIRST CLAUSE, MANDATORY.** The exact Bash `tool_response` field shape must be captured
> from **three real recorded envelopes, checked in as fixtures, BEFORE any parsing code is written.**
> Guessing a field name here is the interface-guessing sin `verify-interface.sh` exists to block, and
> a watcher that silently parses nothing is this project's signature severed-pipe failure.

A non-zero managed outcome emits `additionalContext` (advisory, never blocking — malfunction is never
a decision) and appends a `SignalDebt` to `pending.jsonl` (**single writer**). A successful
`git push` opens a **pending CI verdict** keyed (repo, SHA).

**W2 POLLED (deferred verdicts).** No new daemon — extends the proven `issue-watch` pattern.
`scripts/signal-watch.mjs` runs `gh run list --commit <sha> --json status,conclusion,workflowName`
(**read-only verbs only**), reuses `ci-verdict.mjs`'s unknown-is-red law rather than reimplementing
it, and polls at bounded moments: session-start when debt is pending and cache >10min stale; Stop
(inside the existing continuation-gate — ADR-055 §3.4 forbids a second Stop hook) when debt pending
and last poll >2min. **Never per-prompt.**

**The anti-nag law** (this is where watch planes die, so it is a hard rule with its own red test):
speak on **transitions only**. Green produces **zero bytes** unless it closes a previously-surfaced
red. A turn that pushed cannot end silently with the verdict unknown — one advisory line, never
holding the turn hostage to GitHub's queue.

**Degradation ladder**: no `gh` → W1 still fully works (exit codes need no gh), W2 records
`unverifiable: gh not installed`, surfaced **once per debt**; unauthenticated → same with
`gh auth login required`; API error/offline → verdict **UNKNOWN**, debt stays open. **Never fakes
green, never silently disables** — silent-off is scored equal to crashing.

**Mutants** — **M-W1 (the headline)**: seed a push-debt, inject a canned `gh run list` fixture
(`SIGNAL_WATCH_GH_FIXTURE`, so CI needs no network) resolving to `failure`, run the **literal**
session-start registration, assert the CI-red line appears **with zero user input in the
transcript**. Delete the consumer block → red. *This is 2026-07-27 replayed with the human removed.*
· **M-W2**: an all-green fixture must emit **zero bytes**; break transition-dedupe so green speaks →
red. · **M-W3**: treat an API error as green → rate-limit fixture red. · **M-W4**: remove
`tool_response` parsing → recorded `vercel deploy` exit-1 envelope → red.

**Cost** 2–3 days, no tokens, no new infrastructure. **Skip cap**: D3 ≤65 — this is the dimension
where trust is personally lost when the human is the alarm system.

Also in D3: `hijack-ruvnet.sh` gains **anonymous-shape** categories (hand-rolled cosine, ad-hoc
embedding loops, agent-memory glue) because `:44-57` only knows brand names; and
`no-silent-substitution.mjs` gains `--project <dir>` so `audit()` can finally open the **user's**
repo instead of only this one.

### D7 · 32 → 95
`tests/regression/interface-gate-corpus.test.mjs` — every case cites its incident (#12, #13, #41,
#44, plus the 2026-07-27 heredoc bite), runs the **literal registered command** via `hook-shim.mjs`,
and asserts an exact allow/block verdict. Must-BLOCK: the three #44 escapes. Must-ALLOW: `grep -E
"foo|ruflo init"` (#41), a commit message mentioning `ruflo` (#12), JSON-escaped quotes (#13), a
heredoc whose body opens with a tool name. The suite fails if any listed incident has zero cases.
Also: replace `hijack-ruvnet.sh:31`'s `command -v jq || exit 0` with the node path every other gate
uses. **Mutants** — FN: stop recursing into `bash -lc` → #44 cases sail → red. **FP (mandatory)**:
treat single-quoted `$( )` as live → #41 blocks → red. *Four of five incidents were false positives;
a corpus that only catches misses recreates the one-sided fix pattern.* **1.5 days. Cap ≤50.**

### D6 · 28 → 95
Two-tier `ux-suite.mjs`: environment-sensitive timings stay **advisory** (a flaky gate trains
overrides); the deterministic **decision lane** becomes a **hard gate** — card lane p95 ≤ **250ms**
over 100 firings, absolute fail >**1,000ms**. 1,000ms is ~8,600× the measured 0.1158ms, so a breach
is a correctness event, not jitter. Justification is the product's own constant: hooks get 5s and
those hooks *order* the model to consult the brain — a product may not order a consultation it
prices above its own budget. **Mutants** — insert a 1,100ms sleep → **fails**, not warns · raise the
threshold without a currency stamp → doc-currency red. **1 day. Cap ≤50.**

### D5 · 35 → 95
`tests/mesh/coexistence.test.mjs` with sentinel foreign hooks (slow, failing, garbage-printing;
registered before **and** after ours): every sentinel fires exactly once; the user's `settings.json`
and `~/.codex/config.toml` are **byte-equivalent** after install → update → uninstall; our lint
enumerates-but-never-charges foreign findings. **Mutants** — normalize/reorder the user's JSON keys →
byte-diff red · make one of our advisory hooks exit 2 → single-blocker invariant red. **1.5 days,
depends on D8's images. Cap ≤60.** *The 63-findings count is not the target — 52 are machine-local
and not ours; the points come from proving we never touch what we do not own.*

### D4 · 36 → 95
Counterfactual replay, nightly, N=3, pass ≥2/3, transcripts archived — **a rate, never a verdict.**
One trap specified concretely so it cannot dissolve into intention: record in fixture-project-A that
`ruflo memory search` takes `-q`, not a positional; open a fresh session in fixture-project-B with a
**differently-worded** task. PASS requires all three: the lesson loaded **before** the first tool
call; the produced command uses `-q` where the **brain-off control** uses the positional form; and
the trap still passes after a nightly refresh runs between record and replay. The oracle is a
**machine-checkable token**, not a similarity judgment.

> **A trap whose CONTROL run also produces `-q` is INVALID — the result is INCONCLUSIVE, never a
> pass.** This is the exact inversion of L4's defect: L4's `must:` list proved the brain spoke; this
> proves the agent's **artifact changed, against a control**.

**Mutants** — delete the lesson row → red · run the treated arm brain-disabled; it must produce the
control artifact → red. **2–3 days, REAL TOKENS nightly — the one standing spend, priced in the
open. Cap ≤55.**

### D2 · 42 → 95
`tests/experience/scenarios.json` — **verified absent today** (`tests/experience/` does not exist).
~20 hand-written coherent scenarios in ADR-053 §1's record shape, plus a report that fails on: any
coherent scenario unclassified, `manual` >20%, or any `ci`/`scheduled-live-probe` naming a job that
does not exist in `.github/workflows/` (a machine-checkable join, so a scenario cannot point at a
fictional runner). **Mutant** — delete a classification, or point one at a non-existent job → red.
**1 day; the list is human work by design. Cap ≤55.**

### D1 · 50 → 95
`REQUIRE_BRAIN=1` grep-findable in `.github/workflows/ci.yml` — a warm-brain lane (bundle cached by
SHA) where a **skipped battery FAILS**. The conversion already exists in `run-tests.mjs`; the lane
just has to exist and set the variable. **Mutant** — point the cache at an empty dir → the skip
converts to a failure → lane red; that single mutant proves both the lane and the env wire.
**1 day + cache storage. Cap ≤60.**

## Ranked build order (dependencies stated, red-first per item)

1. **D8 stranger matrix + install DEGRADED state** — nothing downstream is trustworthy on a machine
   where install cannot fail. No dependencies.
2. **Plane W (external-signal watch)** — the owner's named wound and the cheapest large win.
   Depends only on the shim.
3. **D1 `REQUIRE_BRAIN` lane** — depends on the bundle cache.
4. **D2 scenarios + report** — informs which matrix cells D8 grows next.
5. **D7 incident corpus + both mutant polarities** — classifier already landed.
6. **D6 two-tier ux-suite** — card lane already landed.
7. **D5 coexistence sentinels** — depends on D8's images.
8. **Distribute the walls** (ADR-055 item 8) — **after 5 and 7**, because shipping a blocking gate to
   strangers before its corpus and coexistence proof exist is how #12 happened the first time.
9. **D4 traps + D3 strata** — last; they burn tokens nightly and depend on fixtures from 1 and 4.
10. **Release-gate flip** — after 1–9 exist, the gate becomes required.

## The release gate — a critical-invariant VECTOR, never an average

`claims-verify.mjs` gains:

```
INSTALL-FAILS-LOUD | INTERFACE-CORPUS | LATENCY-DECISION-LANE | COEXIST-BYTE-EQUAL |
LEARNING-REPLAY | SIGNAL-WATCH-FIRES | SCENARIOS-CURRENT | GUARANTEE-RUNS
```

Each is `PASS | FAIL | UNKNOWN` **on the exact candidate SHA**. The verdict is the vector
**minimum**; `UNKNOWN` is not `PASS`. Any non-PASS forces README/status/release metadata to
`DEGRADED` and **mechanically bans** the strings "healthy", "proven", "all pass", and any composite
score — with its own mutant (write "all pass" into README with one invariant red → release refuses).
*An average is how 18/100 coexisted with "all pass" on one page; the vector makes that state
unrepresentable.*

## Where the score gets WORSE before it gets better — said out loud

The first full Gen-2 run should read **below 38**. The counterfactual replay fails today. The
signal-watch E2E fails today — the 2026-07-27 incident is the proof. The scenarios report fails today
because the file is absent. **A Gen-2 suite green against today's product would be the
self-congratulation it exists to kill.**

And README:484/526's *"L1–L4 behavioral harness — all pass … drives the full pipeline"* must be
downgraded **now**, before any build item, to what L4 actually proves: *the hook injects the full
directive set* — a speech test, not a behaviour test. The visible claim gets weaker today. That is
correct: **the strong claim was the defect.**

## What CANNOT be automated — named, with owners

1. Whether an offer was **welcome** (precision's numerator) — human adjudication, owner: Stuart.
2. Whether a substitution **choice** was right in an open-world architecture — human review of the
   nightly transcripts; a grader model may second-opinion, never sole-gate.
3. The ~20 scenario list's **coherence** — hand-written by design.
4. **The 95 itself** — awarded only when BOTH graders re-run the same rubric on the same SHA and both
   land ≥95. No self-score counts; the 83-vs-38 category error is not repeated.

## Currency log

| Date | What changed | Why (with referents) |
|---|---|---|
| 2026-07-28 | Kept D5's real installer mutant executable after `bin/install.mjs` gained the shared model-cache sibling. | `tests/mesh/coexistence.test.mjs` now copies both legitimate installer siblings into its isolated mutant tree. Before this repair the mutant crashed on `../kb/model-requirements.mjs` and D5 failed without exercising byte preservation; `npm run test:mesh` is the real gate. |
| 2026-07-28 | **Codex SessionStart/Stop moved from configuration failure to direct real-path proof; the overall release vector remains UNKNOWN at D4.** | Commit `c466c2a`, issue #52. Before: a fresh Codex 0.145.0 session rejected both Brain hook sources on unsupported `_note`, so lifecycle coverage was zero. After: the same child-Codex probe has no Brain parse/clamp errors; the installed stable wrapper returned SessionStart developer context in 0.527s and translated a real open-ledger Stop into Codex `decision:"block"` in 1.172s. The new test executes the wrapper across a v1→v2 active-generation flip after v1 deletion, killing the stale-cache-path failure. Focused tests pass 52/52. This repairs a D5/D8 host-path defect but does not manufacture the blocked D4 replay, so the vector-minimum release law still says UNKNOWN. |
| 2026-07-28 | **Re-read the governed surfaces after the installer, retrieval, hook, and Top-100 validity repairs. The release verdict remains UNKNOWN, not PASS.** | `bin/install.mjs` now treats a local assembled bundle as the source of truth, prunes stale stores omitted by its manifest, and reports the installed manifest's real 60-repo count instead of the stale hard-coded “20+”. `plugin/hooks/hooks.json` anchors dispatch at `^(Task|Agent)$` and observes `PostToolUse` outcomes through `plugin/scripts/routing-outcome-capture.mjs`; these are outcome receipts, not automatic quality adjudication, so D3 is not overstated. `evals/runs/top-100-latest.json` passes all 12 gates (100/100 grounded and routed, 100 receipts, 8/8 enforceable implementation receipts, semantic 96/100, p95 3.675s). `scripts/release-vector.mjs` still exits 1 because D4 is **UNKNOWN**: live `scripts/learning-replay.mjs` transcripts show Claude Code initialized the treated/control sessions but every arm received HTTP 429 `seven_day` quota rejection before inference. The treated hook did deliver the learned lesson, but a blocked executor is not a behavioral replay. The harness now makes `--help` side-effect-free and records executor failures explicitly as UNKNOWN; focused D4/release/claims tests pass 86/86. The vector-minimum law therefore still bans a healthy/proven release claim. |
| 2026-07-27 | Initial draft, two-sided duel | Owner: *"get every single one of these numbers to be 95 or better… I want Fable 5 and GPT-5.6 to pull it together into an ADR and a DDD."* Both designs converged on tri-state per-invariant verdicts, vector-minimum release, and mandatory mutants; GPT's `PASS/FAIL/UNKNOWN` naming adopted. GPT's `gh auth` claim checked and found FALSE. Already-narrowed deductions verified first-hand at `install.mjs:3240-3248` and `verify-interface.sh:173` |
| 2026-07-27 | D6 built: `kb/card-lane-budget.json` + `scripts/qe/card-lane-gate.mjs`, wired into `scripts/qe/ux-suite.mjs` | Both `governs:`-listed files above; §D6 mutants proven (1,100ms sleep → real `ux-suite.mjs` FAIL, not warn; a silent, undocumented manifest-threshold raise across ≥2 commits shows as `presumed-stale` under `node scripts/doc-currency.mjs --check`, per this document's own drift rule). Measured on this machine: p50 0.0245ms / p95 0.0481ms / max 0.0768ms over 100 in-process firings — well inside the 250ms/1000ms budget in `kb/card-lane-budget.json` |
| 2026-07-27 | **Seven dimensions landed and the release gate itself was built.** D8 `.github/workflows/stranger-matrix.yml` (5 images, real `npm pack` tarball, virgin HOME) · D7 `tests/regression/interface-gate-corpus.test.mjs` · D5 `tests/mesh/coexistence.test.mjs` · D2 `tests/experience/scenarios.json` + `report.mjs` · D1 `REQUIRE_BRAIN` in `ci.yml` · D3 `scripts/signal-watch.mjs` · D6 as the row above. And item 10, `scripts/release-vector.mjs`, now emits the eight-invariant vector this document specified — first run reads **7 PASS, D4 UNKNOWN, verdict UNKNOWN, exit 1**, which is the design working: seven green cells do not average into a pass. | Every `governs:` path above moved. Verified by re-reading each against this document's §D1–§D8 rather than by date-stamping. **The score is expected to read BELOW 38 on the first Gen-2 run** — the stranger matrix went red on all five images and found a real, weeks-old defect this ADR had already recorded twice without anyone fixing it: `session-start.sh` emits 8,795–10,320 bytes against selfcheck's 4,096 cap, and leaves orphaned descendants after SIGTERM. A gate that goes red on its first run against a defect the docs already knew about is the gate doing its job, not the gate being wrong. |
| 2026-07-27 | **D4 landed — the vector reads PASS on all eight.** `scripts/learning-replay.mjs` measures 15/15 treated vs 3/15 control across five N=3 sets; the shipped artifact is 3/3 with the control at 0/3. Re-read §D4 against it: the trap matches the spec (lesson before first tool call, token vs a brain-off control, survives a real refresh, machine-checkable oracle). §"The release gate" re-read against `scripts/release-vector.mjs` after two corrections to MY code, not to this document: the D4 detector delegated to the trap's own `checkArtifact()` (a strict `sha === HEAD` rule can never be satisfied by its own commit), and it read `.verdict` where that function returns `.status`, which made a real PASS print as UNKNOWN. | Governed paths moved: `scripts/release-vector.mjs`, `scripts/claims-verify.mjs`. §D4's stated cap holds and is NOT closed — the win-twice promotion bar is unexercised, and the trap is conclusive only ≈51% of nights because Haiku reaches `--query` unaided in ~20% of control runs. Narrowing the token would credit the lesson for something the control demonstrably reaches without it, so the invalid rate stays. |
| 2026-07-28 | **D3 has its existence proof: one REAL debt, resolved end to end.** An independent grading scored D3 76/100 with this deduction: *"Never proven in anger: no evidence of a single real debt resolved end-to-end (push → red → surfaced → cleared)."* Correct — `tests/unit/signal-watch.test.mjs` proved each PART (conclusion mapping, debt opening, the degradation ladder), and `tests/mutation/signal-watch-mutation.test.mjs` proved the parts fail when broken, but no test had ever carried a whole debt from `git push` to "CI is green again" on data from a real pipeline. New `tests/fixtures/signal-watch/ci-lifecycle-learning-replay.json` captures a real incident on this repo's own `main`: `.github/workflows/learning-replay.yml` carried an unquoted colon in a step name, GitHub rejected the file, and it concluded `failure` on two SHAs 38 minutes apart before `68b1ce7` quoted the name and the next run went green 77 seconds later. Runs `30325577756` (failure, `2818207c`, 03:18:45Z) · `30327349291` (failure, `06bf252a`, 03:57:09Z) · `30327405302` (success, `68b1ce71`, 03:58:26Z), every field COPIED from `gh run list --workflow learning-replay.yml --repo stuinfla/ruvnet-brain --json databaseId,conclusion,status,headSha,createdAt,workflowName,event,url` and re-verifiable from the fixture's own provenance block. New `tests/unit/signal-lifecycle.test.mjs` drives the real poller (`scripts/signal-watch.mjs`, through its documented fixture port — no network, no auth) and the real surfacer (the `node -e` program lifted VERBATIM out of `plugin/scripts/session-start.sh` at test time, so an edit to the shipped block is what runs, not a copy that can drift) across DDD-0013 Context 2's named transitions: the red surfaces with the actionable minimum (inv. 5), the same still-red debt is never re-nagged (inv. 7), a second distinct SHA speaks because it is a new debt, the green closes the outstanding red with **exactly one line**, and every subsequent green emits **zero bytes** (inv. 2) | Both mutants run and killed, then reverted clean: making `resolveVerdict` return `success` for a red conclusion fails with `expected 'success' to be 'failure'`; dropping the closing `out.push` from `session-start.sh` fails with `expected [] to have a length of 1 but got +0`. No `governs:` path here changed on net — `session-start.sh` was mutated and reverted (`git diff --quiet` clean), and the two new files are test and fixture. Recorded here because §D3's claim of a working watch plane is what these artifacts now back |
| 2026-07-27 | **The session-start defect the row above recorded twice without fixing is now CLOSED, re-read against `plugin/scripts/session-start.sh`.** Commits `308a6c4`/`f8f0bc9` moved it: measured through the same door (`scripts/ci/stranger-scenario.mjs`, `npm pack` → virgin HOME → the installed `hook-shim.mjs session-start` command), all four stdin regimes × both sources, the flood is 10652 bytes (first firing) / 9127 bytes (the other seven) → **3675 bytes**, and `✗ Self-check FAILED — 8 contract violation(s)` → `✓ Self-check passed`. Nothing was truncated: THE PLAYBOOK's text relocated verbatim to `plugin/skills/ruvnet-brain/PLAYBOOK.md`; the three background spawns (spine seed, KB-freshness check, auto-update) moved out of the hook's process group through new `plugin/scripts/detach.mjs`, each with its own process group, an explicit TTL, and a receipt in `detached-jobs.jsonl` — closing the orphaned-descendants half of the same finding. Both guards proven by mutant: +5KB of stdout filler reproduces the flood (8× violations vs the 4096 cap); a bare `&` job outliving its parent reproduces the orphan (8× `survivors=true`). D8's own healthy-image assertion was re-verified after, in `4893819` (not a `governs:` path here — `scripts/ci/stranger-scenario.mjs` is outside this document's governed set). | Governed path moved: `plugin/scripts/session-start.sh` (commits `308a6c4`, `f8f0bc9`). Re-read the row above against the fix rather than editing it — the prior row's "recorded twice without anyone fixing it" stands as an accurate account of what was true when it was written; this row is what changed since. No other `governs:`-listed path moved in the same window (checked: `git log 07c53d5..HEAD` against the full governed set turns up only these two commits, both touching only `session-start.sh`). |
