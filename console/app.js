/* ============================================================================
   RuvNet Brain — Onboarding Console (frontend)
   ----------------------------------------------------------------------------
   Vanilla ES module. No frameworks, no build step, no network beyond the
   local API. Renders real machine state per console/CONTRACT.md:

     Mirror → Explain → Recommend → (consent) Apply → Undo

   Data flow: GET /api/state (fast) renders sections 2–6 immediately;
   GET /api/stack (slow network audit) fills section 1 + late suggestions.
   POSTs (/api/apply, /api/save-config, /api/undo) echo the launch token.
   ============================================================================ */

'use strict';

/* ------------------------------------------------------------------ setup */

const TOKEN = (typeof window !== 'undefined' && typeof window.__CONSOLE_TOKEN__ === 'string')
  ? window.__CONSOLE_TOKEN__
  : null; // tolerated: static preview has no token; GETs still work read-only

const MOCK = new URLSearchParams(location.search).has('mock'); // dev only, never default

let preStateHash = null;          // echoed on /api/apply so the server can refuse a moved world
let lastMemory = null;            // last rendered memory card, so the late fleet scan can merge into it
const renderedRecIds = new Set();
let stateRecsSettled = false;
let stackRecsSettled = false;
const found = {};                 // pieces of the "we looked at your computer" ribbon

/* --------------------------------------------------------------- helpers */

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/* Parse a trusted (hand-authored, no interpolated data) SVG/HTML snippet. */
function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function chip(text, tone, title) {
  return el('span', { class: `chip tone-${tone || 'grey'}`, title: title || null }, text);
}

function setChips(id, chips) {
  const c = document.getElementById(id);
  if (c) c.replaceChildren(...chips);
}

function announce(msg) {
  const r = $('#live-region');
  if (r) { r.textContent = ''; r.textContent = msg; }
}

function illoBox(name) {
  const tpl = document.getElementById('illo-' + name);
  if (!tpl) return null;
  return el('div', { class: 'illo-box', 'aria-hidden': 'true' }, tpl.content.firstElementChild.cloneNode(true));
}

/* Wrap section content beside its spot illustration.
   The illo comes FIRST in DOM order so its mobile float lands beside the
   opening text; the desktop grid re-places it via `order`. */
function withIllo(name, ...content) {
  return el('div', { class: 'sect-body with-illo' },
    illoBox(name),
    el('div', { class: 'sect-main' }, ...content));
}

const fmtUsd = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v > 0 && v < 0.01) return '<$0.01';
  return '$' + v.toFixed(2);
};

