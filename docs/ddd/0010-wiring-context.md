# DDD-0010 — The Wiring bounded context

Updated: 2026-07-27
Created: 2026-07-22

Governs **ADR-037** (the wiring gate cannot fail).

**Status**: Proposed (2026-07-22)

> Rewritten 2026-07-22 after adversarial review. The first draft modelled an `Exemption` entity with
> a `{path, human}` invoker taxonomy; review proved that category empty at fixpoint, and it is gone.
> One thing from the first draft survived intact and turned out to be the most useful line in the
> document — see **Reachability** below.

---

## Why this context exists separately

Quality (ADR-011) answers *"is this code correct?"* Wiring answers *"does the product reach it at
all?"*

The seam is real: all seven of the 2026-07-22 incidents had passing tests. But the first draft
overstated why, claiming tests "structurally cannot" prove wiring. That is false and review caught
it. A **unit** test that imports the target proves nothing — it is the one caller whose existence is
guaranteed by its own file. An **integration** test that drives the release path, the CLI registry,
or the installed product absolutely can prove reachability. The limitation belongs to the tests this
repo happened to write, not to testing.

Corrected: *coverage measures whether code was exercised by a harness; wiring measures whether the
**product** reaches it.* `agentic-qe` ships coverage analysis
(`agentic-qe/.opencode/skills/qe-coverage-analysis.yaml`, retrieved 2026-07-22 — external repo,
unverifiable from inside this one) and answers the first well. Neither implies the other.

---

## Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Caller** | A reference that would **execute** the module, from a place the product runs | **any mention of the module's name** |
| **Reachability** | Existence of a Caller | correctness · coverage · having tests |
| **Wired** | Has ≥1 Caller | built · tested · documented · shipped |
| **Inventory** | The set of modules the audit considers at all | everything first-party |
| **Invisible module** | First-party executable outside the Inventory | a module that is unwired |
| **Exempt** | Recorded as needing no Caller, with a reason | proven to need no Caller |
| **Held** | Built, kept, knowingly unwired, with a stated bar | exempt |
| **Predicate** | The rule deciding whether a reference is a Caller | the search roots |

### The Caller definition is the whole document

That row — *Caller is **explicitly not** any mention of the module's name* — was written in draft 1
and is correct. `callersOf()` implements **precisely** "any mention of the module's name."

**The domain model disclaimed the implementation, in writing, and the contradiction sat unnoticed
while an entire ADR was written about a different part of the system.** Draft 1 read its own glossary
and still went after the allowlist. A model that names the right invariant does nothing if nobody
diffs it against the code.

### Invisible ≠ unwired

An unwired module is *reported*. An invisible one is never considered, prints nothing, and appears in
no count. Measured 2026-07-22: **40 of 129 first-party executables are Invisible** — including
`plugin/scripts/anticipate.sh`, one of the seven founding failures.

The allowlist governs 25 modules inside the visible 69%, each carrying a written justification. The
Inventory silently excludes 40, with no entry, no reason, and no output. **The larger hole is the one
nobody had to write a sentence to justify** — which is why "where can code hide" beats "what does the
allowlist say" as the organising question of this context.

---

## Aggregates

### `WiringAudit` (aggregate root)

Every module in the Inventory resolves to exactly one of **wired · exempt · held · unwired**, and the
four counts sum to the Inventory size. Printing that sum is the invariant, not a nicety: today
`STANDALONE` modules are never printed in any run, so the audit's own output cannot be reconciled
against what it examined.

Invariants:
- The four states are exhaustive and mutually exclusive.
- Counts sum to the Inventory. A run that cannot show this is not an audit.
- **The Inventory is itself reportable.** A module excluded by file type or directory must be
  countable, or the aggregate is lying by omission rather than by assertion — the harder lie to see.

### `Exemption` (value, not entity)

Reduced deliberately from draft 1's entity. An exemption is a **name plus a human-written reason**,
carrying no machine-checkable structure, because review proved the checkable form vacuous: an invoker
the scanner can verify makes the module *wired*, so the exemption is never consulted; an invoker it
cannot verify means the search roots are wrong.

Invariant: **no duplicate names.** Two entries for one module is a contradiction, not an override.

The honest consequence: an exemption's reason is **prose, and prose is not verification.** Draft 1
tried to fix that with a schema. The truth is simpler and less comfortable — the reasons were written
by an author who never ran the check, in the same commit as the gate, and no type system detects
that. The mitigation is (a) needing far fewer exemptions once the Predicate is correct, and (b)
printing every one on every run so they stay visible.

---

## Domain events

| Event | Meaning | Consumer |
|---|---|---|
| `ModuleFoundUnwired` | In the Inventory, no Caller | release path — refuses |
| `DuplicateExemptionDetected` | One module claimed twice | release path — refuses |
| `ExemptSetReported` | The full exempt list, every run | the human |
| `InventoryReported` | What was examined, and what was excluded | the human |
| `HeldWorkReported` | Deliberately unwired work, with its bar | the human |

The last two are new and carry the correction. Draft 1 had no vocabulary for "examined nothing" as
distinct from "examined and found nothing" — so a gate reporting **62/62 wired, exit 0** read as
health when it was silence.

---

## Anti-corruption boundary

Wiring does not judge whether a module is *worth* keeping — that is a product decision, and a gate
making it would start deleting things. It reports reachability. Removal is a human act.

Wiring does not consume unit-test results as evidence of reachability. Not because tests cannot prove
it — the corrected framing above concedes integration tests can — but because *importing a module is
not the product reaching it*, and accepting that inference is what produced the seven incidents.
