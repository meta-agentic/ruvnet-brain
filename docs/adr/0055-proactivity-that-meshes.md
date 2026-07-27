---
id: ADR-055
title: Proactivity that meshes — one decision law, four planes, substance-bound enforcement, learning bound to outcomes
status: Accepted
date: 2026-07-27
updated: 2026-07-27
authors: [Stuart Kerr, Claude Fable 5, GPT-5.6 (codex, read-only)]
tags: [proactivity, hooks, mesh, fourth-wall, learning, grounding, qa]
supersedes: []
relates: [ADR-012, ADR-017, ADR-023, ADR-028, ADR-030, ADR-040, ADR-043, ADR-050, ADR-052, ADR-053, ADR-054]
governs:
  - plugin/hooks/hooks.json
  - plugin/scripts/
  - kb/forge-mcp-all.mjs
  - kb/forge-evidence.mjs
  - tests/mesh/
  - tests/experience/
  - ~/.claude/settings.json (this machine's layer — census appendix A)
---

# ADR-055: Proactivity that meshes

**Status**: Accepted (duel-verified two-sided 2026-07-27 — full record below, incl. the first run's process failure)
**Date**: 2026-07-27
**Related**: ADR-012, ADR-017, ADR-023, ADR-028, ADR-030, ADR-040, ADR-043, ADR-050, ADR-052, ADR-053, ADR-054

## Context — the owner's overnight mandate, verbatim in spirit

*"Come up with the definitive ADR for what it takes so this thing acts TRULY PROACTIVE, leverages
ALL the learning we've done, and forces it across ALL projects in a HEALTHY way. No brittle hooks.
Thoroughly reviewed and tested individually AND holistically — the entire system hangs together,
no points of conflict in any hooks, they all mesh."* Bar: **anything satisfiable by ritual is
worthless; a test that cannot fail is not a test.**

The design law is the day's measured taxonomy (2026-07-26/27): every gate binding to SUBSTANCE
held (version-sync, gate C++, design wall, verify-interface, timeout lint); every gate binding to
CEREMONY was theater (the grounding stamp records that a search RAN, never what it RETURNED —
"The Brain did its job. I ignored it."). The founding failure this ADR closes: the brain returned
rUv's own local-WASM browser example (`ruvector/examples/rvf/scripts/rvf-browser.html` — `npm
install @ruvector/rvf-wasm`, fully local); hours later the model wrote browser code importing the
runtime from `esm.sh`, contradicting both the returned source and the product's
nothing-leaves-your-device premise. Every gate stayed green. GPT-5.6 replayed that exact write
against the live gate during this duel and measured `LIVE_GATE_EXIT=0`.

## §1 The decision law — when the brain BLOCKS vs INTERRUPTS vs ADVISES

Stated in terms of what evidence the machine holds, never in terms of how important a rule feels.
Both duelists converged on this independently; the wording below is the merge.

**BLOCK (exit 2) is lawful iff ALL of:**
1. A **deterministic detector** connects the exact proposed action to **contradictory held
   evidence**: money (undeclared model on dispatch), honesty (push without bump; ungraded visual;
   unread interface), consent (the user's own state record), or **explicit contradiction of
   grounded source or user policy** (§3).
2. **Malfunction ≠ decision.** Exit 2 is a decision; parse/dependency/timeout/state failures
   permit the action and record degraded health — they never manufacture a refusal
   (the lesson-hooks.sh codification, now law for every plane).
3. The refusal **carries the evidence** — source span, receipt, violated fact — and the compliant
   replacement, so compliance is cheaper than defiance (route-dispatch.sh's refusal is the house
   style).
4. A decision **receipt is durably written before refusing** (gate-receipt.sh).
5. A **visible override exists and writes its own receipt** (see §3.5 for the two override
   regimes and the recorded disagreement).
6. The detector has a **known-good corpus, an incident replay, and mutation proof** (§8).

**"Not found in retrieval" is never sufficient to block** (GPT-5.6's correction, adopted — see
§3.3).

**INTERRUPT (unsolicited mid-session bytes)** only through the speech chokepoint
(`unprompted-runtime.mjs`), which enforces: the user's 1–5 dial (ADR-052), per-channel policy,
the DismissalLedger with severity-weighted budgets, session frequency caps, the precision ledger,
and ONE combined output envelope. Interrupts fire when: an **observable** plan, delegation,
write, or command drifts from a current grounding receipt; a ratified lesson matches the present
decision; a dormant installed capability directly serves the stated goal; deterministic grounding
debt remains after an opaque mutation. Interruptions advise — they never gain blocking power from
severity prose.

**ADVISE (passive always-on bytes)** is the residual and must shrink. Every speaker declares its
output budget and owner; unmeasured or redundant advice moves to silence, not up to blocking.
Every always-on byte is context tax the token-ledger must show.

**Promotion and demotion are asymmetric by design (converged, near-verbatim in both verdicts):**
- silent → advisory: requires a detector fixture and a measurable outcome.
- advisory → interrupt: requires the precision floor and a user-controlled channel.
- interrupt → block: requires **human ratification** + deterministic evidence + incident replay +
  known-good corpus + killed detector mutants. **Never automatic.** An agent may never promote
  its own speech (the ADR-054 consent architecture applied to proactivity itself).
- Advisory/interrupt detectors **auto-demote** when adjudicated trailing precision over the last
  20 outcomes falls below 0.60 (ADR-028's floor) — and the demotion is **announced at
  session-start**; a silent demotion is the ADR-050 failure shape.
- Blocking detectors enter a **loud circuit-open state** (advisory-only) after two CONFIRMED
  false blocks within the trailing 20 adjudicated outcomes (GPT-5.6). **An override alone is not
  a false-positive verdict** — only adjudication (§4) is.

## §2 Four planes, one chokepoint each — the mesh topology

| Plane | Chokepoint (end state) | What feeds it |
|---|---|---|
| **Speech** | `unprompted-runtime.mjs` (exists) | anticipate, lesson-hooks, grounding-drift (§3.6); ground-ruvnet's footer becomes a candidate |
| **Mutation** (Write/Edit/MultiEdit/NotebookEdit) | `implementation-guard.mjs` — ONE registration, ONE parse | consent (protect-state), grounding gate, fourth-wall detectors D1–D5 |
| **Execution** (Bash / Task / Agent) | `execution-guard.mjs` — ONE registration, ONE parse | route-dispatch, verify-interface, design-wall, version-bump, package/network checks |
| **Lifecycle** (Stop / SessionEnd) | continuation-gate **via the shim**; ONE SessionEnd coordinator | work-ledger debt, grounding debt, learning flush, autocapture ordering |

Detector modules stay small and independently testable; consolidation is at the parse/decision
boundary, never a monolith (GPT-5.6's framing, adopted). Staging (Fable's, adopted): shared-parse
first (a body change, no restart), single-dispatcher-per-plane second (a SHELL change,
`requiresRestart`, honestly flagged per ADR-023). The load-bearing invariant is M2
(single-blocker), not the dispatcher count.

## §3 The fourth wall (issue #46) — substance-bound grounding

### 3.1 The GroundingReceipt originates AT RETRIEVAL, not in a PostToolUse regex

**Recorded disagreement, resolved on evidence.** Fable's draft extracted substance from the tool
RESULT text in the PostToolUse stamp hook. GPT-5.6: the producer (`kb/forge-mcp-all.mjs`) holds
the actual source documents and MCP supports `outputSchema`/`structuredContent`; PostToolUse
regex-mining of a JSON-encoded prose payload is fragile — this repo's own `grounding-stamp.sh`
header already documents the quote-escaping pain of exactly that. **GPT's position wins.**
`search_ruvnet` emits a typed, content-addressed receipt in `structuredContent` (prose retained
for the model); the PostToolUse hook shrinks to the thin bridge that persists it, append-only, to
`evidence.jsonl` (mirrored asynchronously to AgentDB — never in the hot path).

Receipt facts (each carrying value, authority, source path, span, span hash, confidence class
`explicit|derived|ambiguous`): package names and roles; exact install commands; import/export
names and signatures; **explicit negative facts** ("does not export X"); implementation
alternatives; conflicting source claims; and network posture as FOUR independent fields —
runtime execution (local|remote), backend required, data egress, artifact delivery
(bundled | optional-CDN | required-remote). Extraction is deterministic (manifests, imports,
exports, install commands, URLs); an LLM summary never becomes a hard fact. Validity binds to
corpus/source hashes — not to an arbitrary 24-hour ritual (ADR-012's stamp survives only as the
recency layer beneath this; its "mechanically enforced grounding" claim is narrowed by this ADR).

### 3.2 User-owned project policy resolves source-internal ambiguity

GPT-5.6's find, verified in source: `rvf-browser.html` itself mentions CDN delivery as an
alternative alongside the local package — so "the source says local" is NOT a deterministic
verdict on its own, and Fable's draft D1 was a latent false-positive machine. A user-owned
`.ruvnet/implementation-policy.json` (`network.runtimeOrigins: "bundled-only"`,
`dataEgress: "deny"`, `preferredImplementations`) selects among source-supported options. The
agent cannot modify this file through ordinary mutation tools (same wall class as
protect-brain-state.sh).

### 3.3 Deterministic detectors (converged set; hard-block only on contradiction)

- **D1 GROUNDING-NET**: a new executable remote origin is introduced where the selected
  implementation is local and policy requires bundled delivery. Replays the esm.sh incident.
- **D2 GROUNDING-PKG**: a new dependency/import contradicts the package selected by receipt +
  policy.
- **D3 GROUNDING-API**: a symbol is **explicitly absent** from an authoritative closed export/
  type set, or carries an explicit negative fact. **GPT-5.6's correction, adopted over Fable's
  draft: absence from top-k retrieval is ADVISORY only. Retrieval silence is not contradiction.**
- **D4 GROUNDING-POLICY**: the edit violates a user-owned invariant (e.g. data egress).
- **D5 GROUNDING-RECEIPT**: receipt missing, tampered, cross-session, or referencing changed
  source hashes.

Advisory-only, never blocking: API shapes merely unfound; unresolved implementation
alternatives; semantic drift without a deterministic contradiction; unsupported parsers;
conflicting authorities with no selected policy.

### 3.4 Where it binds

- **PreToolUse (mutation plane)**: reconstruct the post-edit file (`change-image`), run D1–D5,
  refuse with the receipt evidence verbatim in the refusal.
- **PreToolUse (execution plane)**: deterministic package installs, remote imports, heredocs,
  obvious generators. Arbitrary shell cannot be fully understood pre-execution — say so, don't
  pretend (the protect-brain-state.sh honesty rule).
- **PostToolUse**: audit the ACTUAL changed artifact after opaque Bash/generator operations; on
  an escaped contradiction, open a **grounding-debt** record and inject the exact repair.
- **Stop**: NO second Stop hook (converged). continuation-gate consumes grounding debt with its
  existing loop protections — the turn cannot end clean while deterministic debt remains.
- **pre-commit / pre-push / CI**: the same detector engine over the actual git diff — catches
  what no hook can.

### 3.5 Overrides — the one open disagreement, both positions recorded

Converged: overrides are scoped (detector + receipt hash + diff hash + file), one-use,
expiring (~15 min), loud, append-only receipted, adjudicated later, and never a persistent
environment variable (the blanket `RUVNET_SKIP_GROUNDING_CHECK=1` regime is retired for the
fourth wall). **Disagreement**: GPT-5.6 requires an interactive human terminal to mint one;
Fable refuses that clause — the owner's standing flow is authorized autonomous runs
("finish the loop — don't ask"), and a human-terminal-only override during a sanctioned
overnight run trains exactly the workaround culture the false-positive discipline exists to
prevent. **Resolution shipped**: token mintable in-band with a mandatory stated reason, every
mint receipted and adjudicated; if adjudication ever shows in-band minting laundering bad
overrides, the human-terminal clause is the pre-agreed escalation. Existing walls
(design-wall, verify-interface, version-bump) keep their in-band skip tokens + receipts until
precision data justifies migrating them.

### 3.6 The interrupt tier

A `grounding-drift` producer joins the speech chokepoint: it speaks only when an observable
action or delegation departs from a current receipt, when grounding debt is unresolved, or when
a receipt went stale because source changed. It cannot interrupt private planning — it
interrupts the first observable expression of the plan. Copy pattern: "You are departing from
receipt <id>. Selected: X. Your action introduces Y. Use Z. Evidence: <paths>."

### 3.7 Explicitly NOT built (converged refusals, by name)

1. No LLM judge in any blocking path (unmeasured error rate; latency; trains overrides). An
   OPTIONAL advisory judge on UNKNOWN only — cached, 2s cap, failure = skip — is permitted
   post-v1, never in v1 (GPT proposes; Fable defers; deferral shipped).
2. No prose-to-prose comparison as authority. The binding unit is a typed fact with evidence.
3. No blocking on retrieval absence.
4. No CDN/package allowlists standing in for selected evidence (allowlists are ceremony).
5. No AgentDB, network, or model dependency in the hot path — local receipt + policy files only.
6. No automatic detector promotion.
7. No claim that AIMDS/agentic-flow/RedBlue already solve source compliance: AIMDS LTL verifies
   propositions AFTER deterministic propositions exist (offline/Stop layer, post-v1); RedBlue
   attacks the finished wall offline; agentic-flow transports outcomes. None decides compliance.
8. No claim of an OS security boundary: a sufficiently empowered Bash process can forge local
   state. Defense in depth, honestly scoped.
9. No Task-prompt content-scanning by hard detectors in v1 (Fable's refusal of GPT's Task
   matcher, recorded): free prose of a subagent brief under string detectors is a
   false-positive machine; delegation drift is the interrupt tier's job (§3.6).
10. No "rUv over your shoulder" product claim while the wall is inert: the console reports one
    of `SUBSTANCE-BOUND | SEARCH-ONLY | OFF` (GPT-5.6). Measured status at ADR time:
    **SEARCH-ONLY** — the incident write passes the live gate.

### 3.8 Build status — §3 as shipped (2026-07-27, issue #46, v3.9.88-dev)

**Implemented** (build items 4 and 5 of the ranked order): the retrieval-side receipt
(`kb/forge-evidence.mjs`, called from `forge-mcp-all.mjs`'s success path only, also returned as
`structuredContent.grounding`), the substance stage in `ground-before-write.sh` after its recency
wall, detectors D1/D2/D3 plus the D4 policy cases in `plugin/scripts/grounding-substance.mjs`, the
user-owned `.ruvnet/implementation-policy.json`, and the in-band reasoned override with its own
receipt ledger. `grounding-stamp.sh` now derives the §3.7.10 mode from the evidence ledger's own
mtime rather than asserting it.

**Measured**: the incident replay exits 0 on `origin/main` (independently re-run: zero bytes on
both streams, no receipt, with genuinely fresh real stamps) and exits 2 on this branch carrying the
source path, the install command and the source's own words. 20 real historical writes from this
repo's git log, the compliant local install, a source-carried CDN origin, a comment discussing
esm.sh, an unretrieved API shape, and every empty/absent/torn/stale ledger shape all exit 0.
Each detector is proven load-bearing by disabling it and watching its own bad write pass.

**Deviations from §3 as written, each deliberate:**
1. **Persistence lives in the producer, not a PostToolUse bridge.** §3.1 assigns extraction to the
   producer (adopted) and persistence to a thin bridge. The producer already holds both the
   documents and the filesystem, so a bridge would add a second process, a second parse of the same
   escaped prose, and a failure mode where an uninstalled hook silently means no receipts ever. The
   typed receipt is still emitted in `structuredContent`, so the bridge remains buildable and any
   other host can consume it without re-mining prose — which was §3.1's actual purpose.
2. **Binding is at the PreToolUse mutation plane only.** §3.4's execution-plane, PostToolUse-audit,
   Stop-debt and CI-diff bindings are build item 6 and are not in this change.
3. **D5 (receipt integrity) is not implemented.** Its blocking form needs the outcome ledger and
   adjudication of build item 7; a D5 blocking on "the ledger looks odd" would be malfunction
   manufacturing a refusal, which §1.2 forbids. Absent or unreadable evidence is treated as no
   evidence, i.e. permitted.
4. **The stage is invoked from `ground-before-write.sh` rather than `implementation-guard.mjs`.**
   The §2 plane dispatchers are build item 3 and must land after battery v2 (item 2); wiring a new
   registration ahead of them is the out-of-order change the ranked build order exists to prevent.
   The recency wall's pure-bash contract is preserved and still asserted — the substance stage is
   the only part allowed a dependency, and it fails open on a missing node or checker (both proven
   by breaking them, not by comment).

## §4 Learning that changes behavior — buildable vs ceremony, honestly split

**Real today (measured):** 27 Tier-1 lessons load every session (global-memory sqlite, read
live); gate-blocks.jsonl records catches; advocacy-outcomes has offered/dismissed with severity
budgets; dispatch-log.jsonl; the SONA queue with level-triggered flush; lesson-gate with owner
ratification; version-bump-gate already splices lesson text into refusals — the one existing
lesson→enforcement wire, and the template.

**One canonical outcome ledger** (GPT-5.6's schema, adopted): detectorId, channel, evidenceHash,
actionHash, decision, override, outcome, adjudicationSource, policyVersion, timestamp. Outcome
classes: `acted | ignored | overridden | confirmed_tp | confirmed_fp | intentional_exception |
unadjudicated`.

**Buildable now, deterministic:** (1) ACTED detection — the advised action observably follows the
offer within the session; (2) override adjudication where a machine verdict exists —
`--ci-override` receipts joined to the CI conclusion of that exact SHA (gate C++ v2 already
fetches it); where no machine verdict exists the row stays **unadjudicated, never scored**;
(3) contested-block detection (block + same action + skip token ≤60s); (4) the demotion/
circuit-open arithmetic of §1, loud.

**Ceremony, refused by name (converged):** "detectors tune themselves from prose lessons";
automatic promotion; any learned component weakening a hard gate online. A confirmed false
positive GENERATES a proposed scoped detector/policy change plus a new known-good fixture; the
change ships only if the corpus stays green, the incident replay still refuses, and all mutants
die. That is real learning. A prose lesson never creates a bespoke hook — gates scale with
decision planes, not lesson count (ADR-030).

## §5 Machine-wide propagation — how a lesson becomes enforcement

- **Tier 0**: global instructions (CLAUDE.md) — settled invariants, always loaded.
- **Tier 1**: machine global-memory — cross-project lessons (27 live), char-budgeted, loud
  cap-trip.
- **Tier 2**: per-project AgentDB — decisions, history, candidates.
- **Tier E (the missing rung, now explicit)**: enforcement definitions consumed by the four
  plane chokepoints as DATA — each carrying scope, source lesson IDs, detector version, effect
  ceiling, policy deps, known-good fixture, incident fixture, owner ratification, expiry/review
  (GPT-5.6's definition record, adopted).
- **Distribution tier**: `plugin/hooks/hooks.json` + packed artifact + active-generation spine —
  the ONLY channel that reaches other machines. Therefore the write wall
  (ground-before-write + grounding-stamp/receipt bridge) and the dispatch wall (route-dispatch,
  matcher `Task|Agent`, anchored) move from this machine's `~/.claude/settings.json` into the
  shipped plugin (opt-in via profile.json preserved — the gates already self-gate);
  marketplace-clone direct paths are retired; user settings keep machine-specific reminders
  only. SHELL change, `requiresRestart`, honestly flagged.

## §6 Per-hook contract (every registration, every layer)

`event · matcher (anchored) · layer · codeRoot · mode (advisory|blocking) · offBehavior
(silence|run|partial) · failureBehavior · timeoutSeconds (explicit) · warmP95BudgetMs ·
coldBudgetMs · stdoutCapBytes · stateRead · stateWritten · dependencies · reachesStrangers ·
owner` — shim-table entries carry it natively; out-of-shim hooks carry it in a checked-in
`hook-contracts.json`; the mesh lint fails any registration absent from both. Rules: prompt-path
timeout ≤5s, warm p95 <500ms, cold <2s (named startup exceptions must be measured); declared
timeout ≥ the body's statically derived worst case; plugin advisory stdout ≤4KB; exit 2 means
decision, crashes never do; one code generation per subsystem invocation; no state path with
concurrent writers and no coordinator.

## §7 Holistic mesh invariants (merged set — GPT's 15 ⊇ Fable's M1–M8)

1. **Registry completeness**: every active user, project, and enabled-plugin hook enumerated —
   six registries on this machine today, not one.
2. **One blocker** per (event, tool) pair — one decision aggregator, never competing blocking
   handlers from different code copies.
3. **One code generation** per subsystem invocation (kills the learn-capture straddle, F7).
4. **Off totality**: observable `run|silence|partial` under brain-OFF for every handler,
   including Stop (undecided today — F5).
5. **Timeout totality**: no missing timeout, no unit ambiguity — any value >60 is a wrong-unit
   bug by fiat.
6. **Budget integrity**: body worst-case fits the host timeout (kills F11).
7. **Speech ownership**: no plugin-layer unsolicited bytes bypass the chokepoint; out-of-plugin
   speakers enumerated + grandfathered explicitly (the honest form of F9).
8. **State ownership**: one writer/coordinator per state path (kills F10/F21).
9. **Decision precedence**: block > advisory > silence; no two modules emit contradictory final
   decisions.
10. **Load honesty**: budgets hold at 20 concurrent full-chain firings (flakiness observed twice
    under parallel load; a serially-passing suite is lying).
11. **Coexistence**: foreign hooks before/after ours fire exactly once; unrelated config stays
    byte-equivalent (ADR-053 §2.8).
12. **Broken-world**: advisory hooks silent; blockers emit only documented decisions.
13. **Packed-path fidelity**: tests execute the literal registered command from the packed
    layout — never the body directly (the adjacent-door defect, F16).
14. **Cross-host validity**: Claude Code AND Codex parsers accept shipped hook metadata (F17).
15. **Falsifiability**: every invariant has a seeded violating fixture that turns the suite red.

## §8 The mesh test suite — specified so it can fail

Registry census over all six registries; contract lint (M1–M9); battery v2 per ADR-053 §2 —
every literal registration with `CLAUDE_PLUGIN_ROOT` substituted to the packed layout, four
stdin regimes including **held-open** under an external process-group watchdog; broken-world
sweep; stream discipline; 20× concurrent full-chain load with warm/cold/p95 budgets;
coexistence sentinels; OFF matrix; single-refusal; update-while-firing; fourth-wall incident
replay (must REFUSE) + known-good corpus (local wrapper, direct rvf-wasm, human-selected CDN,
unrelated URLs, comments discussing esm.sh, unknown-but-not-disproved shapes advisory,
explicitly-absent symbol refused) + **mutation proof** (break each detector and each invariant
independently; every mutant killed or no release); artifact proof (packed install ubuntu +
windows, Codex/Claude parser smoke); exact-SHA gate C++ v2. **Run against today's machine the
census/lint suite is born red** (appendix B) — which is the proof it works.

## Ranked build order (converged; user-pain-avoided ordering; red-first per item)

1. **Merged-registry census + contract lint** (M1–M9). Red first: born red on F5, F6, F16–F19
   (the user-layer timeout fixes of 03:00 become regression fixtures, not findings).
2. **Hook battery v2** before changing any registration. Red first: held-open stdin exceeds
   budget today (F20); packed-literal cases expose the adjacent-door gap (F16).
3. **Four plane dispatchers**: Stop through the shim with a decided offBehavior; stale project
   Stop override deleted; duplicate Task/Stop blockers removed; one parse per event; learn-flush
   budget rebalanced (F11) and flush path spine-resolved (F7).
4. **GroundingReceipt at retrieval** (`forge-mcp-all.mjs` structuredContent + evidence store).
   Red first: incident fixture proves the term/timestamp stamp carries no substance.
5. **D1–D5 + policy file + scoped one-use override.** Red first: the esm.sh write passes today
   (measured, `LIVE_GATE_EXIT=0`) and must refuse after; known-good corpus zero hard false
   blocks; mutants killed.
6. **PostToolUse grounding debt + continuation-gate consumption + diff-level CI detector.** Red
   first: an opaque Bash generator introducing the contradiction escapes today; afterwards it
   must hold Stop until repaired or overridden.
7. **Outcome adjudication + loud demotion/circuit-open.** Red first: precision-0.2 fixture must
   demote AND announce; a suppressed announcement fails the test; unadjudicated overrides must
   not score.
8. **Distribute the walls** (plugin hooks.json, `Task|Agent` anchored; retire clone paths;
   installer/uninstaller updated). Red first: fresh packed stranger install, Agent-named
   undeclared dispatch + contradicting write — both pass today, both must refuse exactly once.
9. **Speech-plane honesty**: ground-ruvnet footer as a candidate; out-of-plugin speakers
   enumerated in hook-contracts.json. Red first: M7 lint red on the current footer bypass.
10. **Ship only through artifact + exact-SHA gates** (ADR-053 §3/§4). ADR-055 moves to
    Implemented only when the packed live path refuses the original incident.

## Consequences

- The grounding claim becomes honest: console states `SUBSTANCE-BOUND | SEARCH-ONLY | OFF`.
  At ADR time it had to say SEARCH-ONLY. Since §3.8 (v3.9.88-dev) a machine whose bundle carries
  the substance writer reports SUBSTANCE-BOUND, and one whose bundle predates it still reports
  SEARCH-ONLY — derived from the evidence ledger's mtime, never asserted. The ADR itself stays
  Accepted rather than Implemented until the packed live path refuses the original incident
  (ranked build order item 10).
- ADR-012 is narrowed (its stamp = recency layer only), not superseded; ADR-023's spine charter
  is finally total (Stop included); ADR-054's off-contract becomes machine-readable for every
  registration, not just the shim's eleven.
- Two SHELL changes (plane dispatchers; distributed walls) are `requiresRestart` — flagged,
  rare, honest per ADR-023 §4.
- The mesh suite is born red; the census appendix is its first fixture set.

---

## Appendix A — Hook census (this machine, 2026-07-27, post-03:00 fixes; spine gen 22 = 3.9.85-dev)

**42 active handler registrations across six registries** (GPT-5.6 count, spot-verified):
RuvNet Brain plugin 15 · user settings 11 · project settings 2 · security-guidance 9 ·
vercel 4 · superpowers 1.

**Layer P — `plugin/hooks/hooks.json`** (ships to every installer; bodies hot via spine):
P1/P2 SessionStart startup|resume → session-start (advisory, partial, 5s). P3 UserPromptSubmit
`.*` → ground-ruvnet (advisory, silence, 5s; warm 153–181ms). P4 UserPromptSubmit `*` →
unprompted-speech (blocking, silence, 5s; warm 225–265ms). P5 PreToolUse `Write|Edit|Bash` →
hijack-ruvnet (advisory, silence, 5s; 69–73ms). P6 PreToolUse `Task` → route-dispatch (blocking,
run, 5s). P7 PreToolUse `^(Write|Edit|MultiEdit|NotebookEdit)$` → protect-state (blocking, run,
5s; 61–65ms). P8/P9 PreToolUse `Bash` → verify-interface / design-wall (blocking, run, 5s;
201–204 / 170–175ms). P10/P11 PreToolUse write/bash → unprompted-speech (blocking, silence, 5s;
236–241 / 261–368ms). P12 PostToolUse `Write|Edit|MultiEdit|Bash` → learn-capture (advisory,
silence, 5s). P13 PostToolUse `Write|Edit|MultiEdit` → md-stamp (advisory, silence, 5s). P14
SessionEnd `.*` → learn-flush (advisory, silence, 30s). P15 Stop `*` → continuation-gate
**direct, NOT via shim** (`|| true`, 10s; 52ms).

**Layer U — `~/.claude/settings.json`** (this machine only; installer writes none of these):
U1–U3 SessionStart date-awareness (3s) / architecture-reminder (3s) / agentdb-ensure (5s — also
loads the 27 Tier-1 lessons). U4 PreToolUse `(Edit|Write|Bash)` config-aware-hook (2s). U5
PreToolUse `Write|Edit|MultiEdit` → marketplace-clone ground-before-write (5s). U6 PreToolUse
`Task|Agent` → marketplace-clone route-dispatch (**5s — fixed 03:00 tonight; was ABSENT → 600s
default**). U7 PostToolUse `(Write|Edit|MultiEdit)` adr-qa-auto (3s; python3). U8 PostToolUse
`.*search_ruvnet` → marketplace-clone grounding-stamp (5s). U9 UserPromptSubmit git-push-age
(2s; 80–86ms). U10/U11 PreCompact + SessionEnd agentdb-autocapture (30s each). **All Layer-U
timeouts were milliseconds-intent values (2000/3000/5000/30000) in a seconds field until tonight
— fixed 03:00 with backup; live doc verified: timeout is seconds, default 600 (30 on
UserPromptSubmit).**

**Layer J — project `.claude/settings.json`**: J1 PreToolUse `Bash` version-bump-gate (5s; 5ms).
J2 Stop → repo continuation-gate (10s) — its own `_note` says remove at spine ≥3.9.34; spine is
3.9.85.

**Layer T — third-party plugins (GPT-5.6's find, verified at file:line)**: security-guidance
2.0.6 — 9 handlers incl. SessionStart `timeout: 180` (hooks.json:10) and a Stop reviewer with
`asyncRewake: true` (hooks.json:81-87); vercel 0.45.1 — 4 handlers, no timeouts; superpowers
6.2.0 — 1 handler, no timeout. Thirteen third-party handlers default to 600s.

**Layer D — dead inventory**: 7 unregistered gate scripts in `~/.claude/hooks/` + `archive/`;
`kling-preflight.sh` skill-owned (ADR-0014); ~30 other projects carry their own settings hooks.

**Per-event chains (this repo)** — hooks fire in PARALLEL (live doc, verbatim: "All matching
hooks run in parallel, and identical handlers are deduplicated automatically" — none of the
duplicates below are identical, so none dedupe): Bash = 6 hooks, warm wall ≈ 330–370ms, CPU sum
≈ 0.83s; Write/Edit = 5; Task/Agent = 2 blocking from two code copies; UserPromptSubmit = 3
(+ security-guidance + vercel layers); Stop = 3 behaviors (P15 + J2 + security asyncRewake);
SessionStart worst-case is security-guidance's 180s; SessionEnd = 3 concurrent state writers.

## Appendix B — Conflict matrix (Fable F1–F15; GPT-5.6 additions F16–F22; convergence marked)

- **F1** Timeout-unit schism, user layer — **fixed 03:00 tonight; now a regression fixture.**
- **F2** Untimed blocking route-dispatch (user layer, 600s default) — the ADR-053 duel find
  recreated one layer up — **fixed 03:00 tonight; regression fixture.** (Both duelists.)
- **F3** Subagent-wall matcher split: plugin `Task` only (hooks.json:61) vs user `Task|Agent`;
  Agent-named dispatch unguarded for strangers; unanchored `Task` also matches TaskStop. (Both.)
- **F4** Anchoring inconsistency inside hooks.json (`^(...)$` at :71/:101/:111 vs unanchored
  :51/:123); NotebookEdit hits hijack/learn-capture by substring accident. (Fable.)
- **F5** Stop bypasses the spine — no table entry, no mode, no offBehavior; contradicts the
  file's own `_note`. (Both.)
- **F6** Double continuation-gate from two code roots, deduped only by a shared cooldown-lock
  path — incidental, not contractual; J2's removal condition satisfied 50 versions ago. (Both.)
- **F7** learn-capture.sh:103 resolves its background flush from `CLAUDE_PLUGIN_ROOT`/clone,
  never the spine — version-straddling inside the learning pipeline. (Both.)
- **F8** The write wall is not distributed: user-settings-only, marketplace-clone paths,
  installer writes none of it; SECURITY.md says so honestly. (Both.)
- **F9** "Sole writer of unprompted bytes" is true only inside the plugin layer — ≥9 machine
  speakers outside any dial/ledger. (Both.)
- **F10** SessionEnd two-writer collision (learn-flush + autocapture; GPT adds vercel cleanup —
  F21). (Both.)
- **F11** learn-flush worst case 48s (8 × 6s, learn-flush.mjs:20,55) inside a 30s timeout
  (hooks.json:151). (Both.)
- **F12** Per-Bash CPU tax ≈0.83s, same payload parsed ~10×; verify-interface/design-wall spawn
  node 3–4× each for field extraction. (Fable; GPT's parse-once dispatchers are the cure.)
- **F13** The 24h stamp remains ceremony post-fix: recency + genuine result, never obedience;
  one stamped search opens a day of contradicting writes. (Both — the founding finding.)
- **F14** Off-contract coverage: `offBehavior` exists only for the shim's 11; Stop/user/project/
  third-party undeclared. (Fable.)
- **F15** Consent wall's documented Bash hole (protect-brain-state.sh:18-22). (Both.)
- **F16** (GPT) The test suite cannot see the merged registry — `PLUGIN_HOOKS_JSON` points only
  at the brain's file (hook-contract.test.mjs:46); the existing battery tests bodies directly,
  not the literal registered command (hook-battery.test.mjs) — the adjacent door.
- **F17** (GPT) Codex's plugin hook parser rejects `hooks.json`'s `_note` field ("unknown field
  '_note'", recorded in the duel-46 rerun transcript) — cross-host metadata validity was never
  tested.
- **F18** (GPT, verified) Thirteen third-party handlers with no timeout (600s default);
  security-guidance SessionStart carries an explicit 180s — dominating every cold start on this
  machine.
- **F19** (GPT, verified) Three independent Stop behaviors (brain, project, security-guidance
  `asyncRewake`) can continue or rewake the same completed turn.
- **F20** (GPT, verified against source) `unprompted-runtime.mjs` reads stdin
  (`fs.readFileSync(0)`, :153) BEFORE any deadline exists (:167) — a held-open stdin defeats the
  internal budget entirely and eats the host's full 5s on every prompt. The canonical-hang class
  of ADR-053 §2.2, live in the newest chokepoint.
- **F21** (GPT) SessionEnd lifecycle ordering: brain learn-flush + user autocapture + vercel
  cleanup run concurrently with no coordinator (M9).
- **F22** (GPT, verified in source) `rvf-browser.html` itself offers a CDN alternative — network
  posture cannot be a store-level verdict; policy file required (§3.2). This finding reshaped
  D1.

## Adversarial duel record (2026-07-27, per the standing order)

**Process failure, recorded because the record is the point:** the first GPT-5.6 run produced
nothing twice — both output files were 39-byte stubs reading "Reading additional input from
stdin..." (codex launched with stdin never closed, 00:02 and 01:17). The Fable side proceeded
solo, was marked "not independently duel-verified", and the GPT runs were RERUN with the brief
delivered correctly (transcripts: `duel-46-gpt-r2.out`, 1.5MB; `overnight-gpt-r2.out`, 3.3MB).
This ADR is the two-sided synthesis. During the same night, the two live user-layer defects both
sides ranked most urgent (F1/F2) were fixed at 03:00 with backup; the ADR records them as
regression fixtures rather than open findings.

**Converged independently (the decision):** the block/interrupt/advise law bound to substance
with malfunction ≠ decision; asymmetric promotion (human-ratified) vs automatic loud demotion at
the 0.60 floor; four planes, one chokepoint each, parse-once; deterministic contradiction
detectors only in the hot path — no LLM judge, no allowlists, no retrieval-absence blocks; no
second Stop hook — grounding debt through continuation-gate; the same detector engine at
commit/push/CI; the wall distributed via the plugin, clone paths retired; one canonical outcome
ledger with unadjudicated rows never scored; the mesh suite born red, battery v2 with held-open
stdin under an external watchdog, 20× load honesty, mutation proof; per-hook contracts across
every registry. The conflict matrix converged on F2/F3/F5–F9/F10/F11/F13/F15 from the same
file:lines.

**GPT-5.6 found, Fable missed (folded in with attribution):** the three third-party registries
and the 42-registration count (F18); the Codex `_note` rejection (F17); the held-open-stdin hole
in the newest chokepoint (F20); the merged-registry blindness of the existing tests (F16); the
triple-Stop interaction (F19); the receipt-at-retrieval architecture over PostToolUse prose
mining (§3.1); the D3 authority correction — retrieval silence is not contradiction (§3.3); the
user-owned policy file dissolving the source's own CDN ambiguity (F22 → §3.2); receipt-integrity
D5; the circuit-open state for blocking detectors; the SUBSTANCE-BOUND/SEARCH-ONLY/OFF console
honesty state; the enforcement-definition record for Tier E.

**Fable found, GPT missed:** the anchoring inconsistency and NotebookEdit substring accidents
(F4); the measured warm latencies and the per-Bash CPU sum (F12); the offBehavior coverage gap
as a totality requirement (F14 → M4); the wrong-unit-by-fiat rule (any timeout >60 fails);
the staged consolidation path (shared parse before SHELL-change dispatchers).

**Resolved disagreements (both positions recorded above):** receipt origin — GPT's
retrieval-boundary receipt adopted over Fable's PostToolUse extraction, on the evidence of this
repo's own quote-escaping history (§3.1); D3 authority — GPT's correction adopted (§3.3);
consolidation depth — GPT's end-state via Fable's staging (§2); advisory LLM judge — deferred
past v1 (§3.7.1); override human-terminal requirement — Fable's refusal shipped with GPT's
clause as the pre-agreed escalation (§3.5); Task-prompt scanning — Fable's refusal shipped,
delegation drift goes to the interrupt tier (§3.7.9).