const fmtMs = (ms) => {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const v = Number(ms);
  if (v < 1000) return `${Math.round(v)} ms`;
  const s = v / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} m ${Math.round(s % 60)} s`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined,
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return String(iso); }
};

const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString());

/* ----------------------------------------------------------------- fetch */

async function getJSON(url) {
  if (MOCK) return mockGet(url);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.json();
}

async function postJSON(url, body) {
  if (MOCK) return mockPost(url, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, ...body }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { status: res.status, ok: res.ok, data };
}

const TOKEN_MSG = 'The security token didn’t match — this page belongs to an older console launch. Restart the console and reload.';

/* ----------------------------------------------------------------- theme */

const THEME_KEY = 'rbc-theme';

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = $('#theme-toggle');
  if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function initTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    applyTheme(next);
  });
  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      let stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
      if (stored !== 'light' && stored !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
    });
  } catch { /* older engines */ }
}

/* ---------------------------------------------------------------- errors */

function inlineError(bodyId, msg, retry) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.replaceChildren(
    el('div', { class: 'inline-error', role: 'alert' },
      el('p', { class: 'ie-title' }, 'Couldn’t read this section.'),
      el('p', { class: 'ie-msg' }, msg),
      retry ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: retry }, 'Try again') : null,
    ),
  );
}

function showGlobalError(err) {
  const b = $('#global-error');
  if (!b) return;
  b.hidden = false;
  b.replaceChildren(
    el('p', {},
      'Couldn’t reach the console server (', el('code', {}, String(err.message || err)), '). ',
      'The page stays read-only either way — nothing was touched.'),
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { b.hidden = true; loadState(); } }, 'Try again'),
  );
}

/* ---------------------------------------------------- the "found" ribbon */

/* One-time count-up for the found-strip numbers: each figure rolls in the first time it
   appears, then stays static across the ribbon's later re-renders. Real values only — the
   animation is a reveal, never an estimate — and prefers-reduced-motion gets the final
   number immediately. */
const REDUCED_MOTION = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } })();
const countedKeys = new Set();
function countUpNum(key, value, render = fmtInt) {
  const target = Number(value);
  const b = el('b', {}, render(target));
  if (REDUCED_MOTION || countedKeys.has(key) || !Number.isFinite(target) || target <= 0) {
    countedKeys.add(key);
    return b;
  }
  countedKeys.add(key);
  const dur = 700;
  let t0 = null;
  const tick = (t) => {
    if (t0 == null) t0 = t;
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    b.textContent = render(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(tick);
    else b.textContent = render(target);
  };
  requestAnimationFrame(tick);
  return b;
}

function updateFoundStrip() {
  const strip = $('#found-strip');
  if (!strip || !found.host) return;
  const bits = [];
  if (found.pkgTotal != null) {
    bits.push(el('span', {}, countUpNum('pkgTotal', found.pkgTotal), ' packages on your global stack',
      found.pkgCurrent != null ? el('span', {}, ' (', countUpNum('pkgCurrent', found.pkgCurrent), ' current)') : ''));
  }
  if (found.npx != null) {
    bits.push(el('span', {}, countUpNum('npx', found.npx), ' npx call sites across ',
      countUpNum('projects', found.projects ?? 0), ' projects',
      found.projectNames?.length
        ? el('span', {}, ' — ', el('span', { class: 'fs-path' }, found.projectNames.slice(0, 2).join(', ')),
            found.projectNames.length > 2 ? ` +${found.projectNames.length - 2} more` : '')
        : ''));
  }
  if (found.memScore != null) {
    bits.push(el('span', {}, 'memory quality ', countUpNum('memScore', found.memScore, (v) => `${v}/100`)));
  }
  strip.replaceChildren(
    el('span', {}, 'We looked around ', el('b', {}, found.host), '’s machine: '),
    ...bits.flatMap((b, i) => (i ? [' · ', b] : [b])),
    el('span', {}, '. Every number below traces to something we actually observed.'),
  );
  strip.hidden = false;
}

/* ------------------------------------------------------------- section 0: host */

// Node reports the OS by its kernel codename — 'darwin' is the Unix core inside macOS. That is the
// machine's word for itself, not a person's, and this page is meant to read in plain English.
function osName(platform) {
  return { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[platform] || platform || '—';
}
function renderHost(host, generatedAt) {
  if (host && host.user) {
    found.host = `${host.user}@${osName(host.platform)}`;
    const hc = $('#host-chip');
    if (hc) { hc.textContent = found.host; hc.hidden = false; }
    const meta = $('#host-meta');
    if (meta) {
      meta.replaceChildren(
        el('span', {}, 'user ', el('b', {}, host.user)),
        el('span', {}, 'platform ', el('b', {}, osName(host.platform))),
        el('span', {}, 'node ', el('b', {}, host.node || '—')),
        el('span', {}, 'npm prefix ', el('b', {}, host.npmPrefix || '—')),
      );
      meta.hidden = false;
    }
  }
  const fg = $('#foot-generated');
  if (fg && generatedAt) fg.textContent = `machine state read ${fmtDate(generatedAt)}`;
  updateFoundStrip();
}

/* ------------------------------------------------------------ section 1: stack */

const STATE_ORDER = { BROKEN: 0, BEHIND: 1, UNRESOLVED: 2, AHEAD: 3, CURRENT: 4 };
const STATE_TONE = { CURRENT: 'green', BEHIND: 'warn', AHEAD: 'cyan', BROKEN: 'red', UNRESOLVED: 'grey' };
const STATE_TITLE = {
  AHEAD: 'Newer than the target — a legal state, not an error.',
  UNRESOLVED: 'We couldn’t check this one — reported honestly, not guessed.',
  BROKEN: 'Present on disk but no readable version.',
};

function stackSkeleton() {
  $('#body-stack').replaceChildren(
    frag(`<div class="skeleton" aria-hidden="true">
      <div class="sk-bar w35"></div><div class="sk-bar w90"></div>
      <div class="sk-bar w85"></div><div class="sk-bar w88"></div><div class="sk-bar w60"></div></div>`),
    el('p', { class: 'loading-note' },
      'Checking every global package against the npm registry, one by one — read-only, nothing changes. ',
      'Private by design: the registry only sees ordinary version lookups; nothing about you or your projects leaves this machine. ',
      'On a full stack the first look honestly takes 30–60 seconds; after that it’s instant from cache. ',
      el('span', { class: 'elapsed', id: 'stack-elapsed' }, '')),
  );
  setChips('chips-stack', [chip('checking registry…', 'wait')]);
  if (stackTicker) clearInterval(stackTicker);
  const t0 = Date.now();
  stackTicker = setInterval(() => {
    const target = document.getElementById('stack-elapsed');
    if (!target) { clearInterval(stackTicker); stackTicker = null; return; }
    const s = Math.round((Date.now() - t0) / 1000);
    target.textContent = `— ${s}s in, still working (the registry answers one package at a time)`;
  }, 1000);
}

function pkgRow(p) {
  const st = STATE_ORDER[p.state] != null ? p.state : 'UNRESOLVED';
  return el('tr', {},
    el('td', { class: 'cell-name' }, p.name || '—'),
    el('td', { class: 'cell-mono' },
      p.installed != null ? p.installed : el('span', { style: 'color:var(--red-text)' }, 'unreadable')),
    el('td', { class: 'cell-mono' }, p.target ?? '—'),
    el('td', { class: 'cell-mono cell-dim' }, p.tag ?? '—'),
    el('td', {}, chip(st, STATE_TONE[st], STATE_TITLE[st]),
      p.state === 'BEHIND' ? el('button', {
        class: 'btn-fix', type: 'button',
        title: `Update ${p.name} to ${p.target ?? 'latest'} — one click below, undo recorded first`,
        onclick: () => jumpToRec(`sync:${p.name}`),
      }, `update → ${p.target ?? 'latest'}`) : null,
      p.state === 'BROKEN' ? el('button', {
        class: 'btn-fix', type: 'button', title: `Repair ${p.name} — one click below`,
        onclick: () => jumpToRec(`repair:${p.name}`),
      }, 'repair') : null),
  );
}

/* ---- family grouping: roll sub-packages up under the tool people recognize ---- */
const STACK_FAMILIES = [
  { name: 'ruflo',            what: 'orchestration brain',           test: (n) => n === 'ruflo' || n === '@claude-flow/cli' },
  { name: 'AgentDB',          what: 'memory that learns',            test: (n) => n === '@claude-flow/memory' },
  { name: 'AI Defence',       what: 'prompt-injection / PII shield', test: (n) => n === '@claude-flow/aidefence' },
  { name: 'RuVector',         what: 'vector search + RVF storage',   test: (n) => n.startsWith('@ruvector/') || n === 'ruvector' || n === 'ruvector-extensions' || n === 'ruvbot' },
  { name: 'Agentic-Flow',     what: 'multi-model / cheap routing',   test: (n) => n === 'agentic-flow' },
  { name: 'Agentic-QE',       what: 'testing & quality fleet',       test: (n) => n === 'agentic-qe' },
  { name: 'MetaHarness',      what: 'harness scoring & routing',     test: (n) => n.startsWith('@metaharness/') },
  { name: 'Agent-Browser',    what: 'browser automation',            test: (n) => n.startsWith('agent-browser') },
  { name: 'Agentic Robotics', what: 'robot / agent control',         test: (n) => n.startsWith('@agentic-robotics/') || n === 'agentic-robotics' },
];
const STACK_MORE = { name: 'More RuvNet tools', what: 'flow-nexus, qudag, ruv-swarm, ruvi…' };

function familyOf(name) {
  const f = STACK_FAMILIES.find((fam) => { try { return fam.test(String(name)); } catch { return false; } });
  return f ? f.name : STACK_MORE.name;
}

function groupFamilies(pkgs) {
  const map = new Map();
  for (const p of pkgs) {
    const fam = familyOf(p.name || '');
    if (!map.has(fam)) map.set(fam, []);
    map.get(fam).push(p);
  }
  const order = [...STACK_FAMILIES.map((f) => f.name), STACK_MORE.name];
  return order.filter((n) => map.has(n)).map((n) => {
    const meta = STACK_FAMILIES.find((f) => f.name === n) || STACK_MORE;
    const items = map.get(n).slice().sort((a, b) =>
      (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || String(a.name).localeCompare(String(b.name)));
    const attention = items.filter((p) => ['BROKEN', 'BEHIND', 'UNRESOLVED'].includes(p.state)).length;
    return { name: n, what: meta.what, items, attention };
  });
}

/* No status without a remedy: every "behind/broken" indicator carries a jump to its
   one-click fix card (the consent-gated recommendation that already exists below). */
let stackTicker = null;
function jumpToRec(recId) {
  const card = document.getElementById('card-recs');
  if (card) card.open = true;
  const rec = document.getElementById(`rec-${recId}`);
  if (!rec) return;
  rec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  rec.classList.add('rec-flash');
  setTimeout(() => rec.classList.remove('rec-flash'), 2600);
  // Land ready to act: the Apply button gets focus so the fix is one keystroke away —
  // the jump must never feel like it WAS the fix.
  setTimeout(() => rec.querySelector('.btn-apply')?.focus(), 650);
}

/* Re-mirror the machine — used by the header ↻ button and auto-run after every apply/undo,
   so the page always shows the AFTER state instead of a stale before. */
async function recheckMachine() {
  setChips('chips-stack', [chip('re-checking your machine…', 'wait')]);
  announce('Re-checking your machine — every card will update to the current state.');
  await Promise.allSettled([loadStack({ skipCache: true }), loadState()]);
  announce('Re-check complete.');
}

/* Jump-and-flash for a Settings row (provider chips land here) — same pattern as jumpToRec. */
function jumpToSetting(key) {
  const card = document.getElementById('card-settings');
  if (card) card.open = true;
  const row = document.getElementById(`field-${key}`);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('rec-flash');
  setTimeout(() => row.classList.remove('rec-flash'), 2600);
}

/* WP5 — the page-level "stand by, this is private" line fades once the first card hydrates. */
function dismissStandby() {
  const n = document.getElementById('standby-note');
  if (!n || n.hidden) return;
  n.classList.add('gone');
  setTimeout(() => { n.hidden = true; }, 650);
}

/* ---------------------------------------- click-to-learn: ONE shared popover
   Used by the Dev/Prod headers (WP3), every Settings row (WP4), and the wiring
   lead (WP6). Anchored near its trigger, closes on Escape / click-outside /
   scroll, never shifts the layout (position: fixed). */

let infoPopEl = null;
let infoPopOwner = null;

function closeInfoPop() {
  if (!infoPopEl) return;
  const owner = infoPopOwner;
  infoPopEl.remove();
  infoPopEl = null;
  infoPopOwner = null;
  document.removeEventListener('pointerdown', onInfoDocDown, true);
  document.removeEventListener('keydown', onInfoKey, true);
  window.removeEventListener('scroll', closeInfoPop, true);
  window.removeEventListener('resize', closeInfoPop);
  if (owner && document.contains(owner)) owner.focus({ preventScroll: true });
}

function onInfoDocDown(e) {
  if (!infoPopEl) return;
  if (infoPopEl.contains(e.target)) return;
  if (infoPopOwner && (e.target === infoPopOwner || infoPopOwner.contains(e.target))) return;
  closeInfoPop();
}

function onInfoKey(e) { if (e.key === 'Escape') closeInfoPop(); }

function openInfoPop(trigger, title, beats) {
  if (infoPopEl && infoPopOwner === trigger) { closeInfoPop(); return; } // second click toggles off
  closeInfoPop();
  const pop = el('div', { class: 'info-pop', role: 'dialog', 'aria-label': title, tabindex: '-1' },
    el('button', { class: 'ip-close', type: 'button', 'aria-label': 'Close', onclick: closeInfoPop }, '×'),
    el('p', { class: 'ip-title' }, title),
    (Array.isArray(beats) ? beats : [beats]).map((b) => (typeof b === 'string'
      ? el('p', { class: 'ip-beat' }, b)
      : el('p', { class: 'ip-beat' }, el('span', { class: 'ip-k' }, b.k), b.t))));
  document.body.append(pop);
  const r = trigger.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const left = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - pw - 12));
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  infoPopEl = pop;
  infoPopOwner = trigger;
  document.addEventListener('pointerdown', onInfoDocDown, true);
  document.addEventListener('keydown', onInfoKey, true);
  window.addEventListener('scroll', closeInfoPop, true);
  window.addEventListener('resize', closeInfoPop);
  pop.focus({ preventScroll: true });
}

function infoBtn(title, beats) {
  return el('button', {
    class: 'info-btn', type: 'button',
    'aria-label': `About “${title}” — what it is and why it matters`,
    title: 'What is this — and why it matters',
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); openInfoPop(e.currentTarget, title, beats); },
  }, 'i');
}

/* What/Why/How copy — three beats, every Settings row (WP4). */
const SETTING_INFO = {
  qeFleet: [
    { k: 'What is this?', t: 'A squad of test agents that spins up only when you ask — it can write tests for your code, measure what your tests miss, scan for security holes, and check accessibility.' },
    { k: 'Why does it matter?', t: 'Untested code breaks in front of users.' },
    { k: 'How does it help me?', t: 'Say “QE this” and the fleet does a quality pass no human has patience for.' },
  ],
  routing: [
    { k: 'What is this?', t: 'Sends small mechanical tasks to small cheap models and saves the big model for hard work.' },
    { k: 'Why does it matter?', t: 'Most AI work doesn’t need the expensive model.' },
    { k: 'How does it help me?', t: 'Same quality where it counts, at a fraction of the spend — every routing decision is receipted.' },
  ],
  nightly: [
    { k: 'What is this?', t: 'Rebuilds the knowledge base overnight so answers track the newest source.' },
    { k: 'Why does it matter?', t: 'This ecosystem ships fast — stale knowledge means wrong answers.' },
    { k: 'How does it help me?', t: 'You wake up current without doing anything.' },
  ],
  provider: [
    { k: 'What is this?', t: 'Which AI stack is yours — sets your frontier model and what “savings” are measured against.' },
    { k: 'Why does it matter?', t: 'The router should ride licenses you already pay for.' },
    { k: 'How does it help me?', t: 'Click your house and routing adapts to your subscriptions automatically.' },
  ],
  openrouterKey: [
    { k: 'What is this?', t: 'One key that unlocks many cheap models from many providers.' },
    { k: 'Why does it matter?', t: 'The biggest savings come from models outside your main subscription.' },
    { k: 'How does it help me?', t: 'Paste it once, the cheap lane lights up — stored only in your user folder.' },
  ],
};

/* Dev-vs-Prod economics, in the owner's words (WP3). */
const PROFILE_INFO = {
  Development: ['Development is you, building your app. You already pay for a subscription (Claude Max, Codex) — dev work rides it at no extra cost, so this table optimizes for speed on your license.'],
  Production: ['Production is your app, serving other people. Your users can’t ride your personal subscription — production runs on metered API calls you pay per token, so this table optimizes for cost-per-quality on every call. Different economics — that’s why there are two tables.'],
};

/* The wiring card's click-to-learn (WP6). */
const WIRING_INFO = [
  { k: 'What is this?', t: 'A live map of how each project launches the RuvNet tools — a fresh npx download on every call, or your one global install.' },
  { k: 'Why does it matter?', t: 'npx keeps hidden private copies that can go stale — old code quietly answers while every command still “works”.' },
  { k: 'How does it help me?', t: 'You see exactly where each style is in use, and every fix below is one click with the undo recorded first.' },
];

function familyRow(fam) {
  const tone = fam.attention ? 'warn' : 'green';
  const statusText = fam.attention ? `${fam.attention} need${fam.attention === 1 ? 's' : ''} a look` : 'current';
  const count = fam.items.length;
  // Version on the row (Stuart 2026-07-17: "show the version numbers"). Healthy family → the
  // flagship's version. Attention family → the problem AND its resolution on the same line:
  // "installed → target" right beside the fix button.
  const first = fam.attention ? fam.items.find((i) => i.state === 'BEHIND' || i.state === 'BROKEN') : null;
  const verText = first
    ? `${first.installed ?? '?'} → ${first.target ?? 'latest'}`
    : (fam.items[0]?.installed ? `v${fam.items[0].installed}` : '');
  return el('details', { class: 'fam' },
    el('summary', { class: 'fam-sum' },
      el('span', { class: 'fam-name' }, fam.name),
      el('span', { class: 'fam-what' }, fam.what),
      el('span', { class: 'fam-status' },
        verText ? el('span', { class: 'fam-ver' + (first ? ' is-behind' : '') }, verText) : null,
        chip(statusText, tone),
        fam.attention ? el('button', {
          class: 'btn-fix', type: 'button', title: 'Jump to the one-click fix below (evidence, cost, and undo included)',
          onclick: (e) => {
            e.preventDefault(); e.stopPropagation();
            if (first) jumpToRec(`${first.state === 'BROKEN' ? 'repair' : 'sync'}:${first.name}`);
          },
        }, 'fix ↓') : null,
        el('span', { class: 'fam-count' }, count > 1 ? `${count} parts` : '1 pkg')),
      el('span', { class: 'fam-chev', 'aria-hidden': 'true' }, '›')),
    el('div', { class: 'fam-body' },
      el('div', { class: 'scroll-x' },
        el('table', { class: 'tb' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col' }, 'Package'), el('th', { scope: 'col' }, 'Installed'),
            el('th', { scope: 'col' }, 'Target'), el('th', { scope: 'col' }, 'Tag'),
            el('th', { scope: 'col' }, 'State'))),
          el('tbody', {}, fam.items.map(pkgRow))))));
}

function renderStack(data) {
  if (stackTicker) { clearInterval(stackTicker); stackTicker = null; }
  const body = $('#body-stack');
  const sum = data.summary || {};
  const pkgs = Array.isArray(data.packages) ? [...data.packages] : [];
  const shadows = Array.isArray(data.shadows) ? data.shadows : [];

  const total = sum.total ?? pkgs.length;
  const current = sum.current ?? pkgs.filter((p) => p.state === 'CURRENT').length;
  const behind = sum.behind ?? pkgs.filter((p) => p.state === 'BEHIND').length;
  const ahead = sum.ahead ?? pkgs.filter((p) => p.state === 'AHEAD').length;
  const broken = sum.broken ?? pkgs.filter((p) => p.state === 'BROKEN').length;
  const stale = sum.stale ?? shadows.filter((s) => s.stale).length;

  const chips = [chip(`${fmtInt(current)} current`, 'green')];
  if (behind) chips.push(chip(`${fmtInt(behind)} behind`, 'warn'));
  if (ahead) chips.push(chip(`${fmtInt(ahead)} ahead`, 'cyan', STATE_TITLE.AHEAD));
  if (broken) chips.push(chip(`${fmtInt(broken)} broken`, 'red'));
  if (stale) chips.push(chip(`${fmtInt(stale)} stale shadows`, 'warn'));
  setChips('chips-stack', chips);

  // The stack card leads the page but only EXPANDS when it has something to say (Stuart,
  // 2026-07-16): an action to take (behind/broken/stale), or the user's first visit ever.
  // A clean stack on a repeat visit stays collapsed — the green chip is the whole story.
  const stackCard = $('#card-stack');
  if (stackCard && !stackCard.dataset.userToggled) {
    const firstVisit = !localStorage.getItem('rvbc-seen');
    if (behind || broken || stale || firstVisit) stackCard.open = true;
  }
  try { localStorage.setItem('rvbc-seen', '1'); } catch { /* private mode */ }

  found.pkgTotal = total;
  found.pkgCurrent = current;
  updateFoundStrip();

  pkgs.sort((a, b) =>
    (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || String(a.name).localeCompare(String(b.name)));
  const attention = pkgs.filter((p) => ['BROKEN', 'BEHIND', 'UNRESOLVED'].includes(p.state));

  const main = [];
  main.push(el('p', { class: 'lead-stat' },
    'We read ', el('b', {}, fmtInt(total)), ' packages on your global stack — ',
    el('b', {}, fmtInt(current)), ' current',
    ahead ? el('span', {}, ', ', el('b', {}, fmtInt(ahead)), ' ahead of the registry (which is legal)') : '',
    broken ? el('span', {}, ', ', el('b', {}, fmtInt(broken)), ' broken') : '',
    behind ? el('span', {}, ', ', el('b', {}, fmtInt(behind)), ' behind') : '',
    '.'));

  if (pkgs.length) {
    main.push(el('p', { class: 'impact-note' },
      attention.length
        ? el('span', {},
            `${fmtInt(attention.length)} package${attention.length === 1 ? '' : 's'} need${attention.length === 1 ? 's' : ''} a look — every one has a one-click fix with evidence, cost, and undo. `,
            el('button', {
              class: 'btn-fix', type: 'button',
              onclick: () => jumpToRec(attention[0].state === 'BROKEN' ? `repair:${attention[0].name}` : `sync:${attention[0].name}`),
            }, 'take me to the fix ↓'))
        : 'Nothing needs attention — every package matches its target, one copy each.'));
    // Attention families bubble to the top (Stuart 2026-07-17); the healthy remainder keeps the
    // curated blast-radius order (never alphabetical). Stable sort preserves it within each group.
    main.push(el('div', { class: 'fam-list' },
      groupFamilies(pkgs).sort((a, b) => (b.attention || 0) - (a.attention || 0)).map(familyRow)));
  } else {
    main.push(el('p', { class: 'muted' }, 'No stack packages detected on this machine yet.'));
  }

  if (shadows.length) {
    // Problems only (Stuart 2026-07-17: "just tell me the ones I need to deal with — never an
    // issue without its resolution on the same line"). Stale rows carry their one-click fix
    // (the purge:shadows recommendation — evidence, cost, undo); the in-sync majority collapses
    // to a single verified line with a peel-back for whoever wants the full inventory.
    const staleRows = shadows.filter((s) => s.stale);
    const syncCount = shadows.length - staleRows.length;
    main.push(el('aside', { class: 'shadows' },
      el('p', { class: 'shadows-title' }, 'Shadow copies in the npx cache',
        staleRows.length ? chip(`${staleRows.length} stale`, 'warn') : chip('all in sync', 'green')),
      staleRows.length ? el('p', { class: 'shadows-sub' },
        'npx keeps private copies in ', el('code', {}, '~/.npm/_npx'),
        '. A stale one quietly answers instead of your newer install — every command still “works”, which is exactly why it’s invisible. These need dealing with:') : null,
      ...staleRows.map((s) => el('div', { class: 'shadow-row' },
        el('span', { class: 'shadow-name' }, s.name || '—'),
        el('span', { class: 'shadow-vers' }, `cache ${s.version ?? '?'} · global `, el('b', {}, s.global ?? '?')),
        chip('stale', 'warn'),
        el('button', {
          class: 'btn-fix', type: 'button',
          title: 'Jump to the one-click removal below — evidence, cost, and undo included',
          onclick: () => jumpToRec('purge:shadows'),
        }, 'remove it ↓'),
        el('span', { class: 'shadow-dir' }, s.dir || ''),
      )),
      el('p', { class: 'shadows-ok' },
        staleRows.length
          ? `The other ${fmtInt(syncCount)} cached ${syncCount === 1 ? 'copy matches' : 'copies match'} your installs — re-checked on every audit.`
          : shadows.length === 1
            ? 'The 1 cached copy matches your install — re-checked on every audit; nothing is hiding stale.'
            : `All ${fmtInt(shadows.length)} cached copies match your installs — re-checked on every audit; nothing is hiding stale.`),
      el('details', { class: 'sub' },
        el('summary', {}, `Peel it back — ${shadows.length === 1 ? 'the 1 cached copy' : `all ${fmtInt(shadows.length)} cached copies`}`),
        el('div', { class: 'sub-body' },
          shadows.map((s) => el('div', { class: 'shadow-row' },
            el('span', { class: 'shadow-name' }, s.name || '—'),
            el('span', { class: 'shadow-vers' }, `cache ${s.version ?? '?'} · global `, el('b', {}, s.global ?? '?')),
            s.stale ? chip('stale', 'warn') : chip('in sync', 'green'),
            el('span', { class: 'shadow-dir' }, s.dir || ''),
          ))))));
  }

  body.replaceChildren(withIllo('stack', ...main));
}

/* ----------------------------------------------------------- section 2: wiring */

const MECH_LABEL = { NPX: 'npx', GLOBAL_BINARY: 'global', PLUGIN: 'plugin', MCP: 'mcp' };

/* Verdict icons — same 2px round-cap stroke language as the page's other spot icons. */
const WV_ICON_CLEAN = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.6"/>
    <path d="M8.3 12.4l2.5 2.5 4.9-5.4"/>
  </svg>`;
