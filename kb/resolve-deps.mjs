// resolve-deps.mjs — portable resolver for the rvf-kb-forge KB scripts.
//
// Resolves the two runtime deps the KB needs in a machine-independent order:
//
//   @ruvector/rvf        -> RvfDatabase (the .rvf vector store)
//   @xenova/transformers -> the MiniLM embedder (Xenova/all-MiniLM-L6-v2, 384-dim)
//
// Resolution order (first hit wins) for EACH dep:
//   1. The KB output dir's own node_modules (so `cd <kb-dir> && npm i` just works).
//   2. node_modules walked up from this file.
//   3. An explicit env override   (RVF_MODULE_PATH / XENOVA_PATH).
//
// This file ships INSIDE the bundle, so it must not assume anything beyond Node 18+ and the
// two npm deps being installable via `npm i @ruvector/rvf @xenova/transformers`.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const KB_DIR = path.dirname(__filename);

// require() rooted at THIS file — node walks up node_modules from the KB dir to the project
// root, so it finds deps installed either in <kb-dir>/node_modules or a parent node_modules.
const localRequire = createRequire(__filename);

function existsModuleDir(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

/**
 * Resolve and return the @ruvector/rvf module ({ RvfDatabase, ... }).
 * Order: KB node_modules -> RVF_MODULE_PATH env -> Mac npm-global.
 */
export function loadRvf() {
  // 1. project / KB node_modules (walked up from this file)
  try {
    return { mod: localRequire('@ruvector/rvf'), via: 'project node_modules' };
  } catch { /* fall through */ }

  // 2. explicit env override
  const envPath = process.env.RVF_MODULE_PATH;
  if (envPath && existsModuleDir(envPath)) {
    const base = envPath.endsWith('@ruvector/rvf') || envPath.endsWith('@ruvector/rvf/')
      ? envPath
      : path.join(envPath, '@ruvector/rvf');
    try {
      const req = createRequire(path.join(envPath, 'noop.js'));
      return { mod: req('@ruvector/rvf'), via: `RVF_MODULE_PATH (${envPath})` };
    } catch {
      try { return { mod: localRequire(base), via: `RVF_MODULE_PATH dir (${base})` }; } catch { /* fall through */ }
    }
  }

  throw new Error(
    "Cannot resolve '@ruvector/rvf'. Run `cd <kb-dir> && npm i` (or `npm i @ruvector/rvf` at the "
    + 'project root), or set RVF_MODULE_PATH to a node_modules dir that contains it.'
  );
}

/**
 * Resolve and dynamically import @xenova/transformers.
 * Order: KB node_modules -> XENOVA_PATH env -> Mac build.
 * Returns { T, modelCache, via } where T is the imported module namespace.
 */
export async function loadTransformers() {
  // 1. node_modules — resolve the package entry, import via file:// URL.
  try {
    const resolved = localRequire.resolve('@xenova/transformers');
    const T = await import('file://' + resolved);
    return { T, modelCache: chooseModelCache(), via: 'project node_modules' };
  } catch { /* fall through */ }

  // 2. explicit env override — may be a transformers.js file path or a package dir.
  const envPath = process.env.XENOVA_PATH;
  if (envPath) {
    const url = envPath.startsWith('file://') ? envPath
      : envPath.endsWith('.js') ? 'file://' + path.resolve(envPath)
      : 'file://' + path.join(path.resolve(envPath), 'src/transformers.js');
    try {
      const T = await import(url);
      return { T, modelCache: chooseModelCache(), via: `XENOVA_PATH (${envPath})` };
    } catch { /* fall through */ }
  }

  throw new Error(
    "Cannot resolve '@xenova/transformers'. Run `cd <kb-dir> && npm i` (or `npm i @xenova/transformers` "
    + 'at the project root), or set XENOVA_PATH to the transformers package dir / src/transformers.js.'
  );
}

/**
 * Pick a model cache directory. KB_MODEL_CACHE wins; otherwise a kb-local `models-cache`
 * if it already has the model; otherwise the Mac cache if present; otherwise a kb-local
 * dir (created lazily) into which a remote download will be cached.
 */
export function chooseModelCache() {
  if (process.env.KB_MODEL_CACHE) return process.env.KB_MODEL_CACHE;
  const kbLocal = path.join(KB_DIR, 'models-cache');
  if (fs.existsSync(path.join(kbLocal, 'Xenova/all-MiniLM-L6-v2'))) return kbLocal;
  return kbLocal; // remote download lands here on first run
}

/**
 * Configure a transformers namespace `T` for MiniLM: point at the cache, and allow
 * remote download ONLY when the model isn't already cached (offline-first).
 * Returns { modelCache, haveLocalModel }.
 */
export function configureModel(T, modelCache) {
  const haveLocalModel = fs.existsSync(path.join(modelCache, 'Xenova/all-MiniLM-L6-v2'));
  T.env.localModelPath = modelCache;
  T.env.allowRemoteModels = !haveLocalModel; // fresh machine -> download from HuggingFace
  return { modelCache, haveLocalModel };
}
