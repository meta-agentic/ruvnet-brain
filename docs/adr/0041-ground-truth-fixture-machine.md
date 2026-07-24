---
id: ADR-041
title: The ground-truth fixture machine — making recall and false-alarm rate falsifiable in-fence
status: Accepted
date: 2026-07-23
updated: 2026-07-23
authors: [Stuart Kerr, Claude Code]
tags: [proactive, metrics, fixture, recall, false-alarm, acceptance, 4.0]
supersedes: []
relates: [ADR-028]
---

**Status**: Accepted (2026-07-23)

Build pending (→ Implemented once the harness + mutants pass). Duel recorded in `docs/reviews/0041-duel-fixture-machine.md`.

## Why now

ADR-028:144-146 names it "the **first build item**, because without it every subsequent number is
unfalsifiable," and ADR-028:102/104 make two of the five acceptance metrics depend on it outright:

- **Recall** = dormant capabilities surfaced ÷ dormant capabilities actually present, target ≥ 0.80 —
  "Requires a ground-truth fixture machine — without one, recall is unmeasurable and any claim about it
  is fabrication."
- **False-alarm rate** = recommendations fired against a **verified-healthy** machine, target **0** —
  "One false alarm costs more trust than ten true ones earn. Non-negotiable."

The key unlock (verified against ADR-028's own definitions): **recall and false-alarm do NOT need the
deploy gate.** Precision needs real production offers (the `advocacy-outcomes.jsonl` ledger, which is
deploy-gated). But recall and false-alarm are properties of the DETECTOR against a KNOWN machine state —
buildable and measurable entirely behind the fence. This ADR is therefore the single highest-value
in-fence 4.0 item: it moves 2 of 5 acceptance metrics from "unmeasured opinion" to "a real number."

## The decision, and the trap the duel must kill

Build a reproducible fixture: machine states with KNOWN ground truth, run the real audit/matcher path
against them, compute recall and false-alarm.

**The trap — and it is the whole reason this needs a duel, not just a build:** a fixture you author,
fed to a detector you author, can score a trivial 100% by ECHO — the detector "finds" exactly the
dormant set because the fixture handed it that set (`capability-registry` auditAll is itself the thing
under test). That is the lesson `fixture-cannot-falsify-its-own-choice` made flesh: a recall number
from a fixture that cannot fail on a broken detector is fabrication wearing a percentage.

## The fork

- **(A) Synthetic registry fixtures.** Fake `auditAll`/probe outputs with a hand-authored dormant set;
  run `matchGoal` + the surface; measure recall/false-alarm. Fast, deterministic, CI-able — but risks
  echo unless the ground truth is established by a DIFFERENT mechanism than the detector under test.
- **(B) Real reproducible machine state.** Actually install-and-disable N real capabilities in a
  throwaway HOME; run the real end-to-end probe. Genuinely measures detection — but slow, harder to
  reproduce deterministically, and may need paid/installed tooling.

## Recommendation (to be stress-tested)

**A HYBRID keyed on separation of authorities:** the ground truth must be produced by an authority the
detector does not read. Concretely: fixtures are real capability *presence/absence* states (approach
B's honesty) established by a manifest the DETECTOR never consults, exercised through the real probe
path (not a stubbed auditAll), with a small deterministic set (approach A's reproducibility). The
recall number is only admissible if a mutation test proves it: **break the detector (disable one real
probe) and watch recall drop** — a recall metric that cannot fall when the detector is broken is not a
metric. False-alarm is measured on a state where the manifest says "nothing dormant" and asserts the
surface fires ZERO — proven by adding a genuinely-dormant cap and watching the count go to 1.

## What the duel must resolve

- Is a synthetic-registry fixture (A) ever honest, or does the echo trap make only (B)/hybrid
  admissible? (GPT-5.6: argue only real-state measurement is falsifiable.)
- Is real-machine-state (B) worth its cost/nondeterminism for a metric, when a carefully-separated
  synthetic fixture with a mutation test might give the same falsifiability cheaper? (Fable 5.)
- The non-negotiable both must satisfy: the recall/false-alarm harness must FAIL when the detector is
  broken — designed and proven, not asserted.

## Consequences

Unlike ADR-040, this DOES move the score: recall and false-alarm become measured numbers on the
Proactive pillar, in-fence. Precision stays deploy-gated (real ledger). Decision + duel land here
before any build.

## Decision (converged 2026-07-23 — Fable 5 + GPT-5.6)

The fork was false, and both duelists independently dissolved it to the **same boundary**: *real
detector, real filesystem/SQLite artifacts, real matcher, real hook, independent manifest; synthetic
only where the production component is already a pure function (`goal-match`) or a delivery policy.*
Every probe input is redirectable through `$HOME`, `$PATH`, `auditAll({project})` and existing env
overrides — so the "install a real machine" cost is unnecessary: a scratch `HOME` with constructed
artifacts exercises 100% of the detector's `fs.existsSync`/JSON-parse/`sqlite3`-CLI probe code, which
is all the detector has (`capability-registry.mjs` LOCATES, never EXECUTES).

**The echo trap dies by separation of authorities:** the manifest is the denominator authority and
speaks only state-vocabulary; `capability-registry.mjs` never reads it, so it must genuinely map
artifact→state, not echo.

**The measurable cohort is four portable capabilities** — `memory-distillation`,
`workflow-pattern-learning`, `session-capture`, `mcp-servers`. Four is deliberate: breaking one
detector yields recall 3/4 = 0.75, which fails ADR-028's 0.80 bar — that gap is the mutation test's
teeth. `learning-hooks` (intentionally `unknown`, never `off`) and `nightly-refresh` (launchd-specific)
are **excluded** from the measurable cohort — they have no falsifiable dormant state; a fixture must
only declare dormancy the detector's state machine can express (itself a finding the fixture surfaces).

**Harness (two boundaries, both reported):**
- *Detector layer* — spawn the real `capability-registry.mjs --json` in the scratch HOME; its `off` set
  for the cohort must equal the manifest's dormant keys. Detector false-alarm = cohort rows reading
  `off` on the healthy state (must be 0).
- *Surface layer* — spawn the real `anticipate.sh` (no `RUVNET_CAPABILITY_REGISTRY`/`RUVNET_GOAL_MATCH`
  overrides), fresh `session_id` + `RUVNET_ANTICIPATE_STATE` per prompt; recall = unique dormant keys
  recorded `OFFERED` in the real `advocacy-outcomes.jsonl` ÷ manifest dormant keys (≥ 0.80). Negative
  corpus (homonym prompts already in `goal-match.mjs`, and goal-shaped prompts vs the healthy state) →
  zero OFFERED, zero output. A run killed by anticipate's 2s watchdog is retried once and reported
  `infra-killed`, never scored as a miss.

**The mutation tests that make the number a measurement, not a tautology** (temp copy of `scripts/`,
each asserting `mutant !== original` so a refactor can't silently run an unmutated copy):
1. false-negative probe mutant (`session-capture` no-hook branch `OFF`→`UNKNOWN`) → recall drops to
   0.75 → acceptance test MUST reject.
2. false-positive probe mutant (both-boundaries branch `ON`→`OFF`) → healthy state emits an offer →
   false-alarm ≥ 1 → zero-alarm gate MUST reject (this is what proves the 0-target isn't a tautology —
   the exact hole a pure-synthetic fixture cannot cover).
3. promiscuous-matcher mutant (`goal-match.mjs` subject guard removed) → homonym corpus fires → the
   existing subject-absent negatives kill it.
4. scorer self-test (flip one manifest entry) → the comparator itself must report the mismatch.

**Residual honestly budgeted:** schema drift (ruflo renaming a field the fixture hard-codes) is
invisible to any hand-built fixture — so ONE non-gating nightly job on the real machine diffs the
*shape* of real `stats.json`/`memory.db`/`settings.json` against the builder's outputs and alarms on
drift. The gating CI number stays deterministic; drift detection is the one thing bought from reality.

**Files to add:** `tests/fixtures/ground-truth-machine/ground-truth.json`,
`tests/helpers/ground-truth-machine.mjs`, `tests/fixtures/proactivity-prompts.mjs`,
`scripts/proactivity-metrics.mjs`, `tests/integration/proactivity-ground-truth.test.mjs`,
`tests/mutation/proactivity-detector-mutation.test.mjs`. Keep `goal-match.test.mjs` (matcher) and
`anticipate.test.mjs` (delivery/suppression) as-is.

**Build sequencing:** this harness runs the real `anticipate.sh`, which ADR-040's chokepoint is
editing — so it is built AFTER ADR-040 lands, against the final emitter, not a moving target.
