# Onboarding Console — API + data contract (v1)

Updated: 2026-07-17
Created: 2026-07-15

The single source of truth both the backend (`scripts/onboarding-console.mjs`) and the
frontend (`console/index.html` + `app.js` + `style.css`) build against. Implements ADR-0013
and DDD-0002. **The ordering is the design: Mirror → Explain → Recommend → (consent) Apply → Undo.**

The server binds `127.0.0.1` only and mints a random `token` per launch. Every mutating request
must echo the token. The page receives the token inlined at render time (`window.__CONSOLE_TOKEN__`).
A GET with a wrong/absent token still serves read-only state; a POST with a wrong token is `403`.

---

## GET `/api/state` — fast sections (no network)

Returns in well under a second. `memory.fleet` is **`null` here by design** — scanning every memory
store on the machine costs ~90ms each and a real machine has 100+, which is far too slow to sit in
front of the page's first paint. The fleet arrives separately from `GET /api/memory`.

`GET /api/state?fast=1` replays the last good gather from disk (~3ms) so a repeat load paints
instantly, then the live call replaces it. The cached copy never contains `token` — that is minted
per server run and spliced in on read.

```jsonc
{
  "token": "…",
  "generatedAt": "2026-07-14T…Z",
  "host": { "user": "stuartkerr", "platform": "darwin", "node": "v22…", "npmPrefix": "~/.npm-global" },
  "sections": {
    "wiring": {
      "summary": { "npx": 190, "global": 12, "mcp": 6, "plugin": 5, "projectsWithNpx": 16 },
      "sites": [
        { "scope": "project", "project": "ruvnet-brain", "file": ".claude/settings.json",
          "event": "PreToolUse", "matcher": "Bash", "spec": "npx @claude-flow/cli@latest hooks …",
          "mechanism": "NPX" }
      ]
    },
    "memory": {
      "fleet": [
        { "name": "ruvnet-brain", "total": 1023, "embedded": 1021, "coverPct": 99.8,
          "patterns": 456, "learns": true, "findings": [] }
      ],
      "health": {
        "project": "ruvnet-brain", "score": 92, "summary": "learns; recall-quality not probed",
        "dimensions": [
          { "key": "liveness", "label": "Liveness", "status": "ok",
            "detail": "store→search round-trip works on the live path", "deduction": 0 },
          { "key": "coverage", "label": "Coverage", "status": "ok", "detail": "checkpoint present, <1d old", "deduction": 0 },
          { "key": "recallQuality", "label": "Recall quality", "status": "notTested",
            "detail": "no embedding round-trip run this session", "deduction": 0 },
          { "key": "compactionSurvival", "label": "Compaction survival", "status": "ok",
            "detail": "PreCompact snapshot present", "deduction": 0 },
          { "key": "sessionSurfacing", "label": "Session surfacing", "status": "ok",
            "detail": "SessionStart hook surfaces state", "deduction": 0 }
        ],
        "notTested": ["recallQuality"]
      }
    },
    "savings": {
      "totals": { "count": 3, "usdSaved": 0.42, "msSaved": 18400 },   // null ⇒ render "nothing measured yet"
      "note": "receipts only — no modelled or projected savings",
      "receipts": [
        { "at": "2026-07-13T…Z", "capability": "model-routing", "task": "…",
          "chosenTier": "haiku", "baselineTier": "opus", "measuredMs": 4200, "measuredUsd": 0.14 }
      ]
    },
    "config": {
      "path": "~/.claude/ruvnet-brain/config.json",
      "exists": true,
      "values": { "openrouterKey": true, "nightly": true, "routing": "auto", "qeFleet": false },
      "schema": [
        { "key": "openrouterKey", "label": "OpenRouter API key", "type": "secret",
          "help": "Unlocks cheap-model routing + the self-improvement loop", "secret": true },
        { "key": "nightly", "label": "Nightly brain refresh", "type": "bool",
          "help": "Rebuild the KB from pinned SHAs overnight" },
        { "key": "routing", "label": "Token-smart routing", "type": "enum",
          "options": ["auto", "off"], "help": "Route cheap tasks to smaller models" },
        { "key": "qeFleet", "label": "On-demand QE fleet", "type": "bool",
          "help": "Agentic-QE test fleet, spun up on request" }
      ]
    },
    "recommendations": [ /* Recommendation[] — non-stack, e.g. de-npx a project */ ]
  }
}
```

## GET `/api/memory` — the across-your-projects fleet scan (slow, ~7–10s)

```jsonc
{ "fleet": [ { "name": "ruvnet-brain", "total": 1023, "embedded": 1021, "coverPct": 99.8, … } ] }
```

