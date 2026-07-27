# rUv's operating doctrine — distilled from the 2026-07-16 hackerspace call + the meta-wrapper gist

Updated: 2026-07-17

**Status:** distillation of rUv's own spoken practice (Read.ai transcript, local-only) and his
public gist (`docs/research/metaharness/ruv-gist-meta-wrapper.md`). Spoken doctrine = intent;
verify shipped behavior against repo source before asserting a capability. The verbatim transcript
lives in the private `ruv-meetings` brain store (fenced from every public bundle).

## The core thesis, in his words

> "You can basically make any crappy model, generally speaking, work as good as the frontier
> models... step away from the perception that the latest, greatest has to be the best."

Benchmarks measure the LLM's **internal cap** — frontier always wins there, by a few points.
Real work is won by the **harness**: trial-and-error churn plus a causal memory ("what worked,
what failed → update the memory") closes the gap at a fraction of the cost. His number: GLM 5.2 at
**~56–57× cheaper** than Fable delivers ~85–90% of frontier capability *inside the right harness*.
The competitive moat isn't model access — it's **operating these systems more economically than
anyone else**: "we can compete based on intelligence... and have a margin to make money."

## The maturity ladder he actually climbs (each stage feeds the next)

1. **Benchmark harness** — apples-to-apples per-model baselines; see *which instances fail and why*.
2. **Oracle memory** — store how each failure was solved; share solutions across models. ("Cheating
   in a benchmark; in the real world it's asking a smart coworker who's seen the problem before.")
3. **Darwin mode** — evolutionary improvement with an LLM judge deciding what worked.
4. **Flywheel** — always-running self-improvement probing "can I make this cheaper / better?"
   ⚠️ His own warning, from experience: a misconfigured flywheel is a **self-DDoS** — it burned his
   credits for days discovering dead ends. Bound it with cheap models and hard limits.
5. **Dream cycles** — the flywheel's nightly output posted as GitHub issues: security-gap scans
   against fresh research, competitor deltas, hardest-benchmark probes (HLE), red/blue self-attacks
   (red team → judge → blue team → retest).

## Routing & capacity doctrine (what our router work should converge toward)

- **Meta-proxy load balancing**: all traffic through a local proxy that watches per-provider usage
  and redirects seamlessly among his six premium accounts (2× Anthropic, 2× OpenAI, 2× Gemini);
  overflow falls back to OpenRouter. The proxy *mimics* the Anthropic/OpenAI APIs so tools don't
  know the difference.
- **Complexity-learned routing**: the flywheel learns which model tier fits which problem
  complexity — "if it's a simple edit I don't need Opus, I don't need Fable... it figures out when
  to use the cheaper model."
- **Skill economics**: don't load 350 skills — learn causally *which skill this task needs* and
  load only that. (Directly applicable to this plugin's hook budget.)
- **Claude Code `-p` critique**: "works amazingly well but burns a ton of usage — a huge context
  window loaded with guidance." The harness goal: *minimum usage for the same result*.
- **Finding vs. fixing asymmetry**: cheap models FIND (bugs, vulns) nearly as well as frontier
  inside a good harness; they struggle to FIX. Route discovery cheap, escalate repair.
  (Corroborated live by Robert E. Lee: local Qwen/Gemma find the same vulnerability classes —
  but "you need an answer key / golden test to validate.")

## Deployment doctrine (updates our GCP service research)

- **Local → cloud rhythm**: "get the general vibe working locally... then deploy the harness to
  GCP and let it do its thing for however long — for some applications, several days." (His Wi-Fi
  router build had been running 17 hours at call time.)
- Docker containers wrapping the CLIs (`claude -p`, `codex`, `gemini`) behind the metaharness.
- **CloudRun**: prefers a SIMD-capable higher-end CPU over an expensive GPU — "the cheapest path of
  least resistance." **Cloud Functions** for API endpoints (never client-side intelligence — it
  doesn't scale). **Firestore first, Postgres LAST** ("Postgres is great until it isn't").
- No Vercel/Fly for backends: "an abstraction of someone else's cloud... I don't need to pay a
  10–15% premium." Tailscale unifies everything local + cloud.
- **Monitoring tiers**: always-running agents (red/blue) → GitHub issues for findings → email for
  bad → **SMS = "you've shit the bed."** Escalation carries meaning.

## The business play (context for our momentum/positioning work)

- **Meta LLM service**: a proxy that sponsors your downtime — "your capacity for the next 3 hours
  has been sponsored by X" — GLM 5.2 + DeepSeek via OpenRouter/Requesty behind an Anthropic-shaped
  API. CAC math: acquiring a user costs $20–50; gifting $10 of cheap-model capacity is cheap
  acquisition. Free tier learns *patterns* (AST-level structure, not private data) to hyper-optimize.
- **MicroLoRA fine-tuning** for open weights: adapt a model to a harness's idiosyncrasies (Fable is
  trained *for* Claude Code; nothing is trained for Codex's quirks — a harness or a microLoRA
  bridges that).

## Directly relevant to RuvNet Brain

On the call, unprompted, rUv described the two front doors to his ecosystem:

> "You could just go to my repos and say, *What would rUv do? Use Stuart's rUv brain*, and it'll
> probably crank out something pretty cool. Or for the enterprises... they could just point it at
> my API."

The Brain is the named path for builders. Alignment work this implies: our router layer should
converge on his meta-proxy doctrine (usage-aware multi-provider balancing, complexity-learned
tiers, finding-cheap/fixing-frontier), our nightly jobs should grow toward dream-cycles (we
already have: gists refresh, model refresh, issue watch/fix — next: a bounded self-audit issue
poster), and the GCP service (his gist, our deltas) is the shared build target.

## The flywheel's real discipline (grounded in metaharness source, not the folk version)

From `metaharness/packages/darwin-mode/bench/swebench/flywheel-swebench-evaluator.mjs` and
`metaharness/docs/adrs/ADR-234` (Accepted):

- **The gate is FROZEN.** `meetsPromotionRule` never moves; the **anchor suite is never optimized
  against** — it is the "did it forget?" oracle. Every promotion is Ed25519-signed and replayable
  (`verifyReplayBundle`). "ruvllm proposes; the flywheel disposes."
- **Domain code lives in injected seams.** `Evaluator` (runSolver + gradePredictions) and `Proposer`
  are injected; the flywheel core never sees the domain — so the loop is testable at $0 with mocks
  before a single paid call (`dataSource: 'SYNTHETIC'` labeled honestly).
- **Score axes**: `primary` (wins), `noopRate` (gave-up fraction), `costPerWin` — with a 999
  sentinel when nothing wins, so a policy that resolves nothing can never look "cheap" — and
  `regressed` (reserved for a red/blue gate).
- **Structural levers are menu-bounded**: the proposer picks capability tokens from a fixed menu,
  filtered on return — a policy value "can NEVER carry anything else."
- **Two-layer learning (ADR-234)**: ruvllm micro-loop (per-request MicroLoRA/SONA + EWC++) under
  the flywheel macro-loop as programmatic fail-safe — no live adaptation ships until the frozen
  gate admits it.
- **The realistic ceiling — "error recovery, not intelligence creation"**: general reasoning +1–5pp;
  narrow enterprise domain +10–30pp; **agentic coding/ops +20–60pp when failures are harness-bound**
  (tool order, retry policy, context packing, acceptance checks, routing). Local small models:
  2–5× apparent usefulness — "the system stops wasting limited competence."
- **The warning label (ADR-226, his own measured failure)**: a strong read-only ADVISOR added
  **zero** marginal resolves at 5.4× cost. The winning lever is **evolving the executor policy and
  promoting only proven changes. Assume no improvement loop helps until the gate says it did.**
- **Acceptance discipline**: three arms (off / on / on+flywheel) on a frozen holdout; real only if
  ≥ one of +3pp accuracy, −25% cost-per-correct, −50% regression — with **no anchor degradation**.

### What "implement MetaHarness perfectly" therefore means for this machine
1. **Measure first** (free READ layer): `metaharness_score` + `oia_audit` baselines — no loop
   before a baseline exists.
2. **Pick ONE measured, harness-bound domain we own** — model routing is ideal: we already have
   labelled outcomes (`routing-outcomes.jsonl`), an executor policy, and a cost axis.
3. **Wire the flywheel with real seams**: our routing receipts as the Evaluator's ground truth, a
   frozen holdout split, cheap proposer model, hard budget caps (his self-DDoS warning), signed
   receipts surfaced in the console's Trust card.
4. **Never ship an advisor** — every evolved policy must clear the frozen gate on held-out data or
   it doesn't route a single real request.
