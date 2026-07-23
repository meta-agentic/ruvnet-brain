# Duel record — ADR-043 (the continuation gate re-engages)

Date: 2026-07-23 · Governs: `docs/adr/0043-continuation-gate-must-force-not-whisper.md`

## Honesty note up front — this was not a true cross-model duel

The standing order is Fable 5 **and** GPT-5.6-Sol wrestling to convergence. GPT-5.6 (`codex`) was
degraded the entire session by a version-cache bug (`codex_models_manager … missing field
supports_reasoning_summaries`) and produced no usable review. So this pass was **Fable 5 + the author's
synthesis**, recorded as such rather than dressed up as a two-model convergence. A real GPT-5.6 pass is
owed when `codex` is healthy again.

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

## Deferred, named not dropped

- `projectKey()` keys by basename → same-named repos could share a ledger. Full-path hash is the fix;
  deferred because it orphans existing ledgers (needs a migration).
- Headless/CI/subagent runs could eat one forced turn if their ledger has fresh items. Bounded by the
  empty-by-default ledger + the TTL; an interactive-only gate is the real answer.
- Public opt-in switch: **not needed today** — nothing auto-populates the ledger (no `--commit-to` in
  `hooks.json`, verified), so a fresh install never forces. Becomes mandatory the moment any auto-populator
  is added.