const WV_ICON_DRIFT = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4.2 2.9 19.3h18.2z"/>
    <path d="M12 10.2v4.2"/>
    <path d="M12 17.1v.02"/>
  </svg>`;

function renderWiring(w) {
  const body = $('#body-wiring');
  if (!w) {
    setChips('chips-wiring', [chip('no data', 'grey')]);
    body.replaceChildren(el('p', { class: 'muted' }, 'No wiring data received.'));
    return;
  }
  const s = w.summary || {};
  const sites = Array.isArray(w.sites) ? w.sites : [];

  // The verdict this card exists for (Stuart 2026-07-17: "facts without purpose" — a census
  // is not an answer). One question, answered up top: when a rUv tool launches here, does the
  // version you installed actually run? Unpinned npx is the only lane that can lie — it keeps
  // a private copy in ~/.npm/_npx that quietly ages while every command still "works" (the
  // 3.25.6-vs-3.28.0 failure). Pinned npx (rUv's own style per his ruvector ADR, e.g.
  // `npx -y ruvector@0.2.25`) cannot drift — the villain is UNPINNED npx, not npx.
  // (renderGates answers "what stopped Claude"; this card answers "can what runs go stale".)
  const npxSites = sites.filter((x) => x.mechanism === 'NPX');
  const isPinned = (x) => /@\d+(\.\d+){0,2}([^\d.]|$)/.test(String(x.spec || ''));
  const driftSites = npxSites.filter((x) => !isPinned(x));
  // Summary counts npx but no rows arrived to inspect? Assume the worst, never the best.
  const driftN = (!npxSites.length && (s.npx ?? 0) > 0) ? (s.npx ?? 0) : driftSites.length;
  const pinnedN = npxSites.length - driftSites.length;
  const total = (s.npx ?? 0) + (s.global ?? 0) + (s.mcp ?? 0) + (s.plugin ?? 0);
  const projCount = new Set(sites.filter((x) => x.scope === 'project' && x.project).map((x) => x.project)).size;

  setChips('chips-wiring', total
    ? (driftN
        ? [chip(`${fmtInt(driftN)} can drift stale`, 'warn'), chip(`${fmtInt(total - driftN)} pinned down`, 'green')]
        : [chip('nothing can drift', 'green'), chip(`${fmtInt(total)} launch sites`, 'grey')])
    : [chip('nothing wired yet', 'grey')]);

  found.npx = s.npx ?? 0;
  found.projects = s.projectsWithNpx ?? 0;
  found.projectNames = [...new Set(sites.filter((x) => x.scope === 'project' && x.project).map((x) => x.project))];
  updateFoundStrip();

  const main = [];
  if (total) {
    // ---- the verdict banner: the answer first, evidence below it ----
    const title = driftN
      ? `${fmtInt(driftN)} launch site${driftN === 1 ? '' : 's'} can silently run a stale copy`
      : 'Every rUv tool here resolves to one known version';
    const sub = [];
    if (driftN) {
      sub.push('Unpinned npx keeps a private copy in ', el('code', {}, '~/.npm/_npx'),
        ' and runs that — every command still “works” while old code answers. Rewire ',
        driftN === 1 ? 'it' : 'each one', ' to the global binary, or pin the exact version the way rUv does.');
    } else {
      const bits = [];
      if (s.global) bits.push(el('span', {}, el('b', {}, fmtInt(s.global)), ' through your one global binary'));
      if (s.mcp) bits.push(el('span', {}, el('b', {}, fmtInt(s.mcp)), ' through a running MCP server'));
      if (s.plugin) bits.push(el('span', {}, el('b', {}, fmtInt(s.plugin)), ' inside Claude Code itself'));
      if (pinnedN) bits.push(el('span', {}, el('b', {}, fmtInt(pinnedN)), ' via npx pinned to an exact version, which cannot age'));
      const joined = [];
      bits.forEach((b, i) => { if (i) joined.push(i === bits.length - 1 ? ' and ' : ', '); joined.push(b); });
      sub.push('All ', el('b', {}, fmtInt(total)), ' launch sites',
        projCount ? el('span', {}, ' across ', el('b', {}, fmtInt(projCount)), ` project${projCount === 1 ? '' : 's'}`) : '',
        ' are accounted for: ', ...joined,
        '. Zero unpinned npx — nothing can silently drift stale.');
    }
    main.push(el('div', { class: 'wire-verdict' + (driftN ? ' is-drift' : ' is-clean') },
      el('span', { class: 'wv-icon', 'aria-hidden': 'true' }, frag(driftN ? WV_ICON_DRIFT : WV_ICON_CLEAN)),
      el('div', { class: 'wv-text' },
        el('p', { class: 'wv-title' }, title, infoBtn('How it’s wired', WIRING_INFO)),
        el('p', { class: 'wv-sub' }, ...sub),
        driftN && driftSites.length ? el('ul', { class: 'wv-sites' },
          ...driftSites.slice(0, 8).map((x) => el('li', {},
            el('span', { class: 'site-where' }, x.scope === 'project' ? (x.project || 'unknown project') : 'machine-wide'),
            el('span', { class: 'cell-dim' }, x.file || '—'),
            el('span', { class: 'site-spec' }, x.spec || ''))),
          driftSites.length > 8 ? el('li', { class: 'cell-dim' },
            `+ ${fmtInt(driftSites.length - 8)} more — the full map is in the peel-back below`) : null) : null)));

    // ---- lane legend, subordinate to the verdict: one quiet line per lane in use.
    // A lane at zero is omitted, not excused — a "0 plugin" row answers nothing.
    const npxMeaning = driftN === 0
      ? 'pinned to exact versions — deliberate, reproducible, cannot age'
      : pinnedN > 0
        ? `${fmtInt(driftN)} unpinned can drift stale · ${fmtInt(pinnedN)} pinned are safe`
        : 'downloads a private copy per call — can silently drift stale';
    const lanes = [
      { n: s.global ?? 0, label: 'global binary', tone: 'w-global', meaning: 'one path, one version — what runs is what you installed' },
      { n: s.mcp ?? 0, label: 'MCP server', tone: 'w-mcp', meaning: 'a running tool the AI calls directly — alive, not re-downloaded' },
      { n: s.npx ?? 0, label: 'npx', tone: 'w-npx', meaning: npxMeaning },
      { n: s.plugin ?? 0, label: 'plugin', tone: 'w-plugin', meaning: 'ships inside Claude Code itself' },
    ].filter((l) => l.n > 0);
    if (driftN) lanes.sort((a, b) => Number(b.label === 'npx') - Number(a.label === 'npx')); // risk leads
    main.push(el('div', { class: 'wire-legend' },
      ...lanes.map((l) => el('div', { class: 'wire-leg-row' },
        el('span', { class: 'wire-dot ' + l.tone, 'aria-hidden': 'true' }),
        el('b', { class: 'wire-leg-n' }, fmtInt(l.n)),
        el('span', { class: 'wire-leg-lab' }, l.label),
        el('span', { class: 'wire-leg-meaning cell-dim' }, l.meaning)))));
  }

  if (sites.length) {
    const groups = new Map();
    for (const site of sites) {
      const key = site.scope === 'project' ? (site.project || 'unknown project') : 'global (your user settings)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(site);
    }
    const outer = el('details', { class: 'sub' },
      el('summary', {}, `Peel it back — all ${fmtInt(sites.length)} resolution sites, project by project`),
      el('div', { class: 'sub-body' },
        [...groups.entries()].map(([proj, list]) => el('details', { class: 'sub' },
          el('summary', {}, `${proj} — ${list.length} site${list.length === 1 ? '' : 's'}`),
          el('div', { class: 'sub-body' },
            el('div', { class: 'scroll-x' },
              el('table', { class: 'tb' },
                el('thead', {}, el('tr', {},
                  el('th', { scope: 'col' }, 'File'), el('th', { scope: 'col' }, 'Event · matcher'),
                  el('th', { scope: 'col' }, 'Via'), el('th', { scope: 'col' }, 'Spec'))),
                el('tbody', {}, list.map((site) => el('tr', {},
                  el('td', { class: 'cell-mono' }, site.file || '—'),
                  el('td', { class: 'cell-mono cell-dim' }, [site.event, site.matcher].filter(Boolean).join(' · ') || '—'),
                  el('td', {}, chip(MECH_LABEL[site.mechanism] || String(site.mechanism || '?').toLowerCase(), 'grey')),
                  el('td', { class: 'cell-mono cell-dim' }, site.spec || '—'),
                ))))))))));
    main.push(outer);
  } else {
    main.push(el('p', { class: 'muted' }, total
      ? 'The site-by-site list didn’t arrive with this audit — the counts above are from the summary.'
      : 'No resolution sites found — nothing is wired through hooks yet.'));
  }

  body.replaceChildren(withIllo('wiring', ...main));
}

/* -------------------------------------------------- section 3: recommendations */

const SEV_TONE = { INFO: 'grey', SUGGESTED: 'cyan', IMPORTANT: 'amber' };

const ICON_MACHINE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="5" width="16" height="11" rx="2"/>
    <path d="M2 19h20"/>
  </svg>`;

const BADGE_OK = `
  <svg class="applied-badge" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14"/>
    <path d="M10 16.8l4.1 4L22 12.2"/>
  </svg>`;

function updateRecsChip() {
  const n = renderedRecIds.size;
  if (!stateRecsSettled && !stackRecsSettled) { setChips('chips-recs', [chip('…', 'wait')]); return; }
  if (n === 0 && stateRecsSettled && stackRecsSettled) {
    setChips('chips-recs', [chip('none needed', 'green')]);
  } else {
    setChips('chips-recs', [chip(`${n} proposal${n === 1 ? '' : 's'}`, n ? 'amber' : 'wait')]);
  }
}

function maybeRecsEmpty() {
  const emptyBox = $('#recs-empty');
  if (!emptyBox) return;
  if (stateRecsSettled && stackRecsSettled && renderedRecIds.size === 0) {
    emptyBox.hidden = false;
    emptyBox.replaceChildren(el('div', { class: 'recs-empty' },
      withIllo('recs',
        el('p', { class: 'lead' }, 'Nothing to suggest.'),
        el('p', {}, 'Your setup looks the way you meant it to — and an advisor with nothing to say should say exactly that. If your machine changes, reload and we’ll look again.'))));
  } else {
    emptyBox.hidden = true;
  }
}

function recsSettled(source, ok) {
  if (source === 'state') stateRecsSettled = true;
  if (source === 'stack') {
    stackRecsSettled = true;
    const pending = $('#recs-pending');
    if (pending) {
      if (ok) pending.remove();
      else {
        pending.textContent = 'The stack audit failed, so suggestions from it can’t appear this session.';
        pending.style.color = 'var(--warn-text)';
      }
    }
  }
  updateRecsChip();
  maybeRecsEmpty();
}

function addRecommendations(recs, source) {
  const list = $('#recs-list');
  // Ordering explains itself (shown once): machine-wide first, then your active projects.
  if (!document.getElementById('recs-order-note')) {
    list.before(el('p', { class: 'impact-note', id: 'recs-order-note' },
      'Ordered by what you’re working on — machine-wide updates first (they affect every project), then your most recently active projects.'));
  }
  let dropped = 0;
  const nodes = [];
  for (const rec of Array.isArray(recs) ? recs : []) {
    if (!rec || rec.id == null || renderedRecIds.has(rec.id)) continue;
    // The DDD invariant, honored in the UI too: no evidence/cost/undo → not rendered.
    if (!Array.isArray(rec.evidence) || !rec.evidence.length || !rec.cost || !rec.undo) { dropped += 1; continue; }
    renderedRecIds.add(rec.id);
    nodes.push(buildRecCard(rec));
  }
  // Stack updates (sync:/repair:) arrive from the slow audit AFTER wiring recs — but they outrank
  // them (machine-wide blast radius), so they go to the top instead of queueing at the bottom.
  if (source === 'stack' && list.firstChild) list.prepend(...nodes);
  else list.append(...nodes);
  if (dropped) {
    list.append(el('p', { class: 'fineprint' },
      `${dropped} proposal${dropped === 1 ? '' : 's'} arrived without evidence, cost, or an undo and ${dropped === 1 ? 'was' : 'were'} not rendered — the contract requires all three.`));
  }
  updateRecsChip();
}

