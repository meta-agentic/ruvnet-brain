---
id: ADR-032
title: The capability surface — on, off, and the third answer we keep refusing to give: unknown
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [console, capability, honesty, derived-status, advocacy, settings, anti-nag]
supersedes: []
relates: [ADR-024, ADR-027, ADR-028, ADR-0013, ADR-020]
---

**Status**: Proposed (2026-07-22)

**Updated 2026-07-22** — reconciled to the advocacy-dial adversarial duel (Fable 5 + GPT-5.6); the
converged design and the decisions it forced are in §"Adversarial review and the reconciled design".
Governing DDD-0004 moved to v1.1.0 in the same pass.

Governed DDD: `docs/ddd/0006-capability-context.md` (capability surface) · `docs/ddd/0004-advocacy-context.md` (the advocacy dial)

ADR-027 said dormant-but-installed is a defect. ADR-028 said a page you must visit is not
proactivity. Neither said **what a capability's state actually is, how you are allowed to know it,
or what the surface may say when it does not know.** That gap is where three separate lies got in.

## The failure that forced this

### 1. We built the detectors and wired them to nothing

`scripts/capability-audit.mjs` contains three real detectors, each returning a real finding with real
evidence. Verified 2026-07-22:

```
$ grep -rn "capability-audit\|auditCapabilities" scripts console plugin package.json
(no output)
```

**Zero call sites outside the file itself.** Run by hand right now, its third detector fires with the
single loudest fact on this machine — verified live, same day:

```
$ ~/.npm-global/bin/ruflo hooks list   →  26 rows, "Enabled: No" on every one
```

26 learning hooks installed. Zero enabled. Executions blank, Last Executed `Never`, on all 26. This
is precisely ADR-027's North Star case — installed, dormant, expensive — and the code that finds it
has never once rendered to a human. ADR-028 measured a 21-day latency-to-surface and called it the
number this project exists to destroy. Here the latency is not caused by missing data or missing
code. Both exist. Nothing connects them, because nothing said what a capability surface *is*.

### 2. The panel already tells a verified lie about capability state

`console/activity.js:337` and `:411` render, verbatim:

> *"0 lessons recorded yet. Lessons are captured manually: run `record-lesson` in this project to
> keep one. There is no automatic distillation into lessons yet."*

That count comes from the AgentDB `lessons` namespace. Meanwhile, verified live 2026-07-22:

```
$ node -e "loadLessons() from scripts/lesson-store.mjs"  →  count 12  |  byStatus {"candidate":12}
   ~/.config/ruvnet-brain/lessons.json, 13,842 bytes
```

A user with twelve lessons is told they have none, and is then told a *general* claim about the
product ("there is no automatic distillation yet") on the strength of one unnamed store being empty.
Both halves are wrong, and the standing order is unambiguous: the product can never lie. The
mechanism of the lie is the thing to fix — **the panel asserted a scope it never named.** It said
"lessons", meant "one namespace in one database", and the user had no way to tell the difference.

### 3. A green light wired to a wall

`scripts/onboarding-console.mjs:189`:

```js
function sessionHookExists() {
  return fs.existsSync(path.join(HOME, '.claude/hooks/agentdb-ensure.sh')) || fs.existsSync(path.join(HOME, '.claude/hooks'));
}
```

The second disjunct is directory existence. `~/.claude/hooks` exists on essentially every machine
that has ever run Claude Code, so `sessionSurfacing` renders `ok` almost unconditionally. This is
not a fabricated number — ADR-020's gates would catch that — it is something subtler and, in a
capability panel, worse: a **derivation so weak it is indistinguishable from a strong one on screen.**
ADR-024 established that a status must be re-derived from the verifiable artifact. It did not
establish that the *strength* of the derivation must be visible. It must, or checks decay into
decoration and nobody can tell which ones already have.

### What the three have in common

Not fabrication. Every one of them reads something real. The defect is that the surface presents
`on` / `off` as if those were the only two answers, so every gap in knowledge gets rounded to one of
them — usually to the reassuring one. **A binary vocabulary forces a lie whenever the truth is "I
could not check."**

## Decision

### 1. State is DERIVED from a named artifact, never asserted — and the artifact is named on the surface

