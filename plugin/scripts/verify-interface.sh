#!/bin/bash
# verify-interface.sh — PreToolUse gate on Bash. YOU MAY NOT CALL A TOOL YOU HAVE NOT READ THE HELP FOR.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-13). Stuart, furious: "There's zero reason you should be making incorrect calls. You
# have all of the code, all the pointers, all the knowledge. Why are you still so fascinated with
# efficiency that you won't take the split second to check you're making the call the right way?
# EFFECTIVE WINS OVER EFFICIENCY EVERY SINGLE TIME. Stop skipping steps. You are destroying your
# credibility."
#
# He is describing a real, mechanical defect. I reported AgentDB broken THREE TIMES. It was NEVER
# broken:
#   1. I called `ruflo memory search "query"` POSITIONALLY. The CLI wants `-q`. Empty result → I
#      declared the product broken.
#   2. My canary test then "failed" because MY OWN grep filtered the rows out.
#   3. My broken-state test printed nothing because I set the test up wrong.
# Every one was my defect, reported to him as a product defect. Cost: hours of his time and his trust.
#
# THE PRECISE GAP: the brain holds 2GB of rUv's SOURCE. It does NOT hold the runtime interface of a
# compiled npm CLI — `-q` lives in a binary's --help output, not in the indexed corpus. So when I went
# to INVOKE the tool, I typed the interface I ASSUMED existed. I ground FACTS in the brain and never
# ground INTERFACES in the tool.
#
# A rule would not fix this; I ignored rules all night. So: A WALL. You cannot invoke an ecosystem
# CLI's subcommand until you have actually read its --help in the last 24h. Five seconds, enforced.
#
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK (stderr returns to the model as the reason).
# FAILS OPEN on anything it cannot parse — a gate that breaks your shell is worse than the bug.
# ─────────────────────────────────────────────────────────────────────────────────────────────────
#
# FIX (2026-07-16, issues #12 and #13 — reported by github.com/sparkling, a real user this gate
# blocked mid-session, including a git commit).
#
# #13 — the payload was parsed with a bash regex: field() { local re="\"$1\"[[:space:]]*:[[:space:]]*
# \"([^\"]*)\""; ... }. `([^"]*)` cannot cross a `"`, and a JSON-escaped quote (`\"`) still contains a
# literal `"` byte in the raw text — so any command with an embedded quote was silently truncated at
# the first one. That cuts both ways: real invocations wrapped in an outer quote became invisible to
# the gate (false negative — the exact call this gate exists to catch sailed through unchecked), and
# a truncated fragment happening not to match made a broken check look like a passing one. Fixed by
# parsing with an actual JSON parser (node -e, piped stdin) instead of a regex — JSON string escaping
# is not a regular language, no regex fixes this. Fails open (exit 0) if node is missing or the parse
# throws.
#
# #12 — two further defects, now fixed:
#   1. `[@a-z0-9.-]*` after the tool name (meant only to absorb `@latest`) also absorbed an arbitrary
#      hyphenated suffix, so a DIFFERENT binary — `ruflo-source-patch`, `ruflo-adr-reindex.sh` — was
#      misread as `ruflo` with a bogus subcommand, and demanded `--help` for a command that doesn't
#      exist. And because the match was unanchored, it fired on ordinary prose that happened to
#      contain a tool's name (a git commit message body). Fixed: the version suffix now requires an
#      explicit `@`, and matching is anchored to actual command position (start of the command, or
#      right after a shell separator — `;`, `&`, `|`, `(`, newline — optionally through an `npx `
#      wrapper) instead of anywhere a substring happens to appear. Prose that merely *mentions* a
#      tool's name — inside a quoted string, a commit message, an echo argument — is not at command
#      position and no longer matches.
#   2. The documented override, `RUVNET_SKIP_INTERFACE_CHECK=1`, was read from the HOOK PROCESS's own
#      environment. A PreToolUse hook receives the proposed command as JSON on stdin and never
#      executes it, so setting the variable the way the message instructed — on the command itself —
#      had no effect on this process at all. The escape hatch was unreachable from the side told to
#      use it. Fixed: the command STRING is now checked for a `RUVNET_SKIP_INTERFACE_CHECK=1` token,
#      which is what a caller can actually do. (The old env-var check is kept too, for a genuinely
#      different, valid use: a persistent opt-out set in the shell that launches Claude Code itself —
#      but that is a session-wide switch, not the documented per-command override.)
# ─────────────────────────────────────────────────────────────────────────────────────────────────
#
# FIX (2026-07-24, issue #41, residual of #12 — reported by github.com/sparkling, design + reference
# implementation supplied verbatim in the issue).
#
# #12's "command position" anchor — `(^|[;&|(${NL}])` — was matched against the RAW command with no
# awareness of shell quoting: a `|`, `;`, `&`, `(`, or newline INSIDE a quoted string (a grep pattern's
# regex alternation, an awk program, a `git commit -m` message) reads as a real shell separator, so
# whatever follows is misread as command position. `grep -E "foo|ruflo init" file.txt` blocked on an
# ordinary read-only search. Fixed by matching against a quote-masked SKELETON of the command
# (`shellSkeleton()` in hook-input.mjs, ADR-0021's one shared parser) instead of the raw string:
# quoted CONTENT is replaced with `_`, quote characters and everything outside quotes survive
# byte-identical, so a `|` etc. inside quotes is masked away while a real shell separator outside
# quotes still anchors the match. Capture groups are unaffected because any surviving match lies
# outside quotes, where the skeleton equals the original. Computed once and reused by both the
# help-recording branch and the blocking branch, which share MATCH_RE. Fails open (exit 0) if the
# skeleton verb errors for any reason — same contract as every other step here.
# ─────────────────────────────────────────────────────────────────────────────────────────────────

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

