---
id: ADR-036
title: Knowing who uses this — counting installs and versions without becoming a tracker
status: Proposed-Blocked
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [telemetry, consent, privacy, versioning, install, upgrade, adoption]
supersedes: []
relates: [ADR-035, ADR-013, ADR-023]
---

**Status**: Proposed — BLOCKED (2026-07-22). Every tier is blocked on a finding in §10, and the
consent question in §7 additionally requires an owner decision. Nothing here is implemented.

---

## 1. The question

The owner, 2026-07-22:

> *"I need to be able to know how many people are using this and, preferably, who they are. […] I've
> got people that are still on the 0.5 release that I need to update. They don't know that it doesn't
> auto-update because I've told people the new version auto-updates. […] I am not trying to spy on
> anybody."*

Two distinct problems wear one costume:

- **A — Population.** How many people use this, and what are they on?
- **B — Stranding.** Users are running old code and do not know it.

They are not the same problem and they do not have the same fix. **B is not solved by measuring it.**
Conflating them is how a project ends up shipping surveillance to fix a documentation bug.

---

## 2. What is measurable today (live, 2026-07-22)

| Instrument | Value | What it counts | What it CANNOT count |
|---|---|---|---|
| GitHub traffic views | **98 uniques / 14d** | **People.** GitHub de-dupes by visitor. | Anyone who installed without visiting the repo page. |
| Release asset downloads | **574 lifetime** | File fetches. | People. GitHub exposes **no unique-downloader field** for assets. |
| Newest release pulls | **69** since Jul 21 | Machines that refreshed. Best proxy for active installed base. | New installs vs nightly refreshes — indistinguishable. |
| npm downloads | 2,207 / 7d | Registry traffic, mirror-dominated. | Population. Moves with release cadence, not adoption. |
| `rb:totals.install` | opt-in only | Consenting machines, once each. | Everyone who declined. A **floor**, never a total. |
| GitHub clones | 6,319 / 804 uniques | Mostly **this project's own plugin auto-update**. | Anything useful about humans. |

**Honest population estimate: ~70–100 real users.** Not 2,207.

The install ping is correctly wired — `bin/install.mjs:1894` calls `sendInstallPing`, guarded by a
consent file, and `offerTelemetry` returns early on re-runs, so it fires **once per machine on first
install**. That is the right shape. Its weakness is coverage (opt-in), not correctness.

---

## 3. The stranding problem is already diagnosed in this codebase

`bin/install.mjs:988-1000`, written before this ADR:

> *the BRAIN (KB bundle, nightly via forge-update.mjs + GitHub Releases) and the Claude Code PLUGIN
> WRAPPER (hooks, skills, slash commands) […] drift silently, and — this is the damaging part — the
> version a user is SHOWN always comes from the frozen wrapper, never the brain. […] A user
> (Dr. Mark Allen) hit exactly this: KB current, wrapper still the June v0.5.0-dev build, and nothing
> anywhere told him the two had diverged.*

**Consequence for this ADR: "users on 0.5" is probably wrong.** Their brain may be current; their
*wrapper* is frozen because `autoUpdate: false` is set for that marketplace — and the wrapper is what
reports the version. The root cause is a Claude Code setting, not a failed install.

**This constrains the design.** Any telemetry reporting a single version reproduces the exact
confusion that created this problem. **Both versions must be reported, or neither is worth reporting.**

---

## 4. Options considered

### Option 1 — Server-side download counting (proxy the bundle)
Route bundle downloads through a Vercel function that counts uniques before redirecting to the asset.

> **CORRECTED 2026-07-22 after adversarial review.** The first draft of this ADR rejected Option 1 as
> *"retroactive-ish"* but worse on both axes. **The "retroactive" part was false, and it was the
> reason given for preferring the alternative.** Verified: `kb/forge-update.mjs:220-222` fetches
> `asset.browser_download_url` — GitHub's own host — directly. A proxy deployed today intercepts
> **nothing** that is already installed. It covers 100% of installs only *after* clients change,
> which is precisely the property it was credited with having for free.