Split out of `/api/state` so it cannot block first paint. The page renders memory health immediately
and merges this list into the same card once it lands.

## GET `/api/stack` — the network audit (slow, ~5–20s; page loads a skeleton first)

```jsonc
{
  "packages": [
    { "name": "ruflo", "installed": "3.30.2", "target": "3.30.2", "tag": "alpha", "state": "CURRENT" }
    // state ∈ CURRENT | BEHIND | AHEAD | BROKEN | UNRESOLVED
  ],
  "shadows": [
    { "name": "@ruvector/rvf", "version": "0.1.9", "global": "0.2.3", "dir": "~/.npm/_npx/…", "stale": true }
  ],
  "summary": { "total": 40, "behind": 0, "broken": 1, "ahead": 0, "current": 38, "shadows": 15, "stale": 15 },
  "recommendations": [ /* Recommendation[] — sync BEHIND, purge stale shadows */ ]
}
```

## Recommendation — the aggregate the whole page is built around

**A Recommendation CANNOT exist without non-empty `evidence`, a `cost`, and an `undo`.** The
backend factory throws otherwise (DDD invariant, schema-enforced). The UI must render all four.

```jsonc
{
  "id": "sync-stack",
  "title": "Sync 1 stale shadow of @ruvector/rvf",
  "rationale": "A second copy in the npx cache preempts your global binary and quietly serves 0.1.9.",
  "severity": "IMPORTANT",                       // INFO | SUGGESTED | IMPORTANT
  "touchesMachine": true,                        // ⇐ if true, the UI MUST show plainImpact + require an explicit confirm
  "plainImpact": "This removes an extra, out-of-date copy of a tool sitting in a temporary folder on your computer. Your main copy is newer and stays untouched. Nothing you use will stop working — the temporary copy rebuilds itself automatically the next time it's needed. Fully reversible.",
  "evidence": [ { "observed": "@ruvector/rvf@0.1.9 in ~/.npm/_npx while global is 0.2.3", "source": "stack-sync findShadows" } ],
  "cost": { "time": "~0s", "latency": "none", "usd": 0, "risk": "low" },
  "change": { "kind": "run-script", "human": "purge the stale npx shadow", "cmd": "node scripts/stack-sync.mjs --sync" },
  "undo":   { "kind": "restore-dir", "human": "npx re-resolves on next use; backup kept at <dir>.bak-<ts>" }
}
```

**`touchesMachine` and `plainImpact` are load-bearing.** `touchesMachine: false` means the action
only writes RuvNet-Brain's own settings file in your user folder and changes nothing about how your
computer runs other software (e.g. Save Settings). `touchesMachine: true` means it installs, removes,
or rewires something the rest of your system uses — those **must** render `plainImpact` (jargon-free,
says what happens + why it's safe + that it's reversible) and a distinct "this changes your computer"
confirm step before Apply is allowed. Write `plainImpact` for a smart person who has never heard of npx.

## POST `/api/apply` — the ONLY writer (consent-gated)

Request: `{ "token", "ids": ["sync-stack", …], "preStateHash": "…" }`
Behavior (DDD Change Plan invariants): **re-read the world**, abort with `worldMoved` if `preStateHash`
no longer matches, **record the inverse first**, back up every mutated file to `<file>.bak-<ts>`, then run.
Response: `{ "results": [ { "id", "ok", "undoToken", "log" } ] }`

## POST `/api/save-config` — save Settings at user level

Request: `{ "token", "values": { … } }` → writes `~/.claude/ruvnet-brain/config.json`
(backup first, undo recorded). Response: `{ "ok", "backup", "undoToken" }`

## POST `/api/undo` — reverse a prior apply/save

Request: `{ "token", "undoToken" }` → Response: `{ "ok" }`

---

## Section order on the page (progressive disclosure — each collapsible, each independently useful)

1. **Your stack** — installed / current / duplicated / broken (from `/api/stack`)
2. **How it's wired** — npx vs global, where (from wiring)
3. **What we'd suggest** — the Recommendation cards (evidence · cost · undo · Apply/Skip)
4. **Is your memory actually working?** — the 0–100 health score with named deductions
5. **MetaHarness / Agentic-QE savings** — receipts only, or an honest "nothing measured yet"
6. **Settings** — the editable form, one **Save** button, writes at user level

## Design law (from ADR-0013)
- Read-only by default. Opening the page changes nothing.
- Existing choices are data, not errors. `AHEAD` is legal. `NPX` is shown with its tradeoff, never labelled "wrong".
- Every number traces to a receipt or an observation. No "up to 90%". No estimates.
- Nothing above `SUGGESTED` severity for anything not measured on THIS machine.
