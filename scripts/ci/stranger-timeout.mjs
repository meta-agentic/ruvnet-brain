const DEFAULT_HOOK_TIMEOUT_SEC = 5;
const DEFAULT_REGIMES = 4;
const DEFAULT_GRACE_MS = 2_000;
const INSTALL_OVERHEAD_MS = 60_000;

/**
 * The installer runs every shipped registration through selfcheck's four stdin regimes. Its outer
 * watchdog must outlive those inner watchdogs; otherwise a slow but bounded Windows run is reported
 * as an installer hang before selfcheck can return its named contract verdict.
 */
export function selfCheckOuterTimeoutMs(
  hooksDoc,
  { regimes = DEFAULT_REGIMES, graceMs = DEFAULT_GRACE_MS, overheadMs = INSTALL_OVERHEAD_MS } = {},
) {
  let oneRegimeMs = 0;
  for (const groups of Object.values(hooksDoc?.hooks || {})) {
    for (const group of groups || []) {
      for (const hook of group?.hooks || []) {
        const timeoutSec = typeof hook?.timeout === 'number' ? hook.timeout : DEFAULT_HOOK_TIMEOUT_SEC;
        oneRegimeMs += Math.max(1, timeoutSec * 1_000) + graceMs;
      }
    }
  }
  return overheadMs + Math.max(1, regimes) * oneRegimeMs;
}