*Pro:* covers every install regardless of consent once adopted; no per-machine record required.
*Con:* a server in the critical path of the one operation that must never fail (mitigate: failure-open
redirect). IP-derived uniqueness is noisy (NAT, CGNAT, CI) and IP is PII in the EU unless discarded
immediately.
**Revised verdict: not rejected — folded in as a bounded aggregate.** Coverage bias in an opt-in UUID
(systematically excluding decliners *and* every legacy client) may distort a 70–100-user population
more than IP noise does. Keep GitHub's release totals as the legacy baseline, put a failure-open
first-party redirect in newly shipped updaters, retain only short-lived daily aggregates with **no
durable per-client record**, and reconcile the three instruments as a **range**, never one number.

### Option 2 — Anonymous install ID on a periodic heartbeat
`crypto.randomUUID()` on disk, sent with a daily ping alongside both version strings.
*Pro:* true unique-active-machine counts, version distribution, retention curves. Rotatable and
deletable. No IP retention needed.
*Con:* requires re-consent (§7). Only counts consenting users. Forward-looking only.

### Option 3 — Do nothing; infer from release downloads
*Pro:* zero cost, zero privacy surface.
*Con:* cannot distinguish new install from refresh, cannot see version distribution at all — which
is the specific thing the owner asked for. **Insufficient for B.**

### Option 4 — Client-side staleness check (no telemetry whatsoever)
The client already knows its local version and can read `releases/latest`. If stale, tell the user.
*Pro:* **fixes** stranding rather than measuring it. No consent change, no privacy surface, works for
users who declined telemetry — i.e. exactly the users most likely to be stale.
*Con:* gives the owner no numbers.

---

## 4a. The bootstrap paradox — the constraint that reorders everything

*Raised by adversarial review, then verified against the code. It invalidates the first draft's
sequencing.*

**Every tier requires shipping new client code. The users the owner most wants to reach are, by
definition, the ones not receiving new code.** A plan that ships staleness logic in the wrapper
cannot reach a machine whose wrapper is frozen — that is the same frozen wrapper, and the freeze is
caused by `autoUpdate: false` in the user's own `~/.claude/settings.json`, which this project cannot
read or change.

**The escape hatch is real and verified.** The brain bundle ships its own updater:

- `bin/install.mjs:1119` — *"The brain bundle SHIPS its own self-updater (forge-update.mjs, right in the KB dir)"*
- `bin/install.mjs:1143` — the scheduled job is `cd <kbDir> && node forge-update.mjs --apply`

So `forge-update.mjs` is **brain-owned code that is itself replaced by every bundle refresh**. Code
placed there reaches any install whose nightly still runs — *including installs whose wrapper has been
frozen since June*. This is the only delivery channel to the stranded population, and the first draft
of this ADR did not identify it.

### Reachability cohorts — state these before claiming any coverage

| Cohort | Reachable by | Notes |
|---|---|---|
| Nightly running, wrapper frozen | **Brain bundle** (`forge-update.mjs`) | The Dr. Mark Allen case. The main stranded group, and it IS reachable. |
| Nightly running, wrapper current | Either channel | Already fine. |
| Nightly disabled / never scheduled | **Nothing.** No code path executes. | Reachable only by human channels: release notes, Discussions, README, direct outreach. |

**Telemetry cannot discover silent machines.** A machine that makes no requests is invisible to every
instrument in §2 by construction. No design in this ADR may claim otherwise, and any population
figure must be stated as *"of machines that phoned home"*, never as *"of users"*.

---

## 5. Decision

**Adopt Option 4 first, delivered through the brain bundle. Fold Option 1 in as a bounded aggregate.
Adopt Option 2, then Option 3. Reject Option 3-as-only-plan.**

