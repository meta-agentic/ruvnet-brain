#!/bin/sh
# clear-claude-tmp.sh — purge stale Claude Code task-output temp files.
#
# WHY IT IS A SCRIPT NOW (2026-07-13): this was an inline plist one-liner, and it carried a beautiful
# little bug. Its "log" line was:
#     echo "Old Claude task logs cleared at Mon Apr  6 16:33:08 EDT 2026" >> /tmp/clear-claude-tmp.log
# The date was expanded ONCE, by whatever shell wrote the plist back in April, and then frozen into the
# argument forever. Every one of the 43 log lines since is byte-identical. The job ran fine for months;
# its log was a lie the entire time — it could not distinguish today's run from April's.
#
# It also never reported WHAT it deleted, so "ran and cleaned 200 files" and "ran and cleaned nothing"
# looked identical too. Both fixed: a real $(date), and a real count.
#
# Stuart nuked it on 2026-07-12 believing it was junk; it was not — the cleanup genuinely worked (this
# temp dir hits ~800MB). Restored, corrected, wrapped in job-heartbeat.sh, and put in the registry so it
# is supervised like everything else.
set -u

TMPDIR_CLAUDE="${CLAUDE_TMP_ROOT:-/private/tmp/claude-501}"
LOG="${CLEAR_TMP_LOG:-/tmp/clear-claude-tmp.log}"
AGE_DAYS="${CLEAR_TMP_AGE_DAYS:-2}"

[ -d "$TMPDIR_CLAUDE" ] || { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] SKIP: $TMPDIR_CLAUDE does not exist" >> "$LOG"; exit 0; }

# Count first, then delete — so the log can state what actually happened rather than assert success.
COUNT=$(find "$TMPDIR_CLAUDE" -name "*.output" -mtime +"$AGE_DAYS" 2>/dev/null | wc -l | tr -d ' ')
find "$TMPDIR_CLAUDE" -name "*.output" -mtime +"$AGE_DAYS" -delete 2>/dev/null
BEFORE_MB=$(du -sm "$TMPDIR_CLAUDE" 2>/dev/null | cut -f1)

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] cleared $COUNT stale .output file(s) older than ${AGE_DAYS}d; dir now ${BEFORE_MB}MB" >> "$LOG"
exit 0
