# ADR-0005: Behavioral grounding via retrieve-and-inject + hard-deny + drift SLO (not a "lock")

**Status:** Accepted (2026-06-27) · **Red-team origin:** Enf-H1/H2/H3/H6, Arch-H6

## Context
v0.1 claimed Claude Code hooks could intercept a drafted prose answer and "rip it back." They cannot:
`PreToolUse` sees only tool name+input, never prose; no hook mutates the token stream. "Can't maneuver" was
false, and a lexical denylist is paraphrase-evadable and false-positives on correct contrastive answers.

## Decision
Defense-in-depth, strongest first: **(1) Retrieve-and-inject** — the `UserPromptSubmit` hook runs the KB
query itself and injects real source passages, so the agent answers *from* in-context truth, not a decline-
able mandate. **(2) `PreToolUse` HARD-DENY** — deterministically block installing/writing pgvector/pinecone/
chroma/weaviate deps or hand-rolled cosine/JSON-embeddings when an RVF path exists (the one real harness
tooth). **(3) `Stop` semantic judge** — re-open once if a RuvNet answer dismisses a capability without a
supporting citation. **(4) Semantic** drift detection (embedding-similarity to a drift centroid), not
keywords. We claim a **measured drift-rate SLO** (e.g., ≤2% on the adversarial bait set), never "can't drift."

## Consequences
- Honest: the grounding/hooks live in host config, not inside `brain.rvf`; full strength is Claude Code,
  weaker on Cursor/Codex/API (documented gradient).
- Enforcement is *measured* every version, not asserted.

## Alternatives rejected
- *"Behavioral lock" / mid-draft interception* — not a real hook capability; theater.
- *Keyword denylist as the detector* — evadable + false-positive; replaced by semantic + injection.
