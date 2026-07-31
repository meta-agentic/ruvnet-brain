// Deterministic answer-content requirements for every source question in the top-100 corpus.
// Clauses are ANDed; alternatives inside one `anyOf` are ORed. Product names alone never count.

const clause = (label, ...anyOf) => Object.freeze({ label, anyOf: Object.freeze(anyOf) });

export const TOP100_SEMANTIC_ASSERTIONS = Object.freeze({
  'n-01': [
    clause('index', 'hnsw', 'hierarchical navigable small world'),
    clause('single-file storage', 'single file', 'one file', '.rvf'),
  ],
  'n-02': [
    clause('explanation', 'feature attribution', 'causal chain', 'explainable recall'),
  ],
  'n-03': [
    clause('swarm topology', 'mesh', 'hierarchical', 'ring'),
  ],
  'n-04': [
    clause('automatic test generation', 'generate tests', 'test generation', 'automatically write tests'),
  ],
  'n-05': [
    clause('branching mechanism', 'copy-on-write', 'cow branch', 'fork a vector store'),
    clause('recovery', 'roll back', 'rollback', 'discard a branch'),
  ],
  'n-06': [
    clause('cache role', 'vector cache', 'read cache', 'cached vector'),
    clause('witness role', 'witness-anchored', 'witness chain', 'verifiable retrieval'),
  ],
  'n-07': [
    clause('feedback loop', 'self-aware feedback loop', 'meta-cognitive', 'self-monitoring'),
    clause('behavior change', 'self-modification', 'policy adaptation', 'strategy adaptation'),
  ],
  'n-08': [
    clause('post-quantum cryptography', 'ml-kem', 'ml-dsa', 'post-quantum cryptography', 'quantum-resistant'),
  ],
  'n-09': [
    clause('autonomy', 'autonomous agents', 'self-governing agents', 'autonomy loop'),
    clause('governance', 'rule-based governance', 'spending limits', 'risk thresholds'),
  ],
  'n-10': [
    clause('declarative programming', 'declarative framework', 'composable modules', 'llm signatures'),
    clause('typescript runtime', 'typescript', 'javascript implementation'),
  ],
  'n-11': [
    clause('low-latency tools', 'aggressive caching', 'cache-first pattern', 'cached access', 'low-latency ai tool', 'seconds to milliseconds'),
    clause('resilience', 'circuit-breaker', 'graceful degradation', 'dependable under failure'),
  ],
  'n-12': [
    clause('prompt compression', 'compress prompts', 'prompt compression', 'shrink prompts'),
    clause('token reduction', 'token reduction', 'reduce token usage', 'lower token costs'),
  ],
  'n-13': [
    clause('specification phase', 'specification'),
    clause('pseudocode phase', 'pseudocode'),
    clause('architecture phase', 'architecture'),
    clause('refinement phase', 'refinement'),
    clause('completion phase', 'completion'),
  ],
  'n-14': [
    clause('webassembly support', 'webassembly', 'wasm'),
  ],
  'n-15': [
    clause('hidden solution', 'conformance firewall', 'never sees the gold fix', 'without the gold fix'),
    clause('verification', 'security regression test', 'fail-to-pass', 'project-specific test'),
  ],
  'n-16': [
    clause('open implementation', 'open-source implementation', 'open source implementation'),
    clause('cli compatibility', 'claude-code-compatible cli', 'claude code cli'),
  ],
  'n-17': [
    clause('visual retrieval', 'visual retrieval', 'image semantic search', 'text-to-image search'),
    clause('local execution', 'on-device clip', 'client-side', 'no data upload'),
  ],
  'n-18': [
    clause('project scaffolding', 'create-sparc', 'project scaffolding'),
    clause('agent tooling', 'roo code', 'clinerules', 'mcp wizard'),
  ],
  'n-19': [
    clause('hypervisor isolation', 'microhypervisor', 'hardware-grade partition', 'secure hardware partition'),
    clause('tenant boundary', 'multi-tenant', 'isolated guest', 'untrusted agent workload'),
  ],
  'n-20': [
    clause('radio sensing', 'channel state information', 'wifi sensing', 'csi'),
    clause('camera-free detection', 'camera-free', 'without a camera', 'radio alone'),
  ],
  'n-21': [
    clause('mutation target', 'planner', 'retry policy', 'model routing', 'structured policies'),
    clause('fixed model', 'freeze the model', 'without swapping out the model', 'harness around it'),
  ],
  'n-22': [
    clause('harness evolution', 'evolve the harness', 'harness variants', 'darwin mode'),
    clause('model remains fixed', 'model remains fixed', 'freeze the model', 'does not retrain the model', 'without swapping out the model'),
  ],
  'n-23': [
    clause('cross-session persistence', 'across sessions', 'survives restarts', 'persistent memory'),
    clause('project memory store', '.swarm/memory.db', 'project memory', 'memory store'),
  ],
  'n-24': [
    clause('browser binding', 'wasm bindings', 'in-browser', 'webassembly'),
    clause('vector search', 'vector search', 'nearest-neighbor', 'similarity search'),
  ],
  'n-25': [
    clause('anthropic provider', 'anthropic'),
    clause('openrouter provider', 'openrouter'),
    clause('gemini provider', 'gemini'),
  ],
  'n-26': [
    clause('graph memory', 'graph queries', 'causal graph', 'n-ary hyperedge', 'relationship queries'),
  ],
  'n-27': [
    clause('cog architecture', 'cog-as-plugin', 'one crate per capability', 'self-contained apps'),
    clause('target runtime', 'rust cog', 'arm cross-compile', 'aarch64', 'armv7'),
  ],
  'n-28': [
    clause('public support scope', 'firmware downloads', 'installation', 'upgrade instructions', 'onboarding'),
    clause('issue path', 'issue tracker', 'report issues'),
  ],

  'agentdb-q1': [
    clause('durable agent memory', 'persistent memory', 'survives across sessions', 'long-term agent memory'),
    clause('query model', 'vector search', 'graph relationships', 'structured agent state'),
  ],
  'agentdb-q2': [
    clause('cognitive container', '.rvf cognitive container', 'single-file .rvf'),
    clause('episodic memory', 'reflexion', 'episodic memory'),
    clause('causal graph', 'causal graph', 'graph relationships'),
    clause('skill library', 'skill library'),
    clause('learning system', 'reasoningbank', 'self-learning bandit', 'thompson sampling'),
  ],
  'agentdb-q7': [
    clause('self-learning search', 'self-learning vector search', 'feedback learning', 'learning rate'),
    clause('working example', 'three lines', 'create database', 'vector search'),
  ],
  'ruflo-q1': [
    clause('orchestration purpose', 'agent orchestration', 'coordinate swarms', 'multi-agent coordination'),
    clause('developer audience', 'coding agents', 'software development', 'developers'),
  ],
  'ruflo-q2': [
    clause('swarm definition', 'agents working', 'coordinated agents', 'agent swarm'),
    clause('hierarchical topology', 'hierarchical'),
    clause('mesh topology', 'mesh'),
    clause('ring topology', 'ring'),
    clause('star topology', 'star'),
  ],
  'ruflo-q8': [
    clause('project store', '.swarm/memory.db', 'project memory'),
    clause('store operation', 'memory store', 'store memory'),
    clause('search operation', 'memory search', 'search memory'),
  ],
  'rulake-q1': [
    clause('cache layer', 'vector cache', 'working-memory layer', 'read cache'),
    clause('verifiable recall', 'witness-anchored', 'provenance-verifiable', 'deterministic recall'),
  ],
  'rulake-q2': [
    clause('witness bundle', 'witness-anchored bundle', 'witness anchored bundle'),
    clause('one-bit cache', 'rabitq', '1-bit cache', 'one-bit cache'),
    clause('backend federation', 'backendadapter', 'backend adapter', 'federation'),
    clause('freshness', 'freshness mode', 'fresh', 'eventual', 'frozen'),
  ],
  'ruvector-q1': [
    clause('vector database', 'vector database', 'similarity search', 'nearest-neighbor'),
    clause('local storage', '.rvf', 'on-disk store', 'zero-server'),
  ],
  'ruvector-q2': [
    clause('self-learning', 'sona', 'self-learning'),
    clause('binary format', 'rvf format', '.rvf'),
    clause('index', 'hnsw'),
    clause('quantization', 'quantization tier', 'int8', 'sq8'),
    clause('graph intelligence', 'graph intelligence', 'graph relationship'),
  ],
  'ruview-q1': [
    clause('wifi sensing', 'wifi sensing', 'channel state information', 'csi'),
    clause('human signal', 'human presence', 'pose', 'breathing', 'heart rate'),
  ],
  'ruview-q2': [
    clause('csi', 'channel state information', 'csi'),
    clause('sensor', 'esp32'),
    clause('pose estimation', 'wifi-densepose', 'pose estimation'),
    clause('container', 'rvf cognitive container', 'cognitive container'),
  ],

  'ho-01': [
    clause('on-disk approximate search', 'hnsw', 'approximate-nearest-neighbor', 'ann search'),
    clause('no database server', 'zero-server', 'no server', 'single file'),
  ],
  'ho-02': [
    clause('isolated experiment', 'copy-on-write', 'sandbox risky', 'branch memory'),
    clause('discard or recover', 'discard', 'roll back', 'rollback'),
  ],
  'ho-03': [
    clause('test generation', 'generate tests', 'test generation'),
    clause('coverage analysis', 'coverage gap', 'untested code'),
  ],
  'ho-04': [
    clause('cost-aware routing', 'cost routing', 'cheapest model', 'reduce model cost'),
    clause('quality protection', 'quality bar', 'without sacrificing quality', 'escalate'),
  ],
  'ho-05': [
    clause('spec-to-code phases', 'specification', 'pseudocode', 'architecture', 'refinement', 'completion'),
    clause('quality gates', 'quality gate', 'review gate'),
  ],
  'ho-06': [
    clause('structured state', 'structured agent state', 'persistent structured storage'),
    clause('relationships', 'graph relationships', 'causal graph', 'relationship queries'),
  ],
  'ho-07': [
    clause('read cache', 'vector cache', 'read cache', 'cached reads'),
    clause('repeated lookup speed', 'sub-millisecond', 'faster repeated', 'cache hit'),
  ],
  'ho-08': [
    clause('rust neural network', 'neural network library written in rust', 'in-rust ml', 'rust neural'),
    clause('no python', 'without shipping python', 'no python'),
  ],
  'ho-09': [
    clause('post-quantum security', 'post-quantum', 'quantum-resistant', 'ml-kem', 'ml-dsa'),
    clause('node communication', 'secure messaging', 'agent-to-agent messaging', 'peer-to-peer'),
  ],
  'ho-10': [
    clause('harness evolution', 'evolve the harness', 'harness variants', 'darwin mode'),
    clause('fixed model', 'model remains fixed', 'freeze the model', 'without swapping out the model'),
  ],
  'ho-11': [
    clause('multi-agent coordination', 'coordinate swarms', 'multi-agent coordination', 'agents working in parallel'),
    clause('shared work', 'share state', 'shared state', 'shared memory'),
  ],
  'ho-12': [
    clause('real vulnerability', 'real cve', 'real security vulnerabilities', 'publicly disclosed'),
    clause('proof of fix', 'security regression test', 'fail-to-pass', 'project-specific test'),
  ],

  'd-01': [
    clause('binary container', '.rvf', 'binary container'),
    clause('portable single file', 'single file', 'one binary file', 'copy around'),
  ],
  'd-02': [
    clause('causal explanation', 'causal chain', 'explainable recall', 'feature attribution'),
  ],
  'd-03': [
    clause('specialized fleet', 'specialized agents', 'agent roles', 'agent swarm'),
    clause('shared state', 'share state', 'shared state', 'persistent context'),
  ],
  'd-04': [
    clause('automatic unit tests', 'generate tests', 'unit test generation', 'automatically write tests'),
    clause('risk focus', 'risk-based', 'riskiest', 'risk-weighted'),
  ],
  'd-05': [
    clause('checkpoint', 'checkpoint', 'copy-on-write', 'cow branch'),
    clause('instant recovery', 'roll back instantly', 'instantly roll back', 'instant rollback', 'discard a branch'),
  ],
  'd-06': [
    clause('read-through vector cache', 'read-through cache', 'vector cache', 'read cache'),
    clause('latency', 'sub-millisecond', 'cached access'),
  ],
  'd-07': [
    clause('divergence detection', 'divergence detection', 'novelty detection'),
    clause('self-modification safety', 'self-modification', 'meta-cognitive', 'safeguard'),
  ],
  'd-08': [
    clause('post-quantum communication', 'post-quantum', 'quantum-resistant', 'ml-kem', 'ml-dsa'),
    clause('distributed routing', 'dag-based communication', 'anonymous routing', 'multi-hop routing'),
  ],
  'd-09': [
    clause('declarative llm programs', 'declarative framework', 'composable modules', 'llm signatures'),
    clause('typescript', 'typescript', 'javascript implementation'),
    clause('optimization', 'automatically optimized', 'optimizer', 'auto-tune prompts'),
  ],
  'd-10': [
    clause('instruction compression', 'compress system prompts', 'compress instructions', 'prompt compression'),
    clause('meaning preservation', 'preserving their meaning', 'without changing behavior', 'without losing'),
  ],
  'd-11': [
    clause('phased method', 'specification', 'pseudocode', 'architecture', 'refinement', 'completion'),
    clause('phase gates', 'quality gates', 'review gates'),
  ],
  'd-12': [
    clause('embedded classifier', 'small neural network', 'small trainable', 'embedded classifier'),
    clause('rust runtime', 'written in rust', 'in-rust ml'),
    clause('no python', 'without shipping python', 'no python'),
  ],
  'd-13': [
    clause('security benchmark', 'real cve', 'security vulnerabilities'),
    clause('passing criterion', 'security regression test', 'fail-to-pass', 'project-specific test'),
  ],
  'd-14': [
    clause('cheap-first routing', 'cheap model', 'cheapest model', 'cost-aware escalation'),
    clause('failure escalation', 'when the cheaper model gives up', 'demonstrable failure', 'escalate'),
  ],
  'd-15': [
    clause('risk ranking', 'rank untested code by risk', 'risk-based test prioritization', 'risk-weighted'),
    clause('coverage gap', 'coverage gap', 'untested code'),
  ],
  'd-16': [
    clause('hypervisor partition', 'microhypervisor', 'hardware-grade partition', 'secure hardware partition'),
    clause('tenant isolation', 'multi-tenant', 'isolated guest', 'strict isolation'),
  ],
  'd-17': [
    clause('prebuilt roles', 'ready-to-run specialized agents', 'coder', 'reviewer', 'architect'),
    clause('spawnable fleet', 'spawn agents', 'agent swarm', '54+'),
  ],
  'd-18': [
    clause('evidence-backed promotion', 'replayable receipt', 'receipt-backed', 'independently benchmarked'),
    clause('reversibility', 'roll back', 'rollback', 'reversible'),
  ],
  'd-19': [
    clause('cross-session state', 'across sessions', 'persistent memory', 'survives restarts'),
    clause('decisions retained', 'project memory', 'reasoning memory', 'carry decisions'),
  ],
  'd-20': [
    clause('ranking adaptation', 'tunes its own ranking', 'self-learning', 'ranking weights'),
    clause('proof gate', 'proven improvements', 'benchmark', 'quality gate'),
  ],

  's-01': [
    clause('local semantic index', 'on-device semantic search', 'local vector', 'hnsw'),
    clause('offline operation', 'zero-server', 'zero server round-trips', 'no server'),
  ],
  's-02': [
    clause('durability', 'survives restarts', 'persistent memory', 'across sessions'),
    clause('recall justification', 'explainable recall', 'feature attribution', 'causal chain'),
  ],
  's-03': [
    clause('generated tests', 'generate tests', 'test generation'),
    clause('changed-code risk', 'risk-based', 'riskiest changed code', 'risk-weighted'),
  ],
  's-04': [
    clause('coordinated agents', 'coordinate swarms', 'multi-agent coordination', 'coordinated roles'),
    clause('shared state', 'shared state', 'share state', 'persistent context'),
  ],
  's-05': [
    clause('isolated ingest', 'sandbox risky ingest', 'copy-on-write', 'branch memory'),
    clause('instant rollback', 'instant rollback', 'roll back', 'discard a branch'),
  ],
  's-06': [
    clause('cached vector reads', 'vector cache', 'read cache', 'cached reads'),
    clause('cryptographic verification', 'witness', 'provenance-verifiable', 'cryptographically verifiable'),
  ],
  's-07': [
    clause('quantum resistance', 'post-quantum', 'quantum-resistant', 'ml-kem', 'ml-dsa'),
    clause('mesh communications', 'secure mesh', 'secure messaging', 'agent-to-agent messaging'),
  ],
  's-08': [
    clause('instruction compression', 'compress instructions', 'compress system prompts', 'prompt compression'),
    clause('behavior preserved', 'without changing behavior', 'preserving their meaning', 'without losing'),
  ],
  's-09': [
    clause('requirements-to-completion', 'specification', 'requirements', 'completion'),
    clause('hard gates', 'quality gates', 'review gates'),
  ],
  's-10': [
    clause('real vulnerability patches', 'real cve', 'real security vulnerabilities', 'patching agent'),
    clause('objective closure', 'security regression test', 'resolve-per-dollar', 'fail-to-pass'),
  ],
  's-11': [
    clause('small classifier', 'small trainable classifier', 'small neural network', 'embedded classifier'),
    clause('low-memory rust', 'written in rust', 'low-memory embedded', 'in-rust ml'),
    clause('no python', 'without shipping python', 'no python'),
  ],
  's-12': [
    clause('policy evolution', 'planner', 'retry policies', 'model routing'),
    clause('replayable evidence', 'replayable receipts', 'receipt-backed', 'auditor could replay'),
  ],
  's-13': [
    clause('cheap first', 'cheap model', 'cheapest model', 'cost-aware escalation'),
    clause('measured escalation', 'demonstrable failure', 'demonstrably fails', 'quality bar'),
  ],
  's-14': [
    clause('composable programs', 'composable modules', 'declarative framework', 'llm signatures'),
    clause('optimizers', 'optimizer', 'automatically optimized', 'auto-tune prompts'),
    clause('typescript', 'typescript', 'javascript implementation'),
  ],
  's-15': [
    clause('ready roles', 'ready-to-run specialized agents', 'coder', 'reviewer', 'architect'),
    clause('mesh orchestration', 'mesh', 'agent swarm', 'swarm coordination'),
    clause('provider cost', 'multiple model providers', 'cost tracking', 'openrouter', 'gemini'),
  ],
  's-16': [
    clause('bare-metal isolation', 'microhypervisor', 'hardware-grade partition', 'secure hardware partition'),
    clause('tenant boundary', 'multi-tenant', 'strict isolation', 'untrusted workload'),
  ],
  's-17': [
    clause('living decisions', 'living plans', 'architecture decision record', 'adr tooling'),
    clause('implementation drift', 'implementation drifts', 'drift detection', 'match implementation', 'code does another', 'checked against reality'),
  ],
  's-18': [
    clause('copy-on-write tenants', 'copy-on-write', 'cow branch', 'fork a vector store'),
    clause('tiny branch cost', '162 bytes', 'constant time and size', 'tiny storage overhead'),
  ],
  's-19': [
    clause('independent benchmark', 'independently benchmarked', 'fixed benchmark', 'frozen benchmark', 'benchmark immutability', 'parent and child each scored', 'quality gate', 'benchmark the parent versus the child'),
    clause('signed evidence', 'signed', 'witness', 'receipt-backed'),
    clause('reversible change', 'reversible', 'roll back', 'rollback'),
  ],
  's-20': [
    clause('multiple providers', 'multiple model providers', 'anthropic', 'openrouter', 'gemini'),
    clause('per-task budget', 'max cost per task', 'per-task cost budget', 'cost ceiling'),
  ],

  'agentdb-q9': [
    clause('database class', 'rvf database'),
    clause('node backend', 'nodebackend', 'node backend', 'native (n-api)', 'native n-api'),
    clause('wasm backend', 'wasmbackend', 'wasm backend'),
    clause('runtime resolution', "resolvebackend('auto')", 'resolvebackend("auto")', 'backend resolved at runtime', 'auto-detects native or wasm'),
  ],
  'agentdb-q12': [
    clause('speed claim', '150x faster', '150× faster'),
    clause('quality claim', '36% search quality', '+36%', 'feedback learning'),
    clause('benchmark method', 'hnsw vs brute force', 'backend comparison', 'benchmark harness'),
  ],
  'ruflo-q10': [
    clause('mcp definition', 'mcp tool', 'tool definition', 'tools/list'),
    clause('registration code', 'register tool', 'registertool', 'tools/call', 'tool registry'),
  ],
  'ruflo-q12': [
    clause('package identity', '@claude-flow/neural'),
    clause('neural algorithms', 'actor-critic', 'a2c', 'decision transformer', 'q-learning', 'ppo'),
  ],
  'rulake-q9': [
    clause('substrate decision', 'rvdna v2', 'rvdna substrate', 'rvdna-backend'),
    clause('accepted status', 'status: accepted', 'accepted'),
    clause('implementation scope', 'scaffolded', 't0 hot-tier', 'hot-tier only', 'v0.0.1'),
  ],
  'ruvector-q10': [
    clause('canonical format', 'canonical binary format', 'rvf is canonical'),
    clause('first superseded decision', 'adr-001'),
    clause('second superseded decision', 'adr-018'),
  ],
  'ruvector-q12': [
    clause('npm package', 'npm ruvector', 'package ruvector', 'npm install ruvector', 'ruvector npm package'),
    clause('core crate', 'ruvector-core'),
    clause('workspace size', '100+ crates', 'more than 100 crates', 'over 100 crates', '~110 directories', 'about 110 directories'),
  ],
  'ruview-q9': [
    clause('proposal status', 'status: proposed', 'proposal stage', 'proposed'),
    clause('csi persistence', 'persist ephemeral csi', 'csi data', 'csi features'),
    clause('cognitive container', 'rvf cognitive container', 'cognitive containers'),
  ],
});

export function semanticAssertionsFor(sourceId) {
  return TOP100_SEMANTIC_ASSERTIONS[sourceId] ?? null;
}

export function semanticAssertionCompleteness(sourceIds) {
  const expected = [...new Set(sourceIds)];
  const expectedSet = new Set(expected);
  const actual = Object.keys(TOP100_SEMANTIC_ASSERTIONS);
  const missing = expected.filter((sourceId) => !TOP100_SEMANTIC_ASSERTIONS[sourceId]);
  const unexpected = actual.filter((sourceId) => !expectedSet.has(sourceId));
  return { complete: missing.length === 0 && unexpected.length === 0, missing, unexpected };
}
