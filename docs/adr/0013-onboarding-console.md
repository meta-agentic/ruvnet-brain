---
id: ADR-0013
title: The Onboarding Console — RuvNet Brain becomes a mirror, an advisor, and only then a configurator
status: Proposed
date: 2026-07-14
authors: [Stuart Kerr, Claude Code]
tags: [onboarding, ux, config, stack, memory-health, savings, safety]
supersedes: []
related: [ADR-0012 (grounding gate), ruflo/plugins/ruflo-ruvector ADR-0001 (pin + smoke-test contract)]
---

## Context

RuvNet Brain is a passive knowledge base. It answers when asked. Everything else about
adopting rUv's stack — what to install, where it lives, whether it is current, whether it is
even *working* — is left to the user, and the evidence says the user cannot see it.

We know this because we just measured a machine that has been carefully tended for months
(2026-07-14, Stuart's M3 Max — the most RuvNet-literate machine in existence outside rUv's own):

| Finding | Measured |
|---|---|
| Global stack packages | 40 |
| Behind the registry | **0** |
| **Broken installs** (present, no readable version) | **1** (`@ruvector/edge-net` — half-written, `sharp` orphan inside) |
| **Stale shadow copies in the npx cache** | **15** — incl. `@ruvector/rvf@0.1.9` while global was `0.2.3` |
| **Global installers fighting each other** | **2** — nightly `@alpha` vs hourly `@latest` |
| **`npx <pkg>@tag` calls wired into tool-use hooks** | **~190, across 16 projects** |
| Package specs in use for the same tool | **3** (`@claude-flow/cli@latest`, `claude-flow@alpha`, bare `claude-flow`) |
| Places comparing versions with `!=` (fires in EITHER direction) | **3** — one of which *executes* `npm install -g` |

None of this was visible to the operator. Every command "worked". Every `--version` printed a
plausible number. The update nag was confidently telling him to **downgrade**.

Two facts make this a product problem rather than one man's mess:

1. **The user did not write those 190 npx hooks. `init` did.** They are the ecosystem's default.
   Every RuvNet user on earth has this configuration, therefore every RuvNet user has the shadow
   risk, the per-call npx latency, and no single place to answer "what am I actually running?"

2. **npx does not merely fail to catch drift — it manufactures the illusion of currency.** It runs
   its own private copy from `~/.npm/_npx`. The command succeeds, the version string is new, and
   the binary the MCP server actually executes quietly rots. A check that cannot fail protects
   nothing; a check that *reports health while broken* is worse than no check.

Meanwhile the capabilities that would most help a newcomer — MetaHarness routing, Agentic-QE,
AgentDB memory — are invisible until someone tells you they exist, and unverifiable after that.

### The constraint that shapes everything

Hundreds of people will use this. **Many are far more advanced than we are, and we do not know how
they are using it.** A configurator that assumes their setup is wrong, mutates it to match our
opinion, or presents a single "Fix everything" button is a configurator they will uninstall — and
they will be *right* to. Heavy-handedness is not a UX flaw here; it is a correctness flaw, because
we do not have the information required to be confident.

## Decision

Build the **Onboarding Console**: a locally-served, static web page that RuvNet Brain renders from
real machine state. It obeys one ordering, and the ordering is the whole design:

> **Mirror → Explain → Recommend → (only on explicit consent) Apply → Undo.**

### The five principles (each exists to kill a specific failure)

1. **Read-only by default.** The page renders without changing anything. Opening it can never alter
   a working setup. *Kills: the configurator that breaks the expert's machine on first launch.*

2. **Accuracy earns the right to advise.** The first thing a user sees is not our recommendation —
   it is **their own setup, described more accurately than they could describe it themselves**,
   including things they did not know (a shadow copy shadowing their global; 1.4s of npx resolution
   on every tool call). *Kills: the advice nobody trusts because the tool clearly doesn't understand
   their machine.*

3. **Existing choices are data, not errors.** If someone deliberately runs npx everywhere, we do not
   say "wrong". We show the tradeoff with numbers and let them choose. *Kills: condescension toward
   users who know more than us.*

4. **Every recommendation carries evidence, cost, and a reversal.** No item may appear without:
   what we observed, what changes, what it costs (time/latency/$), and the exact undo. A change with
   no recorded inverse may not be offered. *Kills: the irreversible "helpful" mutation.*

