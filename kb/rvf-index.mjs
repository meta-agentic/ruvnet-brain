/**
 * Force @ruvector/rvf to materialize and persist its lazy HNSW index.
 *
 * rvf-runtime builds INDEX_SEG on the first query after a writable reopen and
 * writes it when that handle closes. Querying the original create/ingest handle
 * is not sufficient. This helper makes that lifecycle explicit and fails closed
 * if a final readonly reopen cannot see the index segment.
 */
export async function persistAndVerifyRvfIndex({
  db,
  dimensions,
  rvfPath,
  RvfDatabase,
}) {
  if (!db) throw new TypeError('db is required');
  if (!RvfDatabase) throw new TypeError('RvfDatabase is required');
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new TypeError(`dimensions must be a positive integer, got ${dimensions}`);
  }

  const status = await db.status();
  await db.close();

  const indexer = await RvfDatabase.open(rvfPath);
  if (status.totalVectors > 0) {
    const probe = new Float32Array(dimensions);
    probe[0] = 1;
    await indexer.query(probe, 1);
  }
  await indexer.close();

  const verification = await RvfDatabase.openReadonly(rvfPath);
  try {
    const segments = await verification.segments();
    const hasIndex = segments.some(({ segType }) => segType === 'index');
    // rvf-runtime intentionally stays brute-force below 1,024 vectors.
    const indexRequired = status.totalVectors >= 1024;
    if (indexRequired && !hasIndex) {
      throw new Error(`RVF index persistence failed: ${rvfPath} has vectors but no index segment`);
    }
    return { status, hasIndex, indexRequired, segmentCount: segments.length };
  } finally {
    try {
      await verification.close();
    } catch (error) {
      if (!/\bFsyncFailed\b/.test(String(error?.message || error))) throw error;
    }
  }
}
