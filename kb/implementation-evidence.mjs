import path from 'node:path';

const IMPLEMENTATION_QUERY =
  /\b(?:build(?:s|ing)?|built|ship(?:s|ped|ping)?|implement(?:ed|ation|ing|s)?|released?|deployed?|working|exists?|available|can|does|has|supports?|provides?|includes?|exposes?)\b/i;

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.go', '.java', '.js', '.jsx', '.mjs', '.mts',
  '.py', '.rb', '.rs', '.sh', '.sol', '.swift', '.ts', '.tsx', '.wasm',
]);

export function requiresImplementationProof(query) {
  const text = String(query || '');
  return IMPLEMENTATION_QUERY.test(text) || /^\s*(?:what\s+is|is\s+)/i.test(text);
}

function lifecycleStatus(text) {
  const head = String(text || '').slice(0, 2400);
  const match = head.match(/(?:^|\n)\s*(?:\*\*)?status(?:\*\*)?\s*:\s*(?:\*\*)?([a-z][a-z -]{1,30})/i);
  if (!match) return null;
  return match[1].trim().toLowerCase().replace(/\s+/g, '-');
}

export function classifyResultEvidence(result) {
  const kind = String(result?.kind || '').toLowerCase();
  const file = String(result?.path || '');
  const ext = path.extname(file).toLowerCase();
  const text = result?.fullText || result?.text || '';
  const lifecycle = lifecycleStatus(text);

  if (kind === 'source' || kind === 'manifest' || SOURCE_EXTENSIONS.has(ext)) {
    return { evidenceClass: 'implementation', lifecycleStatus: lifecycle };
  }
  if (kind === 'adr' || /(?:^|\/)(?:adr[-_/]|\d{4}[-_])/i.test(file)) {
    return { evidenceClass: 'design-intent', lifecycleStatus: lifecycle };
  }
  return { evidenceClass: 'documentation', lifecycleStatus: lifecycle };
}

export function assessImplementation(query, results) {
  const required = requiresImplementationProof(query);
  const enriched = (results || []).map((result) => ({
    ...result,
    ...classifyResultEvidence(result),
  }));
  const implementationSources = enriched
    // A source file is not proof merely because it appeared somewhere in a noisy result set.
    // Require the same weakest-known-good relevance floor used by forge-ask-all's evidence grade.
    .filter((result) => result.evidenceClass === 'implementation' && Number(result.ceScore) >= 4)
    .map((result) => `${result.repo}/${result.path}`);

  return {
    results: enriched,
    implementation: {
      required,
      verdict: required ? (implementationSources.length ? 'proven' : 'unproven') : 'not-required',
      implementationSources,
    },
  };
}

export function implementationNotice(implementation) {
  if (!implementation?.required) return '';
  if (implementation.verdict === 'proven') {
    return `✅ IMPLEMENTATION EVIDENCE: PROVEN by ${implementation.implementationSources.join(', ')}.\n\n`;
  }
  return '⛔ BUILT/SHIPPED CLAIM: NOT PROVEN. The retrieved material contains no implementation-bearing '
    + 'source or manifest. ADRs and documentation below may describe design intent. Do not tell the '
    + 'user this capability was built, shipped, implemented, deployed, or is available.\n\n';
}
