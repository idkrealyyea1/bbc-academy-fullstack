/* BBC Academy page transition: play the doors-opening overlay when a page
   loads, and the doors-closing overlay when following an internal link.
   In-page anchors, external links, downloads and reduced-motion users
   navigate instantly, with no animation. Restored for the luxury design;
   logic unchanged from the original implementation. */
(function () {
  var overlay = document.getElementById('pageTransition');
  if (!overlay) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { overlay.classList.add('pt-hidden'); return; }

  // Entering this page: panels slide apart, then the overlay is removed.
  var opened = false;
  function openDoors() {
    if (opened) return;
    opened = true;
    overlay.classList.add('pt-leaving');
    setTimeout(function () { overlay.classList.add('pt-hidden'); }, 800);
  }
  window.addEventListener('load', function () { setTimeout(openDoors, 250); });
  // `load` waits for every image, which can take a while on a slow connection.
  // Open after 1.4s regardless so the entrance is never held hostage by one
  // slow asset; the CSS keyframe above is the last-resort escape hatch.
  setTimeout(openDoors, 1400);
  // Back/forward cache: never leave a restored page covered.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { opened = true; overlay.classList.add('pt-hidden'); }
  });

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
    // The CSS give-up keyframe (for visitors without JS) ends on
    // visibility:hidden. Undo it here, or the exit animation plays invisibly
    // for anyone who browses for more than six seconds.
    overlay.style.animation = 'none';
    overlay.style.visibility = 'visible';
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
