#!/usr/bin/env node
/**
 * API SPEND WATCHDOG — the alarm that should have caught the 2026-07-09 incident.
 *
 * On 2026-07-09 an agentic-qe fleet spawned 374+ headless agents (one every
 * ~105s for 11h), each calling Sonnet on the Anthropic API, burning ~$1,600 —
 * silently, while a paid Max subscription sat unused. Nothing alerted. This is
 * the missing alarm.
 *
 * TWO independent detectors, so it works WITH or WITHOUT an admin key:
 *
 *   1. BURST DETECTOR (no key needed — would have caught the exact failure):
 *      scans every project's .claude-flow/logs/headless/ for agent logs created
 *      in the last window. A flood of automated agents is the signature of a
 *      runaway fleet billing the API. Alerts past a threshold.
 *
 *   2. ANTHROPIC ADMIN COST (definitive $, needs ANTHROPIC_ADMIN_KEY):
 *      pulls today's spend from the Admin Cost API. Alerts if it crosses the
 *      dollar threshold. This is the real-money source of truth.
 *
 * Alerts go to ntfy (phone) + macOS desktop, and are rate-limited so a genuine
 * runaway doesn't spam. Config via env:
 *   AIE_NTFY_TOPIC          ntfy topic (reuses the pipeline's)
 *   SPEND_ALERT_USD         daily $ threshold (default 50)
 *   SPEND_BURST_AGENTS      agents/hour that trips the burst alarm (default 20)
 *   ANTHROPIC_ADMIN_KEY     admin key for the $ detector (optional)
 *   SPEND_SCAN_ROOTS        colon-separated project roots to scan (default ~/Code)
 */
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execFileSync } from 'child_process';

const HOME = homedir();
const STATE_DIR = join(HOME, '.claude', 'logs');
const LAST_ALERT = join(STATE_DIR, 'api-spend-watchdog-last.ts');
const ALERTS_LOG = join(STATE_DIR, 'api-spend-ALERTS.log');
mkdirSync(STATE_DIR, { recursive: true });

const THRESHOLD_USD = Number(process.env.SPEND_ALERT_USD || 50);
const BURST_AGENTS = Number(process.env.SPEND_BURST_AGENTS || 20);
const COOLDOWN_MS = 60 * 60 * 1000; // one alert/hour max
const ROOTS = (process.env.SPEND_SCAN_ROOTS || join(HOME, 'Code')).split(':');

// Reuse the pipeline's ntfy topic if not overridden (parse, never source).
function ntfyTopic() {
  if (process.env.AIE_NTFY_TOPIC) return process.env.AIE_NTFY_TOPIC;
  for (const f of [join(HOME, 'Code', 'All In Expert', '.env')]) {
    try {
      const line = readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith('AIE_NTFY_TOPIC='));
      if (line) return line.slice('AIE_NTFY_TOPIC='.length).trim();
    } catch {}
  }
  return '';
}

function ts() {
  return new Date().toISOString();
}

async function alert(title, body) {
  // rate limit
  try {
    if (existsSync(LAST_ALERT)) {
      const last = Date.parse(readFileSync(LAST_ALERT, 'utf8').trim());
      if (Date.now() - last < COOLDOWN_MS) {
        console.log(`[watchdog] would alert but in cooldown: ${title}`);
        return;
      }
    }
  } catch {}
  writeFileSync(LAST_ALERT, ts());
  try {
    writeFileSync(ALERTS_LOG, `[${ts()}] ${title} — ${body}\n`, { flag: 'a' });
  } catch {}
  console.error(`[watchdog] ALERT: ${title} — ${body}`);
  const topic = ntfyTopic();
  if (topic) {
    try {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: { Title: title, Priority: 'urgent', Tags: 'rotating_light,money_with_wings' },
        body,
      });
    } catch {}
  }
  try {
    // execFile with an arg array — no shell, so title/body can't be interpreted.
    execFileSync('osascript', ['-e',
      `display notification ${JSON.stringify(body)} with title ${JSON.stringify('⚠️ ' + title)} sound name "Basso"`]);
  } catch {}
}

// ─── Detector 1: headless-agent burst (no key needed) ────────────────────────
function countRecentAgents(windowMs = 60 * 60 * 1000) {
  let count = 0;
  const cutoff = Date.now() - windowMs;
  const seen = [];
  for (const root of ROOTS) {
    let projects = [];
    try {
      projects = readdirSync(root).map((p) => join(root, p));
    } catch {
      continue;
    }
    for (const proj of projects) {
      // .claude-flow/logs/headless can be nested (web/src/... etc). Walk shallowly.
      for (const sub of ['.claude-flow/logs/headless', 'web/src/.claude-flow/logs/headless', 'web/src/app/.claude-flow/logs/headless']) {
        const dir = join(proj, sub);
        if (!existsSync(dir)) continue;
        try {
          for (const f of readdirSync(dir)) {
            if (!f.endsWith('.log')) continue;
            const m = statSync(join(dir, f)).mtimeMs;
            if (m >= cutoff) {
              count++;
              if (seen.length < 3) seen.push(proj.split('/').pop() + '/' + f);
            }
          }
        } catch {}
      }
    }
  }
  return { count, seen };
}

// ─── Detector 2: Anthropic Admin Cost (definitive $) ─────────────────────────
async function todaySpendUsd(adminKey) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const url = `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${start.toISOString()}`;
  try {
    const r = await fetch(url, { headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' } });
    if (!r.ok) return { ok: false, reason: `http_${r.status}` };
    const j = await r.json();
    // Sum amounts across the report (shape tolerant).
    let total = 0;
    const walk = (o) => {
      if (o == null) return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (/amount|cost|usd|total/i.test(k) && typeof v === 'number') total += v;
          else walk(v);
        }
      }
    };
    walk(j);
    return { ok: true, usd: total };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
const { count, seen } = countRecentAgents();
console.log(`[watchdog] headless agents in last hour: ${count} (threshold ${BURST_AGENTS})`);
if (count >= BURST_AGENTS) {
  await alert(
    'RUNAWAY AGENT FLEET — check your API bill',
    `${count} automated agents spawned in the last hour (e.g. ${seen.join(', ')}). This is the signature that burned ~$1,600 on 2026-07-09. Kill the fleet / check console spend.`
  );
}

const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
if (adminKey) {
  const s = await todaySpendUsd(adminKey);
  if (s.ok) {
    console.log(`[watchdog] Anthropic API spend today: $${s.usd.toFixed(2)} (threshold $${THRESHOLD_USD})`);
    if (s.usd >= THRESHOLD_USD) {
      await alert(
        `API spend today = $${s.usd.toFixed(2)}`,
        `Anthropic API spend crossed $${THRESHOLD_USD} today while you have a paid Max plan. Check console → Cost → group by API key.`
      );
    }
  } else {
    console.log(`[watchdog] admin cost check unavailable: ${s.reason}`);
  }
} else {
  console.log('[watchdog] ANTHROPIC_ADMIN_KEY not set — $ detector idle; burst detector still active.');
}
