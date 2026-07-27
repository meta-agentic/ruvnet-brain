# PRINCIPLES — the ideals every design must carry

Updated: 2026-07-22

**Created**: 2026-07-22 · **Last updated**: 2026-07-22 · **Why**: the ideals were being retyped
ad-hoc into each agent prompt, so they arrived differently every time and some arrived not at all.

**This document is REQUIRED READING for every agent — human or model — that designs, builds, or
reviews anything in this project.** An ADR, a DDD, an adversarial review, or an implementation that
contradicts a principle here is wrong, and the contradiction is the finding.

It exists because of a specific failure. On 2026-07-22 the owner said: *"You turning around and
telling me it works one way while the customer is going to experience another way is 100% not
acceptable."* He was describing a real defect shipped hours earlier — seven lessons reported as
"enforcing" that printed the word BLOCKED and then permitted the action, because the gate exited 1
to stdout while the host contract requires exit 2 to stderr. The claim was verified by running the
CLI by hand: the one caller in the system that is not a gate.

---

## The two things this product is

Everything else is a means.

1. **PROACTIVE AT MAXIMUM.** It tells you what you own and are not using, before you hit the wall,
   without being asked. A surface that *can* detect something useful and stays silent is broken.
2. **LEARNING AT MAXIMUM.** It gets better every day from what actually happened, and the
   improvement compounds across every project you own. Not a static change in operations — a
   continual process.

If a decision does not serve one of these, it is not a priority. If it damages one of them, it is
not a tradeoff worth making.

---

## P1 · Verify through the user's path, never your own

**The only proof that something works is the path a real user takes.**

Running a CLI by hand proves the CLI runs. It proves nothing about the hook, the console, the
installer, or the person. Every "it works" must name the surface it was verified through, and that
surface must be the one a customer touches.

*Cost of violating it:* claimed five enforcing gates; the customer would have experienced zero.
Twice in 24 hours, in a document whose subject was this exact rule.

## P2 · A claim and the customer's experience must be the same thing

If they differ, the claim is a lie regardless of intent. Before writing "shipped", "enforcing",
"working", or "done", answer: *what exactly will the user see, and have I seen it?*

## P3 · Nudge. Never force.

> *"Nudging somebody is very fair. Forcing them through a gate is not."*

The default is a strong, evidence-carrying nudge that the user can ignore without penalty. Blocking
is a narrow exception a user opts into for a specific rule, never a default and never a surprise.

A gate that fires wrongly gets disabled, and a disabled gate protects nothing — so over-blocking is
not merely rude, it is self-defeating. Good medicine forced down a throat is still force.

## P4 · The user is the arbiter of their own machine

Recommend strongly; decide never. Every machine-touching choice is presented with: what we
recommend, why, what the alternative is, and who it suits. Someone who chose differently on purpose
is **not misconfigured**, and telling them so is the disrespect that loses a power user for good.

Advanced people work differently. Supporting that is the product, not an exception to it.

## P5 · Make the murky legible

A core reason this project exists is to turn confusing things into clear, tangible, **selectable**
choices. That applies to *our own architecture* as much as to rUv's: if a user cannot tell what the
pieces are, what each buys them, and what they lose by taking only some, we have failed at the one
thing we claim to do.

*Live evidence:* a power user said *"I can't use your stuff because it has hooks and this and that.
I just loaded the brain and I don't get the rest of it."* He could not find out what he was missing.

## P6 · Derive; never assert

Every number, state, and status shown to a user is computed from a real check at the moment of
display. `unknown` is a first-class state and must never render as `off` — a detector that could not
tell is not a fault found.

*Cost of violating it:* reported "26 learning hooks installed and every one switched off" by
scraping a CLI's human-readable table. The learner held 457 trajectories and had adapted 106 minutes
earlier. Learning was never off.

## P7 · Built is not shipped; shipped is not wired

The most repeated failure in this project's history — **five times in 24 hours** — is code that is
written, tested, and connected to nothing. A feature exists only when a real caller invokes it on a
real user path.

Before claiming a capability: `grep` for its call sites. Zero call sites means zero feature.

## P8 · Every detection carries a remedy, and every remedy carries an inverse

A card that worries someone is not a button that fixes it. Nothing may be *offered* that cannot be
*run*, and nothing may be *run* that cannot be *undone*. Enforced structurally, not by review.

## P9 · Silence is a valid answer, and usually the right one

Precision over recall. A missed suggestion costs one repetition; a wrong suggestion costs trust in
every future suggestion. When unsure, say nothing.

Frequency is a feature with a hard ceiling: once per state change, dismissible, never re-fired while
dismissed, and two declines is an answer.

## P10 · Use the real tool; name the hand-roll out loud

rUv ships far more than we remember. Search before building. If, after genuinely looking, we still
disagree — say so out loud, cite the source path, and call the hand-roll a hand-roll. Never
silently.

## P11 · Learning is continual, not a feature that shipped

The system must get better from what happened without anyone transcribing it. A learning
architecture whose input is a human typing lessons into a seed file is a rule engine wearing a
learning label.

Corollary: a lesson that cannot say *when it applies* is prose, and prose does not act.

## P12 · Ask about general requirements; never about permission to finish

> *"If you need to ask if something should be a general requirement, then you need to bring that up
> for me, and we'll talk about that."*

Bring **scope and policy** questions to the owner — they change what the product is. Do **not** ask
whether to continue authorized work: that is a stop wearing a question mark, and a status report is
not a finish line.

---

## How this document is used

- **Every ADR** states which principles it serves and which it trades against, explicitly.
- **Every adversarial review** checks the design against this list; a violation is a finding.
- **Every agent prompt** references this file rather than restating rules inline — that restating is
  what made the ideals arrive differently each time.
- **A principle is added only from a real, dated failure.** This is not aspirational; every line
  above cost something.