Extends ADR-024 from job receipts to capability state. Every rendered capability state carries the
artifact it came from (a file path, a command, a config key) and the time it was read. Not in a
tooltip of last resort: on the surface, legible, because §3 above proves that an unnamed derivation
is a derivation nobody audits.

A capability whose artifact cannot be identified may not be rendered as `on` or `off`. It renders
`unknown`, and says which check it could not run.

### 2. `unknown` is a first-class state, equal in standing to `on` and `off`

Four states, and a fifth is prohibited:

| State | Means | Requires |
|---|---|---|
| `on` | The artifact shows it active | A read that succeeded |
| `off` | The artifact shows it inactive | A read that succeeded |
| `unknown` | The probe did not complete, or completed ambiguously | A stated reason |
| `absent` | The artifact shows it is not installed at all | A read that succeeded |

`unknown` and `absent` are different claims — "I could not check" versus "you do not have it" — and
DDD-0004 already forbids conflating them inside the audit. This ADR extends that invariant to the
render, which is where it kept getting lost: an omitted row and an absent capability look identical
to a reader, so **a capability that could not be probed must still appear, marked `unknown`.**
Silence is not a permitted way to express doubt.

There is no `partial`, no `probably`, no `degraded`. A capability that is on but weak is `on` with a
low evidence tier (§3), because splitting the state axis and the confidence axis is what makes both
of them checkable.

### 3. Every derivation carries an evidence tier, and the tier is visible

| Tier | Meaning | Example on this machine |
|---|---|---|
| `direct` | The artifact reports the state itself | `ruflo hooks list` printing `Enabled: No` |
| `indirect` | The state is implied by an artifact that means something adjacent | a hook command string present in `settings.json` — wired, which is not enabled, which is not ever-fired |
| `inferred` | The state is deduced from a proxy, and the proxy could be wrong | `sessionHookExists()`, which a bare directory satisfies |

The rule that makes this bite: **`inferred` may never be rendered without its caveat.** §3 of the
failure section is exactly what an unlabelled `inferred` looks like after a few months — a green
light nobody re-examines. Where a `direct` artifact exists and we are using an `inferred` one, that
is a defect with a name and a fix, not a style choice.

### 4. "What it buys you" is a claim, and claims are sourced

The panel's third column — the reason to care — is where invented capability enters a product. House
rule 5 forbids inventing RuvNet capabilities; this is that rule applied to benefit copy. Every
benefit claim is one of exactly three kinds, and its kind is recorded:

- **`measured-here`** — a number observed on this machine. The strongest, and the only one permitted
  to carry a magnitude. Precedent: ADR-027's flush took the learner from 5 trajectories to 412 in one
  command, measured before and after.
- **`corpus-cited`** — grounded in rUv's indexed source, with the repo path, obtained through
  `search_ruvnet` per the standing grounding gate. May describe what a capability does; may not
  promise what it will do for this user.
- **`none`** — we know the state and have no grounded benefit. This is a legitimate, renderable
  outcome. It reads "we have not measured what this changes for you." It does not read as a blank,
  and it is never filled in with plausible prose.

### 5. A capability row is read-only information unless a real remedy exists

ADR-027 principle 2 prohibits detection without a remedy. The registry (`scripts/remedy-registry.mjs`)
currently holds seven keys — `memory-index`, `learning-flush`, `learning-train`, `distill-fleet`,
`stack-sync`, `purge-shadows`, `reconcile-project` — and **not one is capability-related**, verified
2026-07-22. Meanwhile `capability-audit.mjs` findings carry `{id, title, severity, evidence[], why,
detail}`: no `cost`, no `change`, no `undo`. They therefore cannot pass
`console-engine.makeRecommendation()`, which throws on each of those three.

That is not a bug to route around. It is the schema gate working. So the resolution is explicit and
it is the conservative one: **capability rows render as information until a remedy with a real
inverse is registered for them.** No button, no toggle, no "Enable" that is really a hyperlink to
documentation. House rule 2 states this generally; this ADR states which side of it the capability
panel starts on, so that the first shipping version cannot quietly cheat.

