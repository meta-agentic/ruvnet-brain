# Adversarial duel — ADR-041, the ground-truth fixture machine

**Date:** 2026-07-23 · **Duelists:** Fable 5 (assigned "synthetic-fixture + mutation test") vs
GPT-5.6/codex (assigned "only real machine-state is falsifiable") · **Governs:** ADR-041, ADR-028's
Recall (≥0.80) and False-alarm (=0) acceptance metrics.

## The question

Recall and false-alarm need a ground-truth fixture. The trap ADR-041 names: a fixture you author, fed
to a detector you author, scores 100% by ECHO — a number that cannot fail on a broken detector is
fabrication. Fork: **(A)** synthetic registry fixtures (fast, but risk echo/stubbing the probe) vs
**(B)** real reproducible machine state (honest, but slow/nondeterministic).

## What each side defeated

**GPT-5.6 defeated pure-(A).** A synthetic `auditAll` **stubs out the exact thing recall is about** —
the probe. Every shipped lie in this subsystem (`capability-registry.mjs` "26 hooks off" vs 457
trajectories; the matcher-group count that fabricated ON on a machine that saved nothing; launchctl
"-" counted as clean exit) lived in the probe layer a stub replaces — a pure-A harness would have
scored 100% through all of them. And pure-A **structurally cannot measure false-alarm=0**: with rows
stubbed honest, false-alarm is a tautology, the exact "cannot fail on broken code" the house rule bans.

**Fable 5 defeated pure-(B).** Real-state has its **own echo one layer up** — the installer authors the
ground truth, and a silently half-failed install (hook not really registered, daemon not really
stopped) scores recall against a wrong manifest *with real-machine confidence*. Plus B is
nondeterministic (the WAL race that read a store "unreadable" then "1201 memories" 90s apart) and
expensive at CI scale (an earlier real-probing `auditAll` once left a live daemon and wrote four files
into HOME — that incident, nightly, ×3 for the mutation runs). Decisively: the detector **LOCATES,
never EXECUTES** — it only reads artifacts (`fs.existsSync`, JSON parse, `sqlite3` CLI), never behavior
— so "install real ruflo and run it" buys fidelity *above the detector's own measurement ceiling*.

## Convergence — the fork was false

Both landed on the **same boundary**: real detector + real filesystem/SQLite artifacts + real matcher +
real hook + **independent manifest**, in a scratch `HOME`/`PATH`/`--project` (every probe input is
already env-redirectable — no mocking). B's honesty (real probes) and A's determinism (constructed
artifacts) are simultaneously achievable because the detector only ever reads artifacts. The echo trap
dies by **separation of authorities**: the manifest speaks only state-vocabulary and the detector never
reads it. Measurable cohort = 4 portable capabilities (breaking one → 0.75, failing the 0.80 bar — the
mutation test's teeth); `learning-hooks`/`nightly-refresh` excluded (no falsifiable dormant state).
Four mutation tests prove the harness fails on a broken detector, incl. a false-POSITIVE probe mutant
that makes false-alarm nonzero — the tautology hole pure-A could never cover.

GPT-5.6's extra precision (exact 4 capabilities, exact mutation line numbers, the real
`advocacy-outcomes.jsonl` OFFERED rows as the recall signal) and Fable 5's extras (two-boundary
harness, the `infra-killed` watchdog retry, the schema-drift nightly job as the one thing bought from
reality) are all folded into ADR-041's Decision.

**Net:** each duelist killed the other's central error — GPT-5.6 killed "a stub can measure recall,"
Fable 5 killed "you must reproduce a real machine" — and the survivor is a design that is both
falsifiable and deterministic-in-CI. Unlike ADR-040, this one moves the score: two acceptance metrics
become real numbers, in-fence.
