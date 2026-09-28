/* ============================================================
   Abul Kalam Azad / Security Portfolio
   Vanilla JS, no dependencies. Every effect respects
   prefers-reduced-motion and degrades to static content.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* run fn once loader.js hands over, or right away if the intro never played */
  function whenIntro(fn) {
    if (window.__introDone || !root.classList.contains('is-loading')) fn();
    else document.addEventListener('intro:done', fn, { once: true });
  }

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

  /* ---------- decrypt: random hex resolves left to right into the real text ---------- */
  var HEX = '0123456789abcdef';
  function rhex() { return HEX.charAt((Math.random() * 16) | 0); }

  function decrypt(el, opt) {
    opt = opt || {};
    var plain = el.getAttribute('data-plain');
    if (plain === null) { plain = el.textContent; el.setAttribute('data-plain', plain); }
    if (opt.label) el.setAttribute('aria-label', plain);
    if (reduce) { if (opt.done) opt.done(); return; }

    var n = plain.length, hold = opt.hold || 300, step = opt.step || 40;
    var cur = [], i;
    for (i = 0; i < n; i++) cur.push(rhex());

    var solved = document.createElement('span');
    var hash = document.createElement('span');
    hash.className = 'dc-hash';
    hash.textContent = cur.join('');
    el.textContent = '';
    el.appendChild(solved);
    el.appendChild(hash);

    var t0 = 0, last = 0;
    window.requestAnimationFrame(function frame(now) {
      if (!t0) t0 = last = now;
      var t = now - t0;
      var k = t < hold ? 0 : Math.min(n, Math.floor((t - hold) / step) + 1);
      if (t >= hold && now - last > 50) {         // the hash holds still first, then churns
        last = now;
        for (i = k; i < n; i++) cur[i] = rhex();
      }
      solved.textContent = plain.slice(0, k);
      hash.textContent = cur.slice(k).join('');
      if (k < n) { window.requestAnimationFrame(frame); return; }
      el.textContent = plain;
      if (opt.done) opt.done();
    });
  }

  /* ---------- reveal on scroll (section titles decrypt as they arrive) ---------- */
  function startReveal() {
    var revealables = all('[data-reveal]');

    if (reduce || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = (el.parentElement ? Array.prototype.slice.call(el.parentElement.children) : [])
          .filter(function (n) { return n.hasAttribute && n.hasAttribute('data-reveal'); });
        var i = siblings.indexOf(el);
        el.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 55 : 0) + 'ms';
        el.classList.add('in');
        if (el.classList.contains('sec-head')) {
          var title = el.querySelector('.sec-title');
          var parts = title ? all('.dc-part', title) : [];
          if (parts.length) {
            // two-tone titles ("Let's connect"): label once, decrypt each part in turn
            title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
            parts.forEach(function (p, n) { decrypt(p, { hold: 140 + n * 160, step: 34 }); });
          } else if (title) {
            decrypt(title, { hold: 140, step: 26, label: true });
          }
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- active section in nav ---------- */
  var navLinks = all('.nav a[href^="#"]');
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

  /* ---------- hero: name decrypts from a hash, then one glitch pass ---------- */
  function heroIntro() {
    var parts = all('.hero-name .glitch');
    function glitch() {
      if (reduce) return;
      parts.forEach(function (g) {
        g.classList.add('fire');
        window.setTimeout(function () { g.classList.remove('fire'); }, 700);
      });
    }
    parts.forEach(function (el, i) {
      decrypt(el, { hold: 420 + i * 260, step: 62, done: i === parts.length - 1 ? glitch : null });
    });
  }

  /* ---------- stats count up from zero ---------- */
  function countUp() {
    if (reduce) return;
    all('[data-count]').forEach(function (el) {
      var to = parseInt(el.getAttribute('data-count'), 10);
      if (!to) return;
      var t0 = 0, dur = 1200;
      el.textContent = '0';
      window.requestAnimationFrame(function f(now) {
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) window.requestAnimationFrame(f);
      });
    });
  }

  /* ---------- terminal: type the command once, then reveal output ---------- */
  var term = document.getElementById('term');

  function revealTerminalInstantly() {
    if (!term) return;
    var cmd = term.querySelector('[data-type]');
    if (cmd) cmd.textContent = cmd.getAttribute('data-type');
    var cur = term.querySelector('.cursor');
    if (cur) cur.classList.add('done');
    all('[data-step]', term).forEach(function (el) { el.classList.add('shown'); });
  }

  function runTerminal() {
    var cmd = term.querySelector('[data-type]');
    var cursor = term.querySelector('.cursor');
    var steps = all('[data-step]', term);
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

  function startTerminal() {
    if (!term) return;
    if (reduce || !('IntersectionObserver' in window)) { revealTerminalInstantly(); return; }
    var termObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        termObserver.disconnect();
        window.setTimeout(runTerminal, 700);
      });
    }, { threshold: 0.35 });
    termObserver.observe(term);
  }

  whenIntro(function () {
    startReveal();
    heroIntro();
    window.setTimeout(countUp, 350);
    startTerminal();
  });

  /* ---------- jump-to palette: Ctrl/Cmd+K or "/" ---------- */
  var pal = document.getElementById('pal');
  var palInput = document.getElementById('palInput');
  var palList = document.getElementById('palList');
  var palEmpty = document.getElementById('palEmpty');
  var palScrim = document.getElementById('palScrim');
  var cmdkBtn = document.getElementById('cmdkBtn');
  var cmdkKey = document.getElementById('cmdkKey');

  if (cmdkKey && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) cmdkKey.textContent = '⌘';

  var DEST = [
    { k: '01',  t: 'about',                   h: '#about',          kw: 'whoami bio' },
    { k: '02',  t: 'skills & tools',          h: '#skills',         kw: 'burp nmap metasploit toolkit' },
    { k: '03',  t: 'certifications',          h: '#certifications', kw: 'certs ejpt crta mcrta icca isc2 cc verify' },
    { k: '04',  t: 'security projects',       h: '#projects',       kw: 'vapt report engagement arp scanner mac tools work' },
    { k: '05',  t: 'ctf & labs',              h: '#ctf',            kw: 'tryhackme thm htb hack the box d3' },
    { k: '06',  t: 'write-ups',               h: '#writeups',       kw: 'medium mr robot blog' },
    { k: '07',  t: 'experience & education',  h: '#experience',     kw: 'work intern mentor kiit btech career' },
    { k: '08',  t: 'achievements',            h: '#achievements',   kw: 'cdac meity bug bounty rank' },
    { k: '09',  t: 'contact',                 h: '#contact',        kw: 'email hire mail' },
    { k: 'pdf', t: 'download resume',         h: 'assets/files/Abul_Kalam_Azad_Resume.pdf', dl: true, kw: 'cv resume' },
    { k: 'git', t: 'vapt report repository',  h: 'https://github.com/Abulkalam1524/vapt-lab-assessment', ext: true, kw: 'github report' },
    { k: 'git', t: 'github profile',          h: 'https://github.com/Abulkalam1524', ext: true, kw: 'code source' },
    { k: 'in',  t: 'linkedin',                h: 'https://www.linkedin.com/in/abul-kalam-azad-a7a41a260', ext: true },
    { k: 'thm', t: 'tryhackme profile',       h: 'https://tryhackme.com/p/G00dM4nGr1t', ext: true },
    { k: 'med', t: 'medium write-ups',        h: 'https://medium.com/@azad93204', ext: true, kw: 'blog' },
    { k: '@',   t: 'email me',                h: 'mailto:abul.kalam.azad.cyber@gmail.com', kw: 'contact mail' },
    { k: 'sys', t: 'replay intro',            act: 'replay', kw: 'loader globe boot' }
  ];

  if (pal && palInput && palList) {
    var shown = [], sel = 0, lastFocus = null;

    var mark = function () {
      Array.prototype.forEach.call(palList.children, function (li, i) {
        li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      });
      var cur = palList.children[sel];
      if (cur) { palInput.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
      else palInput.removeAttribute('aria-activedescendant');
    };

    var render = function () {
      var q = palInput.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = DEST.filter(function (d) {
        var hay = (d.k + ' ' + d.t + ' ' + (d.kw || '')).toLowerCase();
        return q.every(function (w) { return hay.indexOf(w) !== -1; });
      });
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      palList.textContent = '';
      shown.forEach(function (d, i) {
        var li = document.createElement('li');
        li.className = 'pal-opt';
        li.id = 'pal-opt-' + i;
        li.setAttribute('role', 'option');
        [['k', d.k], ['t', d.t], ['h', d.ext ? 'external' : d.dl ? 'pdf' : d.act ? 'system' : d.h]]
          .forEach(function (c) {
            var sp = document.createElement('span');
            sp.className = c[0];
            sp.textContent = c[1];
            li.appendChild(sp);
          });
        li.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
        li.addEventListener('click', function () { go(d); });
        palList.appendChild(li);
      });
      if (palEmpty) palEmpty.hidden = shown.length > 0;
      mark();
    };

    var openPal = function () {
      if (!pal.hidden) return;
      lastFocus = document.activeElement;
      pal.hidden = false;
      document.body.classList.add('pal-open');
      palInput.value = '';
      sel = 0;
      render();
      palInput.focus();
    };

    var closePal = function (restore) {
      if (pal.hidden) return;
      pal.hidden = true;
      document.body.classList.remove('pal-open');
      if (restore !== false && lastFocus && lastFocus.focus) lastFocus.focus();
    };

    var go = function (d) {
      closePal(false);
      if (d.act === 'replay') {
        window.scrollTo(0, 0);
        location.reload();
        return;
      }
      if (d.ext) { window.open(d.h, '_blank', 'noopener'); return; }
      if (d.dl) {
        var a = document.createElement('a');
        a.href = d.h;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.parentNode.removeChild(a);
        return;
      }
      if (d.h.charAt(0) === '#') {
        var target = document.querySelector(d.h);
        if (!target) return;
        history.replaceState(null, '', d.h);
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        var head = target.querySelector('h2') || target;
        head.setAttribute('tabindex', '-1');
        head.focus({ preventScroll: true });
        return;
      }
      location.href = d.h;
    };

    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) {
        e.preventDefault();
        if (pal.hidden) openPal(); else closePal();
        return;
      }
      if (!pal.hidden) {
        if (k === 'Escape') { e.preventDefault(); closePal(); }
        else if (k === 'ArrowDown' && shown.length) { e.preventDefault(); sel = (sel + 1) % shown.length; mark(); }
        else if (k === 'ArrowUp' && shown.length) { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; mark(); }
        else if (k === 'Enter') { e.preventDefault(); if (shown[sel]) go(shown[sel]); }
        else if (k === 'Tab') { e.preventDefault(); palInput.focus(); } // single-field dialog: keep focus inside
        return;
      }
      if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
        e.preventDefault();
        openPal();
      }
    });

    palInput.addEventListener('input', function () { sel = 0; render(); });
    if (palScrim) palScrim.addEventListener('click', function () { closePal(); });
    if (cmdkBtn) cmdkBtn.addEventListener('click', openPal);
  }

  /* ---------- contact: copy to clipboard ---------- */
  var live = document.getElementById('contactLive');
  function sayLive(msg) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 40);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.parentNode.removeChild(ta);
      if (ok) resolve(); else reject();
    });
  }

  all('[data-copy]').forEach(function (b) {
    var timer = 0;
    b.addEventListener('click', function () {
      copyText(b.getAttribute('data-copy')).then(function () {
        b.classList.add('done');
        sayLive('Email address copied');
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { b.classList.remove('done'); }, 1600);
      }, function () { sayLive('Copy failed. Select the address and copy it by hand.'); });
    });
  });

  /* ---------- contact: message form. Composes an email; sends nothing itself ---------- */
  var cform = document.getElementById('cform');
  if (cform) {
    var to = cform.getAttribute('data-to');
    var fName = document.getElementById('cfName');
    var fMail = document.getElementById('cfMail');
    var fMsg = document.getElementById('cfMsg');
    var cfLog = document.getElementById('cfLog');
    var cfCount = document.getElementById('cfCount');
    var fields = [fName, fMail, fMsg];

    var count = function () { if (cfCount) cfCount.textContent = fMsg.value.length + '/' + fMsg.maxLength; };
    fMsg.addEventListener('input', count);
    count();

    fields.forEach(function (el) {
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true' && el.checkValidity()) el.setAttribute('aria-invalid', 'false');
      });
    });

    var logLine = function (cls, text) {
      var p = document.createElement('p');
      if (cls) p.className = cls;
      p.textContent = text;
      cfLog.appendChild(p);
      return p;
    };

    // an anchor click rather than location.href, so a failed handler never navigates the page
    var openLink = function (href, blank) {
      var a = document.createElement('a');
      a.href = href;
      if (blank) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.click();
    };

    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      cfLog.textContent = '';

      var bad = null;
      fields.forEach(function (el) {
        el.value = el.value.trim();
        var ok = el.checkValidity();
        el.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok && !bad) bad = el;
      });
      if (bad) {
        var why = bad === fMail && !bad.validity.valueMissing ? ' is not a valid address' : ' is required';
        logLine('err', 'error: ' + bad.getAttribute('data-flag') + why);
        bad.focus();
        return;
      }

      var subject = 'Portfolio contact from ' + fName.value;
      var body = fMsg.value + '\n\n-- \n' + fName.value + '\n' + fMail.value;
      openLink('mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));

      var steps = [['$ ./send --to ' + to], ['> packing message ', 'ok'], ['> handing off to your mail app ', 'ok']];
      var gap = reduce ? 0 : 240;
      steps.forEach(function (st, i) {
        window.setTimeout(function () {
          var p = logLine('', st[0]);
          if (st[1]) {
            var ok = document.createElement('span');
            ok.className = 'ok';
            ok.textContent = st[1];
            p.appendChild(ok);
          }
        }, i * gap);
      });

      // fallback for visitors with no mail app wired up
      window.setTimeout(function () {
        var p = logLine('', '> nothing opened? ');
        var cp = document.createElement('button');
        cp.type = 'button';
        cp.textContent = 'copy the message';
        cp.addEventListener('click', function () {
          copyText('To: ' + to + '\nSubject: ' + subject + '\n\n' + body).then(function () {
            cp.textContent = 'copied';
            sayLive('Message copied');
          }, function () { sayLive('Copy failed'); });
        });
        var gm = document.createElement('a');
        gm.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) +
          '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        gm.target = '_blank';
        gm.rel = 'noopener noreferrer';
        gm.textContent = 'open it in gmail';
        p.appendChild(cp);
        p.appendChild(document.createTextNode(' or '));
        p.appendChild(gm);
      }, steps.length * gap);
    });
  }

  /* ---------- current year in footer ---------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
