#!/usr/bin/env node
// Tests for the pure console engine. The point of these is the SAFETY invariants: a recommendation
// that could become an irreversible or unexplained machine change must be impossible to construct.
import assert from 'node:assert/strict';
import { makeRecommendation, buildStackRecommendations, buildWiringRecommendations, scoreMemoryHealth, summarizeWiring } from './console-engine.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };
const throws = (fn, re) => assert.throws(fn, re);

const valid = {
  id: 'x', title: 'T', severity: 'SUGGESTED',
  evidence: [{ observed: 'saw a thing' }], cost: { time: '1s' },
  change: { human: 'do it' }, undo: { human: 'undo it' },
};

t('makeRecommendation accepts a fully-specified rec', () => {
  const r = makeRecommendation(valid);
  assert.equal(r.id, 'x'); assert.equal(Object.isFrozen(r), true);
});
t('rejects empty evidence (may only suggest what we SAW)', () => throws(() => makeRecommendation({ ...valid, evidence: [] }), /evidence/));
t('rejects missing cost', () => throws(() => makeRecommendation({ ...valid, cost: undefined }), /cost/));
t('rejects missing undo (no change without a recorded inverse)', () => throws(() => makeRecommendation({ ...valid, undo: undefined }), /undo/));
t('rejects touchesMachine:true without a plain-English impact', () => throws(() => makeRecommendation({ ...valid, touchesMachine: true }), /plainImpact/));
t('accepts touchesMachine:true WITH a real plainImpact', () => {
  const r = makeRecommendation({ ...valid, touchesMachine: true, plainImpact: 'This updates a tool on your computer to the current version; your work is untouched and it is reversible.' });
  assert.equal(r.touchesMachine, true);
});

t('BEHIND package → one sync rec that touches the machine and explains itself', () => {
  const recs = buildStackRecommendations({ rows: [{ name: 'ruflo', installed: '3.29.0', target: '3.30.2', tag: 'alpha', state: 'BEHIND' }], stale: [] });
  assert.equal(recs.length, 1);
  assert.equal(recs[0].touchesMachine, true);
  assert.ok(recs[0].plainImpact.length > 40);
  assert.ok(recs[0].undo.human.includes('3.29.0'));            // inverse names the version we came from
});
t('AHEAD package → NO recommendation (AHEAD is a legal state, never "fix" it)', () => {
  const recs = buildStackRecommendations({ rows: [{ name: 'ruflo', installed: '3.31.0', target: '3.30.2', tag: 'alpha', state: 'AHEAD' }], stale: [] });
  assert.equal(recs.length, 0);
});
t('stale shadows → one purge rec with per-shadow evidence', () => {
  const recs = buildStackRecommendations({ rows: [], stale: [{ name: '@ruvector/rvf', version: '0.1.9', global: '0.2.3', dir: '/x' }] });
  assert.equal(recs.length, 1);
  assert.ok(recs[0].evidence.length >= 1);
});
t('npx wiring sites → a per-project de-npx rec; global-only projects → none', () => {
  const recs = buildWiringRecommendations({ sites: [
    { project: 'a', mechanism: 'NPX', file: '.mcp.json', event: 'MCP', spec: 'npx ruflo mcp start' },
    { project: 'b', mechanism: 'GLOBAL_BINARY', file: '.claude/settings.json', event: 'PreToolUse', spec: 'node handler' },
  ] });
  assert.equal(recs.length, 1);
  assert.equal(recs[0].id, 'reconcile:a');
});

t('memory score: all ok → 100', () => {
  const p = Object.fromEntries(['liveness', 'coverage', 'recallQuality', 'compactionSurvival', 'sessionSurfacing'].map((k) => [k, { status: 'ok' }]));
  assert.equal(scoreMemoryHealth({ probes: p }).score, 100);
});
t('memory score: notTested dims are excluded, not counted as pass OR fail', () => {
  const r = scoreMemoryHealth({ probes: { liveness: { status: 'ok' }, coverage: { status: 'ok' } } });
  assert.equal(r.score, 100);                                  // 2 tested, both ok
  assert.equal(r.notTested.length, 3);
});
t('memory score: a single FAIL caps the score below healthy (≤49)', () => {
  const p = { liveness: { status: 'fail' }, coverage: { status: 'ok' }, recallQuality: { status: 'ok' }, compactionSurvival: { status: 'ok' }, sessionSurfacing: { status: 'ok' } };
  assert.ok(scoreMemoryHealth({ probes: p }).score <= 49);
});
t('memory score: nothing probed → null (never a number we did not measure)', () => {
  assert.equal(scoreMemoryHealth({ probes: {} }).score, null);
});

t('summarizeWiring counts by mechanism and unique npx projects', () => {
  const s = summarizeWiring([
    { project: 'a', mechanism: 'NPX' }, { project: 'a', mechanism: 'NPX' }, { project: 'b', mechanism: 'GLOBAL_BINARY' }, { project: 'c', mechanism: 'MCP' },
  ]);
  assert.equal(s.npx, 2); assert.equal(s.projectsWithNpx, 1); assert.equal(s.global, 1); assert.equal(s.mcp, 1);
});

console.log(`\n  ${pass} passed\n`);
