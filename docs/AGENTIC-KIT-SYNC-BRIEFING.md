# RuvNet-Brain ↔ Agentic-Kit — Sync Briefing

Updated: 2026-07-24 10:30:00 EDT | Version 1.1.0
Created: 2026-07-24 10:10:00 EDT

**From:** Stuart Kerr (RuvNet-Brain, `stuinfla/ruvnet-brain`)
**To:** Chris Phillipson (Agentic-Kit, `pacphi/agentic-kit`)
**Purpose:** Our two products now touch at several points. Both were built with the best
intentions; neither should have to guess what the other does. This document states — with
file-and-line citations from **both** codebases — where they meet, where they could conflict,
and a proposed contract so a shared user only ever sees one coherent story. It also describes,
for the first time outside our repo, what RuvNet-Brain 4.0 is turning on — because you
shouldn't have to reverse-engineer our roadmap to know we're not building against you. We're
not. Several 4.0 pieces get *better* because agentic-kit exists.

Everything below was verified on 2026-07-24 against `@pacphi/agentic-kit` **4.0.0-alpha.21**
(cloned from GitHub) and `ruvnet-brain` **3.9.39-dev** source — read, not recalled.

---

## 1. TL;DR

- **The products are complementary layers, not rivals.** Agentic-kit answers *"is the stack
  installed, current, and wired correctly?"* (machine/configuration state). RuvNet-Brain answers
  *"is Claude grounded in rUv's real source, and is the stack you installed actually being
  used?"* (knowledge + usage state). A machine can be 100% ak-green and still have dormant,
  never-used capability — that gap is the brain's territory; the install/heal/prove territory
  is ak's. 4.0 doubles down on our side of that line (§2).
- **ak already manages ruvnet-brain as a subsystem — and does it thoughtfully.** Install,
  drift, dashboard, statusline, CLAUDE.md block, and single-update-ownership are all handled in
  `src/lib/ruvnet-brain.mjs` + `src/lib/heal.mjs`. We're not asking to change that model. We
  want to **bless it, formalize the contract it implicitly depends on, and close the few edges
  where a shared user could see the products disagree.**
- **Five touchpoints need a joint decision** (§6). Four of the fixes are on the brain side;
  one is joint. A decision checklist for the call is at the end (§8).

## 2. What RuvNet-Brain 4.0 is turning on — so nothing surprises you

Today's shipped brain is two things: **grounding** (the `search_ruvnet` offline KB over the
rUv repos, plus hooks that make Claude cite real source instead of stale training priors) and
a **console** you can open to see installed rUv capability, real faults, and one-click fixes
that can also be undone. Useful — but you have to go look.

4.0 exists because of one measured finding: the brain once had everything it needed to say
*"36 stores embedded, never distilled — 6,858 memories teaching nothing"* and said nothing for
**21 days**, because nothing was structurally obliged to speak. Our thesis for 4.0: *a page
you have to visit is a dashboard, not proactivity.* What we're turning on:

