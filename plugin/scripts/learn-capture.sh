#!/bin/bash
# learn-capture.sh — PostToolUse (Write|Edit|Bash). Appends ONE compact step to this session's learning
# queue. A session is a trajectory (task -> steps -> outcome); learn-flush.mjs feeds the queue to the
# GLOBAL SONA learner at SessionEnd, so "how you work" accumulates per-user across ALL projects — while
# project FACTS stay in each project's .swarm/memory.db, never here. We record the workflow ACTION (a
# command verb, a file's basename), never file CONTENT or secrets. ADR-0017.
#
# CONTRACT: PostToolUse is non-blocking — always exit 0, swallow every failure, no process spawn (fast).

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

TOOL=""
re_t='"tool_name"[[:space:]]*:[[:space:]]*"([^"]*)"'
[[ $INPUT =~ $re_t ]] && TOOL="${BASH_REMATCH[1]}"
[ -n "$TOOL" ] || exit 0

ACTION=""
case "$TOOL" in
  Bash)
    # Capture up to the first embedded quote — that's the command's workflow verbs (git push, gh run
    # watch, npx vercel, playwright, npm test). Long args/paths past a quote are dropped: verb, not facts.
    re_c='"command"[[:space:]]*:[[:space:]]*"([^"]*)"'
    [[ $INPUT =~ $re_c ]] && ACTION="${BASH_REMATCH[1]:0:120}"
    ;;
  Write|Edit|MultiEdit)
    re_f='"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"'
    [[ $INPUT =~ $re_f ]] && ACTION="edit ${BASH_REMATCH[1]##*/}"   # basename only — no full path
    ;;
esac
[ -n "$ACTION" ] || exit 0

SID="${CLAUDE_SESSION_ID:-default}"
DIR="$HOME/.cache/ruvnet-brain/learn"
mkdir -p "$DIR" 2>/dev/null || exit 0
printf '{"tool":"%s","action":"%s"}\n' "$TOOL" "${ACTION//\"/\\\"}" >> "$DIR/session-$SID.jsonl" 2>/dev/null || true

# ── HEARTBEAT FLUSH (ADR-027) ────────────────────────────────────────────────────────────────────
# The flush used to fire ONLY on a clean SessionEnd. Sessions compact, crash, get resumed, or are
# killed — none of those reach SessionEnd — so the queue silently grew to 1,884 undelivered events
# over days while the learner sat at 5 trajectories, last trained six days earlier. Draining it took
# the learner to 412/412 in one command. A queue that only empties on a graceful exit will always
# leak; activity itself must be the trigger.
#
# So: every HEARTBEAT_EVERY captures, drain in the BACKGROUND. Detached and fully silent — this runs
# inside a PostToolUse hook and must never add latency to the user's turn or fail one. Cheap check
# (a line count) on the common path; real work only at the threshold.
HEARTBEAT_EVERY=200
LINES=$(wc -l < "$DIR/session-$SID.jsonl" 2>/dev/null || echo 0)
if [ "$LINES" -ge "$HEARTBEAT_EVERY" ] && [ $((LINES % HEARTBEAT_EVERY)) -eq 0 ]; then
  FLUSH="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/ruvnet-brain/plugin}/scripts/learn-flush.mjs"
  [ -f "$FLUSH" ] && (nohup node "$FLUSH" >/dev/null 2>&1 &) || true
fi
exit 0