5. **Every number traces to a receipt.** No estimated savings. No "up to 90%". If we cannot show the
   measurement, the number does not appear. *Kills: the dashboard that inflates its own value —
   the exact sin our own scoring rule (no inflated scores) already forbids.*

### Sections (progressive disclosure — each collapsed, each independently useful)

| # | Section | Answers | Powered by |
|---|---|---|---|
| 1 | **Your stack** | What is installed, is it current, is there more than one copy, is anything broken? | `scripts/stack-sync.mjs --audit` (built, working) |
| 2 | **How it's wired** | Do your tools resolve via npx (slow, shadow-prone) or a global binary? Where? | hook/MCP surface scan |
| 3 | **What we'd suggest** | Ranked, evidenced proposals — each with diff, cost, undo | Recommendation engine |
| 4 | **Is your memory actually working?** | Not "is AgentDB up" — *does recall return the right things after a compact?* | Memory-health probes |
| 5 | **MetaHarness** | What it does; the zero-cost setup for *your* harness; what it has actually saved you | Savings ledger (receipts only) |
| 6 | **Agentic-QE** | Same shape: what it is, your setup, your receipts | Savings ledger |

Sections 5–6 are the template: **explain → personalize → prove.** New capabilities plug in as new
sections without redesigning the page.

### The delivery-mechanism question, answered

Stuart asked: plugins? global installs? npx everywhere? a post-prompt processor? Our recommendation,
grounded in what we measured rather than taste:

| Thing | Mechanism | Why |
|---|---|---|
| **CLIs the hooks/MCP execute** | **Global install, one copy, nightly synced** | npx demonstrably shadows and lies (15 stale copies found). A global binary is one path, one version, verifiable. |
| **Skills / agents / hooks / commands** | **Plugin** | Per-user, versioned, reversible, no PATH surgery. |
| **Model-facing tools** | **MCP server pointed at the absolute global binary** | Never `npx` in an MCP command: it re-resolves on every launch. |
| **Prompt optimization** | **Advisory injection + an explicit command. NOT a silent rewriter.** | See below. |

**We recommend AGAINST a silent post-prompt processor that rewrites the user's prompt.** It is the
purest form of heavy-handedness: it changes what the user said, invisibly, and it will mangle the
carefully-worded prompts of exactly the advanced users we must not break. Instead: keep the advisory
context injection (which adds, never replaces) and offer an explicit, invocable optimizer the user
chooses to run. *The user's words are theirs.*

### Section 4 deserves its own note: memory health is a QUALITY question

"Is AgentDB working" is a liveness check and it is nearly useless — the store answered fine
throughout the 2026-05-31 incident where memory was reported broken three times and never was.
The question that matters is **does recall return the right things when it counts**:

- **Liveness** — does a real store→search round-trip work on the path actually in use?
- **Coverage** — does this project have a checkpoint at all, and how stale is it?
- **Recall quality** — given a synthetic question about the project, does top-k actually contain the
  checkpoint? (This is *measurable*, and nobody measures it.)
- **Compaction survival** — was a PreCompact snapshot written?
- **Session surfacing** — does session start actually put the project's state in front of the model?

Score 0–100 with **named deductions and evidence per deduction**. A known-broken dimension caps the
score. No dimension may be scored from an assumption.

## Consequences

**Positive.** A newcomer gets an onboarding ramp instead of a wall. An expert gets a mirror that
tells them something true they did not know, and never touches their machine without consent. Every
capability becomes discoverable and *provable* rather than folkloric.

**Negative.** Read-only-by-default plus per-item consent means adoption is slower than a "Fix
everything" button would give us. That is the correct trade: we do not have the information required
to be confident about a stranger's machine, and pretending otherwise is how we earn a reputation for
breaking things.

**Risk we are accepting.** The page reports on a machine it does not control. Between render and
apply, state can change (a nightly job, another window). Therefore **apply re-reads state and
re-verifies before mutating**, and refuses if the world moved. Stale-read-then-write is how the
concurrent-session clobber happened on 2026-07-12; we do not repeat it.

## Verification

This ADR is not accepted until:
1. `stack-sync --audit` exits non-zero on a machine with drift and zero on a clean one. *(Done — verified live 2026-07-14.)*
2. The console renders with **zero writes** — provable by running it against a read-only filesystem.
3. Every recommendation object fails schema validation if it lacks `evidence`, `cost`, or `undo`.
4. Memory-health scoring refuses to emit a score for any dimension it did not actually probe.
