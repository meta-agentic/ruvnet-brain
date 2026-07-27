# /rvbc instant-open — duel-converged fix spec (Fable verdict 2026-07-26/27; owner mandate: instant page, live scan, refresh on page)

WHERE THE 3 MINUTES WENT: (S1) project-scoped cold caches compute INLINE on the single-threaded
event loop — gatherState ~13s + capabilities (launchctl 15s cap) + scanFleet ~40s+ + observeLearning
20s serialize behind each other, freezing every request incl. the static page; (S2) boot-time
refreshFleetCache runs ON-LOOP right as the browser opens (blank white tab) + spawnSync osascript up
to 8s; (S3) rvbc.md normalizes a 20-60s wait and permits foreground runs (120s Bash hang).

RANKED FIXES (all file:lines refer to this worktree):
1. serveCached cold/scope-mismatch: NEVER compute inline — respond {warming:true, scope} instantly +
   force-kick the --refresh-cache child (onboarding-console.mjs:1053-1061). The child already
   computes everything (:2209-2258).
2. app.js warming state: warming ⇒ keep skeletons+standby, pill "measuring your machine… ~20s",
   startFreshnessPolling(); NEVER dismissStandby or render empty sections or green pill on warming
   (loadState :3030-3048, renderFreshness :2945-2957; same for loadCapabilities/loadMemoryFleet).
3. expireCachesEmbedding must PRESERVE scope (writeCache(f, j.at, j.data, j.scope ?? null) — :843)
   and /api/refresh needs a debounce-BYPASSING kick (:2151-2160, kickRefresh :910-928).
4. Poller guard: repaint only on strictly-newer AND stale===false stamp
   (Date.parse(at) > Date.parse(FRESH_BASE) && !st.stale, app.js:2979); success path must also
   refresh preStateHash + recommendations — simplest: call loadState() once on success.
5. Boot scans off-loop: fold refreshFleetCache/ACTIVITY into the --refresh-cache child; replace the
   setImmediate re-scan with kickRefresh(); async-spawn osascript (:2198, :1170-1178, :2046-2066).
6. rvbc.md rewrite: background ALWAYS (never foreground — 120s hang), never watch the shell or wait
   for scans, post the clickable URL at once; promise "browser opens in a few seconds — the page
   narrates its own scan"; already-running ⇒ open URL (note it may serve the project that launched it).
7. Mock parity: mockGet '/api/state?fast=1', mockPost '/api/refresh', MOCK_STATE fromCache/
   measuredAt/stale variants (app.js:3348-3367).
8. ONE refresh story: /api/refresh expires ALL four scoped caches scope-preservingly; per-card
   "re-measuring…" chips; retire/rewire the old recheckMachine placebo (app.js:485-491).

THE CORRECT FLOW (acceptance): URL <1s; static page paints 1-2s ALWAYS; every /api/* answers in ms
(warm=data+stamp, cold=warming+kick); the page carries the wait with narration+pill; refresh is an
on-page button answering in ms; terminal/model never involved after launch.