function buildRecCard(rec) {
  const status = el('p', { class: 'rec-status', 'aria-live': 'polite' });
  const actions = el('div', { class: 'rec-actions' });
  const card = el('article', { class: 'rec', id: `rec-${rec.id}` });

  /* impact surface — the load-bearing safety UX */
  let impact;
  if (rec.touchesMachine === true) {
    impact = el('div', { class: 'impact-banner', role: 'note' },
      el('span', { class: 'impact-icon' }, frag(ICON_MACHINE)),
      el('div', { class: 'impact-text' },
        el('p', { class: 'impact-title' }, 'This one touches your computer'),
        el('p', { class: 'impact-plain' }, rec.plainImpact ||
          'It changes something the rest of your system uses. We’ll ask you to confirm before anything runs, and the exact reversal is recorded first.'),
        el('span', { class: 'impact-rev' }, 'reversible — undo recorded before it runs')));
  } else {
    impact = el('p', { class: 'impact-note' },
      'Only writes RuvNet Brain’s own settings file in your user folder — nothing else on your computer changes.');
  }

  /* evidence · cost · change · undo — all four, always */
  const facts = el('div', { class: 'rec-facts' },
    el('div', { class: 'fact' },
      el('span', { class: 'k k-evidence' }, 'Evidence'),
      el('div', { class: 'v' }, el('ul', { class: 'evidence-list' },
        rec.evidence.map((ev) => el('li', {},
          ev.observed || String(ev),
          ev.source ? el('span', { class: 'src' }, ` — ${ev.source}`) : null))))),
    el('div', { class: 'fact' },
      el('span', { class: 'k k-cost' }, 'Cost'),
      el('div', { class: 'v' }, el('div', { class: 'cost-row' },
        rec.cost.time != null ? el('span', { class: 'cost-item' }, el('span', { class: 'ck' }, 'time'), rec.cost.time) : null,
        rec.cost.latency != null ? el('span', { class: 'cost-item' }, el('span', { class: 'ck' }, 'latency'), rec.cost.latency) : null,
        rec.cost.usd != null ? el('span', { class: 'cost-item' }, el('span', { class: 'ck' }, 'cost'), fmtUsd(rec.cost.usd)) : null,
        rec.cost.risk != null ? el('span', { class: `cost-item risk-${rec.cost.risk}` }, el('span', { class: 'ck' }, 'risk'), rec.cost.risk) : null))),
    rec.change ? el('div', { class: 'fact' },
      el('span', { class: 'k k-change' }, 'Change'),
      el('div', { class: 'v' },
        rec.change.human || '',
        rec.change.cmd ? el('span', {}, ' — ', el('code', {}, rec.change.cmd)) : null)) : null,
    el('div', { class: 'fact' },
      el('span', { class: 'k k-undo' }, 'Undo'),
      el('div', { class: 'v' }, rec.undo.human || rec.undo.kind || 'recorded before the change runs')),
  );

  function setIdleActions() {
    actions.replaceChildren(
      el('button', { class: 'btn btn-apply', type: 'button', onclick: onApply },
        rec.touchesMachine ? 'Apply…' : 'Apply'),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: onSkip }, 'Skip'),
    );
  }

  function onApply() {
    if (rec.touchesMachine === true) showConfirm();
    else doApply();
  }

  function showConfirm() {
    const cancel = el('button', { class: 'btn btn-ghost', type: 'button', onclick: setIdleActions }, 'Cancel');
    actions.replaceChildren(
      el('div', { class: 'confirm', role: 'group', 'aria-label': 'Confirm a change to your computer' },
        el('p', { class: 'confirm-q' }, 'Change your computer now?'),
        el('p', { class: 'confirm-detail' },
          rec.change?.human ? `It will ${rec.change.human}. ` : '',
          rec.undo?.human ? `If you change your mind: ${rec.undo.human}.` : 'The reversal is recorded before anything runs.'),
        el('div', { class: 'confirm-btns' },
          el('button', { class: 'btn btn-apply', type: 'button', onclick: doApply }, 'Yes, change my computer'),
          cancel)));
    cancel.focus();
  }

  async function doApply() {
    actions.replaceChildren(el('button', { class: 'btn btn-apply', type: 'button', disabled: true }, 'Applying…'));
    status.textContent = '';
    status.dataset.tone = '';
    try {
      const { status: code, data } = await postJSON('/api/apply', { ids: [rec.id], preStateHash });
      if (code === 403) return fail(TOKEN_MSG);
      if (data && data.worldMoved) return worldMoved();
      const result = (data.results || []).find((r) => r.id === rec.id) || (data.results || [])[0];
      if (!result) return fail('The server returned no result for this change — nothing was assumed applied.');
      if (result.worldMoved || result.error === 'worldMoved') return worldMoved();
      if (result.ok) applied(result);
      else fail('The change didn’t complete. Nothing runs without its backup recorded first.', result.log);
    } catch (err) {
      fail(`Couldn’t reach the console server: ${err.message || err}`);
    }
  }

  function applied(result) {
    card.classList.add('is-applied');
    const undoBtn = el('button', {
      class: 'btn btn-undo', type: 'button',
      onclick: () => doUndo(result.undoToken, undoBtn),
    }, 'Undo this change');
    actions.replaceChildren(
      el('div', { class: 'applied' },
        el('div', { class: 'applied-head' },
          frag(BADGE_OK),
          el('div', {},
            el('p', { class: 'applied-title' }, 'Applied — and reversible.'),
            el('p', { class: 'applied-sub' }, 'A backup was written before anything ran. The undo below restores it exactly.'))),
        result.log ? el('pre', { class: 'log' }, String(result.log)) : null,
        el('div', { class: 'applied-btns' }, undoBtn)));
    announce(`${rec.title} applied.`);
    undoBtn.focus();
    // Close the loop: re-mirror the machine so every card shows the AFTER state.
    recheckMachine();
  }

  async function doUndo(undoToken, btn) {
    if (!undoToken) return fail('No undo token was returned for this change — undo it from the backup file noted in the log.');
    btn.disabled = true;
    btn.textContent = 'Undoing…';
    try {
      const { status: code, data } = await postJSON('/api/undo', { undoToken });
      if (code === 403) return fail(TOKEN_MSG);
      if (data && data.ok) {
        card.classList.remove('is-applied');
        actions.replaceChildren(el('p', { class: 'reverted' }, 'Reverted — your machine is back exactly the way it was.'));
        actions.append(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: setIdleActions }, 'Offer it again'));
        announce(`${rec.title} reverted.`);
        recheckMachine(); // show the restored state everywhere, not just on this card
      } else {
        fail('Undo didn’t complete. The backup file still exists — nothing is lost.');
      }
    } catch (err) {
      fail(`Couldn’t reach the console server: ${err.message || err}`);
    }
  }

  function worldMoved() {
    actions.replaceChildren(
      el('div', { class: 'world-moved', role: 'alert' },
        el('p', {}, 'Your machine changed since this page loaded — another session or a scheduled job got there first. Nothing was touched: we re-read the world before writing, and it had moved.'),
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => location.reload() }, 'Reload and look again')));
    announce('Apply aborted: the machine changed since the page loaded.');
  }

  function fail(msg, log) {
    status.dataset.tone = 'error';
    status.textContent = msg;
    setIdleActions();
    if (log) actions.before(el('pre', { class: 'log' }, String(log)));
    announce(msg);
  }

  function onSkip() {
    card.classList.add('is-skipped');
    if (!card.querySelector('.skipped-row')) {
      card.append(el('div', { class: 'skipped-row' },
        el('span', { class: 'sk-title' }, `skipped · ${rec.title}`),
        el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: () => card.classList.remove('is-skipped'),
        }, 'Show again')));
    }
  }

  card.append(
    el('div', { class: 'rec-top' },
      el('h3', {}, rec.title || rec.id),
      chip(rec.severity || 'INFO', SEV_TONE[rec.severity] || 'grey')),
    rec.rationale ? el('p', { class: 'rationale' }, rec.rationale) : null,
    impact,
    facts,
    actions,
    status,
  );
  setIdleActions();
  return card;
}

/* ----------------------------------------------------------- section 4: memory */

const DIM_TONE = { ok: 'green', warn: 'warn', fail: 'red', notTested: 'nt' };
const DIM_LABEL = { ok: 'ok', warn: 'warn', fail: 'fail', notTested: 'not checked this session' };
const DIAL_ARC = 235.62; /* 270° arc, r=50 */

/* Constant markup only — the score is injected via textContent/attributes below,
   never interpolated into HTML. */
const DIAL_SVG = `
  <svg class="dial" viewBox="0 0 120 108" role="img">
    <defs>
      <linearGradient id="dial-grad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#f0a830"/><stop offset="0.32" stop-color="#ffce6a"/>
        <stop offset="0.68" stop-color="#5ad6ff"/><stop offset="1" stop-color="#5fd38a"/>
      </linearGradient>
    </defs>
    <path class="dial-track" d="M 24.64 95.36 A 50 50 0 1 1 95.36 95.36"/>
    <path class="dial-value" d="M 24.64 95.36 A 50 50 0 1 1 95.36 95.36"
          stroke="url(#dial-grad)" stroke-dasharray="0 235.62"/>
    <text class="dial-num" x="60" y="66" text-anchor="middle"></text>
    <text class="dial-sub" x="60" y="82" text-anchor="middle">of 100</text>
  </svg>`;

function dial(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const box = el('div', { class: 'dial-wrap' }, frag(DIAL_SVG));
  const svg = box.querySelector('.dial');
  svg.setAttribute('aria-label', `Memory quality score ${s} out of 100`);
  svg.querySelector('.dial-num').textContent = String(s);
  /* let the arc sweep in after first paint */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const v = box.querySelector('.dial-value');
    if (v) v.setAttribute('stroke-dasharray', `${((s / 100) * DIAL_ARC).toFixed(2)} ${DIAL_ARC.toFixed(2)}`);
  }));
  return box;
}

// Compact, delightful "it's learning how you work" strip — the visible face of the recursive learning
// loop (ADR-0017). Deliberately small; shows the win without dominating the card.
function renderLearnings(l) {
  if (!l || !l.active) return null;
  const recent = (l.recentWorkflow || []).slice(0, 6);
  const when = l.daysSinceLastAdaptation === 0 ? 'updated today'
    : (l.daysSinceLastAdaptation != null ? `last updated ${l.daysSinceLastAdaptation}d ago` : '');
  return el('div', { class: 'learn-strip' },
    el('div', { class: 'learn-head' },
      el('span', { class: 'learn-spark', 'aria-hidden': 'true' }, '✦'),
      el('div', { class: 'learn-headtext' },
        el('div', { class: 'learn-title' }, 'Learning how you work'),
        el('div', { class: 'learn-sub' },
          el('b', {}, fmtInt(l.patterns) + ' patterns'), ' from ', el('b', {}, fmtInt(l.trajectories) + ' workflows'),
          when ? ' · ' + when : ''))),
    recent.length ? el('div', { class: 'learn-recent' },
      el('span', { class: 'learn-recent-lab' }, 'recently observed'),
      ...recent.map((a) => el('span', { class: 'learn-chip' }, a.length > 30 ? a.slice(0, 28) + '…' : a))) : null,
    el('p', { class: 'learn-foot fineprint' },
      'Shared across all your projects and getting smarter over time — but only ', el('b', {}, 'how you work'), '. Your project facts stay isolated; nothing here is project data.'));
}

function renderMemory(mem) {
  const body = $('#body-memory');
  if (!mem || !mem.health) {
    setChips('chips-memory', [chip('no data', 'grey')]);
    body.replaceChildren(el('p', { class: 'muted' }, 'No memory-health data received.'));
    return;
  }
  const h = mem.health;
  const score = Math.max(0, Math.min(100, Math.round(Number(h.score) || 0)));
  const tone = score >= 85 ? 'green' : score >= 60 ? 'warn' : 'red';
  setChips('chips-memory', [chip(`${score}/100`, tone)]);
  found.memScore = score;
  updateFoundStrip();

  const dims = Array.isArray(h.dimensions) ? h.dimensions : [];
  const notTested = dims.filter((d) => d.status === 'notTested').length;

  const main = [];
  main.push(el('div', { class: 'memory-top' },
    dial(score),
    el('div', { class: 'mem-summary' },
      el('h3', {}, h.project ? `${h.project} — memory quality` : 'Memory quality'),
      el('p', { class: 'mem-line' }, h.summary ||
        'A quality score, not a liveness light: a store can be up, populated, and still never surface the thing you need.'),
      el('p', { class: 'fineprint' },
        'Dimensions we didn’t probe this session are excluded from the score — shown grey below, never assumed. A known-broken dimension caps the score.'))));

  const learn = renderLearnings(mem.learnings);
  if (learn) main.push(learn);

  if (dims.length) {
    main.push(el('div', { class: 'dims' }, dims.map((d) => {
      const st = DIM_TONE[d.status] ? d.status : 'notTested';
      const ded = Number(d.deduction) || 0;
      return el('div', { class: `dim${st === 'notTested' ? ' dim-nt' : ''}` },
        chip(DIM_LABEL[st], DIM_TONE[st]),
        el('span', { class: 'dim-name' }, d.label || d.key || '—'),
        el('span', { class: `dim-ded${ded > 0 ? ' has-ded' : ''}`,
          title: st === 'notTested' ? 'Not probed — contributes nothing to the score' : 'Deduction from the score' },
          st === 'notTested' ? '—' : (ded > 0 ? `−${ded}` : '0')),
        el('span', { class: 'dim-detail' }, d.detail || ''));
    })));
    if (notTested) {
      main.push(el('p', { class: 'fineprint', style: 'margin-top:10px' },
        `${notTested} dimension${notTested === 1 ? ' was' : 's were'} not probed this session — reported honestly rather than scored from an assumption.`));
    }
  }

  const fleet = Array.isArray(mem.fleet) ? mem.fleet : [];
  if (fleet.length) {
    main.push(el('details', { class: 'sub' },
      el('summary', {}, `Across your ${fleet.length} project${fleet.length === 1 ? '' : 's'} — every memory store we found`),
      el('div', { class: 'sub-body' },
        el('div', { class: 'scroll-x' },
          el('table', { class: 'tb' },
            el('thead', {}, el('tr', {},
              el('th', { scope: 'col' }, 'Project'), el('th', { scope: 'col' }, 'Entries'),
              el('th', { scope: 'col' }, 'Embedded'), el('th', { scope: 'col' }, 'Patterns'),
              el('th', { scope: 'col' }, 'Learns'), el('th', { scope: 'col' }, 'Findings'))),
            el('tbody', {}, fleet.map((f) => el('tr', {},
              el('td', { class: 'cell-name' }, f.name || '—'),
              el('td', { class: 'cell-mono num' }, fmtInt(f.total)),
              el('td', { class: 'cell-mono num' }, f.coverPct != null ? `${f.coverPct}%` : '—'),
              el('td', { class: 'cell-mono num' }, fmtInt(f.patterns)),
              el('td', {}, f.learns ? chip('yes', 'green') : chip('no', 'grey')),
              el('td', { class: 'cell-dim' },
                Array.isArray(f.findings) && f.findings.length ? f.findings.join('; ') : '—'),
            ))))))));
  }

  body.replaceChildren(withIllo('memory', ...main));
}

/* ---------------------------------------------------------- section 5: savings */

/* Router panel (rebuilt 2026-07-16). The old panel displayed router-optimizer.mjs — a parallel,
   subscription-blind re-derivation of routing strategy that bypassed the real engine and told a
   Max subscriber to PAY for a worse model than the Sonnet 5 their plan covers. The replica is
   deleted. This panel renders only the ENGINE'S OWN truth: who decides (@metaharness/router —
   rUv's learned cost-optimal router — or a loudly-announced cold-start), the real candidate pool
   with THIS user's marginal prices ($0 where the subscription covers it), and the engine's own
   recent decisions from its append-only log. Nothing shown here can disagree with what routes. */
