/* BBC Academy page transition: play the doors-opening overlay when a page
   loads, and the doors-closing overlay when following an internal link.
   In-page anchors, external links, downloads and reduced-motion users
   navigate instantly, with no animation. */
(function () {
  var overlay = document.getElementById('pageTransition');
  if (!overlay) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { overlay.classList.add('pt-hidden'); return; }

  // Entering this page: panels slide apart, then the overlay is removed.
  window.addEventListener('load', function () {
    setTimeout(function () {
      overlay.classList.add('pt-leaving');
      setTimeout(function () { overlay.classList.add('pt-hidden'); }, 800);
    }, 250);
  });
  // Back/forward cache: never leave a restored page covered.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) overlay.classList.add('pt-hidden');
  });

  // Fallback: if the load handler never fires (JS disabled / slow env), hide
  // the overlay so the page is still readable.
  document.addEventListener('DOMContentLoaded', function () {
    overlay.classList.add('pt-hidden');
  });

  // Fallback: mark JS-ready so a CSS rule hides the overlay immediately.
  document.body.classList.add('js-ready');

  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a') : null;
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#' || link.target === '_blank' || link.hasAttribute('download')) return;
    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    if (url.href === window.location.href) return;
    e.preventDefault();
    overlay.classList.remove('pt-hidden', 'pt-leaving');
    overlay.classList.add('pt-start');
    void overlay.offsetWidth;
    overlay.classList.remove('pt-start');
    // Force the pop animation to replay on every exit.
    var content = overlay.querySelector('.pt-content');
    if (content) { var fresh = content.cloneNode(true); content.replaceWith(fresh); }
    setTimeout(function () { window.location.href = url.href; }, 680);
  });
})();
