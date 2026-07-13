#!/bin/sh
# job-heartbeat.sh — wrap a scheduled job so it CANNOT run without leaving proof, and CANNOT fail quietly.
#
# WHY (2026-07-13): every scheduled job on this machine was trusted to report on itself, and they
# didn't. launchd's own exit status is useless as proof — a job that has NEVER RUN reports exit 0,
# identical to one that ran and succeeded. That ambiguity let com.ruvnet.brain-nightly sit unfired
# and look healthy. Per-job good intentions rot; a wrapper cannot forget.
#
# Usage (from a LaunchAgent's ProgramArguments):
#   /bin/sh /path/to/job-heartbeat.sh <label> -- <command> [args...]
#
# Guarantees:
#   1. A "start" receipt is written BEFORE the command runs.
#   2. An "end" receipt with the REAL exit code is written even if the command dies, is killed, or
#      the machine yanks it away — the trap fires on EXIT/INT/TERM. There is no silent death.
#   3. A non-zero exit pushes an URGENT ntfy alert immediately (topic: $NTFY_TOPIC, or the file
#      ~/.cache/ruvnet-brain/ntfy-topic). No topic = no push, but the receipt is still written.
#   4. The wrapper's own exit code is the job's exit code — launchd still sees the truth.

set -u

LABEL="${1:?usage: job-heartbeat.sh <label> -- <command...>}"
shift
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "job-heartbeat: no command given for $LABEL" >&2; exit 2; }

HB_DIR="${JOB_HEARTBEAT_DIR:-$HOME/.cache/ruvnet-brain/heartbeats}"
mkdir -p "$HB_DIR"
HB="$HB_DIR/$LABEL.json"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
STARTED="$(ts)"
START_EPOCH="$(date +%s)"

# Start receipt. If the job vanishes without ever writing an end receipt, THIS is the evidence that
# it started and never finished — a state the watchdog reports as FAILING, not as silence.
cat > "$HB" <<EOF
{"label":"$LABEL","started_at":"$STARTED","state":"running","pid":$$,"command":"$(echo "$@" | sed 's/"/\\"/g')"}
EOF

notify() { # notify <title> <body> <priority>
  topic="${NTFY_TOPIC:-}"
  [ -z "$topic" ] && [ -f "$HOME/.cache/ruvnet-brain/ntfy-topic" ] && topic="$(cat "$HOME/.cache/ruvnet-brain/ntfy-topic")"
  [ -z "$topic" ] && return 0
  curl -sS -m 10 -H "Title: $1" -H "Priority: $3" -H "Tags: rotating_light" -d "$2" "https://ntfy.sh/$topic" >/dev/null 2>&1 || true
}

finish() {
  code=${FORCED_CODE:-$?}
  ended="$(ts)"
  dur=$(( $(date +%s) - START_EPOCH ))
  if [ "$code" -eq 0 ]; then state="ok"; else state="failed"; fi
  cat > "$HB" <<EOF
{"label":"$LABEL","started_at":"$STARTED","ended_at":"$ended","state":"$state","exit_code":$code,"duration_sec":$dur}
EOF
  # Gong on failure, immediately — not at the next watchdog sweep. A failing nightly should reach the
  # phone while it is still tonight's problem.
  if [ "$code" -ne 0 ]; then
    notify "🔴 SCHEDULED JOB FAILED: $LABEL" "exit $code after ${dur}s — see the job's log. Receipt: $HB" "urgent"
  fi
  exit "$code"
}
trap finish EXIT
# A signal handler must KILL THE CHILD, then exit — letting the EXIT trap write the receipt once.
trap 'FORCED_CODE=143; kill -TERM "$CHILD" 2>/dev/null; exit 143' TERM
trap 'FORCED_CODE=130; kill -TERM "$CHILD" 2>/dev/null; exit 130' INT

# Run the job in the BACKGROUND and `wait` for it — do NOT run it in the foreground.
# Break-test finding (2026-07-13): a POSIX shell blocked on a FOREGROUND child does not run its trap
# when signalled — it dies with the receipt still saying "running", which is precisely the silent
# death this wrapper exists to prevent. `wait` is interruptible, so the trap fires immediately.
# The one death nothing can catch is SIGKILL (-9) / power loss, by definition: no handler runs. That
# case is caught one level up — nightly-watchdog.mjs reports a receipt stuck in "running" as FAILING
# ("started and never finished"). Trap for catchable deaths, watchdog for uncatchable ones.
"$@" &
CHILD=$!
wait "$CHILD"