function renderRouterEngine(re) {
  if (!re || !re.engine) return null;
  const money = (v) => (v == null ? '—' : v === 0 ? '$0' : '$' + v + '/Mtok');
  const eng = re.engine;

  const modeChip =
    eng.mode === 'LEARNED' ? chip(`learned · ${eng.labels} real outcomes`, 'green')
    : eng.mode === 'COLD-START' ? chip(`cold-start · ${eng.labels} of ${eng.needed} labels`, 'warn')
    : chip('router package missing', 'red');

  const engineLine = el('div', { class: 'rp-house' },
    el('span', { class: 'rp-house-tag' }, 'Who decides'),
    el('b', { class: 'rp-house-name' }, '@metaharness/router'),
    el('span', { class: 'rp-house-src' }, 'rUv’s learned cost-optimal router — the Brain adds only your constraints'),
    modeChip);

  const modeNote =
    eng.mode === 'COLD-START' ? el('p', { class: 'rp-split' },
      'It routes by learning from ', el('b', {}, 'your real outcomes'), ' — it has ',
      el('b', {}, String(eng.labels)), ' of the ', el('b', {}, String(eng.needed)),
      ' labelled examples it needs before its predictions count. Until then it says so and falls back — every routed task teaches it. This stops being a fallback with use.')
    : eng.mode === 'UNAVAILABLE' ? el('p', { class: 'rp-split' },
      'The router package isn’t installed here — nothing is silently substituted in its place. ',
      el('span', { class: 'cell-mono' }, 'npm i @metaharness/router'), ' restores it.')
    : null;

  // Dev/Prod are LENSES over the engine's one pool — a filter and a price column, never a second
  // strategy (Stuart 2026-07-16: "not sure I'm seeing dev vs production"). Development = you, in
  // Claude Code, where covered models are $0 marginal. Production = your deployed app on metered
  // APIs, where a personal subscription cannot apply and list price is the real cost.
  const pool = Array.isArray(re.pool) ? re.pool : [];
  const TIER_ORDER = { mechanical: 0, cheap: 1, mid: 2, frontier: 3 };
  const byTier = (a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
  const lensTable = (rows, costOf, costHead) => el('div', { class: 'scroll-x' },
    el('table', { class: 'tb rp-tb' },
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col' }, 'Bucket'), el('th', { scope: 'col' }, 'Model'),
        el('th', { scope: 'col' }, costHead))),
      el('tbody', {}, rows.map((p) => el('tr', {},
        el('td', { class: 'rp-band' }, p.tier || '—'),
        el('td', {}, el('div', { class: 'rp-model' }, prettyModel(p.id))),
        el('td', { class: 'cell-mono num' }, costOf(p)),
      )))));
  // Development: only what this machine's harness can launch; best (cheapest-marginal) per bucket.
  const bestPerTier = (rows, price) => {
    const seen = {};
    for (const p of rows) {
      const k = p.tier || '?';
      if (!seen[k] || price(p) < price(seen[k])) seen[k] = p;
    }
    return Object.values(seen).sort(byTier);
  };
  const devRows = bestPerTier(
    pool.filter((p) => (p.harness || []).includes('claude-code')),
    (p) => (p.subscriptionCovered ? -1 : p.marginalPerMTok ?? Infinity));
  const prodRows = bestPerTier(
    pool.filter((p) => p.listPerMTok != null && p.provider !== 'local'),
    (p) => p.listPerMTok ?? Infinity);
  const devBlock = el('div', { class: 'rp-profile' },
    el('div', { class: 'rp-head' },
      el('span', { class: 'rp-name' }, 'Development'),
      el('span', { class: 'rp-obj' }, 'you, in Claude Code — models your plan covers win at $0 marginal')),
    lensTable(devRows,
      (p) => (p.subscriptionCovered ? el('b', { title: 'covered by your subscription — zero marginal cost' }, '$0 · yours') : money(p.marginalPerMTok)),
      'Your cost'));
  const prodBlock = el('div', { class: 'rp-profile' },
    el('div', { class: 'rp-head' },
      el('span', { class: 'rp-name' }, 'Production'),
      el('span', { class: 'rp-obj' }, 'your deployed app on metered APIs — a personal plan can’t apply there')),
    lensTable(prodRows, (p) => money(p.listPerMTok), 'API price'));
  const lensGrid = el('div', { class: 'rp-grid' }, devBlock, prodBlock);
  const poolFoot = el('p', { class: 'fineprint' },
    `Best pick per bucket shown; the engine weighs all ${pool.length} candidates in its catalog on every call — nothing is retired by being off this summary.`);

  // Decisions: dedupe consecutive identical picks, keep 3, humanize the reason head. The full
  // append-only log stays on disk — this is a pulse, not a table of record.
  const decisionsRaw = Array.isArray(re.decisions) ? re.decisions : [];
  const decisions = [];
  for (const d of decisionsRaw) {
    const prev = decisions[decisions.length - 1];
    if (prev && prev.model === d.model && prev.routedBy === d.routedBy) continue;
    decisions.push(d);
    if (decisions.length >= 3) break;
  }
  const humanReason = (r) => {
    const s = String(r || '');
    if (s.includes('predicted quality')) return s.match(/predicted quality [\d.]+/)?.[0] + (s.includes('clears') ? ' — clears the bar' : '');
    if (s.includes('NOT a tuned heuristic')) return 'starter policy while the router learns — prefers your covered models';
    return s.split('—')[0].split(';')[0].slice(0, 90);
  };
  const decRow = (d) => el('div', { class: 'dec-row' },
    el('div', { class: 'dec-top' },
      el('b', { class: 'dec-model' }, prettyModel(d.model)),
      (String(d.routedBy || '').startsWith('@metaharness/router')
        ? chip('rUv’s router', 'green') : chip('learning fallback', 'warn')),
      el('span', { class: 'dec-when cell-mono cell-dim' }, d.ts ? String(d.ts).slice(5, 16).replace('T', ' ') : '—')),
    el('div', { class: 'dec-why cell-dim' }, humanReason(d.reason)));
  const lastTs = decisionsRaw[0] && decisionsRaw[0].ts ? new Date(decisionsRaw[0].ts) : null;
  const daysQuiet = lastTs ? Math.floor((Date.now() - lastTs.getTime()) / 86400000) : null;
  const decisionsBlock = decisions.length ? el('div', { class: 'mh-dist' },
    el('p', { class: 'dist-ladder' }, 'Latest real decisions — from the engine’s own log, not simulated',
      daysQuiet > 1 ? el('span', { class: 'cell-dim' }, ` · quiet for ${daysQuiet} days — turn on smart routing above to feed it daily`) : null),
    ...decisions.map(decRow)) : null;

  const keyLine = re.keys && re.keys.openrouter
    ? el('span', {}, 'OpenRouter key detected — metered cross-provider candidates are reachable.')
    : el('span', {}, 'No OpenRouter key — only subscription and local candidates are reachable. ',
        el('a', { class: 'rp-getkey', href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener' }, 'Create one →'));

  const constraintLine = re.profile && re.profile.present
    ? el('p', { class: 'rp-split' }, el('b', {}, 'Your constraints, applied as data: '),
        'models your subscription covers enter the pool at ', el('b', {}, '$0 marginal'),
        ' — so the cost-optimal math prefers what you already pay for. Cheapest real cost first; frontier only when the work earns it.')
    : el('p', { class: 'rp-split' }, 'No personal profile yet — run ',
        el('span', { class: 'cell-mono' }, 'node scripts/model-router-setup.mjs'),
        ' so the router knows which models your plan already covers.');

  return el('details', { class: 'mh-profiles' },
    el('summary', { class: 'rp-summary' },
      el('span', { class: 'rp-sum-t' }, 'Who routes your work — and with what'),
      el('span', { class: 'rp-sum-s' }, `rUv’s learned router · your prices · ${eng.mode.toLowerCase().replace('-', ' ')}`),
      el('span', { class: 'rp-chev', 'aria-hidden': 'true' }, '›')),
    el('div', { class: 'rp-body' },
      engineLine,
      modeNote,
      constraintLine,
      lensGrid,
      poolFoot,
      decisionsBlock,
      el('p', { class: 'rp-foot fineprint' },
        'Candidate pool = the engine’s own catalog × your profile (', re.profile ? re.profile.path : '', '). ',
        keyLine)));
}

const MODEL_PRETTY = {
  'claude-fable-5': 'Fable 5', 'claude-opus-4.8': 'Opus 4.8', 'claude-sonnet-5': 'Sonnet 5',
  'claude-haiku-4.5': 'Haiku 4.5', 'agent-booster': 'Agent Booster',
  'inclusionai/ling-2.6-flash': 'Ling 2.6 Flash', 'openai/gpt-4.1': 'GPT-4.1',
  'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B', 'x-ai/grok-4.5': 'Grok 4.5', 'x-ai/grok-4.3': 'Grok 4.3',
  'deepseek/deepseek-chat': 'DeepSeek Chat', 'deepseek/deepseek-v4-flash': 'DeepSeek v4 Flash',
  'z-ai/glm-4.6': 'GLM 4.6', 'z-ai/glm-5': 'GLM 5',
  // house frontiers / ladders (per-provider personalization)
  'openai/gpt-5.6-sol': 'GPT-5.6 Sol', 'openai/gpt-5.6-terra': 'GPT-5.6 Terra', 'openai/gpt-5.6-luna': 'GPT-5.6 Luna',
  'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro', 'google/gemini-3.5-flash': 'Gemini 3.5 Flash', 'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
};
const HOUSE_SOURCE_NOTE = {
  config: 'you set this',
  env: 'detected from your API keys',
  default: 'you’re running Claude Code, so this is your dev house — set your production house in Settings',
};
// Friendly labels for the model-house selector — the stored value stays the id (anthropic/openai/…).
const SEG_LABEL = {
  provider: { auto: 'Auto', anthropic: 'Claude', openai: 'ChatGPT', codex: 'Codex', google: 'Gemini', xai: 'Grok' },
};
const segLabel = (key, opt) => (SEG_LABEL[key] && SEG_LABEL[key][opt]) || opt;
const prettyModel = (id) => {
  if (!id) return '—';
  if (MODEL_PRETTY[id]) return MODEL_PRETTY[id];
  // Fallback prettifier: drop provider prefix + date-pinned suffixes ("claude-haiku-4-5-20251001"
  // must never render raw — Stuart called the wall of ids a mess), title-case the words.
  const base = String(id).split('/').pop().replace(/-\d{8}$/, '');
  return base.split('-').map((w) => (/^\d/.test(w) ? w.replace(/-/g, '.') : w[0].toUpperCase() + w.slice(1)))
    .join(' ').replace(/(\d) (\d)/g, '$1.$2');
};

// The ONGOING view: once real tasks have been routed, how many landed in each band and what that
// saved vs sending them all to the frontier model. Driven entirely by measured receipts.
function renderDistribution(u) {
  if (!u || !u.tasks) return null;
  const frontierName = prettyModel(u.frontierModel);
  const tone = { mechanical: 'b-mech', cheap: 'b-cheap', mid: 'b-mid', frontier: 'b-front' };
  const dist = Array.isArray(u.distribution) ? u.distribution : [];
  const active = dist.filter((d) => d.tasks > 0);
  const frontierBand = dist.find((d) => d.band === 'frontier');
  const frontierIdle = !!frontierBand && !frontierBand.tasks;
  const saved = (u.frontierUsd != null && u.realizedUsd != null) ? u.frontierUsd - u.realizedUsd : null;

  // Verdict first: the money saved is the headline, everything else supports it.
  const hero = el('div', { class: 'dv-hero' },
    saved != null
      ? el('div', { class: 'dv-hero-num' }, fmtUsd(saved), el('span', { class: 'dv-hero-word' }, ' saved'))
      : null,
    el('p', { class: 'dv-hero-sub' },
      'across ', el('b', {}, u.tasks + ' routed ' + (u.tasks === 1 ? 'task' : 'tasks')),
      frontierIdle ? el('span', {}, ' · frontier never fired') : null,
      (frontierBand && frontierBand.tasks > 0)
        ? el('span', {}, ' · ' + frontierBand.tasks + ' escalated to ' + frontierName) : null),
    (u.frontierUsd != null && u.realizedUsd != null)
      ? el('p', { class: 'dv-hero-math' },
          frontierName + ' for everything would have cost ' + fmtUsd(u.frontierUsd) +
          ' — you actually spent ' + fmtUsd(u.realizedUsd) + '.')
      : null);

  // ONE continuous stacked bar — the mix in a single glance. Widths exactly
  // proportional to task counts (flex-grow), band colours carried by tone class.
  const bar = active.length
    ? el('div', {
        class: 'dv-bar', role: 'img',
        'aria-label': 'Task mix: ' + active.map((d) => `${d.label} ${d.pctOfTasks}%`).join(', '),
      },
      ...active.map((d) => el('div', {
        class: 'dv-seg ' + tone[d.band],
        style: 'flex:' + d.tasks + ' 1 0%',
        title: `${d.label} — ${d.tasks} ${d.tasks === 1 ? 'task' : 'tasks'} (${d.pctOfTasks}%)` +
          (d.savedUsd > 0 ? ` · saved ${fmtUsd(d.savedUsd)}` : ''),
      },
        d.pctOfTasks >= 15 ? el('span', { class: 'dv-seg-lab' }, `${d.label} ${d.pctOfTasks}%`) : null)))
    : null;

  // Compact legend: only bands that fired, each with its models + what it saved.
  const legendRows = active.map((d) => {
    const models = d.models.length
      ? d.models.map((m) => prettyModel(m.model) + (m.tasks > 1 ? ' ×' + m.tasks : '')).join(', ')
      : null;
    return el('div', { class: 'dv-leg-row' },
      el('span', { class: 'dv-dot ' + tone[d.band], 'aria-hidden': 'true' }),
      el('span', { class: 'dv-leg-band ' + tone[d.band] }, d.label),
      el('span', { class: 'dv-leg-meta cell-dim' },
        `${d.tasks} ${d.tasks === 1 ? 'task' : 'tasks'} · ${d.pctOfTasks}%` + (models ? ' — ' + models : '')),
      el('span', { class: 'dv-leg-saved num' }, d.savedUsd > 0 ? 'saved ' + fmtUsd(d.savedUsd) : ''));
  });
  // Frontier at zero is the punchline, not missing data — say so where its row would be.
  if (frontierIdle) {
    legendRows.push(el('div', { class: 'dv-leg-row dv-leg-punch' },
      el('span', { class: 'dv-check', 'aria-hidden': 'true' }, '✓'),
      el('span', { class: 'dv-leg-band b-front' }, frontierBand.label),
      el('span', { class: 'dv-leg-meta cell-dim' },
        el('b', {}, 'never fired'), ' — escalation is last resort by design'),
      el('span', { class: 'dv-leg-saved num' }, '')));
  }

  return el('div', { class: 'mh-dist dv-wrap' },
    hero, bar,
    el('div', { class: 'dv-legend' }, ...legendRows),
    el('p', { class: 'fineprint' }, u.note));
}

// WP2d — what we detected on YOUR machine, as chips. Each chip clicks through to the
// setting that already owns the choice (no second provider-switching mechanism).
function renderProviders(sv) {
  const re = sv && sv.routerEngine;
  if (!re) return null;
  // House = the provider whose models this user's subscription covers (from the engine's own pool).
  const covered = (re.pool || []).find((p) => p.subscriptionCovered);
  const HOUSE_NAME = { anthropic: 'Claude Max', openai: 'ChatGPT', codex: 'Codex', google: 'Gemini', xai: 'Grok' };
  const house = { provider: covered ? covered.provider : null };
  const houseName = HOUSE_NAME[house.provider] || 'Your stack';
  const chipBtn = (on, boldPart, rest, target, tip) => el('button', {
    class: `prov-chip ${on ? 'on' : 'dim'}`, type: 'button', title: tip,
    onclick: () => jumpToSetting(target),
  },
    el('span', { class: 'pc-dot', 'aria-hidden': 'true' }),
    el('span', {}, el('b', {}, boldPart), rest));
  const chips = [
    chipBtn(true, houseName, ' — main model on your subscription ($0 extra)', 'provider',
      'Your model house — change it in Settings'),
    (re.keys && re.keys.openrouter)
      ? chipBtn(true, 'OpenRouter key', ' — cheap models live', 'openrouterKey',
          'Your OpenRouter key — manage it in Settings')
      : chipBtn(false, 'OpenRouter key', ' — not detected', 'openrouterKey',
          'Paste a key in Settings to light up the cheap lane'),
  ];
  for (const [id, label] of [['openai', 'OpenAI'], ['google', 'Gemini'], ['xai', 'Grok']]) {
    if (id === house.provider || chips.length >= 4) continue;
    chips.push(chipBtn(false, label, ' — not detected', 'provider',
      `If ${label} is your house, set it under “Your model house” in Settings`));
  }
  return el('div', { class: 'prov-strip' },
    el('span', { class: 'prov-lab' }, 'Your providers:'), ...chips);
}

function renderSavings(sv) {
  const body = $('#body-savings');
  const totals = sv && sv.totals;
  const util = sv && sv.utilization && sv.utilization.tasks ? sv.utilization : null;
  const receipts = sv && Array.isArray(sv.receipts) ? sv.receipts : [];

  // The pitch is the action — always shown, whether or not routing is on yet.
  const enableNote = el('span', { class: 'mh-enable-note', 'aria-live': 'polite' }, '');
  const enableBtn = el('button', { class: 'mh-enable', type: 'button' }, 'Turn on smart routing');
  enableBtn.addEventListener('click', async () => {
    enableBtn.disabled = true; enableNote.textContent = 'saving…';
    try {
      const { data } = await postJSON('/api/save-config', { values: { routing: 'auto' } });
      enableNote.textContent = data && data.ok ? 'On — MetaHarness now routes each task to the right model automatically.' : 'Saved.';
    } catch (e) {
      enableBtn.disabled = false;
      enableNote.textContent = 'Couldn’t save — turn it on under Settings.';
    }
  });
  // Stuart: "If you haven't ever seen MetaHarness, you have no idea what the word means, and you have
  // no idea what you should expect it to do. Saying 'do you want to use it or not' without any visual
  // explaining what it does is a little challenging." He is right — this card asked for a decision
  // before it earned understanding, and seven lines of prose is not how anyone learns a new word.
  // rUv called this exact risk in ADR-076: define the term in the first screen or it reads as jargon;
  // mitigation = the one-line gloss + the four-pillar framing. The diagram IS that mitigation, so the
  // paragraph it replaces is gone rather than sitting above it saying the same thing more slowly.
  const pitch = el('div', { class: 'mh-pitch' },
    el('p', { class: 'mh-lead' },
      el('b', {}, 'MetaHarness'), ' tunes everything wrapped around your model — the planning, the ',
      'context, the retries, which model each task goes to — and keeps only the changes that ',
      el('b', {}, 'measurably win'), '. The model itself never changes. rUv leaves it ',
      el('b', {}, 'off by default'), ' on purpose: he’d rather you choose it than have it forced on you.'),
    el('figure', { class: 'mh-diagram' },
      el('img', {
        // NOT lazy: at 6.5KB this saves nothing, and the card sits far enough down the page that the
        // lazy threshold never fires — the diagram simply never appeared. Verified: no network
        // request at all with loading="lazy", even after scrolling the card into view.
        src: 'assets/metaharness.svg', width: '900', height: '470',
        alt: 'MetaHarness: the model sits frozen at the centre while seven policy surfaces around it — '
           + 'planner, contextBuilder, reviewer, retryPolicy, toolPolicy, memoryPolicy and scorePolicy — '
           + 'are each mutated and measured. Four pillars run underneath: route, evolve, orchestrate, '
           + 'verify. Measured: 28.5% cheaper at 98.1% bar-compliance.',
      })),
    el('div', { class: 'mh-cta' }, enableBtn, enableNote));

  const blocks = [];
  const prov = renderProviders(sv);
  if (prov) blocks.push(prov);
  blocks.push(pitch);

  if (!util && !receipts.length) {
    setChips('chips-savings', [chip('nothing routed yet', 'wait')]);
    // WP2b — the first-run state is a confident promise, not an apology.
    blocks.push(el('div', { class: 'mh-empty' },
      el('p', { class: 'mh-empty-title' }, 'Nothing routed yet — that’s expected.'),
      el('p', { class: 'mh-empty-body' },
        'Turn it on, work normally for a week, then come back. You’ll see exactly what you saved by not sending everything to the most expensive frontier model — every number here will be a ',
        el('b', {}, 'real receipt'), ', never a projection.')));
    // Even before any task runs, show what the router WOULD choose per bucket — the plan is real.
    const rp0 = renderRouterEngine(sv && sv.routerEngine);
    if (rp0) blocks.push(rp0);
    body.replaceChildren(withIllo('savings', ...blocks));
    return;
  }

  // Headline numbers come from the measured utilization (recomputed vs the current frontier, Fable 5).
  const frontierName = util ? prettyModel(util.frontierModel) : 'the frontier';
  const pct = util ? util.pctSaved
    : (totals && totals.pctSaved != null ? totals.pctSaved
      : (totals && totals.baselineUsd ? Math.round((totals.usdSaved / totals.baselineUsd) * 100) : null));
  const savedUsd = util ? util.costOptimalitySaved : (totals ? totals.usdSaved : 0);
  const taskCount = util ? util.tasks : (totals ? totals.count : 0);

  setChips('chips-savings', [
    pct != null ? chip(`${pct}% saved`, 'green') : chip(`${fmtUsd(savedUsd)} saved`, 'green'),
    chip(`${fmtInt(taskCount)} routed`, 'grey'),
  ]);

  // The distribution hero states the same four numbers ($ saved, tasks, frontier-if-all, actual
  // spend) at a size you can read across the room, and the chip carries the %. Rendering the tiles
  // above it too would say $15.17 twice on one card — the "everything at the same weight" problem
  // this card was just rebuilt to fix, wearing a different hat. So the strip is now the FALLBACK:
  // it only appears when there are no receipts yet and the hero has nothing to say.
  const dist = renderDistribution(util);
  if (!dist) {
    blocks.push(el('div', { class: 'totals-strip' },
      el('div', { class: 'total-tile t-green' },
        el('div', { class: 'total-num' }, pct != null ? `${pct}%` : fmtUsd(savedUsd)),
        el('div', { class: 'total-lab' }, `saved vs ${frontierName}`)),
      el('div', { class: 'total-tile' },
        el('div', { class: 'total-num' }, fmtUsd(savedUsd)),
        el('div', { class: 'total-lab' }, '$ kept')),
      el('div', { class: 'total-tile' },
        el('div', { class: 'total-num' }, fmtInt(taskCount)),
        el('div', { class: 'total-lab' }, 'tasks routed')),
      el('div', { class: 'total-tile' },
        el('div', { class: 'total-num' }, util ? fmtUsd(util.frontierUsd) : (totals && totals.msSaved >= 0 ? fmtMs(totals.msSaved) : '—')),
        el('div', { class: 'total-lab' }, util ? `if all on ${frontierName}` : 'time saved'))));
  }

  // WP2a — provenance, worn openly: these numbers are receipts, not projections.
  const receiptCount = util ? util.tasks : (totals && totals.count != null ? totals.count : receipts.length);
  blocks.push(el('p', { class: 'prov-badge' },
    el('span', { class: 'prov-dot', 'aria-hidden': 'true' }),
    el('span', {}, 'real numbers — recomputed from your ',
      el('b', {}, `${fmtInt(receiptCount)} receipt${receiptCount === 1 ? '' : 's'}`),
      ', never projected')));

  // The distribution — how many tasks went to each bucket, and the saved-vs-frontier math.
  // (computed above, so the totals-strip can stand down when this hero is doing the talking)
  if (dist) blocks.push(dist);

  // Full receipt detail, collapsed so the summary stays clean for a first-time reader.
  if (receipts.length) {
    blocks.push(el('details', { class: 'mh-receipts' },
      el('summary', { class: 'rp-summary' },
        el('span', { class: 'rp-sum-t' }, 'Every routed task'),
        el('span', { class: 'rp-sum-s' },
          totals && totals.count > receipts.length
            ? `${fmtInt(totals.count)} measured receipts — showing the ${fmtInt(receipts.length)} newest`
            : `${fmtInt(receipts.length)} measured receipt${receipts.length === 1 ? '' : 's'} · newest first`),
        el('span', { class: 'rp-chev', 'aria-hidden': 'true' }, '›')),
      el('div', { class: 'scroll-x scroll-y' },
        el('table', { class: 'tb' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col' }, 'When'), el('th', { scope: 'col' }, 'Routed to'),
            el('th', { scope: 'col' }, 'Instead of'), el('th', { scope: 'col' }, 'Task'),
            el('th', { scope: 'col' }, 'Saved'))),
          el('tbody', {}, receipts.map((r) => el('tr', {},
            el('td', { class: 'cell-mono cell-dim' }, fmtDate(r.at)),
            el('td', { class: 'cell-mono' }, r.chosenTier || '—'),
            el('td', { class: 'cell-mono cell-dim' }, r.baselineTier || '—'),
            el('td', { class: 'cell-dim' }, (r.task && r.task.length > 60) ? r.task.slice(0, 58) + '…' : (r.task || '—')),
            el('td', { class: 'cell-mono num' }, fmtUsd(r.measuredUsd)),
          )))))));
  }

  // (sv.note used to render here as 11px fineprint — the provenance badge above replaced it.)

  const rp = renderRouterEngine(sv.routerEngine);
  if (rp) blocks.push(rp);

  body.replaceChildren(withIllo('savings', ...blocks));
}

/* --------------------------------------------------------- section 6: settings */

function renderSettings(cfg) {
  const body = $('#body-settings');
  if (!cfg || !Array.isArray(cfg.schema) || !cfg.schema.length) {
    setChips('chips-settings', [chip('no schema', 'grey')]);
    body.replaceChildren(el('p', { class: 'muted' }, 'No editable settings were received.'));
    return;
  }
  const values = cfg.values || {};
  setChips('chips-settings', [chip(`${cfg.schema.length} options`, 'grey'),
    cfg.exists === false ? chip('not created yet', 'wait') : null].filter(Boolean));

  const form = el('form', { class: 'settings-form', novalidate: true });
  const collectors = {}; // key → () => ({ include, value })
  const initial = {};
  let saveBtn;
  const resultSlot = el('div');

  function isDirty() {
    for (const [key, get] of Object.entries(collectors)) {
      const g = get();
      if (g.secret) { if (g.include) return true; continue; }
      if (g.value !== initial[key]) return true;
    }
    return false;
  }
  function refreshDirty() { if (saveBtn) saveBtn.disabled = !isDirty(); }

  for (const f of cfg.schema) {
    const labId = `lab-${f.key}`;
    const helpId = `help-${f.key}`;
    const ctl = el('div', { class: 'field-ctl' });

    if (f.type === 'secret' || f.secret) {
      const isSet = values[f.key] === true;
      let input = null;
      const buildInput = () => {
        input = el('input', {
          type: 'password', class: 'text-input', autocomplete: 'off',
          spellcheck: 'false', placeholder: isSet ? 'Enter a new key to replace it' : 'Enter key',
          'aria-labelledby': labId, 'aria-describedby': helpId,
          oninput: refreshDirty,
        });
        const showBtn = el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: () => {
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            showBtn.textContent = showing ? 'Show' : 'Hide';
          },
        }, 'Show');
        const row = el('div', { class: 'secret-input-row' }, input, showBtn);
        if (isSet) {
          row.append(el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button',
            onclick: () => { row.replaceWith(buildSetRow()); input = null; refreshDirty(); },
          }, 'Keep existing'));
        }
        return row;
      };
      const buildSetRow = () => el('div', { class: 'secret-set-row' },
        el('span', { class: 'chip tone-green secret-set', title: 'A value is stored; it is never sent to this page.' }, '•••• set'),
        el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', 'aria-describedby': helpId,
          onclick: (e) => { const r = buildInput(); e.currentTarget.parentElement.replaceWith(r); input.focus(); refreshDirty(); },
        }, 'Replace…'));
      ctl.append(isSet ? buildSetRow() : buildInput());
      collectors[f.key] = () => ({ secret: true, include: !!(input && input.value.trim()), value: input ? input.value.trim() : undefined });
    } else if (f.type === 'bool') {
      const input = el('input', { type: 'checkbox', 'aria-labelledby': labId, 'aria-describedby': helpId, onchange: refreshDirty });
      input.checked = values[f.key] === true;
      initial[f.key] = input.checked;
      ctl.append(el('label', { class: 'switch' }, input, el('span', { class: 'track', 'aria-hidden': 'true' })));
      collectors[f.key] = () => ({ include: true, value: input.checked });
    } else if (f.type === 'enum' && Array.isArray(f.options)) {
      const name = `seg-${f.key}`;
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': labId, 'aria-describedby': helpId });
      const inputs = [];
      for (const opt of f.options) {
        const input = el('input', { type: 'radio', name, value: opt, onchange: refreshDirty });
        input.checked = values[f.key] === opt;
        inputs.push(input);
        seg.append(el('label', {}, input, el('span', { class: 'seg-lab' }, segLabel(f.key, opt))));
      }
      if (!inputs.some((i) => i.checked) && inputs[0]) inputs[0].checked = true;
      initial[f.key] = inputs.find((i) => i.checked)?.value;
      ctl.append(seg);
      collectors[f.key] = () => ({ include: true, value: inputs.find((i) => i.checked)?.value });
    } else {
      const input = el('input', {
        type: 'text', class: 'text-input', 'aria-labelledby': labId, 'aria-describedby': helpId, oninput: refreshDirty,
      });
      input.value = values[f.key] != null && values[f.key] !== true ? String(values[f.key]) : '';
      initial[f.key] = input.value;
      ctl.append(input);
      collectors[f.key] = () => ({ include: true, value: input.value });
    }

    // WP4 — every row answers What / Why / How on click; unknown keys fall back to their help text.
    const beats = SETTING_INFO[f.key]
      || (f.help ? [{ k: 'What is this?', t: f.help }] : [{ k: 'What is this?', t: 'A RuvNet Brain option, stored in your settings file.' }]);
    form.append(el('div', { class: 'field', id: `field-${f.key}` },
      el('div', {},
        el('span', { class: 'field-label', id: labId }, f.label || f.key, infoBtn(f.label || f.key, beats)),
        f.help ? el('p', { class: 'field-help', id: helpId }, f.help) : el('span', { id: helpId })),
      ctl));
  }

  saveBtn = el('button', { class: 'btn btn-apply', type: 'submit', disabled: true }, 'Save settings');
  form.append(el('div', { class: 'save-row' },
    saveBtn,
    el('p', { class: 'save-note' },
      'Saves to ', el('code', {}, cfg.path || '~/.claude/ruvnet-brain/config.json'),
      ' in your user folder. It does not change how your computer runs anything else.')),
    resultSlot);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = {};
    for (const [key, get] of Object.entries(collectors)) {
      const g = get();
      if (g.include) out[key] = g.value; // untouched secrets are simply absent
    }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = 'Saving…';
    resultSlot.replaceChildren();
    try {
      const { status: code, data } = await postJSON('/api/save-config', { values: out });
      if (code === 403) {
        resultSlot.replaceChildren(el('div', { class: 'form-note n-err', role: 'alert' }, TOKEN_MSG));
      } else if (data && data.ok) {
        const undoBtn = data.undoToken ? el('button', {
          class: 'btn btn-undo btn-sm', type: 'button',
          onclick: async (ev) => {
            ev.currentTarget.disabled = true;
            const r = await postJSON('/api/undo', { undoToken: data.undoToken });
            resultSlot.replaceChildren(el('div', { class: `form-note ${r.data?.ok ? 'n-ok' : 'n-err'}`, role: 'status' },
              r.data?.ok
                ? 'Settings restored from the backup. Reload to see the restored values.'
                : 'Undo didn’t complete — the backup file still exists, nothing is lost.'));
          },
        }, 'Undo save') : null;
        resultSlot.replaceChildren(el('div', { class: 'form-note n-ok', role: 'status' },
          frag(BADGE_OK),
          el('div', { class: 'fn-body' },
            el('b', {}, 'Saved.'), ' Your choices are in ',
            el('span', { class: 'fn-path' }, cfg.path || 'your user folder'), '.',
            data.backup ? el('span', {}, ' Backup kept at ', el('span', { class: 'fn-path' }, data.backup), '.') : ''),
          undoBtn));
        for (const [key, get] of Object.entries(collectors)) {
          const g = get(); if (!g.secret) initial[key] = g.value;
        }
        announce('Settings saved.');
      } else {
        resultSlot.replaceChildren(el('div', { class: 'form-note n-err', role: 'alert' },
          'Save didn’t complete. Your file was not changed without its backup.'));
        refreshDirty();
      }
    } catch (err) {
      resultSlot.replaceChildren(el('div', { class: 'form-note n-err', role: 'alert' },
        `Couldn’t reach the console server: ${err.message || err}`));
      refreshDirty();
    }
    saveBtn.textContent = prev;
  });

  body.replaceChildren(withIllo('settings', form));
}

