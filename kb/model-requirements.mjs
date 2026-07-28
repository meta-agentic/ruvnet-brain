import fs from 'node:fs';
import path from 'node:path';

export const MINILM_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const BGE_MODEL = 'Xenova/bge-base-en-v1.5';

export function modelPath(modelCache, model) {
  return path.join(modelCache, ...model.split('/'));
}

// The RVF sidecar is the source of truth for the query embedder. Only sidecars with a matching
// installed RVF count; stale/orphan metadata must not make a healthy installation look cold.
export function requiredEmbedderModels(kbDir) {
  const models = new Set();
  try {
    for (const file of fs.readdirSync(kbDir)) {
      if (!file.endsWith('.rvf.embed.json')) continue;
      const rvf = file.slice(0, -'.embed.json'.length);
      if (!fs.existsSync(path.join(kbDir, rvf))) continue;
      if (!rvf.endsWith('.big.rvf')) {
        const name = rvf.slice(0, -'.rvf'.length);
        if (fs.existsSync(path.join(kbDir, `${name}.big.rvf`))) continue;
      }
      try {
        const model = JSON.parse(fs.readFileSync(path.join(kbDir, file), 'utf8'))?.model;
        if (typeof model === 'string' && model.includes('/')) models.add(model);
      } catch { /* unreadable metadata proves no requirement */ }
    }
  } catch { /* absent KB falls through to the legacy small-store default */ }
  return models.size ? [...models].sort() : [MINILM_MODEL];
}

export function missingEmbedderModels(modelCache, models) {
  return models.filter((model) => !fs.existsSync(modelPath(modelCache, model)));
}

export function configureTransformersModel(T, modelCache, model) {
  const local = fs.existsSync(modelPath(modelCache, model));
  T.env.localModelPath = modelCache;
  // Transformers.js otherwise downloads into its package-local `.cache`, while every doctor and
  // release detector inspects `modelCache`. A download invisible to the runtime's own detector
  // causes repeated cold starts and false release failures.
  T.env.cacheDir = modelCache;
  T.env.allowRemoteModels = !local;
  return { local };
}
