#!/bin/bash
# npx-witness.sh — the instrument at the door. Fired by launchd the instant ~/.npm/_npx changes.
#
# WHY (2026-07-14 — the day the same failure happened seven times):
# Stale npx shadow copies of RuvNet packages kept "coming back" after every purge. Each time, the
# cleanup was verified with a check built from what had already been found — grep for claude-flow
# because claude-flow was what we'd seen. A check built from what you found can only confirm what
# you found; it is structurally incapable of revealing what you missed. There were at least FIVE
# families of npx producers (claude-flow@latest, claude-flow@alpha, ruflo, ruvector, aqe); exactly
# one was ever fixed, and the shadows returned twice while "the producer was disarmed".
#
# THE RULE THIS ENCODES: you cannot enumerate the callers of a thing — you can instrument the thing.
# This script does not search for callers. launchd (WatchPaths on ~/.npm/_npx) runs it the moment
# the cache CHANGES, and it snapshots who is running right then, with full parent chains. A sixth
# family we never imagined gets logged exactly like the five we know.
#
# It is an OBSERVER: append-only log, no deletions, no fixes, never blocks anything, always exit 0.
# Preferred placement was a shim at /usr/local/bin/npx (catches cache HITS too), but that is
# root-owned; this watcher needs no sudo and catches every cache CREATION — which is precisely the
# event that manufactures a shadow. Log: ~/.claude/logs/npx-witness.log (plain text, greppable).

LOG="$HOME/.claude/logs/npx-witness.log"
NPXDIR="$HOME/.npm/_npx"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || exit 0

{
  echo "═══ $(date -u +%Y-%m-%dT%H:%M:%SZ) — ~/.npm/_npx changed ═══"

  # What is in the cache right now, and what package does each dir hold?
  for d in "$NPXDIR"/*/; do
    [ -d "$d" ] || continue
    deps="?"
    [ -f "$d/package.json" ] && deps=$(node -p "Object.keys(require('$d/package.json').dependencies||{}).join(',')" 2>/dev/null || echo "?")
    echo "  dir: $(basename "$d")  mtime: $(stat -f '%Sm' -t '%H:%M:%S' "$d" 2>/dev/null)  pkgs: $deps"
  done
  [ -d "$NPXDIR" ] || echo "  (cache dir was deleted)"

  # Who is running npx/npm-exec RIGHT NOW — the culprit is alive at creation time (installs take
  # seconds). Walk each suspect's parent chain so we learn who CALLED it, not just that npx ran.
  echo "  --- live npx/npm processes at this instant ---"
  ps -Ao pid,ppid,command | grep -E "npx|npm exec|npm-cli.*exec|_npx" | grep -vE "grep|npx-witness" | head -8 | cut -c1-180 | sed 's/^/  /'
  for pid in $(ps -Ao pid,command | grep -E "npx|npm exec" | grep -vE "grep|npx-witness" | awk '{print $1}' | head -4); do
    echo "  chain for pid $pid:"
    p=$pid
    for _ in 1 2 3 4 5 6; do
      line=$(ps -o pid=,ppid=,command= -p "$p" 2>/dev/null) || break
      [ -z "$line" ] && break
      echo "    $line" | cut -c1-170
      p=$(echo "$line" | awk '{print $2}')
      [ "$p" -le 1 ] 2>/dev/null && break
    done
  done
  echo ""
} >> "$LOG" 2>/dev/null

exit 0
