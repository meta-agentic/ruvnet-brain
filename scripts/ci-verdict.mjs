// scripts/ci-verdict.mjs — the remote-CI ship gate's brain (ADR-053 §5), split out so the decision
// is a pure function a test can break. Between 2026-07-21 and 07-26 the `ci` workflow was red for
// ~70 consecutive runs and six releases shipped straight past it, because nothing on the ship path
// ever asked the remote verdict. Local gates prove one machine; only CI proves ubuntu and windows.

/** Latest COMPLETED ci run on origin/main → { verdict, sha } (verdict null = could not determine). */
export async function fetchLatestCiVerdict({ repo = 'stuinfla/ruvnet-brain', workflow = 'ci.yml' } = {}) {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?branch=main&status=completed&per_page=1`,
      { headers: { accept: 'application/vnd.github+json' } },
    );
    const run = (await r.json()).workflow_runs?.[0];
    return run ? { verdict: run.conclusion, sha: String(run.head_sha || '').slice(0, 7) } : { verdict: null, sha: '' };
  } catch {
    return { verdict: null, sha: '' }; // unknown — the gate treats this as red, never as green
  }
}

/**
 * The gate decision, pure: 'ship' | 'override' | 'refuse'.
 * Green ships. An explicit override reason ships loudly. EVERYTHING else — failure, cancelled,
 * no run found, API unreachable — refuses: an unknown main is a red main, never a green one.
 */
export function assessCiGate(verdict, overrideReason = null) {
  if (verdict === 'success') return 'ship';
  if (overrideReason) return 'override';
  return 'refuse';
}