/* -------------------------------------------------- section 7: trust & provenance
   v3.3 preview (PROVE stage). One row is REAL today — the release bundle's published
   sha256, read live from the latest GitHub release — plus the install channel read from
   the plugin cache on disk. The SBOM and Advisor Mode rows are honest empty states: each
   says exactly what will fill it and when. Nothing here is placeholder data. */

const TRUST_INFO = {
  signature: [
    { k: 'What is this?', t: 'The sha256 fingerprint of the release bundle, published as its own asset on every GitHub release.' },
    { k: 'Why does it matter?', t: 'If your download’s fingerprint matches the published one, the bundle is byte-identical to what was released — nothing altered, nothing truncated.' },
    { k: 'How do I use it?', t: 'Run shasum -a 256 ruvnet-brain.zip on your download and compare. v3.3 adds a one-click local check right here.' },
  ],
  sbom: [
    { k: 'What is this?', t: 'A Software Bill of Materials — the complete, machine-readable list of every package inside the bundle.' },
    { k: 'Why does it matter?', t: 'You can see what’s in the box without unzipping it, and scanners can watch it for known vulnerabilities.' },
    { k: 'How does it help me?', t: 'v3.3 attaches a CycloneDX SBOM to every release; this row will then show its package count and digest, measured from the published asset.' },
  ],
  channel: [
    { k: 'What is this?', t: 'How your plugin updates: riding the latest release, or pinned to a version you chose.' },
    { k: 'Why does it matter?', t: 'This stack ships fast — latest keeps you current. Pinning holds a known-good release when you need repeatable builds.' },
    { k: 'How does it help me?', t: 'Read from your plugin cache on disk, never assumed. Version pinning ships in v3.3 — both choices will live on this row.' },
  ],
  advisor: [
    { k: 'What is this?', t: 'A coming mode switch. Full lets the console apply consent-gated, undoable fixes; Advisor makes every Apply button read-only — it shows the exact command and steps aside.' },
    { k: 'Why does it matter?', t: 'Some machines want eyes-only — work laptops, shared rigs, cautious first weeks. The right choice should be easy in both directions.' },
    { k: 'How does it help me?', t: 'Ships in v3.3. Today the switch is a preview — it changes nothing, and says so.' },
  ],
};

