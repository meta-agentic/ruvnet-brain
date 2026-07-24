# RuvNet-Brain ↔ Agentic-Kit — Sync Briefing

Updated: 2026-07-24 10:10:00 EDT | Version 1.0.0
Created: 2026-07-24 10:10:00 EDT

**From:** Stuart Kerr (RuvNet-Brain, `stuinfla/ruvnet-brain`)
**To:** Chris Phillipson (Agentic-Kit, `pacphi/agentic-kit`)
**Purpose:** Our two products now touch at several points. Both were built with the best
intentions; neither should have to guess what the other does. This document states — with
file-and-line citations from **both** codebases — where they meet, where they could conflict,
and a proposed contract so a shared user only ever sees one coherent story.

Everything below was verified on 2026-07-24 against `@pacphi/agentic-kit` **4.0.0-alpha.21**
(cloned from GitHub) and `ruvnet-brain` **3.9.39-dev** source — read, not recalled.

---

## 1. TL;DR

- **The products are complementary layers, not rivals.** Agentic-kit answers *"is the stack
  installed, current, and wired correctly?"* (machine/configuration state). RuvNet-Brain answers
  *"is Claude grounded in rUv's real source, and is the stack you installed actually being
  used?"* (knowledge + usage state). A machine can be 100% ak-green and still have dormant,
  never-used capability — that gap is the brain's territory; the install/heal/prove territory
  is ak's.
- **ak already manages ruvnet-brain as a subsystem — and does it thoughtfully.** Install,
  drift, dashboard, statusline, CLAUDE.md block, and single-update-ownership are all handled in
  `src/lib/ruvnet-brain.mjs` + `src/lib/heal.mjs`. We're not asking to change that model. We
  want to **bless it, formalize the contract it implicitly depends on, and close the few edges
  where a shared user could see the products disagree.**
- **Five touchpoints need a joint decision** (§5). Four of the fixes are on the brain side;
  one is joint. A decision checklist for the call is at the end (§7).

## 2. The proposed seam — who owns what

| Layer | Question it answers | Owner |
|---|---|---|
| Install / upgrade / heal / machine drift (ruflo, aqe, agentdb, hosts, MCP, natives) | "Is it installed, current, wired?" | **agentic-kit** |
| Brain install + release drift, when ak is present | "Is the brain present and on the current release?" | **agentic-kit** (`ak sync`) |
| Knowledge grounding (`search_ruvnet`), KB integrity, usage/dormancy intelligence, in-session advocacy, lessons | "Is Claude grounded, and is the installed stack being *used*?" | **ruvnet-brain** |
| Rendering the other side's state | Each product renders the other's **published, machine-readable truth** — never re-derives it | both, via the contract in §4 |

## 3. What agentic-kit already does with the brain (the facts, from your source)

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

## 4. What ruvnet-brain commits to (the contract, formalized)

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

## 5. The five touchpoints (risk today → proposal)

1. **Update ownership.** Both our Evergreen nightly and `ak sync` want to own updates. Your
   side already resolves it (suppress + disable, reversibly). **Proposal:** we bless it (§4.5),
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
   (§4.2). Dev machines with locally-built KBs will read as "outdated" to ak — expected, and
   `ruvnetBrain:false` in `kit.json` is the right setting there (we'll document that too).
5. **npm dist-tag hygiene (ours).** `ruvnet-brain`'s npm `latest` currently carries a `-dev`
   version (3.9.18-dev, checked live 2026-07-24) — it works with your `ruvnet-brain@latest`
   spec, but it's not the stable/next split you model with your own channels. **Open
   question** for us; flagging it so it never surprises you.

## 6. Edge cases we verified so nobody re-derives them

- **Fresh installs overwrite per-entry, not per-directory** (`bin/install.mjs:412-421`): KB
  entries the public bundle doesn't ship (locally-added or private stores, plus their manifest)
  survive a reinstall. True today by construction; not yet locked by a test — it will be, as
  part of §4's contract work.
- **`--update` never silently falls back to a fresh install on an empty dir**
  (`bin/install.mjs:1162-1174`) — restored 2026-07-18 after a fallback briefly swallowed that
  branch. Relevant to you only as: `--version`-pinned fresh installs and `--update` are
  different paths with different blast radii, and ak correctly uses the former.
- **`disableRuvnetBrainNightly` touches only `com.ruvnet.brain-update`** — verified against
  our installer's `NIGHTLY_LABEL`; none of our other LaunchAgents share it.

## 7. For the call — five decisions

1. Bless the seam table in §2 as the standing division of labor?
2. Flag-stability contract (§4.1) — anything else your code depends on that we missed?
3. `--doctor --json` shape — what fields would ak actually render?
4. Dashboard deferral (§5.2) — is `ak status --json`'s schema stable enough for us to consume?
5. The duplicate-CLAUDE.md-block case (§5.3) — whose side fixes it? (We volunteer.)

On our side, whatever we agree to becomes an ADR with an adversarial cross-model review before
we build it (our standing process), and each contract item ships with the regression test that
proves it. Nothing here is urgent-broken today — every risk named above is *latent*, which is
exactly when it's cheapest to fix.

Thanks for building agentic-kit the way you did — the fact that this document could cite your
source line-by-line and find *zero* surprises is the best compliment we know how to pay.