Sequencing is driven by §4a, not by cleanliness: **the first shipment must travel a channel old
clients already execute.**

| Order | What | Channel | Consent impact | Answers |
|---|---|---|---|---|
| **1** | Staleness notice comparing **both** wrapper and brain **against their own respective upstreams** (§10.1 — they are different version namespaces), printing the exact repair command — **shipped inside the brain bundle**, not the wrapper. | `forge-update.mjs` | One outbound call to `api.github.com` — **not "nothing leaves the machine"** (§10.3). No owner telemetry. | B, incl. stranded |
| **2** | Failure-open first-party redirect in newly shipped updaters; daily **aggregate** counts only, no per-client record. GitHub totals retained as legacy baseline. | new bundles | None (no durable record) | A (reach range) |
| **3** | Version heartbeat, ≤1/day, `{event:'session', wrapper:<v>, brain:<v>}` — **both** versions or it reproduces the bug in §3. | bundle | See §7 | A (versions) |
| **4** | Anonymous `installationId` → unique active machines, version-per-machine, retention. | bundle | **Material. Requires re-consent.** | A (population) |

### Tier 4 storage design

The current store holds only counter hashes (`rb:totals`, `rb:day:<date>`, `rb:versions`) and cannot
answer a single per-machine question. Required shape:

- `rb:machine:<id>` — hash `{firstSeen, lastSeen, wrapper, brain}`, refreshed with a 45-day TTL.
- `rb:active` — sorted set, `<id> → lastSeenEpoch`.
- 30-day active = `ZCOUNT rb:active <cutoff> +inf`.
- Version distribution = read active ids, pipeline their hashes, aggregate `(wrapper, brain)` pairs.
- Prune with `ZREMRANGEBYSCORE`. **Expiring the machine hashes alone leaves an immortal index** — the
  sorted set must be pruned explicitly or it grows without bound.

Failure modes to test: unbounded set growth, orphaned ids, partial hash/zset writes, clock skew,
unbounded version cardinality, and confusing *"latest reported version"* with *"version at date"*.

### Explicitly out of scope, permanently

**Identity.** The owner asked for *"preferably who they are."* This ADR declines that. An anonymous
ID yields counts, versions and retention; it must not yield identity. If the goal is to *reach*
people, the correct mechanism is voluntary and separate: GitHub Discussions, repo watchers, or an
explicit opt-in "email me about updates". Attaching identity to a usage beacon is how a well-meant
tool becomes a privacy incident, and it is not reversible once shipped.

---

## 6. Grounding — the ecosystem already ships this

Not invented here. `cognitum-open-design/apps/web/src/components/PrivacySection.tsx`:

> *"installationId is only the anonymous reporting id and can be rotated by Delete my data without
> making the first-run banner appear again."*

and `PrivacyConsentModal.tsx`:

> *"the banner records a concrete privacy decision instead of a dismiss-only state"* — gating on
> `privacyDecisionAt`, with `PRIVACY.md` documenting the same handling the modal discloses.

Adopted from that pattern, unchanged: opaque UUID, rotation via delete-my-data, a **recorded
decision** rather than a dismissal, and a canonical privacy document that matches the prompt text
word for word. `cognitum-ruos/crates/ruos-sensors/src/consent.rs` additionally models per-category
consent; tier 3 should be its own category, not a silent widening of the existing one.

---

## 7. The consent constraint — the decision the owner must make

`explainer/api/ping.mjs` states the current contract in its own header:

> *"COUNTS ONLY. No query text, no repo names, no paths, no IPs stored, no cookies, no UA
> persistence — the handler never reads anything but event/v/n and never writes anything else."*

Users consented to **that**. A persistent per-machine identifier is a different thing, however
anonymous. It cannot ride on the existing consent.

