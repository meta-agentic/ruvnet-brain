# Morning Report — RuvNet Brain (2026-06-30)

**Everything you asked for is built and live. Verified, not asserted — every claim below has a check behind it.**

Commit `7d31302` on `main`. Explainer redeployed. Brain bundle re-released.

---

## First: your SiteMaster question (do this in the morning)

**Restart the Claude Code window in SiteMaster.** That's the whole fix. Plugins load at session
start, so a window that was already open when you installed didn't have the brain yet. The moment
you open a fresh session, the brain now **greets you**:

> 🧠 RuvNet Brain active — across all your projects. Ask me anything about rUv's stack… Run
> `npx github:stuinfla/ruvnet-brain --doctor` any time to verify.

- **Universal?** Yes — user-level. Every project, every window. **No reinstall, no second 400MB.**
- **Per-project init?** No. Once. **Nothing to git-ignore** in your repos (it drops zero files there).
- **How to know it's on?** The greeting above, or `claude plugin list` (shows `✔ enabled, scope user`),
  or `npx github:stuinfla/ruvnet-brain --doctor`.

---

## What shipped tonight (with evidence)

### 1. World-class animated explainer — LIVE
https://explainer-stuart-kerrs-projects.vercel.app
- Story-driven (9-months-ahead → becomes-Claude-Code → brain = missing manual), grounded in rUv's
  **real source** (the agenticow 162-byte fork, the post-quantum thread — pulled from the brain, not invented).
- **Dynamic now**: scroll-reveal, count-up stats, 5 **living** SMIL diagrams (the grounding loop has a
  pulse dot traveling it; the constellation lights up node-by-node), new circuit-brain hero.
- Verified: `anim-on` active, 6 inlined animated SVGs, hero 200, **0 console errors / 0 overflow at
  390 / 768 / 1440**, reduced-motion-safe.

### 2. It takes the wheel now (answer-bot → orchestrator)
The build directive + skill no longer wait for instructions. On any build/change request the brain
**proposes the architecture and why it's right** (which RuvNet blocks, parallel Ruflo swarm, SPARC
phases, AgentDB memory, QA gates), asks **one** go/no-go, then **runs it end-to-end** — parallel where
it helps, proven before it claims done. It takes over what it can do well and only asks when the call
is genuinely yours. *(This is the behavioral layer; the fully-autonomous unattended loop — ADR-0008 —
is the next chapter, called out honestly below.)*

### 3. It tells you it's working (the confidence gap you hit)
New SessionStart signal + a `--doctor` that answers your real questions in plain words. You'll never
again wonder "is it even on?"

### 4. Security floor — AIMDS injection guard
The brain injects retrieved source into Claude's context, and it's portable to any repo — so a poisoned
file could hijack an autonomous Claude. A dependency-free guard now wraps any injected instruction as
inert data. Verified: **19/19 guard tests, 0 false-positives on real source**, live in your installed brain.

### 5. It stays current, and a stranger can install it
- Installer pulls the **latest** Release automatically (with `--version` / `--pin` / offline fallback).
- Fixed a real shipping bug: the old bundle's self-update pointed at a dead URL **and** the build script
  was omitting the guard module (would have shipped a crashing brain). Both fixed, rebuilt, **re-released**.
- **Proven**: a true cold install from the live Release (download → unpack → reader → `--doctor` Healthy).

---

## What I decided on your behalf (you were asleep)
- Hero: chose the **circuit-brain** (uses all three theme colors, most on-message) over the nebula/minimal candidates.
- Standardized the building-block count to **18** (the capability-carded set; rvm is indexed but not headlined).
- **Committed + pushed to `main`** (the repo's published branch) so the plugin/installer ship the fixes.
- AIMDS: built a **floor-first lite guard** because the real `aidefence` npm package's ESM build is broken
  for in-process use; layered the full tool as a best-effort upgrade.

## What I did NOT do / honest caveats
- **ADR-0008 (fully-autonomous, unattended end-to-end loop)** is NOT built. The brain now *takes the lead*
  and orchestrates when you say go — but a hands-off "runs the whole project alone overnight" engine is a
  larger, separate build. That's the honest line between what ships today and what's next.
- The take-the-wheel behavior is a strong directive layer; like all prompt-level steering it shapes
  behavior reliably but isn't a hard guarantee on every turn.
- GitHub's unauthenticated API (used for the latest-version check) has a 60/hr limit; it degrades to the
  known-good version gracefully.

## Verify any of this yourself
```
open https://explainer-stuart-kerrs-projects.vercel.app     # the animated page
claude plugin list                                          # ✔ enabled, scope user
npx github:stuinfla/ruvnet-brain --doctor                   # health + "what this means"
# then restart SiteMaster and watch the brain greet you
```