- **In-session advocacy (L3).** The brain speaks *inside* the Claude Code session, once, at
  the relevant moment: "X is installed, usable, and has **never been used** — here's what it
  would do for this task, and here's the one-click way to try or silence it." All unprompted
  speech flows through a single delivery chokepoint with hard anti-nag rules: fires once per
  state change, dismissible, one-action permanent mute, advisory-only (it can never block or
  gate anything the user didn't explicitly opt a rule into).
- **Dormancy detection done honestly.** "Dormant" is defined as *installed + usable + never
  used* — a capability the user couldn't actually run doesn't count, so the alarm is about
  value left on the table, never about salesmanship. The detector's accuracy is itself under
  measurement (a ground-truth fixture with an independent oracle and mutation tests that prove
  the metrics collapse if the detector breaks).
- **Anticipation (L4)** — naming the better path *before* the user commits to a worse one.
  Status: in redesign; our own adversarial review process rejected the first design, so this
  is intent, not build.
- **Compounding lessons (L5).** Corrections a user explicitly ratifies in one project get
  promoted machine-wide and must survive updates — a brain that learns across projects instead
  of keeping notebooks per repo.
- **Self-implementation.** The brain audits and scores its own harness and proposes its own
  fixes, on the same evidence rules as everything else.

**Status, honestly:** all of this lives behind a release fence on a dev branch. None of it is
live on any user machine, and when it ships it arrives as an ordinary release — which your
drift check sees like any other.

**Why this complements agentic-kit rather than competing with it:**

1. Your green checkmark is our *precondition*. Dormancy detection asks the question that comes
   **after** "installed, current, wired" — and on an ak-managed machine our signal is cleaner,
   because you've removed the configuration noise that would otherwise look like dormancy.
2. When our advocacy encounters machine-level drift, the fix we *want* to recommend is
   **`ak sync`** — your verb, not a rebuilt one. We have no ambition to own install/heal.
3. 4.0's new surfaces add **no new writers to anything ak manages**: in-session speech is hook
   runtime output, lessons live in `~/.config/ruvnet-brain/`, and neither touches your managed
   CLAUDE.md blocks, `kit.json`, or any file in your MANAGED-TOOLS table.

## 3. The proposed seam — who owns what

| Layer | Question it answers | Owner |
|---|---|---|
| Install / upgrade / heal / machine drift (ruflo, aqe, agentdb, hosts, MCP, natives) | "Is it installed, current, wired?" | **agentic-kit** |
| Brain install + release drift, when ak is present | "Is the brain present and on the current release?" | **agentic-kit** (`ak sync`) |
| Knowledge grounding (`search_ruvnet`), KB integrity, usage/dormancy intelligence, in-session advocacy, lessons | "Is Claude grounded, and is the installed stack being *used*?" | **ruvnet-brain** |
| Rendering the other side's state | Each product renders the other's **published, machine-readable truth** — never re-derives it | both, via the contract in §5 |

## 4. What agentic-kit already does with the brain (the facts, from your source)

For the record — and because we verified rather than assumed:

1. **Install, pinned to a resolved release**: `heal.mjs:143-158` resolves the GitHub release
   tag *first*, then runs `npx -y ruvnet-brain@latest --yes --no-stack --no-enhance
   --no-nightly-prompt --no-telemetry --version v<tag>` (`ruvnet-brain.mjs:28-29`), stamping
   the release-tag namespace afterward. The resolve-first ordering (closing the
   publish-mid-install window) is a nice touch.
2. **Disk-first version truth**: installed release read from the bundle's own
   `SOURCE.json → releaseTag` (`ruvnet-brain.mjs:87-94`), falling back to ak's `kit.json`
   stamp; drift compared against GitHub `releases/latest`, TTL-cached, with `null` treated as
   *unknown, never up-to-date* (`:98-114`, `:137-142`).
3. **Single update owner**: Evergreen suppressed at install (`--no-nightly-prompt`) and the
   `com.ruvnet.brain-update` LaunchAgent detected as drift and disabled by sync
   (`heal.mjs:177-187`, MANAGED-TOOLS.md invariant 2). The label matches our installer's
   constant exactly — correct.
4. **One managed CLAUDE.md block** (`blocks.mjs:78-81`), gated on the KB dir existing,
   stripped when the brain is removed.
5. **Your audits of our installer were right.** The `github:` HEAD vs. published-release
   inconsistency you found on 2026-07-17, and the `--yes`-accepts-every-optional-offer gotcha
   that forced you to carry four suppression flags — both real, both ours. Fixes below.

We'd also like to say plainly: the MANAGED-TOOLS consistency contract (disk-first truth,
single owner with honest disowning, same-namespace comparisons, one drift story across all
surfaces) is exactly the philosophy the brain project enforces internally ("the product can
never lie"). We independently converged on the same rules. That's why this sync should be easy.

## 5. What ruvnet-brain commits to (the contract, formalized)

These are the guarantees your code currently *assumes*; we propose to make them explicit and
regression-locked on our side:

1. **Flag stability.** `--yes`, `--no-stack`, `--no-enhance`, `--no-nightly-prompt`,
   `--no-telemetry`, `--version <tag>`, `--force` (all present today at
   `bin/install.mjs:74-92`) become a documented public interface with a regression test —
   we will never rename or repurpose them without a major-version deprecation path.
2. **`SOURCE.json → releaseTag` stays in the release-tag namespace for every published
   bundle.** Our publish pipeline already *refuses to publish* a bundle whose `releaseTag` it
   cannot re-stamp to the real tag (`scripts/self-update.mjs:314-338`). Known caveat your
   fallback already handles correctly: **locally-built** bundles (dev machines) stamp the
   bundle version instead — your `kit.json` fallback + `unversioned → refresh once` logic is
   the right behavior there; keep it.
3. **`--yes` semantics fix (planned).** We'll change `--yes` to mean *accept defaults*, not
   *enroll in everything* — nightly and telemetry become explicitly opt-in flags. Your four
   suppression flags keep working forever (see #1); they just stop being load-bearing.
4. **`--doctor --json` (planned, offered).** A machine-readable doctor: KB integrity, reader
   health, smoke-query result, store counts. Today your surfaces can only say *present +
   release drift*; this would let `ak status --deep` / the dashboard's Intelligence tab render
   *actually healthy* vs *present but broken* without shelling our human-oriented output.
   We'd be glad to send the consuming PR to agentic-kit ourselves once it lands.
5. **An "ak-managed" section in our README.** One paragraph: *if agentic-kit manages your
   machine, `ak sync` owns brain updates and Evergreen-off is correct — not broken.* This
   kills the "the two tools are fighting" perception before any user forms it.

## 6. The five touchpoints (risk today → proposal)

1. **Update ownership.** Both our Evergreen nightly and `ak sync` want to own updates. Your
   side already resolves it (suppress + disable, reversibly). **Proposal:** we bless it (§5.5),
   and optionally our installer learns to detect an ak-managed machine and default the nightly
   offer to off — so the two never even meet.
2. **Dashboard overlap.** Our `/rvbc` console has a "what's installed + one-click fix" corner
   that overlaps `ak status`/`ak dashboard`'s center. Two dashboards disagreeing about one
   machine is the exact under-the-covers conflict both of us build against. **Proposal:** when
   ak is present, our console defers machine-install truth to `ak status --json` and links to
   `ak dashboard` for that layer, keeping our page focused on grounding/dormancy/lessons. One
   drift story across both products (your invariant 4, extended across the seam).
3. **CLAUDE.md blocks.** A user who installed the brain directly (accepting our `--enhance`
   section) and adds ak later ends up with **two** grounding sections — yours managed, ours
   orphaned. **Proposal (joint):** we test this case together; likely fix is on our side (our
   installer detects your managed block and withdraws/skips its own section), since your
   block-upsert shouldn't have to know our marker format.
4. **Version namespaces.** You documented our three tracks (plugin semver / bundle version /
   release tag) more clearly than we had. **Proposal:** we adopt that framing in our own
   MAINTAINER docs and commit that the **release tag** remains the sole interop namespace
   (§5.2). Dev machines with locally-built KBs will read as "outdated" to ak — expected, and
   `ruvnetBrain:false` in `kit.json` is the right setting there (we'll document that too).
5. **npm dist-tag hygiene (ours).** `ruvnet-brain`'s npm `latest` currently carries a `-dev`
   version (3.9.18-dev, checked live 2026-07-24) — it works with your `ruvnet-brain@latest`
   spec, but it's not the stable/next split you model with your own channels. **Open
   question** for us; flagging it so it never surprises you.

## 7. Edge cases we verified so nobody re-derives them

- **Fresh installs overwrite per-entry, not per-directory** (`bin/install.mjs:412-421`): KB
  entries the public bundle doesn't ship (locally-added or private stores, plus their manifest)
  survive a reinstall. True today by construction; not yet locked by a test — it will be, as
  part of §5's contract work.
- **`--update` never silently falls back to a fresh install on an empty dir**
  (`bin/install.mjs:1162-1174`) — restored 2026-07-18 after a fallback briefly swallowed that
  branch. Relevant to you only as: `--version`-pinned fresh installs and `--update` are
  different paths with different blast radii, and ak correctly uses the former.
- **`disableRuvnetBrainNightly` touches only `com.ruvnet.brain-update`** — verified against
  our installer's `NIGHTLY_LABEL`; none of our other LaunchAgents share it.

## 8. For the call — six decisions

1. Anything in §2 (what 4.0 turns on) that worries you, or that you'd want to integrate with?
2. Bless the seam table in §3 as the standing division of labor?
3. Flag-stability contract (§5.1) — anything else your code depends on that we missed?
4. `--doctor --json` shape — what fields would ak actually render?
5. Dashboard deferral (§6.2) — is `ak status --json`'s schema stable enough for us to consume?
6. The duplicate-CLAUDE.md-block case (§6.3) — whose side fixes it? (We volunteer.)

On our side, whatever we agree to becomes an ADR with an adversarial cross-model review before
we build it (our standing process), and each contract item ships with the regression test that
proves it. Nothing here is urgent-broken today — every risk named above is *latent*, which is
exactly when it's cheapest to fix.

Thanks for building agentic-kit the way you did — the fact that this document could cite your
source line-by-line and find *zero* surprises is the best compliment we know how to pay.
