#!/bin/bash
# lesson-hooks.sh — THE LAST MILE. Connects ratified lessons to the events that actually fire.
#
# WHY THIS EXISTS, measured 2026-07-22 05:50:
#
#     trigger              enforcing?  wired to a hook that runs?
#     ship                 yes         YES  ← the only real one
#     assert-fact          yes         no
#     report-status        yes         no   ← this is why the model still stopped
#     write-code           yes         no
#     claim-done           yes         no
#     mutate-machine       yes         no
#
# Five lessons the owner had personally ratified reported "enforcing" and NOTHING CALLED THEM. The
# store said armed; the machine said unconnected. `report-status` was enforcing at the exact moment
# the model stopped mid-task, and it never fired, because no hook invoked it.
#
# That is the fifth built-tested-unwired failure in 24 hours, and the owner's verdict is exact: "If
# it's supposedly shipped in 3.7 and we're on 3.8 and you stopped, then clearly it doesn't work."
# A gate that is armed and unconnected is configuration, not enforcement.
#
# ONE dispatcher, not five hooks. ADR-030's constraint holds: gates scale with decision TYPES, never
# with lesson count. This file maps Claude Code's real events onto the store's triggers and asks the
# store what applies. Adding a lesson requires no change here — that asymmetry is the architecture.
#
# FAILS OPEN, ALWAYS. Exit 0 unconditionally on every path. A hook that breaks a turn because it
# could not read a JSON file gets disabled inside a day, and a disabled hook protects nothing.

EVENT="${1:-}"
[ -z "$EVENT" ] && exit 0

# Resolve the gate relative to this script so it works from the repo, the marketplace clone, or an
# installed bundle without a hardcoded path (a hardcoded ~/.npm-global path told users ruflo was
# missing when it sat on their PATH — same class of bug).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
GATE=""
for c in "$HERE/../../scripts/lesson-gate.mjs" "$HERE/../scripts/lesson-gate.mjs" "$HOME/.claude/plugins/marketplaces/ruvnet-brain/scripts/lesson-gate.mjs"; do
  [ -f "$c" ] && GATE="$c" && break
done
[ -z "$GATE" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

# Map a real Claude Code event onto the store's decision points. An event may carry more than one:
# ending a turn is simultaneously "reporting status" and "claiming done", and both have lessons.
TRIGGERS=""
case "$EVENT" in
  Stop)             TRIGGERS="report-status claim-done" ;;
  PreToolUse-write) TRIGGERS="write-code" ;;
  PreToolUse-bash)  TRIGGERS="mutate-machine" ;;
  UserPromptSubmit) TRIGGERS="assert-fact recommend-architecture" ;;
  PreToolUse-push)  TRIGGERS="ship" ;;
  *) exit 0 ;;
esac

OUT=""
for t in $TRIGGERS; do
  # Hard timeout: this runs on every event and must never add perceptible latency.
  R="$(timeout 5 node "$GATE" --trigger "$t" 2>/dev/null || true)"
  [ -n "$R" ] && OUT="${OUT}${R}"
done

[ -n "$OUT" ] && echo "$OUT"
exit 0
