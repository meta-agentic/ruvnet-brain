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
    # Capture the VERB CHAIN ONLY — "git push", "npm test", "npx vercel" — never the arguments.
    #
    # This previously took the first 120 chars up to an embedded quote and called that "verb, not
    # facts". It wasn't. Unquoted inline secrets were captured in full and written to disk, proven
    # by test: `export AWS_SECRET_ACCESS_KEY=wJalr... && psql postgres://admin:Hunter2Pass@db/prod`
    # landed verbatim in session-*.jsonl, and from there fed the global learner. Real command lines
    # routinely carry API keys, DB URLs with inline passwords, and internal hostnames — on a
    # corporate laptop the hostnames alone are a DLP finding.
    #
    # Now: keep at most the first two tokens, and stop at the first token that carries DATA rather
    # than INTENT (contains = / @ : , is a flag, or is improbably long). "export FOO=secret" records
    # "export"; "cd /Users/me/ClientProject" records "cd". The learner only ever needed the verb.
    re_c='"command"[[:space:]]*:[[:space:]]*"([^"]*)"'
    if [[ $INPUT =~ $re_c ]]; then
      set -f                      # no globbing while we word-split untrusted text
      _n=0
      for _tok in ${BASH_REMATCH[1]}; do
        case "$_tok" in
          *=*|*/*|*@*|*:*|-*) break ;;
        esac
        [ ${#_tok} -gt 24 ] && break
        ACTION="${ACTION:+$ACTION }$_tok"
        _n=$((_n + 1))
        [ "$_n" -ge 2 ] && break
      done
      set +f
    fi
    ;;
  Write|Edit|MultiEdit)
    re_f='"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"'
    [[ $INPUT =~ $re_f ]] && ACTION="edit ${BASH_REMATCH[1]##*/}"   # basename only — no full path
    ;;
esac
[ -n "$ACTION" ] || exit 0

SID="${CLAUDE_SESSION_ID:-default}"
DIR="$HOME/.cache/ruvnet-brain/learn"
# Owner-only (0700 dir / 0600 file). This queue was 0644 inside a 0755 dir: on macOS every local
# account is normally in `staff`, so any other user on a shared or corporate machine could read it.
( umask 077 && mkdir -p "$DIR" ) 2>/dev/null || exit 0
QUEUE="$DIR/session-$SID.jsonl"
[ -e "$QUEUE" ] || { : > "$QUEUE" 2>/dev/null && chmod 600 "$QUEUE" 2>/dev/null; } || true
printf '{"tool":"%s","action":"%s"}\n' "$TOOL" "${ACTION//\"/\\\"}" >> "$QUEUE" 2>/dev/null || true

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
# LEVEL-TRIGGERED, NOT EDGE-TRIGGERED. This is the whole fix, and the bug it replaces was severe.
#
# The condition used to be `LINES >= 200 && LINES % 200 == 0` — it fired ONLY when the count landed
# exactly on a multiple of 200. Two captures arriving between checks, or any concurrent write,
# steps the counter over the window and the flush NEVER fires again. Measured on the owner's machine
# 2026-07-22: the queue was at 491. It had sailed past both 200 and 400 without draining once, and
# would have grown forever.
#
# The failure mode is the nastiest kind: capture works, the learner works, and the PIPE BETWEEN THEM
# is severed — while every surface honestly reports both ends as healthy. "Is learning on?" had no
# true answer, because learning is not a switch; it is a chain, and one link was open.
#
# `-ge` cannot skip a window. It fires on every capture past the threshold until the queue is
# actually drained, which is the definition of level-triggered: the condition is the QUEUE'S DEPTH,
# not the instant it crossed a line.
HEARTBEAT_EVERY=200
LINES=$(wc -l < "$DIR/session-$SID.jsonl" 2>/dev/null || echo 0)
if [ "$LINES" -ge "$HEARTBEAT_EVERY" ]; then
  # Debounce so a deep queue doesn't spawn a flush on EVERY subsequent capture: at most one drain
  # per minute. Without this, level-triggering trades a stuck queue for a fork storm.
  STAMP="$DIR/.last-flush"
  NOW=$(date +%s)
  LAST=$(cat "$STAMP" 2>/dev/null || echo 0)
  if [ $((NOW - LAST)) -ge 60 ]; then
    echo "$NOW" > "$STAMP" 2>/dev/null || true
    FLUSH="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/ruvnet-brain/plugin}/scripts/learn-flush.mjs"
    [ -f "$FLUSH" ] && (nohup node "$FLUSH" >/dev/null 2>&1 &) || true
  fi
fi
exit 0
