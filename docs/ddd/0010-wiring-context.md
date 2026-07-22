# DDD-0010 — The Wiring bounded context

Governs **ADR-037** (provable wiring).

**Status**: Proposed (2026-07-22)

---

## Why this context exists separately

Quality (DDD/ADR-011, the verified-quality program) answers *"is this code correct?"* — it reasons
about **behaviour under test**.

Wiring answers a question tests structurally cannot: *"does the product invoke this at all?"* It
reasons about **reachability on a real user path**.

The seam matters because these two look identical from inside a test suite and diverge completely in
production. All seven of the original 2026-07-22 incidents had **passing tests**. A test imports the
module directly — it is the one caller whose existence proves nothing, because the test would pass
just as green if every other caller in the repository vanished. Correctness and reachability were
treated as one property, and the gap between them is where the project shipped seven features that
did nothing.

The distinction generalises beyond this repo, which is why it earns its own context rather than
living inside Quality: **coverage measures whether code was exercised; wiring measures whether the
product reaches it.** `agentic-qe` ships coverage analysis
(`agentic-qe/.opencode/skills/qe-coverage-analysis.yaml`, retrieved 2026-07-22) and answers the first
question well. It does not answer the second, and no amount of the first implies the second.

---

## Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Caller** | A non-test, non-self reference from a place the product actually executes | any mention of the module's name |
| **Wired** | Has at least one Caller | built · tested · documented · shipped |
| **Shippable module** | A first-party module expected to be reached by the product | every file in `scripts/` |
| **Exemption** | A recorded claim that a module needs no Caller, with a named Invoker | permission to skip the gate |
| **Invoker** | *Either* a path the gate can verify mentions the module, *or* the literal `human` | a sentence describing who runs it |
| **Provable exemption** | Invoker is a path; the gate confirms it exists and references the module | a reason that sounds checkable |
| **Unprovable exemption** | `invoker: 'human'` — no file invokes it because a person does | an excuse, or a place to hide |
| **Held** | Built, correct to keep, knowingly unwired, with a stated bar to clear | standalone |
| **Search root** | A directory the caller scan actually reads | everywhere callers might live |
| **Blind spot** | A place callers genuinely live that is not a Search root | a module that is truly unwired |

The last two carry the whole ADR. Before ADR-037 the gate had a Blind spot (`.github/`, root
`package.json`) and no vocabulary to name it — so four Blind-spot cases were recorded as Exemptions,
which is the only word the gate offered. **A missing term forced a false statement.**

---

## Aggregates

### `WiringAudit` (aggregate root)

Owns the judgement of the whole repository at one moment. Invariants:

- Every shippable module resolves to exactly one of: **wired**, **exempt**, **held**, **unwired**.
- No module may be silently absent from the audit. Held work is printed on every run, pass or fail —
  an unwired feature nobody can see is how a gap becomes permanent.
- The audit fails if any module is **unwired**, or if any **exemption is unprovable while claiming a
  path Invoker**.

### `Exemption` (entity, identified by module base name)

- Invariant: `invoker` is either an existing path referencing the module, or exactly `'human'`.
- Invariant: **no duplicate identity.** Two entries for one module is a contradiction, not an
  override — JavaScript's last-wins silently discarded one on 2026-07-22 and nothing noticed.
- An Exemption whose path Invoker stops referencing the module becomes **invalid**, and invalidity is
  a gate failure, not a warning. This is the mechanism by which a stale exemption cannot age into
  folklore.

---

## Domain events

| Event | Meaning | Consumer |
|---|---|---|
| `ModuleFoundUnwired` | Built, tested, reached by nothing | release path — refuses |
| `ExemptionInvalidated` | A named path Invoker no longer invokes the module | release path — refuses, naming the claim |
| `DuplicateExemptionDetected` | One module claimed twice | release path — refuses |
| `HeldWorkReported` | Deliberately unwired work, with its bar | the human, every run |

`ExemptionInvalidated` is the event that did not exist before ADR-037, and its absence is precisely
why four false claims survived. An exemption could only ever be created, never falsified.

---

## Anti-corruption boundary

Wiring does **not** decide whether a module is *worth* keeping — that is a product judgement, and a
gate that made it would start deleting things. It decides only whether the product reaches it, and
reports. Removal is always a human act.

Wiring also does not consume test results, deliberately. Accepting "it has tests" as evidence of
reachability is the exact inference that produced the seven incidents, so the boundary refuses that
input by design rather than by convention.
