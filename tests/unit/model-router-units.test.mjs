// tests/unit/model-router-units.test.mjs — in-process unit tests over the router's pure functions.
// The engine's CONTRACT is locked end-to-end (model-router-engine.test.mjs spawns the real CLI),
// but subprocess execution is invisible to V8 coverage — after the router landed, the shipped-code
// denominator grew and the 14% coverage ratchet tripped at 13.97% (2026-07-12) with every test
// green. These import the modules in-process, which both restores honest coverage accounting and
// pins the pure functions' behavior directly.
import { test, expect } from 'vitest';
import { extractFeatures, applyProfile } from '../../scripts/model-router-engine.mjs';
import { classifyPerRepo } from '../../kb/brain-alarm.mjs';
import { estTokens, estimateCosts, PRICING } from '../../scripts/route-cheap.mjs';

test('extractFeatures: code fences, file types, and question count are read from the prompt', () => {
  const f = extractFeatures('Fix app.ts and util.mjs?\n```js\nconst x = 1;\n```', 'claude-code');
  expect(f.codeFences).toBe(1);
  expect(f.hasCode).toBe(true);
  expect(f.fileTypes).toContain('.ts');
  expect(f.fileTypes).toContain('.mjs');
  expect(f.questionCount).toBe(1);
  expect(f.harness).toBe('claude-code');
  expect(f.estTokens).toBeGreaterThan(0);
});

test('extractFeatures: prose has no code signals', () => {
  const f = extractFeatures('Please summarize the meeting notes for me.', 'codex');
  expect(f.codeFences).toBe(0);
  expect(f.hasCode).toBe(false);
});

test('applyProfile: strips subscription claims the user profile does not back', () => {
  const candidates = [
    { id: 'a', harness: ['claude-code'], subscription: ['claude-code'] },
    { id: 'b', harness: ['codex'], subscription: ['codex'] },
  ];
  const profile = { harnesses: { 'claude-code': { available: true, subscription: true }, codex: { available: true, subscription: false } } };
  const out = applyProfile(candidates, profile);
  expect(out[0].subscription).toEqual(['claude-code']);
  expect(out[1].subscription).toEqual([]); // this user's codex is metered — no phantom $0
});

test('applyProfile: an unavailable harness is removed from the pool filter', () => {
  const out = applyProfile(
    [{ id: 'b', harness: ['codex'], subscription: ['codex'] }],
    { harnesses: { codex: { available: false, subscription: false } } },
  );
  expect(out[0].harness).toEqual([]);
});

test('applyProfile: no profile means the catalog passes through untouched', () => {
  const candidates = [{ id: 'a', harness: ['codex'], subscription: ['codex'] }];
  expect(applyProfile(candidates, null)).toEqual(candidates);
});

test('classifyPerRepo: all repos erroring is a total failure; a partial is not', () => {
  const total = classifyPerRepo({ a: 'ERR: dead', b: 'ERR: dead' }, ['a', 'b']);
  expect(total.allFailed).toBe(true);
  expect(total.errors.length).toBe(2);
  const partial = classifyPerRepo({ a: 8, b: 'ERR: dead' }, ['a', 'b']);
  expect(partial.allFailed).toBe(false);
  expect(partial.errors.length).toBe(1);
  // zero repos must never read as "all failed" — an empty KB is empty, not an outage
  expect(classifyPerRepo({}, []).allFailed).toBe(false);
});

test('route-cheap: estTokens is the documented chars/4 floor-1 estimator', () => {
  expect(estTokens('')).toBe(1);
  expect(estTokens('abcdefgh')).toBe(2);
});

test('route-cheap: estimateCosts prices against verified PRICING and reports frontier savings', () => {
  const model = Object.keys(PRICING)[0];
  const c = estimateCosts(model, 1000, 1000);
  expect(c.cost).toBeGreaterThan(0);
  expect(c.frontier).toBeGreaterThan(c.cost); // the whole point: cheaper than frontier
});
