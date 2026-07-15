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

function updateFoundStrip() {
  const strip = $('#found-strip');
  if (!strip || !found.host) return;
  const bits = [];
  if (found.pkgTotal != null) {
    bits.push(el('span', {}, el('b', {}, fmtInt(found.pkgTotal)), ' packages on your global stack',
      found.pkgCurrent != null ? el('span', {}, ' (', el('b', {}, fmtInt(found.pkgCurrent)), ' current)') : ''));
  }
  if (found.npx != null) {
    bits.push(el('span', {}, el('b', {}, fmtInt(found.npx)), ' npx call sites across ',
      el('b', {}, fmtInt(found.projects ?? 0)), ' projects',
      found.projectNames?.length
        ? el('span', {}, ' — ', el('span', { class: 'fs-path' }, found.projectNames.slice(0, 2).join(', ')),
            found.projectNames.length > 2 ? ` +${found.projectNames.length - 2} more` : '')
        : ''));
  }
  if (found.memScore != null) {
    bits.push(el('span', {}, 'memory quality ', el('b', {}, `${found.memScore}/100`)));
  }
  strip.replaceChildren(
    el('span', {}, 'We looked around ', el('b', {}, found.host), '’s machine: '),
    ...bits.flatMap((b, i) => (i ? [' · ', b] : [b])),
    el('span', {}, '. Every number below traces to something we actually observed.'),
  );
  strip.hidden = false;
}

/* ------------------------------------------------------------- section 0: host */