**Therefore:** tier 3 ships only with a fresh, explicit prompt, and existing consenters are re-asked
once. The prompt must name the identifier, its purpose, and how to delete it. Silently upgrading
"anonymous counts" to "pseudonymous per-machine tracking" would be the single most trust-destroying
thing this project could do — worse than never shipping the feature, because this tool installs
itself into a user's Claude Code configuration and reads their repositories. Its entire license to
operate is that it is legible.

---

## 8. Verification plan

Each tier is unshipped until its guard is proven to **fail on broken code** (project lesson
`tests-that-cannot-fail-on-broken-code`).

| # | Claim | Proven by | Must fail when |
|---|---|---|---|
| 1 | Staleness notice fires when behind | Run with a pinned old `SOURCE.json` + a stubbed `releases/latest` | versions equal → no notice (else it cries wolf forever) |
| 2 | It reads **both** surfaces | Stub wrapper-current/brain-stale AND wrapper-stale/brain-current | either single-surface case must still notify |
| 3 | Heartbeat is ≤1/day | Invoke 5× in one simulated day, assert 1 network call | remove the throttle → test must go red |
| 4 | ID is stable across runs, distinct across machines | Two temp HOMEs, 2 runs each | same ID across machines → red |
| 5 | Delete-my-data rotates the ID | Capture ID, run delete, re-read | unchanged ID → red |
| 6 | Declining sends **nothing** | Decline, then assert zero network calls with an injected fetch | any call → red |
| 7 | Unknown ≠ zero on the dashboard | Both-directions render test (already built and passing 2026-07-22) | unconfigured store rendering `0` → red |

Verification #7 is already done: `metric()` in `explainer/admin.js` was fixed this session after the
`opted-in installs` tile rendered a hard `0` for an unlinked counter store — `Number(null) === 0`
passes `Number.isFinite`. Proven in both directions (absent → `—`, present → the number).

---

## 9. Consequences

- The admin dashboard stops implying npm downloads are users. (Shipped 2026-07-22.)
- Tier 1 helps the *least* instrumented users — those who declined telemetry — which is the correct
  direction for a tool whose users opted out of being counted.
- Tier 3's numbers will always undercount, and every surface displaying them must say so. A floor
  labelled as a floor is honest; a floor displayed as a total is a lie with extra steps.
- Repo must remain **public**: `bin/install.mjs:45,57` fetches release assets unauthenticated. Going
  private breaks every existing install's refresh and every new install. Recorded here because the
  question was raised in the same conversation and the coupling is non-obvious.

---

## 10. Adversarial review, 2026-07-22 — findings and dispositions

Two independent red teams (Fable 5, GPT-5.6 via codex) attacked this ADR on disjoint axes. **Every
claim below was re-verified against the source by the author before being accepted** — the red teams'
line citations were treated as leads, not facts. The first draft did not survive intact.

