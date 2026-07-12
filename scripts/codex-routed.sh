#!/usr/bin/env bash
# scripts/codex-routed.sh — built 2026-07-12. Codex has no native routing surface
# (~/.codex/config.toml launches ONE model per run), so a consulted wrapper is the only
# per-prompt model-selection path available to it. Part of the MetaHarness router (see
# scripts/model-router-engine.mjs, the harness-neutral prompt -> {model, reason} decision
# engine). This script only CONSULTS the engine and LAUNCHES codex — all selection logic
# (features, policy, pricing) lives in the engine, not here.
#
# Contract: never block Stuart's launch. If the engine errors, times out, or returns a
# null model, fall straight through to plain `codex` with no --model flag — a missing
# routing decision must never be worse than no routing at all.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

DECISION=$(node "$DIR/model-router-engine.mjs" --harness codex --prompt "$*" --json 2>/dev/null)

# Extract .model + a short .reason without a jq dependency (Stuart directive). python3 ships
# with macOS by default and its json module handles arbitrary reason text (quotes, unicode)
# more safely than hand-rolled JS string escaping in a node -e one-liner would. Single call,
# tab-delimited output, so we only shell out once per launch.
IFS=$'\t' read -r M REASON <<< "$(printf '%s' "$DECISION" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    m = d.get("model") or ""
    r = (d.get("reason") or "").replace("\n", " ").replace("\t", " ")[:80]
    print(f"{m}\t{r}")
except Exception:
    print("\t")
' 2>/dev/null)"

if [ -z "${M:-}" ] || [ "$M" = "None" ]; then
  # Engine failed / no policy resolved a model — never block, just launch codex unrouted.
  exec codex "$@"
fi

printf '\x1b[2m🧭 codex-routed → %s (%s)\x1b[0m\n' "$M" "$REASON"
exec codex --model "$M" "$@"
