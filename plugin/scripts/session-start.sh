#!/bin/sh
# RuvNet Brain — SessionStart hook. THE CONFIDENCE SIGNAL.
# The #1 UX failure of a background plugin is the user not knowing it's even on. This fires once when
# a Claude Code session starts (in ANY project / VS Code window) and instructs the model to surface a
# brief, friendly confirmation so the user KNOWS the brain is active and how to use it — answering the
# exact questions a newcomer has ("is it on? do I reinstall per project? how do I use it?").
# stdout is injected into the session context at startup; ALWAYS exit 0 so it can never block a session.
set +e
cat <<'EOF'
[RuvNet Brain — active this session]
The RuvNet Brain plugin is installed and ACTIVE for this session. It is USER-LEVEL: it works in every
project and every VS Code / Claude Code window on this machine — there is nothing to reinstall, nothing
to download again, and nothing to initialize per project. One brain (~/.cache/ruvnet-brain/kb), shared
everywhere. The `search_ruvnet` tool and the grounding hooks are live right now.

At the very START of your first response in this session, give the user ONE short, warm confirmation so
they have confidence it's on and know how to use it. Use roughly this (adapt naturally, keep it to 1–2 lines):

  "🧠 RuvNet Brain active — across all your projects. Ask me anything about rUv's stack (RuVector/RVF,
   Ruflo, AgentDB, SPARC, agentic-flow…) and I'll ground my answers in his real source instead of
   guessing. Not sure it's working? Run `npx github:stuinfla/ruvnet-brain --doctor` any time."

Then proceed with whatever they asked. Do NOT repeat this confirmation on later turns in the same session.
EOF
exit 0