Turning an information row into an actionable one is a deliberate, separately-reviewed act: register
the remedy, prove the inverse, then the row gains a control. Never the other order.

## The flexibility requirement — a volume dial that cannot make the product murky

Different users want radically different amounts of advocacy. The owner wants everything; a
corporate user on a locked machine may want nothing to ever speak unprompted. Both must be served
without the quiet setting becoming a way for the product to hide bad news from someone who chose
quiet six weeks ago and forgot.

**The invariant that resolves it: the advocacy level governs INTERRUPTION, never AVAILABILITY.**

- The capability panel always shows every capability, in every state, at every level — including
  `off` and `unknown`. It is a pull surface; pulling it is consent.
- The level decides only what is permitted to speak **unprompted** — the L3 in-session channel of
  ADR-028's ladder, which is not built yet (§"Not in this round").

| Level | Speaks unprompted | Panel content |
|---|---|---|
| `silent` | nothing, ever | complete |
| `important` | `IMPORTANT` findings only | complete |
| `all` | `IMPORTANT` and `SUGGESTED` | complete |

`important` is the proposed default, chosen against ADR-028's false-alarm target of zero rather than
against engagement: one false alarm costs more trust than ten true ones earn, so the default speaks
only where the evidence bar is highest.

Two consequences, both deliberate:

- **`silent` is genuinely silent**, with no residual badge, dot, or count nagging from a corner. A
  setting that is only mostly obeyed is worse than no setting, because it teaches the user their
  choices are advisory.
- **`silent` cannot hide a fact from someone who opens the panel.** If a user at `silent` opens the
  console, all 26 disabled hooks are there, in full, in the same words. That is the entire difference
  between configurable and murky.

The write path already exists and is already reversible: `saveConfig()`
(`scripts/onboarding-console.mjs:961`) takes a `0600` backup and journals a `restore-config` undo
before writing `~/.config/ruvnet-brain/config.json`. The advocacy level is one more key in a schema
that already survives ADR-027's reversal requirement. Nothing new is needed to make the setting safe.

## The anti-nag constraint

ADR-027 and ADR-028 both assert it; neither made it precise enough to test, and **nothing implements
it.** Verified 2026-07-22: `grep -rn "dismiss" scripts console` returns only `dismissStandby()` in
`console/app.js:412`, a loading-spinner helper with no relationship to advocacy. DDD-0004 specifies a
`DismissalLedger` aggregate. It does not exist.

The precise rule:

1. **Offered once per state change.** The unit of "once" is the *observation*, not the finding and
   not the session. A finding whose underlying measurement is unchanged has not become newsworthy by
   the passage of time.
2. **Dismissible in one action**, with no penalty and no follow-up question.
3. **Never re-fires while dismissed.** A dismissal is keyed to `(findingId, observationHash)` and is
   append-only, per DDD-0004's ledger invariant.
4. **A materially worse observation re-offers.** 26 hooks off, dismissed, then a store goes corrupt
   — that is a different observation and it speaks. Materially *better* never re-offers, and
   materially *equal* never re-offers. Only the direction that matters to the user reopens the door.
5. **Dismissal is not resolution.** A dismissed finding stays visible in the panel, marked dismissed.
   The user silenced it; they did not make it untrue.

Rules 1 and 4 together are the whole design. Without the observation hash, "once per state change"
degrades into "once per restart", which is a nag with extra steps.

## What is deliberately NOT in this round

- **MCP connection state.** The console does not read `~/.claude.json` at all today (verified: no
  match in `onboarding-console.mjs`), and it holds six global servers — `ruflo`, `ask-ruvnet`,
  `agent-browser-mcp`, `rulake`, `pi-brain`, `paste`. Reading that file is trivial and worth doing;
  **rendering it as "connected" is prohibited.** No local artifact proves a server is reachable, so
  the honest word is `configured`, and the honest state for reachability is `unknown`. A capability
  panel that says "connected" on the strength of a config entry is the `sessionHookExists()` failure
  repeated on purpose.
- **"Is this wired hook actually working?"** Only a receipt proves execution, and
  `gate-blocks.jsonl` records *refusals* only. A hook that fires correctly a hundred times leaves no
  trace. Wired, enabled, and ever-fired are three different facts, and today we can derive the first
  two and not the third. We say so rather than blur them.
