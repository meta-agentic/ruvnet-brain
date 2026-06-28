# RuvNet Brain — Master Specification

`Updated: 2026-06-27 08:00:00 PDT | Version 0.3.0 (DRAFT — effectiveness-first; point-deeper)`
`Created: 2026-06-27 06:45:00 PDT`

> A downloadable, source-grounded "brain" for the entire RuvNet ecosystem that makes Claude a
> world-class practitioner of Ruv's architecture. It **does the deep traversal at build time and points
> the agent to the exact deep source** (so it can't skim and guess), is **proven against the real code by
> a multi-vendor panel + ground-truth deep-dives** (not by my own say-so), and **measurably** stops drift
> to the training prior. Delivered as a **zip bundle with the forced-grounding wiring inside it**, rebuilt
> as the repos evolve. **Effectiveness first — size is a later optimization.**

> **v0.2 note:** v0.1 was torn apart by three independent reviewers (architecture, proof-rigor,
> enforcement). They were right on ~all counts. The biggest corrections: (1) it is a **bundle, not one
> embedded file**; (2) the quality proof cannot terminate in an LLM grader I control — it needs an
> **external human-expert gate of record**; (3) §5 "behavioral lock" mis-modeled Claude Code hooks —
> replaced with **retrieve-and-inject grounding** + one real hard-deny gate + a **measured drift-rate
> SLO**; (4) a single prose embedder over a 75%-code corpus is a real recall risk — **code-aware
> retrieval must be proven at P1**; (5) honest size is **~500–750 MB full**, so the droppable default is
> a **T0-only SKU (~80–150 MB)** fetched via `npx`, never a committed/LFS blob. Full finding→fix map in §11.

---

> **v0.3 note (owner directive — supersedes where it conflicts):** **(A) Maximize EFFECTIVENESS, not
> efficiency.** Size is *not* a v1 constraint — one comprehensive, correct bundle; quantization/size
> tuning is a *later* pass (this **demotes the v0.2 "768-SQ8 default"** — §4 now picks whatever is
> *sharpest*). **(B) The Definitive-Proof / Point-Deeper Principle (the spine):** never rely on Claude
> *deciding* to look deeper — that is the exact 15-month failure. The KB does the deep traversal at BUILD
> time and **resolves every query to the exact deepest location and serves that source into context**, so
> the agent answers from the implementation, never from a skim. **(C)** Deliver as a **downloadable zip
> bundle that ships the forced-grounding wiring inside it** — not "download and hope Claude reads it."
> **(D)** Quality arbiter = **multi-vendor LLM panel + automated ground-truth deep-dive verification**
> (cited source fetched from the real repo and checked to support the claim); the owner is not the grader.

## Prime directive

**Effectiveness is the only first-class metric.** A correct, complete, source-grounded answer every time —
at every depth — beats a smaller/faster bundle, always. When effectiveness and any other goal (size,
speed, elegance, single-file purity) conflict, **effectiveness wins and the other goal is deferred.** The
failure this project exists to kill is *shallow / confident / wrong*; we do not trade one point of
correctness to save megabytes.

## 0. Mission & success definition

A developer adds **one line** to `.mcp.json` and downloads the RuvNet Brain **zip bundle** (which ships the
forced-grounding wiring inside it). From then
on, Claude answers about RuVector / ruflo / RuView / the 160+ other RuvNet repos **from Ruv's real
source**, at every altitude — and when Claude starts to drift ("just use pgvector"), the system
**grounds it in the real source before it answers** rather than hoping a mandate sticks.

**Honest scope of the promise:** *world-class on Tier-0/Tier-1 (~25 core repos where ~95% of the value
lives), primer-grade + breadth-attested on the long tail.* Not "equally expert on all 169" — that claim
is not supported by any feasible eval and we will not make it.

**Two proofs, never conflated:**
- **Integrity (cryptographic):** the bundle *provably contains the exact pinned commits, in full,
  untampered.* That is ALL the crypto claims — not "comprehensive," not "world-class."
- **Quality (ground-truth + multi-vendor):** every graded answer is verified **against the real source**
  (cited `file:line` fetched and checked to support the claim; an independent agent re-answers from the raw
  repo and we diff), cross-checked by a **different-vendor LLM panel**. The ground-truth check is the gate
  of record; no single same-family LLM decides.

**Done = integrity manifest signed + breadth hygiene met + ground-truth/multi-vendor gate passed + a
measured drift-rate at/below SLO — all pasted. Never "files exist," never "the grader said 98."**

---

## 1. Why every prior attempt failed — and the principle that kills each

| # | Failure mode | Countermeasure |
|---|---|---|
| F1 | **Topical, not deep** | §3 L3 full source bodies; §6.3 breadth hygiene + panel questions that target ingested code |
| F2 | **ADRs read as shipped reality** | §3 L4 Proposed/Accepted/Implemented tags; §3 L2 may cite **only Implemented** code |
| F3 | **Single-layer** | §3 five layers in one bundle |
| F4 | **No behavioral lock** | §5 **retrieve-and-inject** grounding (answer *from* in-context source) + hard-deny gate |
| F5 | **Asserted, not proven** | §6 **external human-expert gate of record** + signed integrity manifest |
| F6 | **Stale on arrival** | §7 SHA-pinned, push-triggered, new-repo auto-onboard |
| F7 | **Unbounded scope death** | §2 tiered depth |
| **F8** | **The proof itself overclaims** (LLM grader laundering an assertion; crypto implying quality) | §6 human gate + restricted crypto vocabulary + per-tier scores, never blended |
| **F9** | **"One magic file" fiction / too big to drop in** | §9 honest bundle + tier-scoped SKUs + `npx` fetch, never committed |

---

## 2. Scope — the RuvNet repo universe

Live from `github.com/ruvnet` 2026-06-27 (`data/ruvnet-registry.json`): **169 non-fork repos** — 3 ≥1k,
12 in 200–1k, 12 in 100–200, 23 in 50–100, 81 in 10–50, 38 <10. **48 pushed ≤3 months. 29 Rust, ~127 code total.**

`IN_SCOPE = (stars ≥ 1000) ∪ (pushed ≤ 3 months) ∪ (core-architecture allowlist)`, **tiered by ingest depth:**

| Tier | Repos | Depth | Eval |
|---|---|---|---|
| **T0 — Pillars** | `RuView` 75.7k · `ruflo` 61.7k · `RuVector` 4.3k | Max: full source, docs, ADRs, symbol index, **L2**, primer | ~15 Q/repo, all 6 archetypes × 4 sophistication levels |
| **T1 — Core stack** | `RuLake`, `agentdb`, `ruv-FANN`, `QuDAG`, `daa`, `SynthLang`, `dspy.ts`, `FACT`, `SAFLA`, `Synaptic-Mesh`, `rvm`, `midstream`, `sublinear-time-solver`, `sparc`, `agentic-flow`, `agent-harness-generator`, `rvcsi`, `rufield`, `ruv-neural`, `rudevolution` | Full source, docs, ADRs, symbol index, **L2**, primer | ~12 Q/repo |
| **T2 — Latest (≤3 mo)** | `helix`, `rupixel`, `worldgraph`, `PhotonLayer`, `rvdna`, `ruqu`, `ruvn`, `ruv-drone`, `skygraph`, `musica`, `obsidian-brain`, `SonicChamber`, `open-claude-code`, … | Full source + docs, primer; **no L2** | 2–3 Q/repo (per-tier score reported separately) |
| **T3 — Long tail (~95)** | older/smaller | Primer-depth (README+manifests+module inventory); deep-walk **on demand** | 1 Q/repo sampling; breadth-attested only |

Tier membership is data (`data/registry.tiers.json`). New-repo policy: §7 re-enumerates the org weekly;
threshold-crossing repos auto-onboard and bump the version. **Per-tier scores are always reported
separately — never a single blended number that hides T3 being lightly evaluated** (red-team Proof-H8).

---

## 3. The artifact — five layers, delivered as one bundle

```
ruvnet-brain bundle:
  brain.rvf            — segment-per-repo HNSW vectors (best embedder, f32/multi-vector)  [§4]
  brain.passages.zst   — FULL passage text, zstd block-indexed (the join target)
  brain.symbols.json   — L4 symbol index (fn/struct/trait/export → repo:file:line)
  brain.graph.json     — L4 cross-repo dependency graph + ADR status
  brain.manifest.sig   — signed integrity manifest (witness root)               [§6.1]
  primers/             — L0 human primers (per-repo + master)
  gate/                — L1 CLAUDE.md directive + hook pack (host-specific)      [§5]
```

- **L0 Human primer** (F1-human): Cognitum-proven top-down primer; every claim grounded in a real KB
  query with a cited path; ADR maturity honest. **This is the only layer Cognitum actually proved.**
- **L1 AI gate** (F4): the verification directive + machine-readable usage contract, shipped in `gate/`
  and installed into the host (see §5 — it lives in host config, **not** inside `brain.rvf`).
- **L2 Concept / "the RuvNet way"** (F3 reasoning gap — **NET-NEW, the highest novel risk**): prescriptive
  best-practice articles. Hard constraints: **T0/T1 only**; each article must carry **≥2 citations to
  Implemented (not Proposed) code**, cross-checked against L4 ADR status; un-citable or ADR-only articles
  are **rejected at build**; the human spot-audit (§6.2) is **weighted toward L2**, not random. (Kills the
  Arch-H4/F2-relapse risk: an idiom synthesized from an unimplemented ADR cannot ship.)
- **L3 Deep source** (F1): `rvf-kb-forge` full-body walk per repo. Ground truth.
- **L4 Structure** (F2): symbol index, repo graph, per-doc ADR status. Makes "which crate implements X"
  deterministic and "how do these connect" answerable.

> **Single-container is deferred, not claimed.** RVF *can* embed payloads (Ask-Ruvnet does, at 1.4 MB),
> but no shipped toolchain does it at ~300 MB with random access. A true single `.rvf` (zstd block index
> for mmap'd passage random-access) is a **P0 spike** with its own success gate; until it passes, we ship
> the honest bundle above (red-team Arch-H1).

---

## 4. Retrieval engineering — maximize effectiveness, then point deeper

**Owner directive: pick the SHARPEST retrieval regardless of size.** Quantization/size shrinking is a
*later* pass and never trades away correctness. The job here is two things: (a) retrieve the *right* deep
content, and (b) **deliver it so the agent answers from it, never from a skim.** Levers, effectiveness-first:

1. **Best-available embedding, multi-vector (top lever — Arch-H5).** `bge-base-en` is a *prose* model; 127/169
   repos are code and the flagship query ("show me how min-cut is implemented") is the implementation
   lookup where prose embedders are weakest. Because **size is not a constraint**, we can be maximalist:
   benchmark a strong **code-aware embedder** (and a larger prose model, e.g. bge-large 1024-dim) and ship
   **multiple vectors per chunk** (prose + code, kind-routed) if that raises answer quality. P1 picks by
   measured effectiveness on implementation-lookups, not by size.
2. **Point-deeper delivery (the spine — NEW).** The KB must not return "a doc near the answer"; it must
   resolve to the **exact deepest implementation location and serve it**. Mechanism: the L4 **symbol index**
   maps the query's target (`min-cut`, `adapt()`, a struct) to `repo:file:line`; retrieval returns that
   **full implementation passage plus its call-graph neighbors** (what calls it / what it calls) via
   **whole-document assembly** (collapse chunk hits by path, concat in order, center on the match). The
   §5 hook then **injects this into context**, so the agent answers from the implementation — it has no
   skim-or-quit option. This is the structural cure for the 15-month "Claude won't keep reading" failure.
3. **f32 (or the sharpest vectors) by default; quantization is a LATER pass.** Per the effectiveness-first
   directive we do **not** quantize for v1 if it costs any measurable answer quality. SQ8/RaBitQ become an
   efficiency option *after* effectiveness is proven, gated on **answer-quality delta on the §6.2 panel**
   (one metric, not recall@k) across 2–3 structurally different repos (supersedes the v0.2 SQ8 default —
   Arch-H10, Proof-H11).
4. **Routing (segment-per-repo) — see §7/§8.** Cross-segment score normalization is a first-class step,
   not an afterthought (Arch-H3, R4).

**Size budget (deprioritized — for planning, not a constraint).** With f32 + multi-vector the **Full**
bundle is honestly **~1–1.5 GB**; we ship it anyway because effectiveness wins. SKUs exist for *convenience*
(download less of the ecosystem), **never as a way to shrink the answer** for a repo in scope:

| SKU | Contents | Rough size (f32, effectiveness-first) | Delivery |
|---|---|---|---|
| **Core** (T0+T1, default) | ~25 repos | **~600 MB–1 GB** | downloadable **zip** (or `npx @ruvnet/brain` fetch) |
| **Full** (all tiers) | 169 repos | **~1–1.5 GB** | zip / `npx` fetch |
| **T0-only** (convenience) | 3 pillars | **~200–350 MB** | zip / `npx` fetch |

A smaller "lite" (quantized) build is a **later** deliverable, only after the full build is proven
effective. **Never committed to a repo, never Git LFS** (hard rule; LFS caused ManifestNotFound on
Railway). The bundle is a downloadable, version-pinned **zip** that includes the forced-grounding wiring.

---

## 5. Behavioral grounding — honest, defense-in-depth (no "lock" theater)

v0.1 claimed Claude Code hooks could intercept a drafted prose answer and "rip it back." **They cannot** —
`PreToolUse` sees only tool name+input, never prose; no hook mutates the token stream. Redesigned to what
hooks *actually* do, strongest-first:

1. **Retrieve-and-inject (the real fix — Enforcement-H2).** The `UserPromptSubmit` hook, on a RuvNet-topic
   or architecture-decision prompt, **runs the KB query itself and injects the real source passages into
   context.** Claude then answers **from in-context truth**, not from a mandate it can decline. This
   removes the "answered without querying" hole entirely — grounding is already present.
2. **`PreToolUse` HARD-DENY (the one real harness tooth).** Deterministically **block** banned actions:
   installing/writing `pgvector`/`pinecone`/`chromadb`/`weaviate` deps, or edits hand-rolling cosine/JSON
   embeddings, **when an RVF/RuVector path exists** — with a message pointing at the RuvNet equivalent.
   This is genuine enforcement (a tool action, not prose).
3. **`Stop` hook = semantic grounding judge (not citation-presence).** Runs the §6.2 rubric (lightweight):
   "does this RuvNet answer recommend a non-RuvNet vector store for a vector task / dismiss a RuvNet
   capability without supporting citation?" If yes, re-open once. Post-hoc and honest — not "mid-draft."
4. **Drift detection is semantic, not a keyword denylist** (Enforcement-H4): embedding-similarity to a
   drift centroid + the Stop-judge, because "a managed vector store" carries the drift with zero banned
   tokens and "unlike pgvector, RVF…" must NOT false-positive.
5. **AIMDS** guardrail inbound/outbound (standing rule).

**Honest limits, stated not buried:**
- The grounding/hooks live in **host config (`settings.json` / `CLAUDE.md`), not inside `brain.rvf`** — so
  "drop one file and the magic travels" is **false for enforcement**; the hook pack is installed per host
  (Enforcement-H6).
- Full strength is **Claude Code only**; Cursor/Codex/API get the embedded directive + injected context
  but no hard-deny. We ship the strongest per host and document the gradient.
- We **do not claim "can't drift."** We claim a **measured drift-rate SLO** (e.g., ≤2% on the adversarial
  bait set) reported every version. Enforcement that isn't measured is theater (Enforcement-H5, verdict).

---

## 6. Proof — integrity (crypto) + quality (ground-truth + multi-vendor), kept separate

### 6.1 Integrity proof — proves ONLY "contains commits X, in full, untampered"
Witness/Merkle root over `(repo, pinned-SHA) → file → chunk → passage` (**vectors excluded from the
reproducible leaves** — embeddings are non-deterministic across hardware, so a third party can recompute
the *source/passage* root but not a vector root; vectors are separately attested as a derived artifact —
Proof-H10). Signed manifest names the **signing identity** and states exactly what the signature assures.
**Forbidden vocabulary in this section's blast radius: "complete," "comprehensive," "world-class."** Crypto
attests *integrity of a chosen scope*; §6.3 attests *size of that scope*; **neither attests correctness of
the scope choice or the answers** (Proof-H3, F8).

### 6.2 Quality proof — ground-truth deep-dive is the gate of record (owner directive)
The instrument that's been wrong for 15 months is an LLM judging RuvNet from memory. So the arbiter must
**anchor on the real source**, not on opinion (Proof-H1/H12, Arch-H7; owner: "the real code is the grader").
- **GATE OF RECORD = automated ground-truth verification.** For every graded answer: (a) extract its cited
  `repo:file:line`(s); (b) **fetch the actual source** at the pinned commit; (c) verify the cited code
  **exists and actually supports the claim** (mechanical span-match + check); (d) an **independent deep-dive
  agent re-answers the same question FROM the raw repo** (not from the KB) and we diff — agreement = pass,
  divergence = flag for review. An answer whose citations don't hold up **fails**, however good it reads.
- **Multi-vendor LLM panel = cross-check (not the final word).** Different families/vendors (e.g. GPT +
  Gemini + Claude) judge completeness/correctness; report inter-judge agreement (κ); a frozen
  **calibration-anchor set** (70/85/95/98 exemplars) re-graded every version detects drift; **test-retest
  reliability measured** so "≥98" isn't false precision (Proof-H5/H6/H9). No single same-family LLM decides.
- **Residual risk, named:** semantic completeness ("did it cover everything important?") still has an LLM
  component that ground-truth checking can't fully replace. Mitigation = the deep-dive re-answer + the
  multi-vendor panel + the L2-weighted audit. This is an **accepted, stated residual**, not a solved problem.
- **Question sets are independence-hardened** (Proof-H2/H7): the held-out and adversarial sets are
  **sourced independently** (real GitHub issues / Discord / user logs, or authored by a different model
  family / humans), **hashed, and burn-after-one-use** — every held-out failure mints a *fresh* set from
  the independent pool; you never re-grade seen items. The **grader is also rotated/held-out** (a model
  never used in the tuning loop judges the final). This breaks the loop-until-green Goodhart trap
  (Arch-H7).
- **Gate:** human-expert sample PASS + LLM pre-filter PASS + per-tier scores reported + drift-rate ≤ SLO.
  Iterations are **capped**; on cap, **human adjudication**, not "loop forever."

### 6.3 Breadth = ingest hygiene (demoted; not a quality claim)
Census-diff coverage%, **with a gated exclusion list**: excluded fraction capped (≤X% LOC), per-path reason
codes, and **§6.2 includes questions that target excluded regions** so exclusion hiding real content
surfaces as an answer-quality failure (Proof-H4, Arch-H8). Breadth proves *files ingested*, never *answers
correct* — it is hygiene, not proof of quality.

---

## 7. Evergreen & versioning — honest cadence and cost

- **Segment-per-repo** (RVF is segment-based; Ask-Ruvnet runs 27 segments). You **cannot** concatenate 169
  HNSW graphs into one "well-routed" index — the global layer is **rebuilt** (O(N log N)) when high-churn
  repos change, OR queries fan out across segments with **cross-segment score normalization**. "Cheap
  incremental" is **deleted**; the real rebuild cost is stated (Arch-H3).
- **Decoupled cadence** (Arch-H9): L3/L4 (walk + symbol/graph) refresh **nightly** for changed repos; the
  expensive L2 synthesis + full §6.2 panel grade run **weekly or on a T0 semantic-diff threshold**, not on
  every daily push of ruflo/RuVector. A real **$/grade-run estimate is produced at P1**, not deferred.
- **Versioning:** `vMAJOR.MINOR.PATCH`; signed manifest + changelog; old versions remain
  downloadable/verifiable. Watchdog (reuse Ask-Ruvnet heartbeat/alert) pages on stale/failed/under-SLO.

---

## 8. Build pipeline (modular segments → normalized global)

```
per repo (parallel, worktree-isolated):
  forge-build (full source) → embed (best/multi-vector, f32) → symbol-index → ADR-status
        │                                                                                  │
        └────── L2 synthesis (T0/T1 only; ≥2 Implemented-code citations; ADR-checked) ─────┘
                                            │
   segment-per-repo store → cross-segment score normalization → zstd block-indexed passages
                                            │
        witness-root (source/passage leaves) + sign  →  multi-vendor pre-filter → GROUND-TRUTH gate → publish vN
```

Per-repo work is parallel — the place for a **Ruflo swarm / Workflow fan-out** (one agent per repo for L2
synthesis + grading), invoked only with explicit go-ahead. Merge/normalize/sign/grade is the deterministic
reduce.

---

## 9. Distribution & UX

- **Download the zip bundle** (or `npx @ruvnet/brain` fetch) — default SKU is **Core (T0+T1)**; the zip
  **includes the forced-grounding wiring** so it's never "download and hope Claude reads it." Version-pinned.
  **Honest framing: "one bundle, one line"** — not "one magic file" (F9).
- Setup = add the line · run the hook-installer for the full grounding (Claude Code) · or paste the L1
  directive (other hosts).
- Optional studio (video/audio/slides/infographic) for humans.
- **Never recommend `@ruvector/rvf-mcp-server`** (stub). Never commit the bundle / never LFS.

---

## 10. Phased roadmap — each phase pasted-proof gated

| Phase | Deliverable | Gate |
|---|---|---|
| **P0** | This spec + 3-way red-team + fixes (**done**); + single-container spike decision + embedder shortlist | Stuart approves direction; **ground-truth + multi-vendor arbiter wired** |
| **P1** | **ruflo PoC**: full 5-layer; **measures**: best embedder/multi-vector, point-deeper hit-rate, real bundle size, real $/grade-run, retrieve-and-inject **drift-rate**; **ground-truth verifies the sample** | breadth hygiene · multi-vendor pre-filter PASS · **ground-truth gate PASS** · drift-rate ≤ SLO · all numbers real & pasted |
| **P2** | T0 (RuView, RuVector) + first normalized multi-segment bundle | per-repo gates + **cross-segment routing eval** (no confusion) |
| **P3** | T1 merged | full panel, **per-tier** scores ≥ bar across T0+T1, ground-truth-gated |
| **P4** | T2 + evergreen automation + **stated $/night** | nightly proven on a real upstream push · watchdog pages |
| **P5** | T3 + public release (signed v1.0.0, studio) | signed manifest · public `verify` reproduces source root · ground-truth-gated release |

No phase is "done" without pasted proof **and** the ground-truth/multi-vendor sign-off where the gate requires it.

## 11. Red-team finding → resolution (3-way review; carried into v0.2→v0.3)

| # | Finding (severity) | Resolution (v0.2/v0.3) |
|---|---|---|
| Arch-H1 | "one file" is fiction; toolchain is 3-part sidecar (CRIT) | §3/§9 ship honest **bundle**; single-container = deferred **P0 spike** |
| Arch-H2 | size ~1.5–2× low; 600 MB undroppable; no-LFS (CRIT) | §4 honest budget + **tier SKUs** + `npx` fetch, never committed |
| Arch-H3 | HNSW merge not cheap; one-index vs modular conflict (CRIT) | §7/§8 **segment-per-repo + cross-segment normalization**; "cheap" deleted |
| Proof-H1/H12, Arch-H7 | proof ends in captured LLM grader (CRIT) | §6.2 **ground-truth-against-real-source gate of record** + multi-vendor panel; no same-family LLM decides |
| Proof-H2/H7 | held-out builder-authored & spendable; bait circular (CRIT) | §6.2 **independently sourced, hashed, burn-after-use**; rotated grader |
| Proof-H3, Arch-H8 | crypto overclaims "complete/comprehensive" (CRIT) | §6.1 **restricted vocabulary**; breadth+crypto demoted to hygiene |
| Enf-H1/H2/H3/H6, Arch-H6 | hooks can't intercept prose; "can't maneuver" false (CRIT/HIGH) | §5 **retrieve-and-inject** + `PreToolUse` hard-deny + Stop semantic judge; "lock" dropped |
| Arch-H5 | prose embedder over 75%-code corpus (HIGH) | §4 **code-aware embedder benchmarked at P1**, top lever |
| Arch-H4, Proof-H9 | L2 net-new hand-wave; F2 relapse (HIGH) | §3 L2 **T0/T1 only, ≥2 Implemented-code citations, ADR-checked, audit-weighted** |
| Proof-H8 | eval samples ~25/169; "entire ecosystem" overclaim (HIGH) | §0/§2 claim = **world-class T0/T1, breadth-attested beyond**; per-tier scores |
| Proof-H5/H6 | false precision; grader drift (HIGH) | §6.2 **calibration anchor set + measured test-retest reliability** |
| Enf-H4 | lexical denylist evadable/false-positive (HIGH) | §5 **semantic drift detection**, not keywords |
| Proof-H4, Arch-H8 | self-graded breadth denominator (HIGH/MED) | §6.3 **gated exclusion list** + panel questions on excluded regions |
| Enf-H5, verdict | enforcement unmeasured (HIGH) | §5 **drift-rate SLO reported every version** |
| Arch-H9 | evergreen "cheap" ignores high-churn cost (MED) | §7 **decoupled cadence + real $/run at P1** |
| Arch-H10, Proof-H11 | SQ8 asserted; n=1 generalization (MED) | §4 **conditional, measured on 2–3 repos, answer-quality metric** |
| Proof-H10 | non-reproducible if vectors in Merkle leaves (MED) | §6.1 **vectors excluded from reproducible leaves**; signer named |
| Proof-H9, Arch-H7 | pseudo-independent same-family judges (MED) | §6.2 **different-vendor judges + κ reported** |

**Accepted residual risks (named, not solved):** semantic-completeness judgment still has an LLM component
the ground-truth check can't fully replace (mitigated by the deep-dive re-answer + multi-vendor panel, not
eliminated); L2 remains the highest novel-error surface even with guards; cross-segment normalization
quality is unproven until P2; the single-container goal may never pass its spike (the zip bundle is the
fallback); effectiveness-first means v1 is large (~1–1.5 GB) — accepted by owner directive.

## 12. What I will NOT claim until proven
No "complete / comprehensive / world-class," no score, no "can't drift," until: signed integrity manifest +
breadth hygiene + **ground-truth/multi-vendor gate PASS** + per-tier panel scores + drift-rate ≤ SLO —
**all pasted**. Crypto vocabulary is restricted to "contains commits X, untampered." Every interim status
names what is built, what is graded and how, and what is **NOT verified** — explicitly. That, plus grading
every answer against the real source, is the actual fix for the 15-month pattern.
