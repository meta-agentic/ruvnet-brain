#!/bin/bash
# lesson-hooks.sh — THE LAST MILE. Connects lessons to the events that actually fire.
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
# store said armed; the machine said unconnected.
#
# ONE dispatcher, not five hooks. ADR-030's constraint holds: gates scale with decision TYPES, never
# with lesson count. This file maps Claude Code's real events onto the store's triggers and asks the
# store what applies. Adding a lesson requires no change here — that asymmetry is the architecture.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHAT CHANGED, 2026-07-22: THIS FILE WAS THE THIRD LAYER OF A BLOCK THAT COULD NOT BLOCK.
#
# The old body ran the gate as `... 2>/dev/null || true`, echoed whatever came back, and then
# `exit 0` unconditionally — with this comment above it, which was true as a promise and fatal as a
# design: "FAILS OPEN, ALWAYS. Exit 0 unconditionally on every path."
#
# Measured, before the fix:
#     $ bash plugin/scripts/lesson-hooks.sh Stop ; echo $?
#       ⛔ BLOCKED — you are about to report progress or state.
#       0                    ← printed BLOCKED, returned ALLOW
#
# Three bugs stacked so neatly that each one alone would have been enough: the gate exited 1 (not the
# harness's blocking code 2), wrote its reason to stdout (which exit-2 ignores), and this file threw
# the code away regardless. `|| true` is what turned "the gate is broken" into "the gate is silent",
# which is why it survived long enough to be documented as working.
#
# FAIL-OPEN IS STILL THE RULE — it was just implemented as "always allow", which is not the same
# thing. Failing open means an ERROR must not refuse the user: a missing node, an unreadable store, a
# timeout. It never meant discarding a DELIBERATE refusal. Those are now distinguished by exit code:
# 2 is a decision and propagates; every other non-zero is a malfunction and allows.
#
# AND THE DEFAULT IS NOW A NUDGE, not a block (the owner, same day: "Nudging somebody is very fair.
# Forcing them through a gate is not."). The gate emits `additionalContext` on exit 0 for nudges —
# the model reads it, nothing is refused. Exit 2 happens only for a lesson the user has personally
# opted into blocking, in a file only they write.

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

# Map a real Claude Code event onto the store's decision points, and onto the event name the harness
# will accept back. An event may carry more than one decision point: ending a turn is simultaneously
# "reporting status" and "claiming done", and both have lessons.
#
# CLAUDE_EVENT is what goes into hookSpecificOutput.hookEventName, and it MUST be the harness's real
# event name — "PreToolUse", never our internal "PreToolUse-write" — or the envelope is discarded and
# the nudge silently reaches nobody. That is this project's signature failure; it is not repeating here.
TRIGGERS=""
CLAUDE_EVENT=""
case "$EVENT" in
  Stop)             TRIGGERS="report-status claim-done";        CLAUDE_EVENT="Stop" ;;
  PreToolUse-write) TRIGGERS="write-code";                      CLAUDE_EVENT="PreToolUse" ;;
  PreToolUse-bash)  TRIGGERS="mutate-machine";                  CLAUDE_EVENT="PreToolUse" ;;
  PreToolUse-push)  TRIGGERS="ship";                            CLAUDE_EVENT="PreToolUse" ;;
  UserPromptSubmit) TRIGGERS="assert-fact recommend-architecture"; CLAUDE_EVENT="UserPromptSubmit" ;;
  *) exit 0 ;;
esac

# ONE invocation carrying every trigger for this event — not one per trigger. Two reasons, both hard:
# a nudge must be a SINGLE JSON document (two concatenated objects on stdout parse as neither), and
# this runs on every matching event, so one node spawn instead of two is latency the user feels.
ARGS=()
for t in $TRIGGERS; do ARGS+=(--trigger "$t"); done

# A hard timeout, because this runs on every matching event and must never add perceptible latency.
# BUT `timeout` is GNU coreutils and STOCK macOS DOES NOT SHIP IT — on this dev machine it exists
# only because Homebrew put it there, which is exactly how a bug like this hides. Unguarded,
# `timeout 5 node ...` on a clean Mac exits 127 (command not found), so the gate would never run at
# all: no nudge, no block, and — worst of all — silence indistinguishable from "no lessons applied".
# So the timeout is used when present and skipped when not. A missing convenience must degrade the
# latency guarantee, never the gate. (Same lesson as the CI runner that went red because a test
# assumed macOS-only paths.)
TIMEOUT=""
command -v timeout  >/dev/null 2>&1 && TIMEOUT="timeout 5"
[ -z "$TIMEOUT" ] && command -v gtimeout >/dev/null 2>&1 && TIMEOUT="gtimeout 5"

# Streams pass straight through, UNREDIRECTED and UNCAPTURED. This is deliberate and it is the fix:
#   • stdout carries the nudge JSON — capturing it into a shell variable and re-echoing it risks
#     mangling (trailing-newline stripping, glob expansion) the harness's parse depends on.
#   • stderr carries a block's reason and must arrive as stderr, because exit 2 ignores stdout.
# The old `2>/dev/null` discarded precisely the stream a refusal needs.
$TIMEOUT node "$GATE" --event "$CLAUDE_EVENT" "${ARGS[@]}"
CODE=$?

# THE PROPAGATION. Exit 2 is the gate's considered decision that the user asked to be refused here —
# it is the only code that means anything to the harness, and it is passed through untouched.
# Everything else — 0, a crash, a 124 from timeout, node dying — allows the action. An error must
# never masquerade as a refusal, and a refusal must never be downgraded to an error.
[ "$CODE" -eq 2 ] && exit 2
exit 0
