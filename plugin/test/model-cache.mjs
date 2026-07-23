// model-cache.mjs — cold-vs-warm model-cache detection for the capability battery.
//
// THE BUG THIS EXISTS TO KILL (docs/4.0-READINESS.md §6 item 1, ADR-028's empty-first house rule):
// the battery embeds every "can RuvNet do X?" question with the local MiniLM embedder
// (Xenova/all-MiniLM-L6-v2, 384-dim). On a machine where that model has never been downloaded,
// EVERY query fails — and the old battery rendered each failure as the SAME "(no hit)" a real
// retrieval outage prints. A healthy brain on a fresh machine looked broken, which is the exact
// anti-honesty the project forbids.
//
// The distinction is made EVIDENCE-BASED here — the embedder model file either exists on disk or it
// does not (the same evidence kb/resolve-deps.mjs configureModel() and bin/install.mjs already use):
//
//   COLD  — the embedder model file is ABSENT. First-run download not done. Expected on a fresh
//           machine; a "run once to warm it / set KB_MODEL_CACHE" condition, NOT a product fault.
//   FAIL  — the embedder model IS present, yet retrieval returned no valid hit. That is a genuine
//           outage/failure and MUST stay red. A cold cache may never mask a real outage: `cold`
//           requires BOTH no-hit AND model-absent, so with the model present a no-hit is always FAIL.
//
// resolveModelCache() MIRRORS plugin/mcp/server.mjs exactly (KB_MODEL_CACHE, else <BRAIN_HOME>/models)
// so the battery inspects the SAME path the MCP child loads the model from — the evidence is about
// the real door, not an adjacent one.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// The embedder the query side needs. The reranker (Xenova/ms-marco-MiniLM-L-6-v2) is a DIFFERENT
// model and its presence does not warm the query path — only this leaf makes queries answerable.
export const EMBEDDER_REL = path.join('Xenova', 'all-MiniLM-L6-v2');

// Same resolution the MCP server applies to the brain child (server.mjs:37,99):
//   BRAIN_HOME = RUVNET_BRAIN_HOME || ~/.cache/ruvnet-brain
//   modelCache = KB_MODEL_CACHE || <BRAIN_HOME>/models
// Env is read at call time (not import time) so tests can vary it deterministically.
export function resolveModelCache(env = process.env) {
  if (env.KB_MODEL_CACHE) return env.KB_MODEL_CACHE;
  const brainHome = env.RUVNET_BRAIN_HOME || path.join(os.homedir(), '.cache', 'ruvnet-brain');
  return path.join(brainHome, 'models');
}

// The single piece of evidence: does the embedder model actually exist on disk?
export function modelPresent(modelCache = resolveModelCache()) {
  try { return fs.existsSync(path.join(modelCache, EMBEDDER_REL)); }
  catch { return false; }
}

// Classify one battery question's outcome. `haveModel` is the disk evidence above.
//   'pass' — a valid, in-threshold hit from the expected repo.
//   'cold' — NO parseable hit AND the embedder model is absent (cold cache — expected, not a fault).
//   'fail' — anything else while the model IS present: a genuine retrieval failure / outage.
// The asymmetry is deliberate and is what stops an outage masquerading as cold: if the model is
// present, a no-hit can NEVER be classified 'cold'.
export function classifyBattery({ repo, repoOk, relOk, haveModel }) {
  if (repo && repoOk && relOk) return 'pass';
  if (!repo && !haveModel) return 'cold';
  return 'fail';
}
