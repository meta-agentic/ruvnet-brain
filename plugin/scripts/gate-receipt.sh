#!/bin/bash
# gate-receipt.sh — record what a gate CAUGHT.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-17). The walls logged only their successes. design-grades.jsonl held 13 receipts,
# 13 of them passing — yet the design wall had just blocked a commit minutes earlier. The block left
# no trace: the ledger showed the 96 that came after the fix, and nothing about the refusal that
# forced it. So the system could prove Claude complied and could not prove it had ever CAUGHT Claude,
# which is the only part anyone would want to see. Stuart, looking at the console: "make it worth
# something, because right now it seems to be facts without purpose."
#
# A gate that stops something and says nothing is unfalsifiable. This makes the catch auditable.
#
# CONTRACT: called by a blocking gate immediately before it exits non-zero.
#   gate-receipt.sh <gate> <subject> <reason>
# NEVER fails, never blocks, never writes to stdout/stderr — a receipt that breaks a gate would
# trade a real protection for a log line. Every failure path here is swallowed on purpose.
# ─────────────────────────────────────────────────────────────────────────────────────────────────
set -uo pipefail

F="$HOME/.cache/ruvnet-brain/gate-blocks.jsonl"
mkdir -p "$(dirname "$F")" 2>/dev/null || exit 0

# Strip the few characters that would break a JSON line. Reasons are short human strings, not data.
clean() { printf '%s' "${1:-}" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-160; }

printf '{"at":"%s","gate":"%s","subject":"%s","reason":"%s","cwd":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(clean "${1:-unknown}")" \
  "$(clean "${2:-}")" \
  "$(clean "${3:-}")" \
  "$(clean "$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")")" \
  >> "$F" 2>/dev/null || true

exit 0