function renderHost(host, generatedAt) {
  if (host && host.user) {
    found.host = `${host.user}@${host.platform || '?'}`;
    const hc = $('#host-chip');
    if (hc) { hc.textContent = found.host; hc.hidden = false; }
    const meta = $('#host-meta');
    if (meta) {
      meta.replaceChildren(
        el('span', {}, 'user ', el('b', {}, host.user)),
        el('span', {}, 'platform ', el('b', {}, host.platform || '—')),
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
      'Auditing your installed packages against the registry — this one touches the network and usually takes 5–20 seconds.'),
  );
  setChips('chips-stack', [chip('checking…', 'wait')]);
}

function pkgRow(p) {
  const st = STATE_ORDER[p.state] != null ? p.state : 'UNRESOLVED';
  return el('tr', {},
    el('td', { class: 'cell-name' }, p.name || '—'),
    el('td', { class: 'cell-mono' },
      p.installed != null ? p.installed : el('span', { style: 'color:var(--red-text)' }, 'unreadable')),
    el('td', { class: 'cell-mono' }, p.target ?? '—'),
    el('td', { class: 'cell-mono cell-dim' }, p.tag ?? '—'),
    el('td', {}, chip(st, STATE_TONE[st], STATE_TITLE[st])),
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

function familyRow(fam) {
  const tone = fam.attention ? 'warn' : 'green';
  const statusText = fam.attention ? `${fam.attention} need${fam.attention === 1 ? 's' : ''} a look` : 'current';
  const count = fam.items.length;
  return el('details', { class: 'fam' },
    el('summary', { class: 'fam-sum' },
      el('span', { class: 'fam-name' }, fam.name),
      el('span', { class: 'fam-what' }, fam.what),
      el('span', { class: 'fam-status' }, chip(statusText, tone),
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
        ? `${fmtInt(attention.length)} package${attention.length === 1 ? '' : 's'} need a look — open the tool below to see which.`
        : 'Nothing needs attention — every package matches its target, one copy each.'));
    main.push(el('div', { class: 'fam-list' }, groupFamilies(pkgs).map(familyRow)));
  } else {
    main.push(el('p', { class: 'muted' }, 'No stack packages detected on this machine yet.'));
  }

  if (shadows.length) {
    main.push(el('aside', { class: 'shadows' },
      el('p', { class: 'shadows-title' }, 'Shadow copies in the npx cache', chip(`${shadows.length}`, 'cyan')),
      el('p', { class: 'shadows-sub' },
        'npx keeps private copies in ', el('code', {}, '~/.npm/_npx'),
        '. A stale one can quietly answer instead of your newer global install — every command still “works”, which is exactly why it’s invisible.'),
      shadows.map((s) => el('div', { class: 'shadow-row' },
        el('span', { class: 'shadow-name' }, s.name || '—'),
        el('span', { class: 'shadow-vers' }, `${s.version ?? '?'} in cache · global `, el('b', {}, s.global ?? '?')),
        s.stale ? chip('stale', 'warn') : chip('in sync', 'green'),
        el('span', { class: 'shadow-dir' }, s.dir || ''),
      ))));
  }

  body.replaceChildren(withIllo('stack', ...main));
}

/* ----------------------------------------------------------- section 2: wiring */

const MECH_LABEL = { NPX: 'npx', GLOBAL_BINARY: 'global', PLUGIN: 'plugin', MCP: 'mcp' };

function renderWiring(w) {
  const body = $('#body-wiring');
  if (!w) {
    setChips('chips-wiring', [chip('no data', 'grey')]);
    body.replaceChildren(el('p', { class: 'muted' }, 'No wiring data received.'));
    return;
  }
  const s = w.summary || {};
  const sites = Array.isArray(w.sites) ? w.sites : [];

  setChips('chips-wiring', [
    chip(`${fmtInt(s.npx ?? 0)} npx`, 'cyan'),
    chip(`${fmtInt(s.global ?? 0)} global`, 'grey'),
  ]);

  found.npx = s.npx ?? 0;
  found.projects = s.projectsWithNpx ?? 0;
  found.projectNames = [...new Set(sites.filter((x) => x.scope === 'project' && x.project).map((x) => x.project))];
  updateFoundStrip();

  const main = [];
  main.push(el('p', { class: 'lead-stat' },
    el('b', {}, fmtInt(s.npx ?? 0)), ' of your tool calls resolve via ', el('code', {}, 'npx'),
    ' across ', el('b', {}, fmtInt(s.projectsWithNpx ?? 0)), ' projects. ',
    el('b', {}, fmtInt(s.global ?? 0)), ' use a global binary, ',
    el('b', {}, fmtInt(s.mcp ?? 0)), ' an MCP server, and ',
    el('b', {}, fmtInt(s.plugin ?? 0)), ' a plugin.'));

  main.push(el('p', {},
    'Neither wiring is wrong — they trade differently. ', el('code', {}, 'npx'),
    ' re-resolves its own copy on every call: always available, but it adds startup latency each time and keeps a private copy that can drift from your global install. A global binary is one path, one version, verifiable at a glance. This is where each one is in use, so the choice stays yours.'));

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
    main.push(el('p', { class: 'muted' }, 'No resolution sites found — nothing is wired through hooks yet.'));
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
  let dropped = 0;
  for (const rec of Array.isArray(recs) ? recs : []) {
    if (!rec || rec.id == null || renderedRecIds.has(rec.id)) continue;
    // The DDD invariant, honored in the UI too: no evidence/cost/undo → not rendered.
    if (!Array.isArray(rec.evidence) || !rec.evidence.length || !rec.cost || !rec.undo) { dropped += 1; continue; }
    renderedRecIds.add(rec.id);
    list.append(buildRecCard(rec));
  }
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

function renderRouterProfiles(rp) {
  if (!rp || !rp.profiles) return null;
  const money = (v) => (v == null ? '—' : v === 0 ? '$0' : '$' + v + '/Mtok');
  const bandRow = (b) => el('tr', {},
    el('td', { class: 'rp-band' }, b.band),
    el('td', {}, el('div', { class: 'rp-model' }, prettyModel(b.model)), el('div', { class: 'rp-why' }, b.why)),
    el('td', { class: 'cell-mono cell-dim' }, b.effort + (b.effortSource === 'default' ? ' *' : '')),
    el('td', { class: 'cell-mono num' }, money(b.costPerMTok)),
  );
  const profileBlock = (name, p) => el('div', { class: 'rp-profile' },
    el('div', { class: 'rp-head' },
      el('span', { class: 'rp-name' }, name),
      el('span', { class: 'rp-obj' }, p.objective)),
    el('div', { class: 'scroll-x' },
      el('table', { class: 'tb rp-tb' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, 'Band'), el('th', { scope: 'col' }, 'Model'),
          el('th', { scope: 'col' }, 'Effort'), el('th', { scope: 'col' }, 'Cost'))),
        el('tbody', {}, p.bands.map(bandRow)))));
  const keyLine = rp.hasOpenRouterKey
    ? el('span', {}, 'OpenRouter key detected — the full measured range is in play.')
    : el('span', {}, 'No OpenRouter key yet — showing subscription-only picks. ',
        el('a', { class: 'rp-getkey', href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener' }, 'Create one →'));
  const bg = el('div', { class: 'rp-bg', 'aria-hidden': 'true' });
  bg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 180" fill="none"><g stroke="#5ad6ff" stroke-width="1.5" opacity="0.1"><path d="M24 92 C 130 92, 170 34, 300 34"/><path d="M24 92 C 130 92, 170 74, 300 74"/><path d="M24 92 C 130 92, 170 112, 300 112"/><path d="M24 92 C 130 92, 170 150, 300 150"/></g><circle cx="24" cy="92" r="5" fill="#f0a830" opacity="0.18"/><circle cx="300" cy="34" r="4" fill="#5ad6ff" opacity="0.16"/><circle cx="300" cy="74" r="4" fill="#5fd38a" opacity="0.16"/><circle cx="300" cy="112" r="4" fill="#5ad6ff" opacity="0.13"/><circle cx="300" cy="150" r="4" fill="#f0a830" opacity="0.13"/></svg>';
  const house = rp.house || {};
  const houseName = house.label || 'your stack';
  const houseLine = house.label ? el('div', { class: 'rp-house' },
    el('span', { class: 'rp-house-tag' }, 'Your house'),
    el('b', { class: 'rp-house-name' }, house.label),
    el('span', { class: 'rp-house-src' }, HOUSE_SOURCE_NOTE[house.source] || '')) : null;
  // When cross-provider routing is on, cheap/mid leave the house on purpose — say so, or it reads as a bug.
  const splitNote = rp.hasOpenRouterKey ? el('p', { class: 'rp-split' },
    'Your ', el('b', {}, 'frontier'), ' stays in your house. ', el('b', {}, 'Cheap & mid'),
    ' go to the cheapest capable model anywhere — that’s where the saving comes from — because your OpenRouter key is on. Without it, all three stay ',
    el('b', {}, houseName), '.') : null;
  return el('details', { class: 'mh-profiles' },
    el('summary', { class: 'rp-summary' },
      el('span', { class: 'rp-sum-t' }, 'See what it routes where'),
      el('span', { class: 'rp-sum-s' }, `tuned to ${houseName} · development vs production`),
      el('span', { class: 'rp-chev', 'aria-hidden': 'true' }, '›')),
    el('div', { class: 'rp-body' },
      bg,
      houseLine,
      splitNote,
      el('div', { class: 'rp-grid' },
        profileBlock('Development', rp.profiles.development),
        profileBlock('Production', rp.profiles.production)),
      el('p', { class: 'rp-foot fineprint' },
        `Frontier is your ${houseName} flagship — model ids live-verified against the OpenRouter catalog${rp.catalogAsOf ? ' (' + rp.catalogAsOf + ')' : ''}, ranked by Artificial Analysis + Arena. Effort marked * is a default (high; xhigh only for hard, verifiable work). `,
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
const prettyModel = (id) => id ? (MODEL_PRETTY[id] || String(id).split('/').pop()) : '—';

// The ONGOING view: once real tasks have been routed, how many landed in each band and what that
// saved vs sending them all to the frontier model. Driven entirely by measured receipts.
function renderDistribution(u) {
  if (!u || !u.tasks) return null;
  const frontierName = prettyModel(u.frontierModel);
  const tone = { mechanical: 'b-mech', cheap: 'b-cheap', mid: 'b-mid', frontier: 'b-front' };
  const rows = u.distribution.map((d) => {
    const models = d.models.length
      ? d.models.map((m) => prettyModel(m.model) + (m.tasks > 1 ? ' ×' + m.tasks : '')).join(', ')
      : 'nothing here yet';
    // Bar = share of ALL tasks, so it reads directly against the "Share of tasks" header.
    const w = d.tasks ? Math.max(d.pctOfTasks, 4) : 0;
    return el('div', { class: 'dist-row' + (d.tasks ? '' : ' is-empty') },
      el('div', { class: 'dist-band ' + tone[d.band] }, d.label),
      el('div', { class: 'dist-track' },
        el('div', { class: 'dist-fill ' + tone[d.band], style: 'width:' + w + '%' }),
        el('span', { class: 'dist-count' }, d.tasks ? d.tasks + ' · ' + d.pctOfTasks + '%' : '0')),
      el('div', { class: 'dist-models cell-dim' }, models),
      el('div', { class: 'dist-saved num' }, d.savedUsd > 0 ? fmtUsd(d.savedUsd) : '—'));
  });
  return el('div', { class: 'mh-dist' },
    el('p', { class: 'dist-lead' },
      el('b', {}, u.tasks + (u.tasks === 1 ? ' task' : ' tasks')), ' routed so far. Sending every one to ',
      el('b', {}, frontierName), ' would have cost ', el('b', {}, fmtUsd(u.frontierUsd)),
      ' — you spent ', el('b', {}, fmtUsd(u.realizedUsd)), '.'),
    el('div', { class: 'dist-grid' },
      el('div', { class: 'dist-row dist-head' },
        el('div', { class: 'dist-band' }, 'Bucket'),
        el('div', { class: 'dist-track-head' }, 'Share of tasks'),
        el('div', { class: 'dist-models' }, 'Models used'),
        el('div', { class: 'dist-saved' }, 'Saved')),
      ...rows),
    el('p', { class: 'fineprint' }, u.note));
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
  const pitch = el('div', { class: 'mh-pitch' },
    el('p', { class: 'mh-lead' },
      el('b', {}, 'MetaHarness'),
      ' is one of the most powerful pieces of the stack — and rUv leaves it ',
      el('b', {}, 'off by default'),
      ' on purpose: he’d rather you choose it than have it forced on you. One of the things it does is ',
      el('b', {}, 'smart model routing'),
      ' — sending each prompt, and every sub-agent Ruflo spins up, to the cheapest model that’s genuinely good enough (escalating only when the work needs it), learning which model wins from your real results, across the providers you already pay for. Most people never turn it on. Here it’s one click — and yours to switch off anytime.'),
    el('div', { class: 'mh-cta' }, enableBtn, enableNote));

  const blocks = [pitch];

  if (!util && !receipts.length) {
    setChips('chips-savings', [chip('nothing measured yet', 'wait')]);
    blocks.push(el('div', { class: 'empty' },
      el('p', {}, 'No savings measured yet — and we won’t invent any. As routed tasks run, real receipts (never projections, never “up to”) appear here — with how many tasks landed in each bucket and what you saved versus the frontier model.')));
    // Even before any task runs, show what the router WOULD choose per bucket — the plan is real.
    const rp0 = renderRouterProfiles(sv.routerProfiles);
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

  // The distribution — how many tasks went to each bucket, and the saved-vs-frontier math.
  const dist = renderDistribution(util);
  if (dist) blocks.push(dist);

  // Full receipt detail, collapsed so the summary stays clean for a first-time reader.
  if (receipts.length) {
    blocks.push(el('details', { class: 'mh-receipts' },
      el('summary', { class: 'rp-summary' },
        el('span', { class: 'rp-sum-t' }, 'Every routed task'),
        el('span', { class: 'rp-sum-s' }, `${fmtInt(receipts.length)} measured receipt${receipts.length === 1 ? '' : 's'} · newest first`),
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

  if (sv.note) blocks.push(el('p', { class: 'fineprint savings-note' }, sv.note));

  const rp = renderRouterProfiles(sv.routerProfiles);
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

    form.append(el('div', { class: 'field' },
      el('div', {},
        el('span', { class: 'field-label', id: labId }, f.label || f.key),
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

/* ------------------------------------------------------------------ loaders */

async function loadState() {
  try {
    const state = await getJSON('/api/state');
    preStateHash = state.preStateHash ?? state.generatedAt ?? null;
    $('#global-error').hidden = true;
    renderHost(state.host, state.generatedAt);
    const s = state.sections || {};
    renderWiring(s.wiring);
    renderMemory(s.memory);
    renderSavings(s.savings);
    renderSettings(s.config);
    addRecommendations(s.recommendations, 'state');
    recsSettled('state', true);
  } catch (err) {
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

async function loadStack() {
  try {
    const stack = await getJSON('/api/stack');
    renderStack(stack);
    addRecommendations(stack.recommendations, 'stack');
    recsSettled('stack', true);
  } catch (err) {
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
