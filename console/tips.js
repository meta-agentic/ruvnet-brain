/* RuvNet Brain — How to use it (page two).
   The only behavior this static guide needs: the same theme toggle as the console.
   Same key ('rbc-theme'), same mechanism (data-theme on <html>), so both pages
   always agree on light vs dark. */
(function () {
  'use strict';
  var KEY = 'rbc-theme';
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function apply(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) { /* private mode is fine */ }
  }
  btn.addEventListener('click', function () {
    apply(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
})();