- **Per-gate "never fired" claims.** `gates.mjs:116` reduces `byGate` to counts, discarding the
  timestamps already present in the source records — a cheap fix. But block receipts only began
  accumulating on 17 Jul, so absence of a receipt is not evidence a gate never ran. The card already
  carries that caveat and must keep carrying it. Last-fired may be shown; "never fired" may not be
  concluded.
- **Auto-enabling anything.** DDD-0004 rejected silent auto-fix on consent grounds after a corporate
  machine got a background daemon without meaningful consent. Nothing here weakens that.
- **A curated catalog of "cool RuvNet features."** ADR-027 banned it and the ban stands: it would rot
  within a week of rUv shipping, and it is how a capability panel becomes an advertisement.
- **The L3 in-session channel.** This ADR defines the vocabulary, the states, and the budget that an
  in-session channel would spend. It does not build the channel. Per ADR-028 that is 4.0 work, and
  claiming it here would repeat the exact error ADR-027 made when it declared advocacy shipped while
  `buildHealthRecommendations()` was reachable only from `apply()`.

## Adversarial review and the reconciled design (2026-07-22)

Per the standing cross-model rule, this ADR and DDD-0004 were attacked by two models on disjoint
axes. They converged, and the convergence changed the design. Each claim below was re-verified
against the source before acceptance — the models' line citations were leads, not facts.

**1. One dial cannot govern every unprompted utterance — split into three channels.** Both reviewers,
independently. The `off/important-only/all` enum now governs **advocacy only**. **Alarms**
(`HealthDegraded`, `IntegrityFailed`, dead nightly) bypass the dial and always speak — verified: the
brain-health GONG at `session-start.sh:47-60` runs unconditionally, and muting it via `silent` would
make a broken install look healthy. **Promotion** (the Console first-load offer `session-start.sh:85-88`,
the router nudge, "what's new") is one-time onboarding, silenced by anything below `all`, and never
repeats. This is what resolves the otherwise-unresolvable `silent`-vs-GONG contradiction. Modelled in
DDD-0004 §"The three channels".

**2. The setting is DEAD, two ways, and both must be fixed or the dial is theater.**
(a) No emitter reads it — verified: `anticipate.sh` is wired at `hooks.json:52` as bare
`bash … || true`, the one hook that bypasses `hook-shim.mjs`, and gates only on its own kill-switch.
(b) **Two disconnected stores** — the setting lives in `~/.config/ruvnet-brain/settings.json`
(`user-settings.mjs:55`) while the console reads/writes `~/.claude/ruvnet-brain/config.json`
(`onboarding-console.mjs:48`), and `advocacy` is absent from the console schema. A rendered dial would
write a store the runtime never reads. **Decision: unify on one settings module/path** before the dial
is wired; the console imports it, the enforcement runtime reads it.

**3. The enforcement chokepoint is structural, not conventional.** Every advocacy/promotion emitter
routes through one runtime that reads the level + DismissalLedger and alone emits; a raw `echo` is a
protocol violation, dropped not forwarded. Proven by a registry test (the `hook-contract` failsafe
shape) that fails if any such emitter is wired off-runtime, asserting on real process stdout — not the
runtime's structured output, which would be a test with no teeth. DDD-0004 §"The enforcement chokepoint".

**4. `observationHash` specified** (both converged): `SHA-256` over canonical JSON of
`{v, detectorId, findingId, state, severity, material-bands}`, excluding timestamps/prose/paths; a
per-detector `compare()` decides "materially worse". Full spec in DDD-0004 aggregate 4.

**5. The default posture is `important-only`.** The reviewers split — Fable: default `important-only`
(speaks out of the box); GPT-5.6: ask at install, preselect nothing, silent until answered. The
**owner decided** (2026-07-22): *"default recommendation to on, but do not force it on users."* That
is `important-only` as the shipped default — on out of the box for the highest-evidence findings, and
one setting away from silent. GPT-5.6's consent objection ("unprompted-by-default treats missing
consent as permission") is answered by decision 1 — alarms stay out from under the dial, so nothing
that *matters* is ever silenced at any level — and by `off` always being available and fully honoured
(the "do not force").