# Opt-in, like every other gate here: no router profile = this user never asked for our discipline.
PROFILE="${MODEL_ROUTER_PROFILE:-$HOME/.claude/model-router/profile.json}"
[ -f "$PROFILE" ] || exit 0
# Session-wide opt-out: the hook PROCESS's own environment (e.g. exported in the shell that launches
# Claude Code). Different from — and not a substitute for — the per-command override checked below.
[ "${RUVNET_SKIP_INTERFACE_CHECK:-0}" = "1" ] && exit 0

# Real JSON parsing via the shared parser (hook-input.mjs), not a regex (issue #13, now ADR-0021):
# `([^"]*)`-style bash regexes cannot cross a `"`, and a JSON-escaped `\"` is still a literal `"`
# byte — any command with an embedded quote used to be silently truncated. ONE tested parser, shared
# by every gate. node is guaranteed present in Claude Code's environment; fail open if it isn't.
NODE_BIN=$(command -v node) || exit 0
HOOK_INPUT="$(dirname "${BASH_SOURCE[0]}")/hook-input.mjs"
TOOL_NAME=$(printf '%s' "$INPUT" | "$NODE_BIN" "$HOOK_INPUT" tool_name 2>/dev/null) || exit 0
[ "$TOOL_NAME" = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | "$NODE_BIN" "$HOOK_INPUT" command 2>/dev/null) || exit 0
[ -n "$CMD" ] || exit 0

# Quote-masked skeleton of CMD (issue #41, residual of #12): quoted CONTENT is replaced with `_`;
# quote characters and everything outside quotes survive byte-identical. MATCH_RE below is matched
# against SKEL, not CMD, so a `|`/`;`/`&`/`(`/newline INSIDE a quoted string (a grep pattern's regex
# alternation, a commit message, an awk program) is no longer mistaken for a real shell separator.
# Capture-group offsets for any surviving match are unaffected — a match can only survive outside
# quotes, where SKEL equals CMD exactly. Computed once, used by both branches below.
SKEL=$(printf '%s' "$INPUT" | "$NODE_BIN" "$HOOK_INPUT" skeleton 2>/dev/null) || exit 0

# Per-command override (issue #12, defect 2). The block message tells the caller to set this ON THE
# COMMAND — so check the command STRING, not this process's environment (which the caller never
# touches: a PreToolUse hook only ever sees the proposed command as text on stdin).
[[ $CMD =~ (^|[[:space:]])RUVNET_SKIP_INTERFACE_CHECK=1([[:space:]]|$) ]] && exit 0

# Only the ecosystem CLIs whose interfaces I keep guessing at. NOT git/ls/grep — this must not become
# a tax on ordinary work, or it gets switched off and protects nothing.
TOOLS='ruflo|claude-flow|agentic-flow|agentic-qe|ruvector|agent-browser|ruv-swarm'

