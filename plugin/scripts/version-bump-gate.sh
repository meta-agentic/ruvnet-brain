#!/bin/bash
# version-bump-gate.sh — PreToolUse gate on Bash. EVERY PUSH CARRIES A VERSION INCREMENT.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-13). Stuart, after a push with no bump served him stale code: "Every single
# commit to GitHub should come with a version increment: major.minor.bugfix. It's the only way
# we're gonna know beyond a shadow of a doubt what's going on. When other things are looking to
# read a change in version to know that there's something they need to be aware of, that's not
# negotiable."
#
# THE INCIDENT: gates/fleet-doctor//savings were pushed under an unchanged 2.5.2. The plugin
# cache compared 2.5.2 == 2.5.2, correctly served the STALE copy, and a restarted session
# loaded without /savings. THE VERSION NUMBER IS THE UPDATE SIGNAL — a push without a bump is
# an update nothing can see.
#
# Prior art is rUv's own: agent-harness-generator preflight.mjs refuses to greenlight a release
# when package versions drift, and version-bump.mjs bumps every manifest in lockstep — the gate
# is the product. This is that discipline applied at the push boundary.
#
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK. FAILS OPEN on anything unparseable.
# Opt-in (router profile.json), bash builtins + git only — same hardening as its four siblings.
# ─────────────────────────────────────────────────────────────────────────────────────────────

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

PROFILE="${MODEL_ROUTER_PROFILE:-$HOME/.claude/model-router/profile.json}"
[ -f "$PROFILE" ] || exit 0
[ "${RUVNET_SKIP_VERSION_GATE:-0}" = "1" ] && exit 0

field() { local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""; [[ $INPUT =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"; }
[ "$(field tool_name)" = "Bash" ] || exit 0
CMD=$(field command)
[[ $CMD == *"git push"* ]] || exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

# The version source of truth, in precedence order. A repo with neither is not version-managed
# by this convention — pass untouched.
SRC=""
for c in plugin/.claude-plugin/plugin.json package.json; do
  [ -f "$ROOT/$c" ] && { SRC="$c"; break; }
done
[ -n "$SRC" ] || exit 0

UP=$(git -C "$ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || UP=origin/main
git -C "$ROOT" rev-parse --verify "$UP" >/dev/null 2>&1 || exit 0

AHEAD=$(git -C "$ROOT" rev-list --count "$UP..HEAD" 2>/dev/null) || exit 0
[ "$AHEAD" -gt 0 ] || exit 0   # nothing outgoing → nothing to gate

ver_at() { # ver_at <rev> — version string in $SRC at that rev, empty on any failure
  local j re='"version"[[:space:]]*:[[:space:]]*"([^"]*)"'
  j=$(git -C "$ROOT" show "$1:$SRC" 2>/dev/null) || return 0
  [[ $j =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"
}
V_HEAD=$(ver_at HEAD); V_UP=$(ver_at "$UP")
[ -n "$V_HEAD" ] && [ -n "$V_UP" ] || exit 0   # can't read either side → fail open
[ "$V_HEAD" != "$V_UP" ] && exit 0             # bumped → pass

read -r -d '' MSG <<EOF || true
⛔ BLOCKED — this push carries $AHEAD commit(s) but NO version increment ($SRC still $V_UP).

THE VERSION NUMBER IS THE UPDATE SIGNAL. Plugin caches, update checks, and other sessions decide
whether to pull fresh code by comparing versions — a push without a bump is an update nothing can
see. This exact miss served a restarted session stale 2.5.2 without /savings on 2026-07-13.

Before pushing:
    1. bump "version" in $SRC (major.minor.bugfix)
    2. node scripts/sync-version.mjs      # syncs every surface, --check must pass
    3. include the bump in the outgoing commits, then push

(Stuart, 2026-07-13: "that's not negotiable." Deliberate override, say why out loud:
RUVNET_SKIP_VERSION_GATE=1)
EOF
printf '%s\n' "$MSG" >&2
exit 2
