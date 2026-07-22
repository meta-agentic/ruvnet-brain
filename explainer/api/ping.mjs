// api/ping.js — anonymous, OPT-IN, count-only usage telemetry for RuvNet Brain.
//
// Contract (the whole privacy story lives in this file):
//   POST { event: "install" | "search" | "session", v: "<version>", n?: <count 1..10000> }
//   • COUNTS ONLY. No query text, no repo names, no paths, no IPs stored, no cookies, no UA
//     persistence — the handler never reads anything but event/v/n and never writes anything else.
//   • Clients only send this when the user said yes at install time (consent file on their disk);
//     the server can't tell who sent a ping and doesn't try.
//   • Storage: Vercel-linked Upstash Redis via REST (KV_REST_API_URL/KV_REST_API_TOKEN, or the
//     UPSTASH_REDIS_REST_* names the marketplace integration injects). If no store is linked yet,
//     this degrades gracefully: it accepts the ping and answers { stored: false } — never an error
//     back to a user's machine, never a retry loop.
//
// Keys written (read back by api/admin-stats.js):
//   rb:totals            hash { install, search, session } — lifetime counters
//   rb:day:<YYYY-MM-DD>  hash { install, search, session } — per-day, expires after ~45 days
//   rb:versions          hash { <version>: installs }      — which versions people install

const EVENTS = new Set(['install', 'search', 'session']);
const MAX_N = 10000;
const DAY_TTL_SECONDS = 45 * 24 * 60 * 60;

function kvEnv(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Exported for unit tests: returns { event, v, n } or null. Strict on purpose — anything that
// isn't a known event name with a plausible version string is dropped, so the counter store can
// never be used to smuggle arbitrary payloads.
function validatePing(body) {
  let b = body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { return null; }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const event = typeof b.event === 'string' ? b.event : '';
  if (!EVENTS.has(event)) return null;
  const rawV = typeof b.v === 'string' ? b.v.trim() : '';
  const v = /^[A-Za-z0-9._-]{1,32}$/.test(rawV) ? rawV : 'unknown';
  let n = b.n === undefined ? 1 : Number(b.n);
  if (!Number.isInteger(n) || n < 1) return null;
  if (n > MAX_N) n = MAX_N;
  return { event, v, n };
}

// Exported for unit tests: the exact command list a validated ping produces. Extracted from the
// handler because the bug below was invisible while it lived inline — nothing could assert it.
//
// THE BUG (found 2026-07-22 by adversarial review of ADR-036): only `install` recorded a version.
// `kb/telemetry-ping.mjs` has been sending a version on every daily `session` ping since 2026-07-10,
// and this handler threw it away while answering `{ stored: true }`. The consequence is the exact
// question the owner could not answer: `rb:versions` records the version each machine installed AT,
// which after any nightly refresh is not the version it is RUNNING. Version data was wrong, and the
// success response said otherwise.
//
// `rb:versions`   stays install-only — it is a lifetime "what did people arrive on" record.
// `rb:activever:` is the new per-day "what are people RUNNING" hash, and because telemetry-ping
//                 batches to at most one session ping per machine per day, its counts read as
//                 machines-on-that-version-that-day. Same 45-day TTL as rb:day, same shape, no new
//                 KIND of data: `v` is already collected and already named in the file header's
//                 contract, so this records what consent was already given for and stores nothing
//                 per-machine. Widening the payload (wrapper+brain) is NOT done here — that needs
//                 the consent work in ADR-036 §7 and would be silently dropped by validatePing today.
function buildCommands(p, day) {
  const cmds = [
    ['HINCRBY', 'rb:totals', p.event, String(p.n)],
    ['HINCRBY', `rb:day:${day}`, p.event, String(p.n)],
    ['EXPIRE', `rb:day:${day}`, String(DAY_TTL_SECONDS), 'NX'],
  ];
  if (p.event === 'install') cmds.push(['HINCRBY', 'rb:versions', p.v, '1']);
  if (p.event === 'session') {
    cmds.push(['HINCRBY', `rb:activever:${day}`, p.v, '1']);
    cmds.push(['EXPIRE', `rb:activever:${day}`, String(DAY_TTL_SECONDS), 'NX']);
  }
  return cmds;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const p = validatePing(req.body);
  if (!p) return res.status(400).json({ ok: false, error: 'expected { event: install|search|session, v, n? }' });

  const kv = kvEnv();
  if (!kv) {
    // No counter store linked on this Vercel project yet — accept and drop. 200, not 5xx:
    // a user's machine should never see an error (or retry) because of OUR dashboard config.
    return res.status(200).json({ ok: true, stored: false });
  }

  const cmds = buildCommands(p, new Date().toISOString().slice(0, 10));

  try {
    const r = await fetch(`${kv.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    return res.status(200).json({ ok: true, stored: r.ok });
  } catch {
    return res.status(200).json({ ok: true, stored: false });
  }
}

export { validatePing, kvEnv, buildCommands };
