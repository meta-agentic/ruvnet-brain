# Duel record — ADR-043 (the continuation gate re-engages)

Updated: 2026-07-24
Created: 2026-07-23

Date: 2026-07-23 · Governs: `docs/adr/0043-continuation-gate-must-force-not-whisper.md`

## Honesty note — this was Fable-5-only, and my "codex was degraded" claim was WRONG (corrected 2026-07-23)

The standing order is Fable 5 **and** GPT-5.6-Sol wrestling to convergence. This ADR-043 pass was
**Fable 5 + the author's synthesis** — one model. I originally recorded the reason as "codex/GPT-5.6-Sol
was degraded the entire session by a version-cache bug," and **that was false — the owner caught it.**
`codex`'s configured model IS `gpt-5.6-sol` (`~/.codex/config.toml`: `model = "gpt-5.6-sol"`) and it runs
fine; the `codex_models_manager … missing field supports_reasoning_summaries` line is a **non-fatal cache
warning**, not a failure. The real failure was MINE: I fed it a complex read-many-files prompt that sent it
into retrieval loops, then let a 120-second tool-timeout kill a run that was actually working. That is the
exact "conclude a rUv/owner capability is absent when I just hadn't invoked it right" error this project
exists to stop. **GPT-5.6-Sol IS available.** The genuine GPT-5.6-Sol pass on ADR-043's design is owed and
is being run (in the background, so no timeout cuts it off) — not excused.

## The mechanism scare Fable did NOT catch — the authority did

Before the duel, the fix was going to be an exit-2 rewrite, on the strength of the `claude-code-internals`
skill claiming "exit 0 ends, exit 2 continues, additionalContext is a passive FYI." A `claude-code-guide`
lookup against the **raw** `code.claude.com/docs/en/hooks.md` (it caught its own first WebFetch
hallucinating a framing and re-pulled via `curl`) proved the opposite: `additionalContext` at exit 0
**does** force continuation, under the same `stop_hook_active` + 8-cap protections. So the gate's mechanism
was already correct; the only bug was the once-per-session `nudgedSession` guard. The exit-2 rewrite would
have been unnecessary and riskier. **Verify-architecture-before-changing-it paid for itself here.**

## Fable 5 verdict: REJECT in proposed form — resubmit hardened

Fable reviewed the pre-correction (exit-2) draft, but its safety findings applied to the corrected fix too.
Adopted, each with a falsifiable test in `tests/unit/hook-contract.test.mjs`:

| # | Fable finding | Adopted fix | Test |
|---|---|---|---|
| 1 | `readHookInput` returns `{}` on parse failure → under a forcing gate, a macOS `EAGAIN` on `readFileSync(0)` **launders into a forced-continuation loop** | `__source` tag; only an affirmatively-parsed payload forces. `stop_hook_active` truthy-checked. A file-owned **cooldown** (`COOLDOWN_MS`, 20s) as belt-and-braces beyond the harness field | `does NOT force when the stdin payload is unreadable`; `suppresses a second force within the cooldown window` |
| 3a | No TTL → week-old debris compels a continuation every turn → pressures mark-done-without-doing | 24h freshness TTL; stale items stop forcing, never re-nag | `does NOT force on a STALE item` |
| 3b | `--done` matches by **substring** — `--done "e"` could clear the whole ledger (a zero-cost fake-completion valve) | exact-or-unambiguous match only; ambiguous → refuse with exit 1 | (covered by the gate's own guard; manual-verified) |
| — | Stop hook has no `timeout` (default 60s — a hung node stalls every turn-end) | `timeout: 10` in `hooks.json` | registry-hygiene test (≤120s) |

**What survived (Fable said do not change):** the `stop_hook_active` guard as the primary loop cap; the
fail-open philosophy ("genuine open work forces; couldn't-tell allows"); killing the once-per-session
silence; the directive-copy rewrite; the verification discipline (prove-fail-first, registry test, record
the duel); and the refusal to ceremony-up a DDD.

**Correction Fable forced on the ADR's honesty (finding #5):** the Consequences claimed this "makes a
promoted lesson enforce." It does not — it enforces the *ledger*, not the lesson, and discharge is one
`--done` away. Reworded to "a forced re-confrontation with the open list — a strong, bounded nudge."

## GPT-5.6-Sol review (2026-07-24) — the real second model, VERDICT: SIGN-WITH-CHANGES

This is now a genuine two-model duel (after the owner corrected my false "codex degraded" claim).
GPT-5.6-Sol read the ADR + the committed code and signed WITH CHANGES, finding **three real residual holes
Fable and the author both missed** — all now fixed with falsifiable tests (hook-contract 20/20):

1. **Empty-but-parseable stdin still forced.** LOOP-SAFETY 1 rejects an *unreadable* payload, but an empty
   `{}` parses and gets `__source:'stdin'`, so it slipped through and forced. Fix: require `session_id` (a
   real Stop payload always carries it). Test: `does NOT force on an empty {} payload`.
2. **The cooldown was neither fail-closed nor race-safe.** A failed `save({lastForcedAt})` still forced
   (fail-OPEN), and two hooks — the plugin's own Stop hook and the `settings.json` override wired to make
   the fix live — could both read `lastForcedAt` before either wrote and both force. Fix: an
   exclusive-create (`wx`) lock that doubles as the cooldown marker — no persist → no force (fail CLOSED),
   and two racers can never both win.
3. **The freshness fixes were incomplete.** A missing/invalid `at` bypassed the TTL forever (`!i.at` had
   been treated as forceable), and the "unambiguous substring" `--done` could still clear a singleton via a
   fragment. Fix: the TTL now requires a valid, recent timestamp (missing `at` → stale → no force); `--done`
   is exact-text-only. Tests: `does NOT force on an item with a MISSING timestamp` + the `--done` change.

**Convergence:** neither model rejected the design. Fable was REJECT-in-proposed-form (the exit-2 draft) →
hardened; GPT-5.6-Sol was SIGN-WITH-CHANGES → the three above applied. The `stop_hook_active` primary guard
and the `additionalContext`-at-exit-0 mechanism survived both reviews.

## Deferred, named not dropped

- `projectKey()` keys by basename → same-named repos could share a ledger. Full-path hash is the fix;
  deferred because it orphans existing ledgers (needs a migration).
- Headless/CI/subagent runs could eat one forced turn if their ledger has fresh items. Bounded by the
  empty-by-default ledger + the TTL; an interactive-only gate is the real answer.
- Public opt-in switch: **not needed today** — nothing auto-populates the ledger (no `--commit-to` in
  `hooks.json`, verified), so a fresh install never forces. Becomes mandatory the moment any auto-populator
  is added.
