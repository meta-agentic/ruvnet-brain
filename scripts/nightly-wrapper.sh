#!/bin/bash
# nightly-wrapper.sh — the ONLY thing launchd invokes for the nightly. Per Stuart's standing order
# (2026-07-12): no noise for success or no-op — only ACTIVE alerts for real failure, and the system
# must attempt to self-heal before escalating, then make failure impossible to miss next session.
#
# Flow: run once -> if it fails, wait and retry ONCE (catches transient network/API blips, the only
# class a blind retry can fix) -> if it fails AGAIN, loud phone alert + a durable marker file that
# ground-ruvnet.sh surfaces at the top of the very next session, unprompted. Success or a legitimate
# "nothing was due tonight" no-op: log only, phone stays silent.
set -u
# kb/models-cache (the fallback) starts cold every time -> every nightly re-downloads the ONNX
# embedder from HuggingFace. Point at the already-warm cache instead (verified present).
export KB_MODEL_CACHE="/Users/stuartkerr/Code/PowerPlatePulse/scripts/models-cache"
cd /Users/stuartkerr/Code/ruvnet-brain 2>/dev/null || {
  curl -sS --max-time 10 -H "Title: 🔴 Nightly CRASHED before it could even start" \
    -H "Priority: urgent" -H "Tags: rotating_light" \
    -d "cd into the repo failed — filesystem or mount problem. Investigate the machine directly." \
    "https://ntfy.sh/$(grep -m1 '^NTFY_TOPIC=' /Users/stuartkerr/Code/ruvnet-brain/.env 2>/dev/null | cut -d= -f2)" >/dev/null 2>&1
  exit 1
}
mkdir -p logs .ruvnet-brain
LOG=logs/nightly.log
MARKER=.ruvnet-brain/nightly-failure.json
LOCK=.ruvnet-brain/nightly.lock

