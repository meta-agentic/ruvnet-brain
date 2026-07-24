/* RuvNet Brain — How to use it (page two).
   Two behaviors, both progressive enhancement — with JS off the page reads exactly as before:
   1. The same theme toggle as the console (same 'rbc-theme' key, same data-theme mechanism).
   2. Collapsible sections (owner, 2026-07-24: the page "gets too overwhelming as a wall of
      text"). Every .depth.card collapses behind its own header; only the inventory — the
      section that IS the page — starts open. Open state persists per browser; a #hash
      deep-link always opens its target. */
(function () {
  'use strict';

  /* ── theme toggle (unchanged) ─────────────────────────────────────────────── */
  var KEY = 'rbc-theme';
  var btn = document.getElementById('theme-toggle');
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) { /* private mode is fine */ }
  }
  if (btn) {
    btn.addEventListener('click', function () {
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
  }

  /* ── collapsible sections ─────────────────────────────────────────────────── */
  var OPEN_KEY = 'rbc-tips-open';
  var DEFAULT_OPEN = ['inventory']; // the lead section IS the page; everything else waits
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.depth.card'));
  if (!sections.length) return;

  function savedOpen() {
    try {
      var raw = localStorage.getItem(OPEN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function persist() {
    try {
      var open = sections.filter(function (s) { return !s.classList.contains('is-collapsed'); })
        .map(function (s) { return s.id; });
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch (e) { /* private mode is fine */ }
  }

  function setOpen(sec, open) {
    sec.classList.toggle('is-collapsed', !open);
    var head = sec.querySelector(':scope > .depth-head');
    if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  var open = savedOpen() || DEFAULT_OPEN;
  sections.forEach(function (sec) {
    var head = sec.querySelector(':scope > .depth-head');
    if (!head || !sec.id) return;

    // Wrap EVERYTHING after the header — several sections carry an art <figure> as a sibling of
    // .depth-body, and a collapsed section that still shows its full-bleed art has not collapsed.
    // grid-template-rows animates the height without measuring it (no reflow jank).
    var dc = document.createElement('div'); dc.className = 'dc';
    var dci = document.createElement('div'); dci.className = 'dci';
    var after = [];
    var walk = head.nextElementSibling;
    while (walk) { after.push(walk); walk = walk.nextElementSibling; }
    if (!after.length) return;
    sec.appendChild(dc); dc.appendChild(dci);
    after.forEach(function (n) { dci.appendChild(n); });

    // The header is the disclosure control: chevron, ARIA, keyboard.
    var chev = document.createElement('span');
    chev.className = 'dc-chev';
    chev.setAttribute('aria-hidden', 'true');
    var svgNS = 'http://www.w3.org/2000/svg';
    var csvg = document.createElementNS(svgNS, 'svg'); csvg.setAttribute('viewBox', '0 0 24 24');
    var cpath = document.createElementNS(svgNS, 'path'); cpath.setAttribute('d', 'M6 9l6 6 6-6');
    csvg.appendChild(cpath); chev.appendChild(csvg);
    head.appendChild(chev);
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-controls', sec.id + '-body');
    dc.id = sec.id + '-body';
    sec.classList.add('dc-ready');

    function toggle() { setOpen(sec, sec.classList.contains('is-collapsed')); persist(); }
    head.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button')) return; // links in headers stay links
      toggle();
    });
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    setOpen(sec, open.indexOf(sec.id) !== -1);
  });

  // One small master switch, right-aligned above the first section.
  var all = document.createElement('p');
  all.className = 'dc-all';
  var allBtn = document.createElement('button');
  allBtn.type = 'button';
  function anyCollapsed() {
    return sections.some(function (s) { return s.classList.contains('is-collapsed'); });
  }
  function labelAll() { allBtn.textContent = anyCollapsed() ? 'expand all' : 'collapse all'; }
  allBtn.addEventListener('click', function () {
    var opening = anyCollapsed();
    sections.forEach(function (s) { setOpen(s, opening); });
    persist(); labelAll();
  });
  all.appendChild(allBtn);
  sections[0].parentNode.insertBefore(all, sections[0]);
  labelAll();
  sections.forEach(function (s) {
    var h = s.querySelector(':scope > .depth-head');
    if (!h) return;
    h.addEventListener('click', function () { setTimeout(labelAll, 0); });
    h.addEventListener('keydown', function () { setTimeout(labelAll, 0); });
  });

  // A #hash deep-link must always land on an OPEN section — from the console's cards, the
  // metaharness cross-reference, or a shared URL.
  function openHashTarget() {
    var id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    var sec = document.getElementById(id);
    if (sec && sec.classList.contains('depth')) { setOpen(sec, true); persist(); labelAll(); }
  }
  window.addEventListener('hashchange', openHashTarget);
  openHashTarget();
}());
