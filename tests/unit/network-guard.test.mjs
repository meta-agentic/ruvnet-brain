// network-guard.test.mjs — issue #27 (Jan Lafko): the reader path must FAIL LOUD in bounded time
// when the network is restricted, never hang forever. These tests exercise the REAL guardNetwork()
// wrapper from kb/resolve-deps.mjs against a REAL local server that accepts connections and never
// responds — the exact shape of Jan's 53-connections-to-a-dead-IP hang, minus the wait.
//
// The timeout is env-tunable (RUVNET_BRAIN_FETCH_TIMEOUT_MS); resolve-deps reads it at import time,
// so each test imports a FRESH copy of the module (query-string cache-bust) with the env set first.

import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RESOLVE_DEPS = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'kb', 'resolve-deps.mjs'),
).href;

// Import a fresh module instance with a given per-attempt timeout, apply the guard, and hand back
// the wrapped fetch plus a restore() that puts the original global fetch back.
async function guardedFetch(timeoutMs) {
  const origFetch = globalThis.fetch;
  process.env.RUVNET_BRAIN_FETCH_TIMEOUT_MS = String(timeoutMs);
  const mod = await import(`${RESOLVE_DEPS}?t=${Date.now()}-${Math.random()}`);
  mod.guardNetwork();
  const wrapped = globalThis.fetch;
  return { wrapped, restore: () => { globalThis.fetch = origFetch; delete process.env.RUVNET_BRAIN_FETCH_TIMEOUT_MS; } };
}

// A real TCP server that accepts connections and never sends a byte — the hang, reproduced.
function blackholeServer() {
  return new Promise((resolve) => {
    const sockets = new Set();
    const srv = net.createServer((socket) => { sockets.add(socket); /* never respond */ });
    srv.listen(0, '127.0.0.1', () => resolve({
      port: srv.address().port,
      close: () => { for (const s of sockets) s.destroy(); srv.close(); },
    }));
  });
}

describe('guardNetwork() — the reader path fails loud in bounded time (issue #27)', () => {
  let cleanup = [];
  afterEach(() => { for (const fn of cleanup) fn(); cleanup = []; });

  it('a server that never responds → bounded rejection naming the HOST and the offline fix, not a hang', async () => {
    const srv = await blackholeServer();
    const { wrapped, restore } = await guardedFetch(300); // 300ms per attempt × 2 attempts
    cleanup.push(restore, srv.close);

    const started = Date.now();
    await expect(wrapped(`http://127.0.0.1:${srv.port}/model.onnx`)).rejects.toThrow(
      new RegExp(`network unreachable: could not fetch from 127\\.0\\.0\\.1:${srv.port}`),
    );
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(5000); // bounded — the whole point; was: forever
  }, 10000);

  it('the honest error carries the escape hatch: KB_MODEL_CACHE + --doctor', async () => {
    const srv = await blackholeServer();
    const { wrapped, restore } = await guardedFetch(200);
    cleanup.push(restore, srv.close);

    const err = await wrapped(`http://127.0.0.1:${srv.port}/x`).catch((e) => e);
    expect(err.message).toMatch(/KB_MODEL_CACHE/);
    expect(err.message).toMatch(/--doctor/);
    expect(err.message).toMatch(/2 attempts/); // bounded retry is stated, not implied
  }, 10000);

  it('non-http(s) fetches pass through unguarded (data:, file: untouched)', async () => {
    const { wrapped, restore } = await guardedFetch(200);
    cleanup.push(restore);
    const res = await wrapped('data:text/plain,ok');
    expect(await res.text()).toBe('ok');
  });

  it('a caller-cancelled request is the CALLER\'s abort, never retried into our loud error', async () => {
    const srv = await blackholeServer();
    const { wrapped, restore } = await guardedFetch(5000); // ours is long; caller cancels first
    cleanup.push(restore, srv.close);

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    const err = await wrapped(`http://127.0.0.1:${srv.port}/x`, { signal: ac.signal }).catch((e) => e);
    expect(err.name).toBe('AbortError'); // the caller's abort surfaces as-is
    expect(String(err.message)).not.toMatch(/network unreachable/);
  }, 10000);

  it('a healthy request is untouched — guard adds no behavior on the happy path', async () => {
    const http = await import('node:http');
    const srv = http.createServer((req, res) => res.end('healthy'));
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const { wrapped, restore } = await guardedFetch(2000);
    cleanup.push(restore, () => srv.close());

    const res = await wrapped(`http://127.0.0.1:${srv.address().port}/`);
    expect(await res.text()).toBe('healthy');
  });
});