| # | Severity | Finding | Verified by | Disposition |
|---|---|---|---|---|
| 10.1 | **critical** | Tier 1's comparator is a **version-namespace error**. `releases/latest` yields a *bundle* tag; the wrapper's version is a separate `3.x` stream from `plugin.json`. `install.mjs:1010` already warns *"COMPARE NUMBERS, NOT NAMESPACES."* As first written, the wrapper check always fires or means nothing. | `sed -n 1010p bin/install.mjs` | **Accepted.** Tier 1 blocked until each surface's own upstream is specified. The wrapper's upstream is marketplace HEAD's `plugin.json`, not a release tag. |
| 10.2 | **critical** | **§7's re-consent has no delivery vehicle.** `install.mjs:1845` returns `'already-set'` when the consent file exists — asked once, ever. Existing users never re-run the installer; nightly and hooks are non-interactive. So Tier 4 would cover only *new* installs — near-zero of the ~70–100 users it exists to count. | `grep -n already-set` | **Accepted, blocking.** Needs a versioned consent schema (`{decidedAt, contractVersion, scope}` — the `privacyDecisionAt` shape §6 praises but did not adopt) plus a defined interactive re-ask moment. |
| 10.3 | major | *"No data leaves the machine"* was **false**. A staleness check calls `api.github.com` — IP, UA and timing to a third party. Exactly the overclaim §7 condemns. Also: 60 req/hr unauthenticated per IP, shared with the installer's own fetch; and `--pin` users get nagged forever. | reasoning over `install.mjs:45,48` | **Accepted.** Table corrected. Tier 1 must define frequency, a snooze, an offline path, and a `--pin` exemption. |
| 10.4 | major | **Tier 3 largely already ships.** `kb/telemetry-ping.mjs` (5.7 KB, 2026-07-10) sends daily-batched `search`/`session` pings with a version, wired at `forge-mcp-all.mjs:68`. Meanwhile `ping.mjs:72` increments `rb:versions` **only on `install`**, so session versions are discarded, and `validatePing` accepts only `event/v/n` — a `{wrapper, brain}` payload is **silently dropped while returning `stored:true`**. | `ls kb/telemetry-ping.mjs`; `sed -n 72p explainer/api/ping.mjs` | **Accepted — the author's own error.** The ADR proposed building a heartbeat that exists. Tier 3 is re-scoped to *extending* it, and the silent-drop is a **bug to fix first**. Coverage today is MCP users only; hook-only users are undecided. |
| 10.5 | major | **`--yes` grants consent with no human answer** (`install.mjs:1865`), contradicting "explicit yes required". Under Tier 4 this becomes UUID assignment without consent. | file read | **Accepted.** Telemetry must be excluded from blanket `--yes`. |
| 10.6 | major | An "anonymous" UUID is **pseudonymous personal data** (GDPR Rec. 26 — it singles out a device). Rotation is client-side only: server rows keyed by the old id persist. No deletion endpoint, no per-id TTL. §7 requires the prompt to name how to delete it — **the design has nothing to name.** | design review | **Accepted, blocking Tier 4.** Requires a real deletion endpoint, per-id TTL, and honest wording ("pseudonymous", not "anonymous"). Vercel platform request logs also retain IPs regardless of `ping.mjs`. |
| 10.7 | major | **Counter integrity unaddressed**: `ping.mjs` is `Access-Control-Allow-Origin: *`, unauthenticated, accepts `n` up to 10,000, and any 32-char string enters `rb:versions` (unbounded cardinality). §9's "a floor labelled as a floor is honest" assumes untampered data; one curl loop makes every number fiction. | `ping.mjs:19-21,49` | **Accepted.** Not solvable perfectly on an open endpoint; requires rate limiting, an `n` ceiling per window, and a version allow-list. Dashboard must not present these as audited figures. |
| 10.8 | minor | *"Once per machine"* is really once per **consent-file lifetime**; the file lives in `~/.cache`, which cache cleaners wipe → re-prompt, re-count. | `install.mjs:1813` | Accepted. §2 wording qualified. |
| 10.9 | minor | Verification #3 ("≤1 network call/day") **fails on correct code** — a flush day sends up to two POSTs, one per event type. | `telemetry-ping.mjs:93-105` | Accepted. Assertion must bound calls per *event type*. |
| 10.10 | minor | Citation drift: `sendInstallPing` is called at `install.mjs:**1894**`, not `:1887`. | `grep -n` | Fixed below. |

**Sound on review, per both teams:** the decline path (`telemetryEnabled` requires a literal `yes`,
and `offerTelemetry` returns before pinging), §2's population honesty, and the permanent identity
carve-out in §5.

### Status change

This ADR moves from *Proposed* to **Proposed — blocked**. Tier 1 is blocked on 10.1 and 10.3; Tier 3
on the 10.4 silent-drop bug; Tier 4 on 10.2 and 10.6. **Nothing here is implemented, and no tier may
be described as shipped until its §8 verification fails on broken code first.**
