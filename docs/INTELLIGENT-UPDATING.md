Updated: 2026-07-18 11:05:00 EDT | Version 1.0.0
Created: 2026-07-18 10:55:00 EDT

# Intelligent Updating — how RuvNet Brain stays current without ever trapping you

> Governing decision: **ADR-0023** (Stable Spine). Bounded context: **docs/ddd/0003-update-context.md**.
> House pattern mirrored: cognitum-v0-appliance **ADR-248** (manifest → verify → atomic swap → health-gate → retained-prev rollback).

## 0. The one-paragraph version

Claude Code loads a plugin **once, at boot, from a version-frozen directory** — so anything that
lives there is trapped until restart. Ruflo's CLI never has this problem because a CLI is
**invoked** (fresh `exec` per call), not **loaded**. Intelligent Updating restructures the Brain so
that almost everything becomes *invoked through one stable path* —
`~/.cache/ruvnet-brain/current` — and updating is just atomically re-pointing that path. Hooks run
new code on their next fire. The MCP proxy swaps its child worker between requests. No restart, no
nag, no trapped users — on npm, npx, git-clone, and marketplace installs alike.

## 1. The two classes: loaded vs invoked

| Piece | Class | Update latency |
|---|---|---|
| hooks.json **declarations** (matchers, timeouts) | loaded at CC boot | next restart (rare; honest nag) |
| skills / commands markdown | loaded at CC boot | next restart (rare; honest nag) |
| MCP **tool name + registration** | loaded at CC boot | next restart (rare; honest nag) |
| **hook script bodies** (grounding, session-start, walls…) | invoked per fire → **spine** | next hook fire (seconds) |
| **MCP behavior** (`search_ruvnet` implementation + KB) | child of the stdio **proxy** | next tool call after child swap |
| CLI / console / scripts | invoked | immediately |
| KB data stores | read per query by the MCP child | on KB update (own track) |

Design rule that keeps this working forever: **the boot-frozen shell must stay tiny and boring.**
`plugin/` changes are near-frozen ABI; anything with behavior belongs in the body (spine-resolved).

## 2. The spine — filesystem contract

```
~/.cache/ruvnet-brain/
  current                      # symlink (POSIX) / directory junction (Windows) → versions/<v>
  current.prev                 # the previously-active target; instant rollback
  versions/
    3.4.13-dev/                # immutable, fully-gated code payload
    3.4.14-dev/
  kb/                          # KB DATA — separate lifecycle (forge-update.mjs), private-store fence intact
  .reload-stamp                # mtime bump = signal to the MCP proxy: swap your child
  update.lock                  # single-updater lock (pid + started-at; stale-reclaimed)
  update-receipts.jsonl        # append-only ledger: every check/apply/flip/rollback, with SHAs
```

- **Atomic flip**: write `current.tmp-<pid>` symlink → `rename(2)` over `current`. POSIX rename is
  atomic; a reader sees the old target or the new target, never neither. On Windows, junctions
  (`fs.symlinkSync(target, path, 'junction')`) require **no admin rights**; flip = create-new +
  `fs.renameSync`.
- **Consistency during a flip**: the hook shim resolves the spine **once** per invocation
  (`realpath current`) and runs everything from that resolved, immutable `versions/<v>/` tree — a
  hook never straddles two versions mid-run. Version dirs are never edited in place, so a resolved
  tree can't change under a running script; `current.prev` retention means it can't vanish either
  (GC keeps active + prev + one more, deletes older only if not referenced by any live realpath).
- **Concurrent updaters** (two sessions, session-start + nightly): `update.lock` with stale-pid
  reclaim (the issue-fix.mjs pattern). Even without it, both writers flip to *gated, valid*
  targets — last writer wins safely.

## 3. The hook shim — how hooks escape the frozen dir

`plugin/hooks/hooks.json` (frozen per session — fine, it changes ~never) routes every hook through
one shim:

```
command: /bin/bash "${CLAUDE_PLUGIN_ROOT}/scripts/hook-shim.sh" ground-ruvnet.sh
```

`hook-shim.sh` (~20 lines, part of the frozen shell, designed to never need changing):

1. `SPINE=$(readlink ~/.cache/ruvnet-brain/current 2>/dev/null)` — resolve ONCE.
2. If the spine exists and `$SPINE/plugin/scripts/<name>` exists → `exec` it (env passthrough,
   stdin passthrough, **exit code preserved** — `route-dispatch.sh`'s deliberate exit-2 block
   still blocks).
3. Else → `exec "${CLAUDE_PLUGIN_ROOT}/scripts/<name>"` (fallback = exactly today's behavior;
   a missing/broken spine can never make things *worse* than the status quo).

Consequence: the CC-versioned plugin cache stops mattering. Whatever stale version CC boots,
hook fire #1 executes current code.

## 4. The hot-swap MCP proxy — `search_ruvnet` updates mid-session

`plugin/mcp/server.mjs` was already a transparent stdio proxy to the brain's `forge-mcp-all.mjs`.
It becomes a **supervising** proxy:

- Caches the client's `initialize` request (and `notifications/initialized`) verbatim.
- Between JSON-RPC requests (never mid-request), stats `.reload-stamp`; if newer than the child's
  start time: SIGTERM child → spawn new child (which resolves the spine + KB fresh) → replay the
  cached handshake → swallow the duplicate `initialize` response → resume bridging. Claude Code's
  connection never drops; request ids continue uninterrupted because the proxy owns the pipe.
- A request already in flight completes on the old child; the swap happens before the next one.
- If the new child dies within 5s → respawn on `current.prev`'s tree via rollback flip, and write
  a loud receipt. (Health-gating at the process level, ADR-248 §6's 60s principle scaled to a
  local process.)

## 5. The update engine — `scripts/update-apply.mjs`

One engine, invoked by every trigger (session-start background check, nightly launchd, `--update`,
`bin/install.mjs`):

```
check    GET manifest (releases/latest → manifest.json)      # already exists in the ship path
verify   SHA-256 each artifact vs manifest; Ed25519 bundle signature (bin/install.mjs already
         inlines the pubkey + verifyBundle — reuse, don't reinvent)
unpack   → versions/<v>.staging-<pid>/   (never into a live dir)
gate     bash -n every hook script · node --check every .mjs · one real CLI smoke query
         (the same "prove the door opens" discipline as the pre-push gate)
promote  mv versions/<v>.staging-<pid> versions/<v>   (atomic)
flip     current.prev ← old target · current → versions/<v> (atomic rename)
signal   touch .reload-stamp   (MCP proxy swaps child; hooks pick up on next fire by construction)
receipt  append update-receipts.jsonl {from, to, sha, gates, ms}
```

`--rollback`: flip `current` back to `current.prev`, touch stamp, receipt. One command, instant.

**Failure modes, by construction:**
- Network dies mid-download → staging dir discarded; `current` untouched.
- Bad bundle → verify fails → no promote, no flip. Users never see it.
- Gate fails → same. The receipt says why.
- Crash between promote and flip → a valid unused `versions/<v>` sits there; next run re-gates and
  flips it. Nothing is half-applied because the flip *is* the apply.
- Post-flip breakage discovered live → `--rollback`, or the proxy's 5s auto-rollback for the child.

## 6. The honest restart contract

The release manifest gains `requiresRestart: boolean` + `restartReason: string`, set by
`release.mjs` **automatically** (it diffs the shell: `plugin/hooks/hooks.json`, `plugin/.mcp.json`,
`plugin/skills/**`, `plugin/commands/**`, `hook-shim.sh`, `mcp/server.mjs` between releases — not
by a human remembering). session-start:

- update applied + `requiresRestart:false` → **say nothing**. It's just live.
- `requiresRestart:true` → ONE line, once, with the reason — the only nag that survives, and it's
  always true when shown.

## 7. Install-path agnosticism

| Path | What happens |
|---|---|
| `npx github:stuinfla/ruvnet-brain` / npm -g | `bin/install.mjs` installs KB (as today) + seeds `versions/<v>` + flips spine |
| Claude Code marketplace/plugin | CC installs the frozen shell; first session-start seeds the spine; from then on CC's own update cadence is irrelevant |
| git clone (maintainer) | `node scripts/update-apply.mjs --dev` → `current` → the checkout; edits are live on save. Guard: dev mode refuses to GC or overwrite a checkout target |
| Already-installed users (migration) | first session-start on the new version detects no spine → seeds it from the running plugin dir → flips. Zero-step migration |

## 8. Security posture

- Bundle Ed25519 signature verification stays mandatory (pubkey inlined in the installer — already
  shipped and CI-asserted); the spine adds SHA-256 per artifact from the manifest.
- The spine lives in user-space (`~/.cache`); no elevation, no keychain, no system mutation.
- Version dirs are immutable-by-convention and never executed from staging paths.
- The updater never touches `kb/` stores — the private-store fence (a user's private KBs) is
  structurally outside the code-update blast radius.

## 9. What we deliberately did NOT build

- **No hot-reload of CC declarations** — CC's loader owns those; pretending otherwise would lie.
  We minimize what lives there and tell the truth the one time a restart genuinely helps.
- **No per-hook version pinning / channels UI** — one `current`, one `prev`. Channels (stable/dev)
  exist only as manifest inputs. Complexity budget spent on atomicity and honesty instead.
- **No daemon.** Update checks piggyback on session-start + the existing nightly job. Nothing new
  runs resident.

## 10. Proving it (what "tested the shit out of it" means here)

- Unit: shim resolution + fallback + exit-code preservation; atomic flip under concurrent flips;
  rollback; manifest requiresRestart diffing; receipt writing.
- Integration: spawn the real proxy, run a real `initialize` → flip spine → next call answers from
  the NEW child (asserted via a version echo in the tool result), old child reaped.
- Live: fire a real hook via the shim, flip to a version dir with a marker change, fire again in
  the SAME session, observe the change — the restart-free update, demonstrated, not asserted.
