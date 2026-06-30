/* =============================================================================
   RuvNet Brain — Explainer main.js   (progressive enhancement only)
   The page is fully usable with JS disabled: every section is a native
   <details>/<summary>. This script adds, on top:
     1. deep-link: open the <details> a #hash points at, and on nav-click.
     2. the #seeit "See it work" demo (typewriter · 4 drift-vs-grounded
        questions · pause / replay), ported intact from the prior explainer.
   No dependencies. No build step.
   ========================================================================== */
(function () {
  "use strict";

  /* --- 1. Deep-link a section open --------------------------------------- */
  function openFromHash() {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    var el = document.getElementById(id);
    while (el && el.tagName !== "DETAILS") el = el.parentElement;
    if (el && !el.open) el.open = true;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();

  // Clicking an in-page link should also expand its target <details>.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var id = a.getAttribute("href").slice(1);
      var sec = document.getElementById(id);
      while (sec && sec.tagName !== "DETAILS") sec = sec.parentElement;
      if (sec && !sec.open) sec.open = true;
    });
  });

  /* --- 1b. ANIMATION LAYER — scroll-reveal · count-up · living diagrams ---
     Additive & progressive: if JS is off, nothing hides. If JS is on but the
     user prefers reduced motion, we skip all motion and leave the final state.
     The body class `anim-on` is what arms the initial hidden/draw CSS states,
     so we only add it when motion is actually allowed. */
  (function () {
    var reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hasIO = "IntersectionObserver" in window;

    // Without IO or with reduced motion: do not arm any hidden state. Everything
    // stays visible/complete (CSS initial states are gated behind .anim-on).
    if (reduce || !hasIO) return;

    document.body.classList.add("anim-on");

    /* ---- prepare elements that need JS-assigned classes / stagger index ---- */
    // showcase cards: reveal, staggered within each .grid group
    document.querySelectorAll(".gallery .grid").forEach(function (grid) {
      var cards = grid.querySelectorAll(".case");
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.add("reveal-stagger");
        cards[i].style.setProperty("--i", i);
      }
    });
    // stat-band cards: assign stagger index (class already in HTML)
    document.querySelectorAll(".spear-grid .reveal-stagger").forEach(function (el, i) {
      el.style.setProperty("--i", i);
    });
    // proof rows: assign stagger index
    document.querySelectorAll(".tbl tbody .reveal-row").forEach(function (el, i) {
      el.style.setProperty("--i", i);
    });
    // section headers: reveal the head-text block of each collapsible section
    document.querySelectorAll(".sections .section > summary .head-text").forEach(function (el) {
      el.classList.add("reveal");
    });
    // coverage-map chips: assign cascade index
    document.querySelectorAll(".dgm-s06 .s06-chip").forEach(function (el, i) {
      el.style.setProperty("--i", i);
    });

    /* ---- generic reveal observer (once) ---- */
    var revealIO = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal, .reveal-stagger, .reveal-row").forEach(function (el) {
      revealIO.observe(el);
    });

    /* ---- 2. COUNT-UP ---- */
    function fmt(v, decimals, commas) {
      var n = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
      if (commas) {
        var parts = n.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        n = parts.join(".");
      }
      return n;
    }
    function countUp(el) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      var target = parseFloat(el.dataset.count);
      var decimals = parseInt(el.dataset.decimals || "0", 10);
      var commas = el.dataset.commas === "1";
      var final = el.textContent;          // exact final text to restore
      var dur = 1100, start = null;
      function ease(t) { return 1 - Math.pow(1 - t, 3); } // ease-out cubic
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var v = target * ease(p);
        el.textContent = fmt(v, decimals, commas);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = final;       // guarantee exact final string
      }
      requestAnimationFrame(step);
    }
    // trigger count-up when the whole stat band first reveals
    var band = document.querySelector(".spearband");
    if (band) {
      var bandIO = new IntersectionObserver(function (entries, obs) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            band.querySelectorAll("[data-count]").forEach(countUp);
            obs.disconnect();
          }
        }
      }, { threshold: 0.3 });
      bandIO.observe(band);
    }

    /* ---- 3. LIVING DIAGRAMS — add .go when a diagram scrolls into view ---- */
    var dgmIO = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.isIntersecting) continue;
        var svg = e.target;
        svg.classList.add("go");
        // s04: kick off the traveling-pulse SMIL motion once it's in view
        var motion = svg.querySelector(".s04-pulse-motion");
        if (motion && motion.beginElement) {
          try { motion.beginElement(); } catch (err) {}
        }
        obs.unobserve(svg);
      }
    }, { threshold: 0.25 });
    document.querySelectorAll(".diagram-svg").forEach(function (svg) {
      dgmIO.observe(svg);
    });
  })();

  /* --- 2. The #seeit demo ------------------------------------------------- */
  (function () {
    var root = document.getElementById("seeit");
    if (!root) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var DATA = [
      { q: "Where should I store embeddings?",
        l: "Use pgvector or Pinecone.",
        h: "…or maybe Redis? Hard to say.",
        r: "RuVector RVF + HNSW — local, on-disk, zero-server.",
        c: "concepts/ruvector/CARD" },
      { q: "Can Ruflo agents edit files on disk?",
        l: "I don't think so — it's just chat.",
        h: "…or maybe a plugin does? Not certain.",
        r: "Yes — Ruflo's terminal_execute writes files.",
        c: "concepts/ruflo/CARD" },
      { q: "What caches repeated vector queries?",
        l: "Maybe Redis? Roll your own.",
        h: "…or Memcached, possibly? Your call.",
        r: "RuLake — sub-millisecond vector cache.",
        c: "concepts/rulake/CARD" },
      { q: "How should I structure a non-trivial build?",
        l: "Just start coding.",
        h: "…or grab some framework? Whatever fits.",
        r: "SPARC — Spec→Pseudocode→Architecture→Refinement→Completion.",
        c: "concepts/sparc/CARD" }
    ];

    var btns = Array.prototype.slice.call(root.querySelectorAll(".seeit-q"));
    var qts = Array.prototype.slice.call(root.querySelectorAll(".seeit-qt"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".seeit-dot"));
    var ansL = root.querySelector(".seeit-ans-l");
    var ansR = root.querySelector(".seeit-ans-r");
    var cite = root.querySelector(".seeit-cite");
    var hedge = root.querySelector(".seeit-hedge");
    var toggle = root.querySelector(".seeit-toggle");
    var togIc = toggle ? toggle.querySelector(".ic") : null;
    var togTx = toggle ? toggle.querySelector(".tx") : null;

    var idx = 0, timers = [], adv = null, settled = false, started = false;
    var hovering = false, focusing = false, inview = true, userPaused = false;
    function isPaused() { return hovering || focusing || !inview || userPaused; }

    function clearT() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers = []; if (adv) { clearTimeout(adv); adv = null; } }
    function stopAdvance() { if (adv) { clearTimeout(adv); adv = null; } }

    function type(el, text, speed, done) {
      if (reduce) { el.textContent = text; el.classList.remove("typing"); if (done) done(); return; }
      el.classList.add("typing"); el.textContent = "";
      var i = 0;
      (function step() {
        el.textContent = text.slice(0, i);
        if (i < text.length) { i++; timers.push(setTimeout(step, speed)); }
        else { el.classList.remove("typing"); if (done) done(); }
      })();
    }

    function setActive(n) {
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute("aria-pressed", i === n ? "true" : "false");
      for (var j = 0; j < dots.length; j++) dots[j].className = "seeit-dot" + (j === n ? " on" : "");
    }

    function schedule() {
      if (reduce || isPaused() || !settled) return;
      stopAdvance();
      adv = setTimeout(function () { render((idx + 1) % DATA.length); }, 3400);
    }

    function render(n) {
      clearT(); idx = n; settled = false;
      var d = DATA[n];
      setActive(n);
      for (var i = 0; i < qts.length; i++) qts[i].textContent = d.q;
      cite.classList.remove("show"); cite.textContent = "cited: " + d.c;
      if (hedge) { hedge.classList.remove("show"); hedge.textContent = d.h; }

      if (reduce) {
        ansL.textContent = d.l; ansR.textContent = d.r;
        if (hedge) hedge.classList.add("show");
        cite.classList.add("show"); settled = true; return;
      }
      ansL.textContent = ""; ansR.textContent = "";
      type(ansL, d.l, 26, function () {
        if (hedge) hedge.classList.add("show");
        timers.push(setTimeout(function () {
          type(ansR, d.r, 18, function () {
            cite.classList.add("show"); settled = true; schedule();
          });
        }, 360));
      });
    }

    for (var b = 0; b < btns.length; b++) { (function (i) {
      btns[i].addEventListener("click", function () { render(i); });
    })(b); }

    function setToggle() {
      if (!toggle) return;
      if (userPaused) {
        if (togIc) togIc.textContent = "▶"; if (togTx) togTx.textContent = "replay";
        toggle.setAttribute("aria-label", "Replay and resume the demo");
        toggle.setAttribute("aria-pressed", "true");
      } else {
        if (togIc) togIc.textContent = "⏸"; if (togTx) togTx.textContent = "pause";
        toggle.setAttribute("aria-label", "Pause the demo");
        toggle.setAttribute("aria-pressed", "false");
      }
    }
    if (toggle) {
      if (reduce) { toggle.style.display = "none"; }
      toggle.addEventListener("click", function () {
        if (userPaused) { userPaused = false; setToggle(); render(idx); }   // resume: replay this pair, then auto-advance
        else { userPaused = true; stopAdvance(); setToggle(); }            // stop: hold on this pair
      });
    }

    root.addEventListener("mouseenter", function () { hovering = true; stopAdvance(); });
    root.addEventListener("mouseleave", function () { hovering = false; schedule(); });
    root.addEventListener("focusin", function () { focusing = true; stopAdvance(); });
    root.addEventListener("focusout", function () { focusing = false; schedule(); });

    if (reduce) { render(0); return; }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        for (var i = 0; i < es.length; i++) {
          var e = es[i];
          if (e.isIntersecting) { inview = true; if (!started) { started = true; render(0); } else { schedule(); } }
          else { inview = false; stopAdvance(); }
        }
      }, { threshold: 0.25 });
      io.observe(root);
    } else {
      render(0);
    }
  })();
})();