# ONE regex, used by BOTH paths. My first version used a DIFFERENT (weaker) regex on the help-recording
# path — it lacked the `@[A-Za-z0-9._-]+` that absorbs `@latest`, so reading `ruflo@latest memory search
# --help` recorded NOTHING and the very next call was still blocked. The break-test caught it before it
# shipped. Two regexes for one concept is how you get a gate that never opens.
#
# Capture TWO levels (`memory search`, not just `memory`): `ruflo memory --help` lists subcommands but
# does NOT show `search`'s `-q` flag — and `-q` is the exact thing I guessed wrong. Granularity has to
# match the mistake it prevents.
#
# ANCHORED to command position (issue #12, defect 1): the version suffix now requires a leading `@`
# (it no longer absorbs an arbitrary hyphenated tail, which used to misread `ruflo-source-patch` as
# `ruflo` with subcommand `source-patch`), and the whole match must start at the beginning of the
# command, or right after a shell separator (`;`, `&`, `|`, `(`, newline) — optionally through a
# leading `npx ` — instead of anywhere the tool's name happens to appear. This is what keeps
# `npx ruflo@latest memory search` recognized as a real invocation while a sentence that merely
# *mentions* `ruflo memory search` inside a quoted string, echo argument, or commit message is not.
NL=$'\n'
MATCH_RE="(^|[;&|(${NL}])[[:space:]]*(npx[[:space:]]+)?($TOOLS)(@[A-Za-z0-9._-]+)?[[:space:]]+([a-z][a-z-]*)([[:space:]]+([a-z][a-z-]*))?"

if [[ $CMD =~ (--help|-h)([[:space:]]|$) ]]; then   # reading help is ALWAYS allowed — and recorded
  if [[ $SKEL =~ $MATCH_RE ]]; then
    KEY="${BASH_REMATCH[3]}.${BASH_REMATCH[5]}${BASH_REMATCH[7]:+.${BASH_REMATCH[7]}}"
    mkdir -p "$HOME/.cache/ruvnet-brain/help-read" 2>/dev/null || true
    : > "$HOME/.cache/ruvnet-brain/help-read/$KEY" 2>/dev/null || true
    # `ruflo memory search --help` also satisfies the parent `ruflo memory` — the child is strictly more.
    : > "$HOME/.cache/ruvnet-brain/help-read/${BASH_REMATCH[3]}.${BASH_REMATCH[5]}" 2>/dev/null || true
  fi
  exit 0
fi

[[ $SKEL =~ $MATCH_RE ]] || exit 0
TOOL="${BASH_REMATCH[3]}"; SUB="${BASH_REMATCH[5]}${BASH_REMATCH[7]:+ ${BASH_REMATCH[7]}}"
KEY="${BASH_REMATCH[3]}.${BASH_REMATCH[5]}${BASH_REMATCH[7]:+.${BASH_REMATCH[7]}}"

STAMP="$HOME/.cache/ruvnet-brain/help-read/$KEY"
# Read within the last 24h? (interfaces move — these are @latest/@alpha packages)
if [ -f "$STAMP" ]; then
  NOW=$(date +%s 2>/dev/null) || exit 0
  THEN=$(date -r "$STAMP" +%s 2>/dev/null) || exit 0
  [ $((NOW - THEN)) -lt 86400 ] && exit 0
fi

read -r -d '' MSG <<EOF || true
⛔ BLOCKED — you have not read the interface for: ${TOOL} ${SUB}

You are about to invoke a tool whose flags you are GUESSING at. That guess has already cost real
trust: \`ruflo memory search "query"\` was called positionally when the CLI wants \`-q\`, it returned
nothing, and AgentDB was reported BROKEN three times when it was never broken at all.

The brain holds rUv's SOURCE. It does NOT hold a compiled CLI's runtime flags. Ground the INTERFACE
in the TOOL, not in your assumptions. Run this first — it takes five seconds:

    ${TOOL} ${SUB} --help

Then re-issue your command with the flags it actually documents.

EFFECTIVE BEATS EFFICIENT. Skipping this step has never once saved time.
(Deliberate override, say why out loud — prefix the COMMAND ITSELF, this is text a hook reads on
stdin and never executes, so exporting the variable in your shell first does nothing:
    RUVNET_SKIP_INTERFACE_CHECK=1 ${TOOL} ${SUB} ...)
EOF
bash "$(dirname "${BASH_SOURCE[0]}")/gate-receipt.sh" verify-interface "${TOOL:-} ${SUB:-}" "CLI interface not verified before use" 2>/dev/null || true
printf '%s\n' "$MSG" >&2
exit 2
