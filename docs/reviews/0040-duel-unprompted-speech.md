# Adversarial duel — ADR-040, the unprompted-speech chokepoint

**Date:** 2026-07-23 · **Duelists:** Fable 5 vs GPT-5.6 (codex) · **Mode:** assigned opposing
stances, adversarial, converge · **Governs:** ADR-040, DDD-0004 §"The enforcement chokepoint"

Recorded per the standing order: no ADR moves to Accepted before its adversarial review is written
here, *including what each side defeated.* This is that record.

## The question

DDD-0004 mandates "every unprompted utterance passes through ONE runtime that reads the level and the
DismissalLedger and alone decides whether bytes reach the user… raw text from an emitter is a protocol
violation." The code does the opposite: `anticipate.sh` reads the dial itself; `lesson-gate.mjs` reads
no dial; both are wired bare in `hooks.json`; the promised registry test does not exist. Fork:
**(A)** implement the chokepoint, vs **(B)** retract it and make per-channel controls honest.
ADR-040 recommended a hybrid leaning (B) for lessons, (A) for advocacy.

## Fable 5 — assigned (B)/hybrid

**Strongest point (survived):** lessons are a **category error** under the advocacy dial. DDD-0004:56
defines Advocacy as "offering a Remedy the user did not ask for"; a lesson carries no Finding/Remedy —
it is the user's own ratified correction, consent-gated by ratification + a per-lesson blocking opt-in
(`lesson-gate.mjs:279`, `:349`) + a per-session cap. The three-channels section (`0004:75-98`) *already*
rejected forcing different consent bars through one knob; shoving lessons under the dial repeats the
error the DDD just fixed. **The copy is the lie that actually ships** — `user-settings.mjs:128` claims
"on 'off', nothing volunteers anything at all," false twice (lessons still fire; alarms bypass by design).

**Defeated on:** its claim that a byte-interposition chokepoint is "unenforceable under CC's hook model,
so it collapses to a test." GPT-5.6 showed this is wrong (below). Fable 5 also conceded W1: a
copy/allowlist test lets a *future* emitter be misclassified and bypass the dial — the forgotten-guard
bug class DDD-0004:104 names.

## GPT-5.6 — assigned (A)-only

**Strongest point (survived) — and it defeated Fable 5's core assumption:** byte-interposition **is**
enforceable. Run each producer as a **captured child process** (`stdio: 'pipe'`, never `inherit`); only
the runtime inherits the real terminal streams. Then "raw bytes are a protocol violation" is
*mechanically* true — a producer that prints rogue bytes simply cannot reach the user — not merely
test-asserted. `hook-shim.mjs:78` already spawns children; capturing their stdio is a small change, not
a new ABI. This is the insight the hybrid was missing, and it is the difference between an enforced
invariant and a documented wish.

**Defeated on / conceded:** lessons must NOT obey the advocacy dial (agreed with Fable 5 explicitly);
do not rewrite the two mature policy engines (`anticipate.sh` persist-before-speak, `lesson-gate` exit
semantics); the boot-frozen `hooks.json`/`hook-shim` ABI cost is real for a deploy-gated pillar, so add
**one** generic `unprompted-speech` entry, not one per emitter.

## Convergence (what ships — ADR-040 Decision)

A **thin one-runtime delivery seam that owns the bytes** (GPT-5.6's captured-stdio) **with per-channel
policy** (Fable 5's category-correctness):

- `unprompted-runtime.mjs` spawns producers captured; it is the sole writer of user-facing bytes.
- Per channel: `advocacy` → dial + DismissalLedger; `lesson` → its own cap + opt-in, **never** the dial;
  `alarm` → always. Raw/invalid producer output on an advisory path → dropped.
- One `unprompted-speech` entry in the shim TABLE with a `channel` field; `hooks.json` routes through it;
  the lesson block's opt-in **exit 2 is preserved** (blocking-mode propagation).
- A registry test with teeth: a bare unprompted line added to `hooks.json` **fails** it; `advocacy=off`
  → byte-empty stdout; an opted-in block → exit 2; rogue bytes → nothing reaches the user.
- The copy is corrected to name what the dial does and does not govern; DDD-0004 → v1.3.0 reconciles the
  invariant to "advocacy+promotion channels, one delivery seam, lessons keep their own consent."

**Net:** each duelist defeated the other's central error — GPT-5.6 killed "unenforceable," Fable 5 killed
"lessons under the dial" — and the convergence keeps both corrections. Neither branch moves the pillar
score (deploy-gated); this is an honesty-and-enforcement fix, which is why it was worth doing right.

## GPT-5.6-Sol implementation red-team (2026-07-24) — VERDICT: REJECT, now hardened

The duel above ratified the DESIGN. A later focused GPT-5.6-Sol pass was asked to red-team the
IMPLEMENTATION (`unprompted-runtime.mjs`) and to RUN it — and it **rejected** the code, empirically proving
three bugs both the original Fable and GPT-5.6 *design* passes missed (a design review does not catch these;
only running the byte-owner does):

1. **Channel spoofing** — the registry declared no per-producer channel allowlist, so any producer could
   emit `{channel:'alarm'}` (always-delivered) or `lesson:block` (force exit 2) and bypass its intended
   policy, defeating the whole per-channel point. Fixed: each producer is bound to an authorised `channels`
   set; a candidate on a channel the producer is not authorised for is dropped, and `hookEventName` is now
   derived from the runtime's own EVENT, not a producer-stamped value.
2. **Failed producers failed OPEN** — output was accepted after a non-zero exit, a timeout kill, or a
   `maxBuffer` overflow, and sequential 4s per-producer timeouts could sum past the 5s hook budget. Fixed:
   output is used only when `!error && status===0 && !signal`; a single global deadline caps total time.
3. **Delivery truncated** — `process.stdout.write()` then `process.exit()` drops buffered bytes on a pipe
   (GPT-5.6-Sol measured 900,082 bytes arriving as 8,192). Fixed: synchronous `fs.writeSync(1|2, …)` plus an
   8 KB per-candidate copy cap.

All three fixed with break-it tests (`unprompted-speech-registry.test.mjs`, 21 pass). **The lesson: a design
duel is not an implementation duel — the byte-owner needed a grader that RAN it, and the real GPT-5.6-Sol
did.** (This is also where the session's later false "codex degraded" claim is disproven twice over: codex's
model is `gpt-5.6-sol`, it works, and the design duel above already used it.)