**Correction, 2026-07-23 — a real regression, caught by the dial's own integration test BEFORE it
shipped (local commit only, never pushed).** The first wiring gated `important-only` on a finding's
*severity*, on the theory a dormant-capability nudge is a low `SUGGESTED` that only `all` should
surface. Verified live: `auditAll()` and `matchGoal()` emit **no severity field**, so that gate
silenced the whole feature at the default and broke seven existing assertions. The honest model:
**`anticipate` produces ONE class of output** — a nudge that has already cleared a high evidence bar
(two independent cues + a confidence floor + once-per-session). Its dial is therefore **off vs on**,
not a severity split it has no data for: `off` is verifiably silent; `important-only` (the default)
and `all` both let the gated nudge through. The `important-only`/`all` distinction is reserved for
emitters that genuinely have a verbosity axis (session-start promotions, health tiers); `anticipate`
does not fake one. Reads the level from `settings.json`, defaulting to `important-only` on any
missing/unreadable/malformed file — a broken settings file must never silently mute the brain.

**6. Tone is a current fail.** Emitters say "this is now yours to fix", "MANDATE (non-negotiable)",
"HARD RULE" (`session-start.sh:38-43,67-73`) — command-and-scold. The rewrite is fact + impact +
optional action + one-tap dismiss.

### Verification items this settles or adds

- Item 5 (a `silent` user gets zero unprompted advocacy but the panel is complete) is now testable
  against a real chokepoint, and the test must read process stdout, not structured output.
- Item 6 (DismissalLedger) has a concrete `observationHash` to build against.
- **New:** a `hooks.json` contract test proving no advocacy/promotion emitter is wired off the runtime.
- **New:** a store-unification test proving the console and the runtime read the same file.

## Consequences

- The console gains a capability panel that is honest on a bare machine by construction: with nothing
  installed, every row reads `absent` or `unknown` with a named reason, and no row reads `0`.
- `capability-audit.mjs` gains its first consumer. Its `ruflo hooks list` subprocess must not sit on
  `/api/state` first paint — it carries a 20-second timeout and would stall the page.
- `detectDisabledLearningHooks()` (`capability-audit.mjs:171`) currently returns `null` whenever
  `enabled > 0`, so it can only ever speak in the all-off case. Under this ADR it must return the
  parsed rows always, because "24 of 26 on" is a state the panel is now obliged to be able to render.
- A new failure mode to watch: a panel of thirty rows mostly reading `unknown` is technically honest
  and practically useless. Honesty about ignorance is the floor, not the goal — every `unknown` that
  has a cheap `direct` artifact behind it is a bug with a deadline.

## Verification (what must be true before this is Accepted)

Nothing below is built. Every mark is honest as of 2026-07-22.

1. ❌ A bare machine with no RuvNet packages renders the panel with zero fabricated values and zero
   misleading `0`s — proven by running it against a fixture home directory, not by reasoning.
2. ❌ A capability whose probe throws renders `unknown` with a stated reason, and is **not** omitted
   — proven by forcing a probe failure and reading the DOM.
3. ❌ Every rendered state names its artifact, and every `inferred` tier renders its caveat — proven
   by a test that fails when a state is constructed without provenance.
4. ❌ The 26-disabled-hooks finding reaches a human surface. This is the single fact that motivated
   the ADR and it has still never been rendered.
5. ❌ A user at `silent` receives zero unprompted advocacy, and the same user opening the panel sees
   every finding in full — both halves proven, because either alone is the failure.
6. ❌ A dismissed finding does not re-fire across a restart, and a materially worse observation does
   re-fire — proven against a real `DismissalLedger`, which does not yet exist.
7. ❌ No capability row renders an actionable control unless `assertRegistryClosure()` resolves its
   id to a remedy with a real inverse — proven by the existing closure test extended to capability ids.
8. ❌ An independent reader who did not build this grades the panel's copy for condescension and
   accuracy, per the standing rule that we never grade our own work.
9. ❌ This ADR and DDD-0006 survive an adversarial cross-model review, per ADR-027 principle 6 —
   which ADR-027 itself has still not done.