function trustRow({ name, info, coming, status, value }) {
  return el('div', { class: `trust-row${coming ? ' is-coming' : ''}` },
    el('span', { class: 'trust-name' }, name, infoBtn(name, info)),
    el('div', { class: 'trust-val' }, ...value),
    el('span', { class: 'trust-status' }, status));
}

function renderTrust(t) {
  const body = $('#body-trust');
  const rel = t.release || {};
  const ch = t.channel || {};
  const sb = t.sbom || {};
  const liveCount = (rel.ok ? 1 : 0) + (sb.present ? 1 : 0);

  setChips('chips-trust', [
    rel.ok ? chip('sha256 published ✓', 'green', 'The release bundle’s fingerprint is published and was read live this session')
           : chip('digest unreachable', 'warn', 'Couldn’t read the published digest this session'),
    sb.present ? chip(`SBOM · ${sb.componentCount} component${sb.componentCount === 1 ? '' : 's'} ✓`, 'green', 'A local CycloneDX SBOM was found and read live this session')
                : chip('SBOM — v3.3', 'coming', 'A CycloneDX SBOM ships with every release from v3.3'),
    ch.installed ? chip(ch.channel === 'pinned' ? 'pinned' : 'latest channel', 'cyan') : chip('no plugin install', 'grey'),
  ]);

  const rows = [];

  /* 1 · bundle signature — the one REAL measurement today */
  rows.push(trustRow({
    name: 'Bundle signature', info: TRUST_INFO.signature,
    status: rel.ok ? chip('published ✓', 'green') : chip('unreachable', 'warn'),
    value: rel.ok ? [
      el('p', {}, 'Latest release ', el('b', {}, rel.tag || '—'),
        rel.asset ? el('span', {}, ' · ', el('span', { class: 'cell-mono' }, rel.asset)) : '',
        rel.publishedAt ? ` · published ${fmtDate(rel.publishedAt)}` : ''),
      el('code', { class: 'trust-hash', title: 'sha256 of the release bundle, as published' }, rel.sha256 || ''),
      el('p', {}, 'Check your download against it: ', el('code', {}, 'shasum -a 256 ruvnet-brain.zip'),
        ' — the 64 characters must match exactly.'),
      rel.sig ? el('p', {}, 'A detached signature (', el('span', { class: 'cell-mono' }, '.sig'),
        ') ships alongside — one-click signature verification lands here in v3.3.') : null,
      el('span', { class: 'trust-src' }, 'read live · ', rel.source || 'github.com — latest release'),
    ] : [
      el('p', {}, 'Couldn’t reach GitHub this session', rel.error ? el('span', {}, ' (', el('span', { class: 'cell-mono' }, rel.error), ')') : '',
        ' — nothing is shown that wasn’t read. The digest is published on the latest release.'),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { trustSkeleton(); loadTrust(); } }, 'Try again'),
    ],
  }));

  /* 2 · SBOM — real once `npm run sbom` has been run locally; honest empty state until then */
  rows.push(trustRow({
    name: 'SBOM', info: TRUST_INFO.sbom, coming: !sb.present,
    status: sb.present ? chip(`${sb.componentCount} component${sb.componentCount === 1 ? '' : 's'}`, 'green') : chip('coming · v3.3', 'coming'),
    value: sb.present ? [
      el('p', {}, 'A ', el('b', {}, `CycloneDX ${sb.specVersion || ''}`.trim()), ' SBOM exists on this machine: ',
        el('b', {}, `${sb.componentCount} component${sb.componentCount === 1 ? '' : 's'}`),
        sb.mainComponent ? ` for ${sb.mainComponent}${sb.mainVersion ? `@${sb.mainVersion}` : ''}` : '',
        sb.generatedAt ? ` · generated ${fmtDate(sb.generatedAt)}` : ''),
      el('p', {}, 'This is the production dependency tree only (', el('code', {}, '--omit dev'),
        ') — the plugin and installer ship no other packages. Regenerate any time: ', el('code', {}, 'npm run sbom')),
      el('span', { class: 'trust-src' }, sb.path || 'sbom/ruvnet-brain.cdx.json'),
    ] : [
      el('p', {}, sb.error
        ? `Found sbom/ruvnet-brain.cdx.json but couldn’t read it (${sb.error}).`
        : 'Not generated yet on this machine — nothing to show, so nothing is shown.'),
      el('p', {}, 'Run ', el('code', {}, 'npm run sbom'),
        ' to produce a CycloneDX SBOM of the shipped dependency tree right now. From ', el('b', {}, 'v3.3'),
        ' every published release carries one too, measured from the release asset itself.'),
    ],
  }));

  /* 3 · install channel — read from the plugin cache on disk */
  rows.push(trustRow({
    name: 'Install channel', info: TRUST_INFO.channel,
    status: ch.installed ? chip(ch.channel === 'pinned' ? 'pinned' : 'latest', 'cyan') : chip('not found', 'grey'),
    value: ch.installed ? [
      el('p', {}, el('b', {}, ch.channel === 'pinned' ? 'Pinned' : 'Latest'),
        ch.channel === 'pinned'
          ? ' — held at a version you chose.'
          : ' — auto-updates from GitHub, so you ride each release as it ships.'),
      el('p', {}, 'On disk right now: ', el('b', {}, `v${ch.version || '?'}`),
        ch.lastUpdated ? ` · updated ${fmtDate(ch.lastUpdated)}` : ''),
      el('span', { class: 'trust-src' }, ch.cacheDir || ''),
      ch.channel !== 'pinned' ? el('p', { style: 'margin-top:6px' },
        'Prefer to hold a known-good release? ', el('b', {}, 'Version pinning arrives in v3.3'),
        ' — you’ll choose it right here.') : null,
    ] : [
      el('p', {}, 'No plugin-cache install found on this machine — you may be running from a repo checkout. ',
        'This row reads ', el('span', { class: 'cell-mono' }, '~/.claude/plugins'), ', never guesses.'),
    ],
  }));

  /* 4 · advisor mode — display-only preview, clearly labeled */
  const advNote = el('p', { class: 'adv-note' },
    'Full is on: every change stays consent-gated, with its undo recorded first. The switch itself goes live in v3.3 — today it’s a preview and changes nothing.');
  const advisorBtn = el('button', {
    class: 'adv-opt', type: 'button',
    title: 'Preview — Advisor Mode ships in v3.3; clicking changes nothing today',
    onclick: () => {
      advNote.textContent = 'Advisor Mode arrives in v3.3 — nothing changed just now. When it lands, this switch makes every Apply button read-only: the console shows the exact command and steps aside.';
    },
  }, el('span', { class: 'pc-dot', 'aria-hidden': 'true' }), 'Advisor — read-only');
  rows.push(trustRow({
    name: 'Advisor Mode', info: TRUST_INFO.advisor,
    status: chip('preview', 'coming'),
    value: [
      el('div', { class: 'adv-seg' },
        el('button', { class: 'adv-opt on', type: 'button', title: 'Your current behavior — consent-gated changes with undo' },
          el('span', { class: 'pc-dot', 'aria-hidden': 'true' }), 'Full — recommended'),
        advisorBtn,
        el('span', { class: 'preview-tag' }, 'preview · v3.3')),
      advNote,
    ],
  }));

  body.replaceChildren(
    el('p', { class: 'lead-stat' },
      'Provenance you can check, not take on faith — ', el('b', {}, String(liveCount)),
      ` measurement${liveCount === 1 ? ' is' : 's are'} live today; the rest of this card names exactly what v3.3 will measure.`),
    el('div', { class: 'trust-list', 'data-trust-ready': '1' }, ...rows),
  );
}

function trustSkeleton() {
  $('#body-trust').replaceChildren(
    frag('<div class="skeleton" aria-hidden="true"><div class="sk-bar w45"></div><div class="sk-bar w70"></div></div>'),
    el('p', { class: 'loading-note' },
      'Reading the published release fingerprint from GitHub (read-only metadata — the one network touch this card makes) and your plugin cache on disk.'));
  setChips('chips-trust', [chip('checking…', 'wait')]);
}

async function loadTrust() {
  try {
    const t = await getJSON('/api/trust');
    renderTrust(t);
  } catch (err) {
    setChips('chips-trust', [chip('unavailable', 'grey')]);
    inlineError('body-trust', String(err.message || err), () => { trustSkeleton(); loadTrust(); });
  }
}

/* ------------------------------------------------------------------ loaders */

async function loadState() {
  try {
    // Instant first paint from the last good gather, honestly stamped by renderHost's generatedAt —
    // then the live gather replaces it. The fleet-wide memory scan makes the live call slow, so
    // without this the page sits blank long enough to read as broken. Recommendations come from the
    // live call only (same rule as loadStack) so nothing is added twice.
    try {
      const fast = await getJSON('/api/state?fast=1');
      if (fast && fast.fromCache && fast.sections) {
        const c = fast.sections;
        renderHost(fast.host, fast.generatedAt);
        renderWiring(c.wiring);
        lastMemory = c.memory;
        renderMemory(c.memory);
        renderSavings(c.savings);
        renderSettings(c.config);
        renderGates(c.gates);
        dismissStandby();
      }
    } catch { /* no cache yet — the skeleton narration carries the wait */ }
    const state = await getJSON('/api/state');
    preStateHash = state.preStateHash ?? state.generatedAt ?? null;
    $('#global-error').hidden = true;
    renderHost(state.host, state.generatedAt);
    const s = state.sections || {};
    renderWiring(s.wiring);
    lastMemory = s.memory;
    renderMemory(s.memory);
    renderSavings(s.savings);
    renderSettings(s.config);
    renderGates(s.gates);
    addRecommendations(s.recommendations, 'state');
    recsSettled('state', true);
    dismissStandby(); // first cards are hydrated — the standby line has done its job
    void loadMemoryFleet(); // 100+ stores at ~90ms each — lands after the page is already usable
  } catch (err) {
    dismissStandby(); // don't say "stand by" over an error banner
    showGlobalError(err);
    const retry = () => loadState();
    inlineError('body-wiring', String(err.message || err), retry);
    inlineError('body-memory', String(err.message || err), retry);
    inlineError('body-savings', String(err.message || err), retry);
    inlineError('body-settings', String(err.message || err), retry);
    for (const id of ['chips-wiring', 'chips-memory', 'chips-savings', 'chips-settings']) {
      setChips(id, [chip('unavailable', 'grey')]);
    }
    recsSettled('state', false);
  }
}

// The across-your-projects fleet list opens every memory store on the machine. It is the single
// slowest thing the console does, so it is fetched on its own and merged into the memory card once
// it lands — the health score and everything else are already on screen by then.
/* ------------------------------------------------- what caught Claude (the gates + their receipts) */

