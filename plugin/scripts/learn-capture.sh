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
exit 0
