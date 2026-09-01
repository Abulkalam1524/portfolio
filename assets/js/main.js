/* ============================================================
   Abul Kalam Azad — Security Portfolio
   Vanilla JS. No dependencies. All motion respects
   prefers-reduced-motion and degrades to static content.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll progress + sticky header state ---------- */
  var progress = document.getElementById('progress');
  var header = document.getElementById('header');
  var ticking = false;

  function onScroll() {
    var top = window.scrollY || document.documentElement.scrollTop;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (max > 0 ? (top / max) * 100 : 0) + '%';
    if (header) header.classList.toggle('stuck', top > 8);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- mobile navigation ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { closeNav(); toggle.focus(); }
    });
  }

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll('[data-reveal]');

  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var siblings = Array.prototype.slice.call(
          entry.target.parentElement ? entry.target.parentElement.children : []
        ).filter(function (n) { return n.hasAttribute && n.hasAttribute('data-reveal'); });
        var i = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 55 : 0) + 'ms';
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- active section in nav ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var visible = {};
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });

      var bestId = null, bestRatio = 0;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] > bestRatio) { bestRatio = visible[id]; bestId = id; }
      });

      navLinks.forEach(function (a) {
        a.classList.toggle('active', bestId !== null && a.getAttribute('href') === '#' + bestId);
      });
    }, { rootMargin: '-64px 0px -55% 0px', threshold: [0, 0.15, 0.4, 0.75] });

    sections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ---------- hero glitch: fire once on load ---------- */
  var name = document.querySelector('.hero-name.glitch');
  if (name && !reduce) {
    window.setTimeout(function () {
      name.classList.add('fire');
      window.setTimeout(function () { name.classList.remove('fire'); }, 700);
    }, 320);
  }

  /* ---------- terminal: type the command once, then reveal output ---------- */
  var term = document.getElementById('term');

  function revealTerminalInstantly() {
    if (!term) return;
    var cmd = term.querySelector('[data-type]');
    if (cmd) cmd.textContent = cmd.getAttribute('data-type');
    var cur = term.querySelector('.cursor');
    if (cur) cur.classList.add('done');
    term.querySelectorAll('[data-step]').forEach(function (el) { el.classList.add('shown'); });
  }

  function runTerminal() {
    if (!term) return;
    var cmd = term.querySelector('[data-type]');
    var cursor = term.querySelector('.cursor');
    var steps = Array.prototype.slice.call(term.querySelectorAll('[data-step]'));
    if (!cmd) { revealTerminalInstantly(); return; }

    var text = cmd.getAttribute('data-type') || '';
    var i = 0;
    cmd.textContent = '';

    (function type() {
      if (i <= text.length) {
        cmd.textContent = text.slice(0, i);
        i++;
        window.setTimeout(type, 55);
        return;
      }
      if (cursor) cursor.classList.add('done');
      steps.forEach(function (el, n) {
        window.setTimeout(function () { el.classList.add('shown'); }, 130 + n * 150);
      });
    })();
  }

  if (reduce) {
    revealTerminalInstantly();
  } else if ('IntersectionObserver' in window && term) {
    var termObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        termObserver.disconnect();
        window.setTimeout(runTerminal, 420);
      });
    }, { threshold: 0.35 });
    termObserver.observe(term);
  } else {
    revealTerminalInstantly();
  }

  /* ---------- current year in footer ---------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