// The verdict is the headline, never the inventory. "21 hooks are configured" is a census; "6 of them
// can stop a tool call, and here is what they stopped" is the point. An empty ledger says so plainly —
// it is the one number on this page that must never be guessed, because the whole claim rests on it.
function renderGates(g) {
  const body = $('#body-gates');
  if (!g || !g.summary) {
    setChips('chips-gates', [chip('no data', 'grey')]);
    body.replaceChildren(el('p', { class: 'muted' }, 'No gate data received.'));
    return;
  }
  const s = g.summary;
  const caught = s.caughtTotal || 0;
  setChips('chips-gates', [
    chip(`${s.blocking} can block`, caught ? 'green' : 'cyan'),
    chip(caught ? `${caught} caught` : 'nothing caught yet', caught ? 'green' : 'grey'),
  ]);

  const main = [];
  main.push(el('p', { class: 'lead-stat' },
    'Every move your AI makes here is read first. ', el('b', {}, String(s.armed)),
    ' gates are armed — ', el('b', {}, String(s.blocking)),
    ' of them can stop a tool call before it touches your machine. The other ',
    el('b', {}, String(s.advisory)), ' add context without ever blocking.'));

  if (caught) {
    // Deliberately NOT the .wire-lane grid: its fixed columns are sized for (count, label, meaning)
    // and fling a gate name and its subject to opposite sides of a dead gap. A catch is a sentence —
    // who stopped what, and why — so it reads as one.
    main.push(el('ul', { class: 'gate-catches' },
      ...g.catches.map((c) => el('li', {},
        el('b', {}, c.gate || 'gate'),
        ' stopped ', el('b', {}, c.subject || 'a call'),
        ' — ', el('span', { class: 'cell-dim' }, c.reason || ''),
        c.at ? el('span', { class: 'cell-dim' }, ' · ' + new Date(c.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''))));
  } else {
    // Honest empty state. The gates only started writing receipts on 2026-07-17; saying "0 blocks"
    // as though it were a measured safety record would be a lie of omission.
    main.push(el('p', { class: 'cell-dim' },
      'Nothing caught yet. The gates began recording every refusal on 17 Jul — from here on, each ',
      'time one stops your AI, the reason lands on this card. Silence here means silence, not proof.'));
  }

  if (Array.isArray(s.duplicated) && s.duplicated.length) {
    main.push(el('p', { class: 'cell-dim' },
      '⚠ ', el('b', {}, s.duplicated.join(', ')),
      s.duplicated.length > 1 ? ' are wired twice' : ' is wired twice',
      ' — once machine-wide and once by the plugin, so they run twice on every matching call. ',
      'Harmless, but it is duplicated work.'));
  }
  body.replaceChildren(...main);
}

async function loadMemoryFleet() {
  try {
    const m = await getJSON('/api/memory');
    if (m && Array.isArray(m.fleet) && lastMemory) {
      lastMemory = { ...lastMemory, fleet: m.fleet };
      renderMemory(lastMemory);
    }
  } catch { /* the fleet list is a bonus — memory health is already rendered */ }
}

async function loadStack({ skipCache = false } = {}) {
  try {
    // Instant first paint from the last good audit, honestly labeled — then the live re-check
    // replaces it. skipCache=true (used right after an apply/undo) goes straight to the live
    // audit so the page shows the AFTER state, never the stale before.
    if (!skipCache) {
      try {
        const fast = await getJSON('/api/stack?fast=1');
        if (fast && fast.fromCache && Array.isArray(fast.packages)) {
          renderStack(fast);
          const when = fast.cachedAt ? new Date(fast.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier';
          setChips('chips-stack', [chip(`as of ${when}`, 'cyan'), chip('re-checking…', 'wait')]);
        }
      } catch { /* no cache yet — the skeleton narration carries the wait */ }
    }
    const stack = await getJSON('/api/stack');
    renderStack(stack);
    addRecommendations(stack.recommendations, 'stack');
    recsSettled('stack', true);
  } catch (err) {
    if (stackTicker) { clearInterval(stackTicker); stackTicker = null; }
    setChips('chips-stack', [chip('couldn’t audit', 'grey')]);
    inlineError('body-stack', String(err.message || err), () => { stackSkeleton(); loadStack(); });
    recsSettled('stack', false);
  }
}

/* ------------------------------------------------------------------- mock ---
   Development-only fixtures matching console/CONTRACT.md exactly.
   Active ONLY with ?mock=1 in the URL — never the default. */

const MOCK_STATE = {
  token: 'mock', generatedAt: new Date().toISOString(),
  preStateHash: 'mock-hash-1',
  host: { user: 'stuartkerr', platform: 'darwin', node: 'v22.14.0', npmPrefix: '~/.npm-global' },
  sections: {
    wiring: {
      summary: { npx: 190, global: 12, mcp: 6, plugin: 5, projectsWithNpx: 16 },
      sites: [
        { scope: 'project', project: 'ruvnet-brain', file: '.claude/settings.json', event: 'PreToolUse', matcher: 'Bash', spec: 'npx @claude-flow/cli@latest hooks pre-command', mechanism: 'NPX' },
        { scope: 'project', project: 'ruvnet-brain', file: '.claude/settings.json', event: 'PostToolUse', matcher: 'Write|Edit', spec: 'npx @claude-flow/cli@latest hooks post-edit', mechanism: 'NPX' },
        { scope: 'project', project: 'PowerPlatePulse', file: '.claude/settings.json', event: 'PreToolUse', matcher: 'Bash', spec: 'npx claude-flow@alpha hooks pre-command', mechanism: 'NPX' },
        { scope: 'global', file: '~/.claude/settings.json', event: 'SessionStart', matcher: '.*', spec: '~/.npm-global/bin/ruflo hooks session-start', mechanism: 'GLOBAL_BINARY' },
      ],
    },
    memory: {
      fleet: [
        { name: 'ruvnet-brain', total: 1023, embedded: 1021, coverPct: 99.8, patterns: 456, learns: true, findings: [] },
        { name: 'PowerPlatePulse', total: 214, embedded: 214, coverPct: 100, patterns: 88, learns: true, findings: ['no checkpoint yet'] },
      ],
      health: {
        project: 'ruvnet-brain', score: 92, summary: 'learns; recall-quality not probed',
        dimensions: [
          { key: 'liveness', label: 'Liveness', status: 'ok', detail: 'store→search round-trip works on the live path', deduction: 0 },
          { key: 'coverage', label: 'Coverage', status: 'ok', detail: 'checkpoint present, <1d old', deduction: 0 },
          { key: 'recallQuality', label: 'Recall quality', status: 'notTested', detail: 'no embedding round-trip run this session', deduction: 0 },
          { key: 'compactionSurvival', label: 'Compaction survival', status: 'warn', detail: 'last PreCompact snapshot is 9 days old', deduction: 8 },
          { key: 'sessionSurfacing', label: 'Session surfacing', status: 'ok', detail: 'SessionStart hook surfaces state', deduction: 0 },
        ],
        notTested: ['recallQuality'],
      },
    },
    savings: {
      totals: { count: 3, usdSaved: 0.42, msSaved: 18400 },
      note: 'receipts only — no modelled or projected savings',
      utilization: {
        frontierModel: 'claude-fable-5', tasks: 3, unpriced: 0,
        realizedUsd: 0.24, frontierUsd: 1.10, costOptimalitySaved: 0.86, pctSaved: 78,
        distribution: [
          { band: 'mechanical', label: 'Mechanical', tasks: 0, pctOfTasks: 0, realizedUsd: 0, frontierUsd: 0, savedUsd: 0, models: [] },
          { band: 'cheap', label: 'Cheap', tasks: 2, pctOfTasks: 67, realizedUsd: 0.05, frontierUsd: 0.50, savedUsd: 0.45, models: [{ model: 'claude-haiku-4.5', tasks: 2 }] },
          { band: 'mid', label: 'Mid', tasks: 1, pctOfTasks: 33, realizedUsd: 0.19, frontierUsd: 0.60, savedUsd: 0.41, models: [{ model: 'claude-sonnet-5', tasks: 1 }] },
          { band: 'frontier', label: 'Frontier', tasks: 0, pctOfTasks: 0, realizedUsd: 0, frontierUsd: 0, savedUsd: 0, models: [] },
        ],
        note: 'Offline demo — the live console recomputes this from your real receipts.',
      },
      receipts: [
        { at: '2026-07-13T14:20:00Z', capability: 'model-routing', task: 'changelog summarization', chosenTier: 'claude-haiku-4.5', baselineTier: 'claude-fable-5', measuredMs: 4200, measuredUsd: 0.14 },
        { at: '2026-07-13T15:02:00Z', capability: 'model-routing', task: 'commit message drafts', chosenTier: 'claude-haiku-4.5', baselineTier: 'claude-sonnet-5', measuredMs: 6100, measuredUsd: 0.09 },
        { at: '2026-07-14T09:41:00Z', capability: 'agentic-qe', task: 'regression triage', chosenTier: 'claude-sonnet-5', baselineTier: 'claude-fable-5', measuredMs: 8100, measuredUsd: 0.19 },
      ],
    },
    config: {
      path: '~/.claude/ruvnet-brain/config.json', exists: true,
      values: { openrouterKey: true, nightly: true, routing: 'auto', qeFleet: false },
      schema: [
        { key: 'openrouterKey', label: 'OpenRouter API key', type: 'secret', help: 'Unlocks cheap-model routing + the self-improvement loop', secret: true },
        { key: 'nightly', label: 'Nightly brain refresh', type: 'bool', help: 'Rebuild the KB from pinned SHAs overnight' },
        { key: 'routing', label: 'Token-smart routing', type: 'enum', options: ['auto', 'off'], help: 'Route cheap tasks to smaller models' },
        { key: 'qeFleet', label: 'On-demand QE fleet', type: 'bool', help: 'Agentic-QE test fleet, spun up on request' },
      ],
    },
    recommendations: [
      {
        id: 'save-preferences', title: 'Remember that you keep npx in helix-experiments on purpose',
        rationale: 'You told us this once — recording it stops us re-suggesting it forever.',
        severity: 'INFO', touchesMachine: false,
        evidence: [{ observed: '12 npx sites in helix-experiments marked "intentional" on 2026-07-10', source: 'operator-profile statedPreferences' }],
        cost: { time: '~0s', latency: 'none', usd: 0, risk: 'low' },
        change: { kind: 'write-config', human: 'record the preference in your RuvNet-Brain settings file' },
        undo: { kind: 'restore-file', human: 'the previous settings file is backed up and restorable' },
      },
    ],
  },
};

const MOCK_STACK = {
  packages: [
    { name: 'ruflo', installed: '3.30.2', target: '3.30.2', tag: 'alpha', state: 'CURRENT' },
    { name: '@ruvector/rvf', installed: '0.2.3', target: '0.2.3', tag: 'latest', state: 'CURRENT' },
    { name: 'agentic-flow', installed: '1.9.1', target: '1.8.4', tag: 'latest', state: 'AHEAD' },
    { name: '@ruvector/edge-net', installed: null, target: '0.4.0', tag: 'latest', state: 'BROKEN' },
    { name: 'agentdb', installed: '3.0.0-alpha.17', target: '3.0.0-alpha.19', tag: 'alpha', state: 'BEHIND' },
    { name: 'qudag-cli', installed: '0.7.2', target: null, tag: 'latest', state: 'UNRESOLVED' },
  ],
  shadows: [
    { name: '@ruvector/rvf', version: '0.1.9', global: '0.2.3', dir: '~/.npm/_npx/a1b2c3d4e5f6/node_modules/@ruvector/rvf', stale: true },
    { name: 'claude-flow', version: '2.7.0', global: '2.7.0', dir: '~/.npm/_npx/f6e5d4c3b2a1/node_modules/claude-flow', stale: false },
  ],
  summary: { total: 6, behind: 1, broken: 1, ahead: 1, current: 2, shadows: 2, stale: 1 },
  recommendations: [
    {
      id: 'sync-stack', title: 'Sync 1 stale shadow of @ruvector/rvf',
      rationale: 'A second copy in the npx cache preempts your global binary and quietly serves 0.1.9.',
      severity: 'IMPORTANT', touchesMachine: true,
      plainImpact: 'This removes an extra, out-of-date copy of a tool sitting in a temporary folder on your computer. Your main copy is newer and stays untouched. Nothing you use will stop working — the temporary copy rebuilds itself automatically the next time it’s needed. Fully reversible.',
      evidence: [{ observed: '@ruvector/rvf@0.1.9 in ~/.npm/_npx while global is 0.2.3', source: 'stack-sync findShadows' }],
      cost: { time: '~0s', latency: 'none', usd: 0, risk: 'low' },
      change: { kind: 'run-script', human: 'purge the stale npx shadow', cmd: 'node scripts/stack-sync.mjs --sync' },
      undo: { kind: 'restore-dir', human: 'npx re-resolves on next use; backup kept at <dir>.bak-<ts>' },
    },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockGet(url) {
  if (url === '/api/state') { await sleep(250); return structuredClone(MOCK_STATE); }
  if (url === '/api/stack') { await sleep(2400); return structuredClone(MOCK_STACK); }
  throw new Error(`no mock for ${url}`);
}

async function mockPost(url, body) {
  await sleep(850);
  if (url === '/api/apply') {
    return { status: 200, ok: true, data: { results: (body.ids || []).map((id) => ({
      id, ok: true, undoToken: `undo-${id}`,
      log: `[stack-sync] backup: ~/.npm/_npx/a1b2c3d4e5f6 → ~/.npm/_npx/a1b2c3d4e5f6.bak-1752500000\n[stack-sync] purged stale shadow @ruvector/rvf@0.1.9\n[stack-sync] verified: global 0.2.3 now answers`,
    })) } };
  }
  if (url === '/api/save-config') {
    return { status: 200, ok: true, data: { ok: true, backup: '~/.claude/ruvnet-brain/config.json.bak-1752500000', undoToken: 'undo-config-1' } };
  }
  if (url === '/api/undo') return { status: 200, ok: true, data: { ok: true } };
  return { status: 404, ok: false, data: {} };
}

/* -------------------------------------------------------------------- init */

initTheme();
loadState();
loadStack();
loadTrust();
$('#recheck-btn')?.addEventListener('click', () => recheckMachine());

// Stack card leads (Stuart 2026-07-16): expand immediately on a true first visit so newcomers
// watch it populate; afterwards only real drift opens it (renderStack). A manual toggle by the
// user wins over both — mark it so the auto-open never fights a deliberate collapse.
{
  const sc = $('#card-stack');
  if (sc) {
    sc.querySelector('summary')?.addEventListener('click', () => { sc.dataset.userToggled = '1'; });
    if (!localStorage.getItem('rvbc-seen')) sc.open = true;
  }
}
