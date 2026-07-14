# npx census — complete map (2026-07-14)

Read-only. Nothing was modified. Every surface that can execute a command string was enumerated;
unparseable files are listed, not skipped.

## Headline

| | |
|---|---|
| Total npx call sites (all packages) | **567** |
| rUv-family call sites | **560** |
| Projects with rUv npx hooks | **54** |
| Dormant launchd guns (disabled, still on disk) | 0 |
| Authorization allowlists pre-approving npx | 307 |
| Advisory surfaces (docs instructing npx) | 5 |
| Unparseable (UNKNOWN, not clean) | 36 |

## By family × surface

| family | count |
|---|---|
| @claude-flow/* | 302 — A-project-settings:275, C-mcp:17, G-helper:1, G-standalone-script:5, H-hook-invoked-script:4 |
| claude-flow (old pkg) | 118 — A-project-settings:115, C-mcp:2, H-hook-invoked-script:1 |
| other rUv | 62 — A-project-settings:56, C-mcp:6 |
| ruflo | 43 — A-project-settings:11, C-mcp:18, G-hook-script:9, G-helper:1, H-hook-invoked-script:4 |
| ruvector | 33 — A-project-settings:20, C-mcp:13 |
| non-rUv | 7 — C-mcp:4, G-hook-script:1, G-standalone-script:1, H-hook-invoked-script:1 |
| agentic-qe / aqe | 2 — A-project-settings:2 |

## Every rUv-family call site


### A-project-settings

- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PreToolUse[Edit|Write|MultiEdit] — **ruvector**
  `npx ruvector hooks pre-edit "$TOOL_INPUT_file_path"`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PreToolUse[Bash] — **ruvector**
  `npx ruvector hooks pre-command "$TOOL_INPUT_command"`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PostToolUse[Edit|Write|MultiEdit] — **ruvector**
  `npx ruvector hooks post-edit "$TOOL_INPUT_file_path"`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PostToolUse[Bash] — **ruvector**
  `npx ruvector hooks post-command "$TOOL_INPUT_command"`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PreCompact[auto] — **ruvector**
  `npx ruvector hooks pre-compact --auto`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:PreCompact[manual] — **ruvector**
  `npx ruvector hooks pre-compact`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:Stop[*] — **ruvector**
  `npx ruvector hooks session-end`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:SessionStart[*] — **ruvector**
  `npx ruvector hooks session-start`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:UserPromptSubmit[*] — **ruvector**
  `npx ruvector hooks suggest-context`
- `~/Code/AI Retirement Analyzer/.claude/settings.json` — hook:Notification[.*] — **ruvector**
  `npx ruvector hooks track-notification`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/AppealArmor/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/AppealArmor/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **ruflo**
  `[ -n "$TOOL_INPUT_file_path" ] && npx ruflo@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PreToolUse[^Bash$] — **ruflo**
  `[ -n "$TOOL_INPUT_command" ] && npx ruflo@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PreToolUse[^Task$] — **ruflo**
  `[ -n "$TOOL_INPUT_prompt" ] && npx ruflo@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>/dev/null |`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **ruflo**
  `[ -n "$TOOL_INPUT_file_path" ] && npx ruflo@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true}" 2>/dev/n`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PostToolUse[^Bash$] — **ruflo**
  `[ -n "$TOOL_INPUT_command" ] && npx ruflo@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-true}" 2>/dev`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:PostToolUse[^Task$] — **ruflo**
  `[ -n "$TOOL_RESULT_agent_id" ] && npx ruflo@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-true}" 2>/de`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:UserPromptSubmit[*] — **ruflo**
  `[ -n "$PROMPT" ] && npx ruflo@latest hooks route --task "$PROMPT" || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:SessionStart[*] — **ruflo**
  `npx ruflo@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:SessionStart[*] — **ruflo**
  `[ -n "$SESSION_ID" ] && npx ruflo@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — hook:Notification[*] — **ruflo**
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx ruflo@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NOTIFICATION_`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json` — statusLine — **ruflo**
  `npx ruflo@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Ruflo v3.5"`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/flighttest/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/flighttest/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/flighttest/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/flighttest/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/flighttest/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/PresenterMode/.claude/settings.json` — hook:PreCompact[auto] — **agentic-qe / aqe**
  `/bin/bash -c 'echo "🔄 Auto-Compact: 20 QE agents available. Use: npx aqe learn status"'`
- `~/Code/PresenterMode/.claude/settings.json` — hook:Stop[*] — **agentic-qe / aqe**
  `echo '📊 Session ended. Run: npx aqe learn status' 2>/dev/null || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/PresenterMode/claude-presentation-master/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} bash -c 'FILE="{}"; echo "🔍 Semantic Searc`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **other rUv**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} bash -c 'FILE="{}"; echo "⚠️ Failure Detect`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PreToolUse[Task] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.prompt // .tool_input.task // empty' | tr '\n' '\0' | xargs -0 -I {} bash -c 'TASK="{}"; echo "🎯 Trajectory Predic`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} bash -c 'FILE="{}"; echo "💾 Experience Rep`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **other rUv**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} bash -c 'FILE="{}"; (sleep 2; TEST_RESULT=$`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:PostToolUse[Task] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.prompt // .tool_input.task // empty, .result.success // "unknown"' | tr '\n' '\0' | xargs -0 bash -c 'TASK="$1"; SU`
- `~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `bash -c 'echo "🎓 Session End: Training models on accumulated experiences..."; npx agentdb@latest train --domain "code-edits" --epochs 10 --`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:UserPromptSubmit[*] — **claude-flow (old pkg)**
  `cat | jq -r '.user_prompt // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha workers dispatch --prompt '{}' --parallel true 2>/`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/daa/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/daa/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-brain/clones/daa/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/daa/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-brain/clones/daa/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-brain/clones/marketing/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/midstream/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/midstream/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-brain/clones/midstream/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/midstream/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-brain/clones/midstream/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_description" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$(echo "$TOOL_INP`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:SessionEnd[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks session-end --persist-memory true --export-patterns true 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:TeammateIdle[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks teammate-idle --auto-assign true 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — hook:TaskCompleted[*] — **@claude-flow/***
  `[ -n "$TASK_ID" ] && npx @claude-flow/cli@latest hooks task-completed --task-id "$TASK_ID" --train-patterns true 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook pre-edit --file '${tool.params.file_path}' --ensure-coordination --track-operation`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook pre-bash --command '${tool.params.command}' --validate-safety --estimate-resources`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook pre-task --description '${tool.params.description}' --auto-spawn-agents --optimize-topology`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook pre-search --pattern '${tool.params.pattern || tool.params.file_path}' --prepare-cache`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^mcp__ruv-swarm__.*$] — **other rUv**
  `npx ruv-swarm hook pre-mcp --tool '${tool.name}' --params '${JSON.stringify(tool.params)}' --validate-state`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook post-edit --file '${tool.params.file_path}' --auto-format --train-patterns --update-graph`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook post-bash --exit-code '${tool.result.exitCode}' --log-execution --update-metrics --learn-patterns`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook post-task --task-id '${tool.result.id}' --analyze-performance --update-coordination`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook agent-complete --agent '${tool.params.description}' --prompt '${tool.params.prompt}' --output '${tool.result.output}' --c`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook post-search --cache-results --train-search-patterns --update-knowledge-graph`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__swarm_init$] — **other rUv**
  `npx ruv-swarm hook mcp-swarm-initialized --swarm-id '${tool.result.id}' --topology '${tool.params.topology}' --persist-config --enable-monit`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__agent_spawn$] — **other rUv**
  `npx ruv-swarm hook mcp-agent-spawned --agent-id '${tool.result.agent_id}' --type '${tool.params.type}' --update-roster --train-specializatio`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__task_orchestrate$] — **other rUv**
  `npx ruv-swarm hook mcp-task-orchestrated --task-id '${tool.result.task_id}' --monitor-progress --optimize-distribution`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__neural_train$] — **other rUv**
  `npx ruv-swarm hook mcp-neural-trained --improvement '${tool.result.improvement}' --save-weights --update-patterns`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebSearch$] — **other rUv**
  `npx ruv-swarm hook post-web-search --query '${tool.params.query}' --analyze-results --update-knowledge`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebFetch$] — **other rUv**
  `npx ruv-swarm hook post-web-fetch --url '${tool.params.url}' --extract-patterns --cache-content`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Notification[.*] — **other rUv**
  `npx ruv-swarm hook notification --message '${notification.message}' --level '${notification.level}' --with-swarm-status --send-telemetry`
- `~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Stop[.*] — **other rUv**
  `npx ruv-swarm hook session-end --generate-summary --save-memory --export-metrics --analyze-patterns --optimize-future`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-packages/marketing/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:UserPromptSubmit[*] — **claude-flow (old pkg)**
  `cat | jq -r '.user_prompt // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha workers dispatch --prompt '{}' --parallel true 2>/`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true 2>/dev/null || true`
- `~/Code/ruvnet-repos/daa/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/daa/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/daa/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/daa/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/daa/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-repos/flow-nexus/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/flow-nexus/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/flow-nexus/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/flow-nexus/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/flow-nexus/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-repos/marketing/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-repos/midstream/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/midstream/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/midstream/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/midstream/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/midstream/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:UserPromptSubmit[.*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks route-task --auto-swarm true --detect-complexity true`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:SessionStart[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-start --auto-configure true --restore-context true`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PreToolUse[Task] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.prompt // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-task --description '{}' --coordina`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PostToolUse[Task] — **claude-flow (old pkg)**
  `cat | jq -r '{agent: .tool_input.subagent_type, description: .tool_input.description} | @json' | xargs -I {} npx claude-flow@alpha hooks pos`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_description" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$(echo "$TOOL_INP`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:SessionEnd[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks session-end --persist-memory true --export-patterns true 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:TeammateIdle[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks teammate-idle --auto-assign true 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — hook:TaskCompleted[*] — **@claude-flow/***
  `[ -n "$TASK_ID" ] && npx @claude-flow/cli@latest hooks task-completed --task-id "$TASK_ID" --train-patterns true 2>/dev/null || true`
- `~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook pre-edit --file '${tool.params.file_path}' --ensure-coordination --track-operation`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook pre-bash --command '${tool.params.command}' --validate-safety --estimate-resources`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook pre-task --description '${tool.params.description}' --auto-spawn-agents --optimize-topology`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook pre-search --pattern '${tool.params.pattern || tool.params.file_path}' --prepare-cache`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^mcp__ruv-swarm__.*$] — **other rUv**
  `npx ruv-swarm hook pre-mcp --tool '${tool.name}' --params '${JSON.stringify(tool.params)}' --validate-state`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook post-edit --file '${tool.params.file_path}' --auto-format --train-patterns --update-graph`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook post-bash --exit-code '${tool.result.exitCode}' --log-execution --update-metrics --learn-patterns`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook post-task --task-id '${tool.result.id}' --analyze-performance --update-coordination`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook agent-complete --agent '${tool.params.description}' --prompt '${tool.params.prompt}' --output '${tool.result.output}' --c`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook post-search --cache-results --train-search-patterns --update-knowledge-graph`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__swarm_init$] — **other rUv**
  `npx ruv-swarm hook mcp-swarm-initialized --swarm-id '${tool.result.id}' --topology '${tool.params.topology}' --persist-config --enable-monit`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__agent_spawn$] — **other rUv**
  `npx ruv-swarm hook mcp-agent-spawned --agent-id '${tool.result.agent_id}' --type '${tool.params.type}' --update-roster --train-specializatio`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__task_orchestrate$] — **other rUv**
  `npx ruv-swarm hook mcp-task-orchestrated --task-id '${tool.result.task_id}' --monitor-progress --optimize-distribution`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__neural_train$] — **other rUv**
  `npx ruv-swarm hook mcp-neural-trained --improvement '${tool.result.improvement}' --save-weights --update-patterns`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebSearch$] — **other rUv**
  `npx ruv-swarm hook post-web-search --query '${tool.params.query}' --analyze-results --update-knowledge`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebFetch$] — **other rUv**
  `npx ruv-swarm hook post-web-fetch --url '${tool.params.url}' --extract-patterns --cache-content`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Notification[.*] — **other rUv**
  `npx ruv-swarm hook notification --message '${notification.message}' --level '${notification.level}' --with-swarm-status --send-telemetry`
- `~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Stop[.*] — **other rUv**
  `npx ruv-swarm hook session-end --generate-summary --save-memory --export-metrics --analyze-patterns --optimize-future`
- `~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook pre-edit --file '${tool.params.file_path}' --ensure-coordination --track-operation`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook pre-bash --command '${tool.params.command}' --validate-safety --estimate-resources`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook pre-task --description '${tool.params.description}' --auto-spawn-agents --optimize-topology`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook pre-search --pattern '${tool.params.pattern || tool.params.file_path}' --prepare-cache`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PreToolUse[^mcp__ruv-swarm__.*$] — **other rUv**
  `npx ruv-swarm hook pre-mcp --tool '${tool.name}' --params '${JSON.stringify(tool.params)}' --validate-state`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **other rUv**
  `npx ruv-swarm hook post-edit --file '${tool.params.file_path}' --auto-format --train-patterns --update-graph`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Bash$] — **other rUv**
  `npx ruv-swarm hook post-bash --exit-code '${tool.result.exitCode}' --log-execution --update-metrics --learn-patterns`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook post-task --task-id '${tool.result.id}' --analyze-performance --update-coordination`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^Task$] — **other rUv**
  `npx ruv-swarm hook agent-complete --agent '${tool.params.description}' --prompt '${tool.params.prompt}' --output '${tool.result.output}' --c`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^(Read|Grep|Glob)$] — **other rUv**
  `npx ruv-swarm hook post-search --cache-results --train-search-patterns --update-knowledge-graph`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__swarm_init$] — **other rUv**
  `npx ruv-swarm hook mcp-swarm-initialized --swarm-id '${tool.result.id}' --topology '${tool.params.topology}' --persist-config --enable-monit`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__agent_spawn$] — **other rUv**
  `npx ruv-swarm hook mcp-agent-spawned --agent-id '${tool.result.agent_id}' --type '${tool.params.type}' --update-roster --train-specializatio`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__task_orchestrate$] — **other rUv**
  `npx ruv-swarm hook mcp-task-orchestrated --task-id '${tool.result.task_id}' --monitor-progress --optimize-distribution`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^mcp__ruv-swarm__neural_train$] — **other rUv**
  `npx ruv-swarm hook mcp-neural-trained --improvement '${tool.result.improvement}' --save-weights --update-patterns`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebSearch$] — **other rUv**
  `npx ruv-swarm hook post-web-search --query '${tool.params.query}' --analyze-results --update-knowledge`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:PostToolUse[^WebFetch$] — **other rUv**
  `npx ruv-swarm hook post-web-fetch --url '${tool.params.url}' --extract-patterns --cache-content`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Notification[.*] — **other rUv**
  `npx ruv-swarm hook notification --message '${notification.message}' --level '${notification.level}' --with-swarm-status --send-telemetry`
- `~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json` — hook:Stop[.*] — **other rUv**
  `npx ruv-swarm hook session-end --generate-summary --save-memory --export-metrics --analyze-patterns --optimize-future`
- `~/Code/ruvvectortest/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/ruvvectortest/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/ruvvectortest/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/ruvvectortest/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/ruvvectortest/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/Site_Master/.claude/settings.json` — hook:PreToolUse[Bash] — **@claude-flow/***
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx @claude-flow/cli@latest hooks pre-command --command '{}' --va`
- `~/Code/Site_Master/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **@claude-flow/***
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx @claude-flow/cli@latest hooks pre-edit `
- `~/Code/Site_Master/.claude/settings.json` — hook:PostToolUse[Bash] — **@claude-flow/***
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx @claude-flow/cli@latest hooks post-command --command '{}' --t`
- `~/Code/Site_Master/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **@claude-flow/***
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx @claude-flow/cli@latest hooks post-edit`
- `~/Code/Site_Master/.claude/settings.json` — hook:Stop[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/u-go-far-linkedin-generator/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-command --command '{}' --validate`
- `~/Code/u-go-far-linkedin-generator/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks pre-edit --file`
- `~/Code/u-go-far-linkedin-generator/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.command // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-command --command '{}' --track-m`
- `~/Code/u-go-far-linkedin-generator/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `cat | jq -r '.tool_input.file_path // .tool_input.path // empty' | tr '\n' '\0' | xargs -0 -I {} npx claude-flow@alpha hooks post-edit --fil`
- `~/Code/u-go-far-linkedin-generator/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/ugo-ai-register-now/.claude/settings.json` — hook:PreToolUse[Bash] — **claude-flow (old pkg)**
  `cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null | head -c 800); if [ -n "$cmd" ]; then npx claude-flow@alpha hooks pre-command --comm`
- `~/Code/ugo-ai-register-now/.claude/settings.json` — hook:PreToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `f=$(jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null | head -c 500); if [ -n "$f" ]; then npx claude-flow@alpha hooks `
- `~/Code/ugo-ai-register-now/.claude/settings.json` — hook:PostToolUse[Bash] — **claude-flow (old pkg)**
  `cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null | head -c 800); if [ -n "$cmd" ]; then npx claude-flow@alpha hooks post-command --com`
- `~/Code/ugo-ai-register-now/.claude/settings.json` — hook:PostToolUse[Write|Edit|MultiEdit] — **claude-flow (old pkg)**
  `f=$(jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null | head -c 500); if [ -n "$f" ]; then npx claude-flow@alpha hooks `
- `~/Code/ugo-ai-register-now/.claude/settings.json` — hook:Stop[*] — **claude-flow (old pkg)**
  `npx claude-flow@alpha hooks session-end --generate-summary true --persist-state true --export-metrics true`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PreToolUse[Edit|Write|MultiEdit] — **ruvector**
  `npx ruvector hooks pre-edit "$TOOL_INPUT_file_path"`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PreToolUse[Bash] — **ruvector**
  `npx ruvector hooks pre-command "$TOOL_INPUT_command"`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PostToolUse[Edit|Write|MultiEdit] — **ruvector**
  `npx ruvector hooks post-edit "$TOOL_INPUT_file_path"`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PostToolUse[Bash] — **ruvector**
  `npx ruvector hooks post-command "$TOOL_INPUT_command"`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PreCompact[auto] — **ruvector**
  `npx ruvector hooks pre-compact --auto`
- `~/Code/Viral_Social/.claude/settings.json` — hook:PreCompact[manual] — **ruvector**
  `npx ruvector hooks pre-compact`
- `~/Code/Viral_Social/.claude/settings.json` — hook:Stop[*] — **ruvector**
  `npx ruvector hooks session-end`
- `~/Code/Viral_Social/.claude/settings.json` — hook:SessionStart[*] — **ruvector**
  `npx ruvector hooks session-start`
- `~/Code/Viral_Social/.claude/settings.json` — hook:UserPromptSubmit[*] — **ruvector**
  `npx ruvector hooks suggest-context`
- `~/Code/Viral_Social/.claude/settings.json` — hook:Notification[.*] — **ruvector**
  `npx ruvector hooks track-notification`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks pre-edit --file "$TOOL_INPUT_file_path" 2>/dev/null || true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks pre-command --command "$TOOL_INPUT_command" 2>/dev/null || true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PreToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_prompt" ] && npx @claude-flow/cli@latest hooks pre-task --task-id "task-$(date +%s)" --description "$TOOL_INPUT_prompt" 2>`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^(Write|Edit|MultiEdit)$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_file_path" ] && npx @claude-flow/cli@latest hooks post-edit --file "$TOOL_INPUT_file_path" --success "${TOOL_SUCCESS:-true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Bash$] — **@claude-flow/***
  `[ -n "$TOOL_INPUT_command" ] && npx @claude-flow/cli@latest hooks post-command --command "$TOOL_INPUT_command" --success "${TOOL_SUCCESS:-tr`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:PostToolUse[^Task$] — **@claude-flow/***
  `[ -n "$TOOL_RESULT_agent_id" ] && npx @claude-flow/cli@latest hooks post-task --task-id "$TOOL_RESULT_agent_id" --success "${TOOL_SUCCESS:-t`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:UserPromptSubmit[*] — **@claude-flow/***
  `[ -n "$PROMPT" ] && npx @claude-flow/cli@latest hooks route --task "$PROMPT" || true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `npx @claude-flow/cli@latest daemon start --quiet 2>/dev/null || true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:SessionStart[*] — **@claude-flow/***
  `[ -n "$SESSION_ID" ] && npx @claude-flow/cli@latest hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || true`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — hook:Notification[*] — **@claude-flow/***
  `[ -n "$NOTIFICATION_MESSAGE" ] && npx @claude-flow/cli@latest memory store --namespace notifications --key "notify-$(date +%s)" --value "$NO`
- `~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json` — statusLine — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks statusline 2>/dev/null || node .claude/helpers/statusline.cjs 2>/dev/null || echo "▊ Claude Flow V3"`

### C-mcp

- `~/Code/All In Expert/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/AMBUILANCE_INVENTORY/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/AMBUILANCE_INVENTORY/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/AppealArmor/.mcp.json` — agentic-payments — **other rUv**
  `npx agentic-payments@latest mcp`
- `~/Code/BrickSmith/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/BrickSmith/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/BWE Chat June 26/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/BWEconstruction/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/CDK/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/CDK/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/Chris_David_Salon/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/RuView/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/DrAgnes/DrAgnes/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/IsoVision-AI/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/IsoVision-AI/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/linkedin-analyzer-focusgts/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/linkedin-analyzer-focusgts/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/Mark T Seed/vendor/RuView/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/marketing/.claude-backup-20260714-150731/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/marketing/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a12f1e2488f8ef930/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a3db9ce544a194062/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a62976f0/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a62976f0/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-a9362d5bf102f4e13/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-ad55a6e1d066134ba/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/.mcp.json` — pi-brain — **ruvector**
  `npx ruvector mcp start`
- `~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-a3eda6229fb850924/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-ae6f2d09d4687c78a/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/PowerPlatePulse/upstream/RuView/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/Ruv Explainer/Ruv-Explainer/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/Ruv-Explainer/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/Ruv-Explainer/explainer-builds/agentbbs/repo/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/config/.mcp.json` — claude-flow — **claude-flow (old pkg)**
  `npx claude-flow@alpha mcp start`
- `~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/config/.mcp.json` — ruv-swarm — **other rUv**
  `npx ruv-swarm@latest mcp start`
- `~/Code/ruvnet-brain/clones/marketing/.mcp.json` — claude-flow — **@claude-flow/***
  `npx @claude-flow/cli@latest mcp start`
- `~/Code/ruvnet-brain/clones/ruflo/plugins/ruflo-core/.mcp.json` — ruflo — **@claude-flow/***
  `npx -y @claude-flow/cli@latest`
- `~/Code/ruvnet-brain/clones/ruv-FANN/.mcp.json` — claude-flow — **@claude-flow/***
  `npx @claude-flow/cli@latest mcp start`
- `~/Code/ruvnet-brain/clones/RuView/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/config/.mcp.json` — claude-flow — **claude-flow (old pkg)**
  `npx claude-flow@alpha mcp start`
- `~/Code/ruvnet-repos/agentic-flow/agentic-flow/config/.mcp.json` — ruv-swarm — **other rUv**
  `npx ruv-swarm@latest mcp start`
- `~/Code/Scaling-Up/.mcp.json` — scaling-up-flow — **@claude-flow/***
  `npx @claude-flow/cli@latest mcp --project-root /Users/stuartkerr/Code/Scaling-Up --memory-namespace scaling-up --swarm-config .claude-flow/s`
- `~/Code/SkillNet-GE/SkillNet-GE/.mcp.json` — ruv-swarm — **other rUv**
  `npx ruv-swarm@latest mcp start`
- `~/Code/SkillNet-GE/SkillNet-GE/.mcp.json` — flow-nexus — **other rUv**
  `npx flow-nexus@latest mcp start`
- `~/Code/stratasocial/.mcp.json` — agentic-payments — **other rUv**
  `npx agentic-payments@latest mcp`
- `~/Code/travel-agent/backend/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/U-GO  Scholar/.mcp.json` — claude-flow — **@claude-flow/***
  `npx -y @claude-flow/cli@latest mcp start`
- `~/Code/Video watcher skill/learn-rs/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`
- `~/Code/XrAy-I/.mcp.json` — claude-flow — **ruflo**
  `npx -y ruflo@latest mcp start`

### G-helper

- `~/.claude/helpers/ruflo-hook.cjs` — line 55 — **ruflo**
  `invokeHook('npx', ['--prefer-offline', '--yes', 'ruflo@latest'], hookArgs, stdinData);`
- `~/.claude/helpers/statusline.cjs` — line 80 — **@claude-flow/***
  `'npx --yes @claude-flow/cli@latest hooks statusline --json 2>/dev/null',`

### G-hook-script

- `~/.claude/hooks/context-overload-check.sh` — line 75 — **ruflo**
  `emit "💾 CONTEXT ${KFMT} — high. Per rule 18 (flush-and-keep-going, NEVER halt): if new decisions/state/open-threads aren't already flushed `
- `~/.claude/hooks/context-overload-check.sh` — line 77 — **ruflo**
  `emit "💾 CONTEXT ${KFMT} — past ${FLUSH_PCT}%. Silently persist durable state to AgentDB (\`npx ruflo@latest memory store --namespace warrio`
- `~/.claude/hooks/mcp-self-heal.sh` — line 97 — **ruflo**
  `fallback_test=$(run_with_timeout 20 npx "ruflo@$known_good_ver" --version 2>&1)`
- `~/.claude/hooks/mcp-self-heal.sh` — line 131 — **ruflo**
  `try_result=$(run_with_timeout 15 npx "ruflo@$try_ver" --version 2>&1)`
- `~/.claude/hooks/mcp-self-heal.sh` — line 340 — **ruflo**
  `test=$(run_with_timeout 10 npx "ruflo@$cached_ver" --version 2>&1)`
- `~/.claude/hooks/mcp-self-heal.sh` — line 342 — **ruflo**
  `log "Cleaning broken npx cache for ruflo@$cached_ver in $dir"`
- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 32 — **ruflo**
  `npx ruflo@latest update check # see what changed`
- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 33 — **ruflo**
  `npx ruflo@latest init upgrade # adopt features, keep .swarm/memory.db`
- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 34 — **ruflo**
  `npx ruflo@latest migrate status # only if a major version jump`

### G-standalone-script

- `~/.claude/scripts/populate-kb.js` — line 128 — **@claude-flow/***
  ``npx @claude-flow/cli@latest embeddings generate -t "${text.replace(/"/g, '\\"').slice(0, 1000)}" -f json`,`
- `~/.claude/scripts/populate-kb.sh` — line 242 — **@claude-flow/***
  `echo " npx @claude-flow/cli@latest hooks pretrain"`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 95 — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 121 — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 144 — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`

### H-hook-invoked-script

- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 32 (invoked by settings.json) — **ruflo**
  `npx ruflo@latest update check # see what changed`
- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 33 (invoked by settings.json) — **ruflo**
  `npx ruflo@latest init upgrade # adopt features, keep .swarm/memory.db`
- `~/.claude/hooks/ruflo-upgrade-awareness.sh` — line 34 (invoked by settings.json) — **ruflo**
  `npx ruflo@latest migrate status # only if a major version jump`
- `~/.claude/plugins/cache/ruflo/ruflo-core/0.2.2/scripts/ruflo-hook.sh` — line 30 (invoked by hooks.json) — **ruflo**
  `run npx --prefer-offline --yes ruflo@alpha hooks "$@"`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 95 (invoked by io.ruv.auto-subscribe.plist.bak-20260712-233157) — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 121 (invoked by io.ruv.auto-subscribe.plist.bak-20260712-233157) — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`
- `~/.claude/scripts/ruvnet-auto-subscribe.sh` — line 144 (invoked by io.ruv.auto-subscribe.plist.bak-20260712-233157) — **@claude-flow/***
  `npx @claude-flow/cli@latest hooks notify \`
- `~/Code/Chris_David_Salon/.claude/helpers/auto-memory-hook.mjs` — line 41 (invoked by settings.json) — **@claude-flow/***
  `const line2 = ' Fix: npm i -D @claude-flow/memory (or re-run: npx ruflo@latest init, then npx ruflo@latest doctor --fix)';`
- `~/Code/Chris_David_Salon/.claude/helpers/auto-memory-hook.mjs` — line 382 (invoked by settings.json) — **claude-flow (old pkg)**
  `console.log(` Resolver: ${hasSidecar ? '✅ .claude-flow/memory-package.json' : '⏸ no sidecar (run: npx ruflo@latest doctor --fix)'}`);`

## Projects with rUv npx hooks (54)

- AI Retirement Analyzer
- All In Expert/ruvector/examples/vibecast-7sense
- AppealArmor
- AppealArmor/ruvector/examples/vibecast-7sense
- Ask-Ruvnet/Ask-Ruvnet
- Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense
- Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense
- BWEconstruction/ruvector/examples/vibecast-7sense
- CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense
- Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense
- DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense
- Mark T Seed/vendor/RuView/vendor/midstream
- Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense
- Mark T Seed/vendor/RuView/vendor/sublinear-time-solver
- PowerPlatePulse/upstream/RuView/vendor/midstream
- PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense
- PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver
- PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense
- PresenterMode
- PresenterMode/claude-presentation-master
- Site_Master
- SkillNet-GE/SkillNet-GE
- Viral_Social
- claude-internals-skill/ruvector/examples/vibecast-7sense
- configure ClawdBot/ruvector/examples/vibecast-7sense
- flighttest
- ruvnet-brain/clones/RuVector/examples/vibecast-7sense
- ruvnet-brain/clones/agentdb/ui
- ruvnet-brain/clones/agentic-flow/agentic-flow
- ruvnet-brain/clones/cognitum-platform-docs
- ruvnet-brain/clones/daa
- ruvnet-brain/clones/flow-nexus
- ruvnet-brain/clones/marketing
- ruvnet-brain/clones/midstream
- ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp
- ruvnet-brain/clones/ruv-FANN
- ruvnet-brain/clones/ruv-FANN/tests/init-test
- ruvnet-brain/clones/sublinear-time-solver
- ruvnet-packages/marketing
- ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test
- ruvnet-repos/agentic-flow/agentic-flow
- ruvnet-repos/daa
- ruvnet-repos/flow-nexus
- ruvnet-repos/marketing
- ruvnet-repos/midstream
- ruvnet-repos/ruflo/v2
- ruvnet-repos/ruflo/v3/@claude-flow/mcp
- ruvnet-repos/ruv-FANN
- ruvnet-repos/ruv-FANN/tests/init-test
- ruvnet-repos/sublinear-time-solver
- ruvvectortest
- u-go-far-linkedin-generator
- ugo-ai-register-now
- wifidp/RuVector/examples/vibecast-7sense

## Authorization surfaces (make npx SILENT, don't run it)

- ~/.claude/settings.json: `Bash(npx ruvector *)`
- ~/Code/AI Retirement Analyzer/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/AMBUILANCE_INVENTORY/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/AMBUILANCE_INVENTORY/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/All In Expert/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/All In Expert/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/All In Expert/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/All In Expert/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/All In Expert/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/AppealArmor/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/AppealArmor/.claude/settings.json: `Bash(npx ruflo:*)`
- ~/Code/AppealArmor/.claude/settings.json: `Bash(npx @ruflo/cli:*)`
- ~/Code/AppealArmor/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/AppealArmor/.claude/settings.local.json: `Bash(npx claude-flow@alpha --version)`
- ~/Code/AppealArmor/.claude/settings.local.json: `Bash(npx ruv-swarm@latest:*)`
- ~/Code/AppealArmor/.claude/settings.local.json: `Bash(npx flow-nexus@latest --version)`
- ~/Code/AppealArmor/.claude/settings.local.json: `Bash(npx agentic-payments@latest --version)`
- ~/Code/AppealArmor/agentic-qe/.claude/settings.json: `Bash(npx ruflo:*)`
- ~/Code/AppealArmor/agentic-qe/.claude/settings.json: `Bash(npx @ruflo/cli:*)`
- ~/Code/AppealArmor/agentic-qe/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/AppealArmor/agentic-qe/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/AppealArmor/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/AppealArmor/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/AppealArmor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json: `Bash(npx ruflo:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.json: `Bash(npx ruflo@latest:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.local.json: `Bash(npx ruv-swarm mcp list)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.local.json: `Bash(npx ruvector --help:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/.claude/settings.local.json: `Bash(npx ruvector:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Ask-Ruvnet/Ask-Ruvnet/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/BWE Chat June 26/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/BWE Chat June 26/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/BWEconstruction/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/BWEconstruction/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/BWEconstruction/.claude/settings.local.json: `Bash(npx ccstatusline@latest)`
- ~/Code/BWEconstruction/.claude/settings.local.json: `Bash(npx next:*)`
- ~/Code/BWEconstruction/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/BWEconstruction/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/BWEconstruction/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/BeeKeeper/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/BeeKeeper/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/BrickSmith/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/BrickSmith/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/CDK/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/CDK/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/CMO-Focus-GTS/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/CMO-Focus-GTS/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/CMO-Focus-GTS/lib/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/CMO-Focus-GTS/lib/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/CMO-Focus-GTS/lib/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/Chris_David_Salon/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Chris_David_Salon/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/RuView/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/RuView/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/RuView/harness/ruview/.claude/settings.json: `Bash(npx ruview*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Cognitum Sensor Primer/cognitum-one-sensor-primer/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/DrAgnes/DrAgnes/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/DrAgnes/DrAgnes/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/DrAgnes/DrAgnes/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/DrAgnes/DrAgnes/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/DrAgnes/DrAgnes/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/Helix - Personal Health Intelligence Platform/helix/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Helix - Personal Health Intelligence Platform/helix/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/IsoVision-AI/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/IsoVision-AI/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Mark T Seed/vendor/RuView/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Mark T Seed/vendor/RuView/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/midstream/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/Mark T Seed/vendor/RuView/vendor/sublinear-time-solver/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/PHS Website 2026/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PHS Website 2026/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a12f1e2488f8ef930/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a12f1e2488f8ef930/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a26ff35fe84d0f570/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a28b7b365a006841e/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a3db9ce544a194062/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a3db9ce544a194062/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a62976f0/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a62976f0/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a77c261f1b1033137/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a8bebe4319a59627e/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a9362d5bf102f4e13/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-a9362d5bf102f4e13/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ac053c4eac3147212/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad019dc6628d19237/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad55a6e1d066134ba/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-ad55a6e1d066134ba/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.claude/settings.json: `Bash(npx -y ruvector@* *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.claude/settings.json: `Bash(npx @claude-flow/cli@latest hooks *)`
- ~/Code/PowerPlatePulse/.claude/worktrees/agent-af8881d77cad1f90c/.claude/settings.json: `Bash(npx ruflo@latest *)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-a3eda6229fb850924/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-a3eda6229fb850924/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-ae6f2d09d4687c78a/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/.claude/worktrees/agent-ae6f2d09d4687c78a/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/harness/ruview/.claude/settings.json: `Bash(npx ruview*)`
- ~/Code/PowerPlatePulse/upstream/RuView/v2/crates/ruview-swarm/agent-harness/.claude/settings.json: `Bash(npx ruvdrone*)`
- ~/Code/PowerPlatePulse/upstream/RuView/v2/crates/worldgraph/.claude/settings.json: `Bash(npx worldgraph*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/midstream/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/ruvector/harnesses/timesfm-harness/.claude/settings.json: `Bash(npx timesfm-harness*)`
- ~/Code/PowerPlatePulse/upstream/RuView/vendor/sublinear-time-solver/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/PowerPlatePulse/upstream/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/PowerPlatePulse/upstream/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/PowerPlatePulse/upstream/ruvector/harnesses/timesfm-harness/.claude/settings.json: `Bash(npx timesfm-harness*)`
- ~/Code/PresenterMode/.claude/settings.json: `Bash(npx aqe:*)`
- ~/Code/PresenterMode/claude-presentation-master/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/PresenterMode/claude-presentation-master/.claude/settings.json: `Bash(npx @claude-flow/*)`
- ~/Code/Ruv Explainer/Ruv-Explainer/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Ruv Explainer/Ruv-Explainer/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Ruv Explainer/Ruv-Explainer/.claude/settings.local.json: `Bash(npx playwright *)`
- ~/Code/Ruv-Explainer/.claude/settings.local.json: `Bash(npx:*)`
- ~/Code/Ruv-Explainer/.targets/ruqu/cli/.claude/settings.json: `Bash(npx ruqu*)`
- ~/Code/Ruv-Explainer/.targets/ruvn/.claude/settings.json: `Bash(npx ruvn*)`
- ~/Code/Site_Master/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/Site_Master/.claude/settings.json: `Bash(npx @claude-flow/cli@latest *)`
- ~/Code/SkillNet-GE/SkillNet-GE/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/U-GO  Scholar/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/U-GO  Scholar/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Video watcher skill/cognitum-home-integration/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Video watcher skill/cognitum-home-integration/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Video watcher skill/learn-rs/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Video watcher skill/learn-rs/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/Viral_Social/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/Warrior Nation/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/Warrior Nation/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/XrAy-I/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/XrAy-I/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/claude-internals-skill/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/claude-internals-skill/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/claude-internals-skill/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/cognitum-learn/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/cognitum-learn/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/configure ClawdBot/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/configure ClawdBot/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/configure ClawdBot/ruvector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/configure ClawdBot/ruvector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/configure ClawdBot/ruvector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/flighttest/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest swarm init:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx tsc:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx ts-node:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest memory init:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest memory store:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest memory search:*)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest memory stats)`
- ~/Code/linkedin-analyzer-focusgts/.claude/settings.local.json: `Bash(npx @claude-flow/cli@latest memory list:*)`
- ~/Code/marketing/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/marketing/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/RuVector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-brain/clones/RuVector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/RuVector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/RuVector/harnesses/timesfm-harness/.claude/settings.json: `Bash(npx timesfm-harness*)`
- ~/Code/ruvnet-brain/clones/RuView/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-brain/clones/RuView/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/RuView/harness/ruview/.claude/settings.json: `Bash(npx ruview*)`
- ~/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/agentdb/ui/.claude/settings.json: `Bash(npx agentdb:*)`
- ~/Code/ruvnet-brain/clones/agentic-flow/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-brain/clones/agentic-flow/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/agentic-flow/agentic-flow/.claude/settings.json: `Bash(npx agentic-flow *)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx ruflo:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx @ruflo/cli:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/docs/metaharness/aqe-mcp-snapshot/.claude/settings.json: `Bash(npx ruflo:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/docs/metaharness/aqe-mcp-snapshot/.claude/settings.json: `Bash(npx @ruflo/cli:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/docs/metaharness/aqe-mcp-snapshot/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/agentic-qe/docs/metaharness/aqe-mcp-snapshot/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/cognitum-platform-docs/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/daa/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/flow-nexus/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/marketing/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/marketing/.claude/settings.json: `Bash(npx @claude-flow/*)`
- ~/Code/ruvnet-brain/clones/midstream/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/ruflo/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-brain/clones/ruflo/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-brain/clones/ruflo/.claude/settings.json: `Bash(npx:*)`
- ~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/mcp/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/ruv-swarm/npm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/tests/init-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/tests/integration-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/tests/test-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/ruv-FANN/tests/test-npm-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-brain/clones/sublinear-time-solver/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-brain/clones/symbolic-scribe/harness/.claude/settings.json: `Bash(npx symbolic-scribe-harness*)`
- ~/Code/ruvnet-packages/marketing/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-packages/marketing/.claude/settings.json: `Bash(npx @claude-flow/*)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/js/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/init-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/integration-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/test-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/tests/test-npm-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/agentic-flow/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-repos/agentic-flow/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-repos/agentic-flow/agentic-flow/.claude/settings.json: `Bash(npx agentic-flow *)`
- ~/Code/ruvnet-repos/daa/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-repos/flow-nexus/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvnet-repos/marketing/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-repos/marketing/.claude/settings.json: `Bash(npx @claude-flow/*)`
- ~/Code/ruvnet-repos/midstream/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-repos/ruflo/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/ruvnet-repos/ruflo/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/ruvnet-repos/ruflo/.claude/settings.json: `Bash(npx:*)`
- ~/Code/ruvnet-repos/ruflo/v2/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-repos/ruflo/v3/@claude-flow/mcp/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/ruvnet-repos/ruv-FANN/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`
- ~/Code/ruvnet-repos/ruv-FANN/ruv-swarm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/ruv-FANN/ruv-swarm/npm/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/ruv-FANN/tests/init-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/ruv-FANN/tests/integration-test/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/ruv-FANN/tests/test-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/ruv-FANN/tests/test-npm-install/.claude/settings.json: `Bash(npx ruv-swarm *)`
- ~/Code/ruvnet-repos/sublinear-time-solver/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/ruvvectortest/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/travel-agent/backend/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/travel-agent/backend/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/u-go-far-linkedin-generator/.claude/settings.json: `Bash(npx claude-flow *)`
- ~/Code/u-go-far-linkedin-generator/.claude/settings.json: `Bash(npx claude-flow@alpha *)`
- ~/Code/ugo-ai-register-now/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/wifidp/RuVector/.claude/settings.json: `Bash(npx @claude-flow*)`
- ~/Code/wifidp/RuVector/.claude/settings.json: `Bash(npx claude-flow*)`
- ~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx claude-flow:*)`
- ~/Code/wifidp/RuVector/examples/vibecast-7sense/.claude/settings.json: `Bash(npx @claude-flow/cli:*)`

## Advisory surfaces

- ~/.claude/hooks/archive — 8 ARCHIVED scripts contain live npx lines (inert unless re-wired)
- ~/.claude/skills/Stu-catruvector-catalog_old/SKILL.md — 1 npx mentions (advisory — instructs the model)
- ~/.claude/skills/presentation/SKILL.md — 1 npx mentions (advisory — instructs the model)
- ~/.claude/skills/ruvnet-stack/SKILL.md — 3 npx mentions (advisory — instructs the model)
- ~/.claude/skills/ruvnet-update/SKILL.md — 10 npx mentions (advisory — instructs the model)

## UNPARSEABLE — unknown, NOT clean

- /Users/stuartkerr/Code/Bricksmith-app/bricksmith-studio/.claude/settings.json
- /Users/stuartkerr/Code/Red Clover Inn/.claude/settings.json
- /Users/stuartkerr/Code/dotfiles-installer-1/.claude/settings.json
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-brain/clones/ruflo/v3/@claude-flow/cli/.claude/settings.json
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/js/claude-flow/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.preEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.postEditHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.preCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.postCommandHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/Synaptic-Mesh/src/rs/ruv-FANN/.claude/settings.json (hooks.sessionEndHook is object, not an array)
- /Users/stuartkerr/Code/ruvnet-repos/ruflo/v3/@claude-flow/cli/.claude/settings.json
- /Users/stuartkerr/Code/stratasocial/.claude/settings.json