# Single-instance guard (2026-07-12): the plist has no built-in one, and a full corpus rebuild can run
# for HOURS (verified live: 2h29m and still embedding one repo at ~1.5/s) — long enough to still be
# running when the NEXT scheduled 3:15am fire happens, which would start a second instance on top of
# it with no protection. A stale lock from a crashed run (PID no longer alive) is treated as no lock.
if [ -f "$LOCK" ]; then
  OLD_PID=$(cat "$LOCK" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "===== $(date -u +%FT%TZ) — SKIPPED: previous run (pid $OLD_PID) still in progress =====" >> "$LOG"
    exit 0
  fi
  echo "===== $(date -u +%FT%TZ) — stale lock from pid $OLD_PID (not running) — clearing =====" >> "$LOG"
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

# NIGHTLY_SMOKE=1 — prove this whole chain (launchd -> heartbeat wrapper -> here -> node -> the repo
# scan -> the log) WITHOUT a multi-hour rebuild or a real Release publish. self-update.mjs is dry-run
# by default, so dropping --apply --publish exercises every link except the build itself.
# WHY IT EXISTS (2026-07-13): the 03:15 fire on 07-12 died before it could even write its own log
# ("/bin/bash: logs/nightly.log: No such file or directory" — relative path, no working directory) and
# NOBODY KNEW, because the only way to test this chain was to wait until 03:15 and hope. A scheduled job
# you can only test by waiting for it is a job you are not testing. Now: `NIGHTLY_SMOKE=1 <the exact
# plist command>` proves it on demand, any time, in seconds.
SMOKE="${NIGHTLY_SMOKE:-0}"

run_once() {
  local before after rc tail
  before=$(gh release view --json tagName -q .tagName 2>/dev/null || echo "unknown")
  { echo "===== nightly-wrapper attempt $1 — $(date -u +%FT%TZ) — before: $before ====="
    if [ "$SMOKE" = "1" ]; then
      echo "[SMOKE] dry-run: exercising the full chain, NOT building or publishing"
      /usr/local/bin/node scripts/self-update.mjs --fresh-window 60
    else
      /usr/local/bin/node scripts/self-update.mjs --apply --publish --fresh-window 60
    fi
  } >> "$LOG" 2>&1
  rc=$?
  if [ "$SMOKE" = "1" ]; then
    # A smoke run must never claim a real outcome, touch the failure marker, or alter the tag story.
    if [ "$rc" -eq 0 ]; then echo "===== attempt $1: SMOKE OK — chain intact (no build, no publish) =====" >> "$LOG"; return 0; fi
    echo "===== attempt $1: SMOKE FAILED exit $rc — the chain is BROKEN, fix before 03:15 =====" >> "$LOG"
    return 1
  fi
  after=$(gh release view --json tagName -q .tagName 2>/dev/null || echo "unknown")
  if [ "$after" != "$before" ] && [ -n "$after" ] && [ "$after" != "unknown" ]; then
    echo "===== attempt $1: VERIFIED SUCCESS $before -> $after =====" >> "$LOG"
    rm -f "$MARKER"
    return 0
  elif [ "$rc" -eq 0 ]; then
    echo "===== attempt $1: CLEAN NO-OP, tag unchanged at $after =====" >> "$LOG"
    rm -f "$MARKER"
    return 0
  else
    echo "===== attempt $1: FAILED exit $rc, tag stuck at $after =====" >> "$LOG"
    return 1
  fi
}

# Memory distillation (ADR-174) had gone stale 3 days — same silent-death pattern as everything
# else tonight. Independent of publish success/failure: mine raw memory_entries into structured
# episodes/reasoning_patterns on every nightly run. Best-effort, never blocks the real job.
~/.npm-global/bin/ruflo memory distill run --path .swarm/memory.db >> "$LOG" 2>&1 || true
# Durability: was a one-off manual snapshot before tonight. Now recurring — WAL-safe, rotates
# automatically (keeps last 14), zero risk to the live DB (reads only).
~/.npm-global/bin/ruflo memory backup --db .swarm/memory.db --keep 14 >> "$LOG" 2>&1 || true

# ── GONG LAYER 3: brain-health canary (Stuart, 2026-07-12 — the brain must NEVER be dark silently).
# One real query against the LIVE cache brain every night. forge-ask-all.mjs exits non-zero on a
# total retrieval failure (all repos erroring) and rings kb/brain-alarm.mjs itself; this adds the
# guaranteed-nightly cadence plus its own urgent push, independent of the publish job's outcome.
BRAIN_KB="$HOME/.cache/ruvnet-brain/kb"
if [ -f "$BRAIN_KB/forge-ask-all.mjs" ]; then
  echo "===== brain-health canary — $(date -u +%FT%TZ) =====" >> "$LOG"
  if (cd "$BRAIN_KB" && /usr/local/bin/node forge-ask-all.mjs --dir . --q "HNSW vector index" --k 1) >> "$LOG" 2>&1; then
    echo "===== brain-health canary: OK =====" >> "$LOG"
  else
    echo "===== brain-health canary: DOWN — escalating =====" >> "$LOG"
    sh scripts/notify.sh "🚨 RuvNet Brain DOWN (nightly canary)" \
      "The live brain at $BRAIN_KB failed a real query — retrieval is broken for every session on this machine. Fix: cd $BRAIN_KB && npm i, then npx github:stuinfla/ruvnet-brain --doctor. See logs/nightly.log." \
      urgent "rotating_light" || true
  fi
fi

# ── Key-health canary (Stuart, 2026-07-12: two provider keys found dead by accident, months late).
# Runs through `zsh -lc` ON PURPOSE: a login shell sources ~/.zshrc -> env.global + the openclaw
# SOPS secrets, so this probes the EXACT env every real shell inherits — the real door, not a copy.
# The canary itself handles urgent pushes on alive->DEAD transitions (and recovery notices), so a
# known-dead key doesn't re-alarm every night; here we only log.
echo "===== key-health canary — $(date -u +%FT%TZ) =====" >> "$LOG"
zsh -lc 'cd /Users/stuartkerr/Code/ruvnet-brain && /usr/local/bin/node scripts/key-canary.mjs --notify' >> "$LOG" 2>&1 \
  && echo "===== key-health canary: all present keys alive =====" >> "$LOG" \
  || echo "===== key-health canary: at least one key DEAD (push sent on new deaths) =====" >> "$LOG"

if run_once 1; then
  exit 0
fi

echo "===== first attempt failed — waiting 3 min, retrying once (self-heal for transient issues) =====" >> "$LOG"
sleep 180

if run_once 2; then
  echo "===== SELF-HEALED on retry — no escalation needed =====" >> "$LOG"
  exit 0
fi

# Both attempts genuinely failed. Escalate loudly AND leave a marker the next session cannot miss.
AFTER=$(gh release view --json tagName -q .tagName 2>/dev/null || echo "unknown")
TAIL=$(tail -8 "$LOG" | tr '\n' ' ' | cut -c1-600)
mkdir -p .ruvnet-brain
python3 -c "
import json, datetime
json.dump({
  'at': datetime.datetime.utcnow().isoformat() + 'Z',
  'tag_stuck_at': '$AFTER',
  'tail': '''$TAIL''',
  'note': 'Nightly failed twice (immediate + 3min retry). Needs a live session to diagnose — see logs/nightly.log.'
}, open('$MARKER', 'w'), indent=2)
"
sh scripts/notify.sh "🔴 Nightly FAILED twice — needs you" "tag stuck at $AFTER after retry. Last: $TAIL" urgent "rotating_light"
echo "===== ESCALATED: marker written at $MARKER =====" >> "$LOG"
exit 1
