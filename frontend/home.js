/* Homepage-only behaviour: the act mastheads enter as you reach them, and the
   cover contents strip marks the act you are reading.
   No dependencies, no layout work: without JS (or with reduced motion) every
   section simply renders in place. */
(function () {
  'use strict';

  var body = document.body;
  if (!body || !body.classList.contains('page-home')) return;

  var heads = document.querySelectorAll('.page-home .act-head');
  var links = document.querySelectorAll('.page-home .act-contents a');
  var acts = document.querySelectorAll('.page-home .act');
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Reveal: add the class only after we know the observer exists, so a failure
     here can never leave content hidden. */
  if (heads.length && !reduceMotion && 'IntersectionObserver' in window) {
    body.classList.add('js-reveal');
    var reveal = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          reveal.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    Array.prototype.forEach.call(heads, function (head) {
      reveal.observe(head);
    });
  }

  /* Contents strip: keep the current act marked while reading. */
  if (acts.length && links.length && 'IntersectionObserver' in window) {
    var byId = {};
    Array.prototype.forEach.call(links, function (link) {
      var id = (link.getAttribute('href') || '').replace(/^#/, '');
      if (id) byId[id] = link;
    });

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var link = byId[entry.target.id];
          if (!link) return;
          Array.prototype.forEach.call(links, function (other) {
            other.removeAttribute('aria-current');
          });
          link.setAttribute('aria-current', 'true');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );

    Array.prototype.forEach.call(acts, function (act) {
      if (act.id && byId[act.id]) spy.observe(act);
    });
  }
})();
