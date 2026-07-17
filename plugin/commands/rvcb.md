---
description: "RvCB — RuvNet Brain Console (alias of /rvbc; both spellings work). Opens the live console page: your whole RuvNet stack on one page — what's installed, what your AI learned, one-click reversible fixes. Read-only until you click."
---

Launch the **RuvNet Brain Console** for the user (this is the short alias for
`/ruvnet-brain:configure` — same console, fewer keystrokes).

Do this:

1. **Find the repo.** Prefer `~/Code/ruvnet-brain`. If `$CLAUDE_PLUGIN_ROOT` is set, the repo may be
   its parent directory. Use whichever path contains `scripts/onboarding-console.mjs`.

2. **Start the server in the BACKGROUND** (it is a long-running process) so this turn keeps going, and
   open the browser:

   ```
   node <repo>/scripts/onboarding-console.mjs --serve --open
   ```

   Run it with `run_in_background: true`. It binds `127.0.0.1` only and prints a line like
   `http://127.0.0.1:7411/`.

3. **Confirm it opened in their real browser** (on macOS the `--open` flag launches the default
   browser; if the user reports nothing appeared, run `open "http://127.0.0.1:<port>/"` yourself).
   One warm sentence: the page is **read-only until you click**, every machine change is **explained
   first and reversible**, and Settings save at the user level only.

4. If the server errors (e.g. `sqlite3` not found, or a bad node version), report it plainly and offer
   to fix it — don't leave them staring at a dead tab.

Do **not** narrate the machine yourself — the page is the mirror. Your job is just to get it open.
