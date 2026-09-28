/* ============================================================
   Skills field: every tool is a node in a small physics sim.
   Nodes drop in when the section scrolls into view. The cursor is
   a probe: sweeping it shoves nodes, holding still lets you grab
   one and throw it.

   Decorative only (aria-hidden): the chip grid under it carries the
   same list for screen readers and search. Plain 2D canvas, no
   libraries, nothing inline, so it stays inside the CSP.
   Sleeps when nothing moves and pauses when scrolled off screen.
   ============================================================ */
(function () {
  'use strict';

  var box = document.getElementById('field');
  var cv = document.getElementById('fieldCanvas');
  if (!box || !cv || !cv.getContext) return;

  var ctx = cv.getContext('2d');
  var readout = document.getElementById('fieldProbe');
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [label, group, core]. Groups map to the legend colours (.field --k-* in style.css).
  // Core tools are drawn larger with a dashed inner ring.
  var TOOLS = [
    ['burp suite', 'web', 1], ['owasp top 10', 'web'], ['sqli', 'web'], ['xss', 'web'],
    ['nmap', 'net', 1], ['wireshark', 'net'], ['netcat', 'net'], ['scapy', 'net'],
    ['metasploit', 'exp', 1], ['nessus', 'exp'], ['nikto', 'exp'], ['nuclei', 'exp'],
    ['python', 'scr', 1], ['bash', 'scr'], ['kali linux', 'scr'], ['git', 'scr'],
    ['aws', 'cld'], ['azure', 'cld'], ['gcp', 'cld'],
    ['cvss v3.1', 'std'], ['ptes', 'std'], ['mitre att&ck', 'std']
  ];

  var G = .42, AIR = .992, BOUNCE = .42, FRICTION = .9, VMAX = 36, STEP = 1000 / 60;

  var W = 0, H = 0, S = 1, nodes = [], col = {};
  var ptr = { x: 0, y: 0, dx: 0, dy: 0, speed: 0, on: false };
  var grab = null, hover = null, readNow = '';
  var ret = { x: 0, y: 0, s: 12, on: false }; // reticle position and half-size
  var visible = false, running = false, dropped = false, still = 0, last = 0, acc = 0;

  function readColors() {
    var cs = getComputedStyle(box);
    ['web', 'net', 'exp', 'scr', 'cld', 'std'].forEach(function (k) {
      col[k] = cs.getPropertyValue('--k-' + k).trim() || '#c8ff2e';
    });
    col.bg = cs.getPropertyValue('--bg').trim() || '#0b0b0a';
    col.fill = cs.getPropertyValue('--surface').trim() || '#141412';
    col.hot = cs.getPropertyValue('--hot').trim() || '#ff5a1f';
  }

  function font() { return '600 ' + (12 * S).toFixed(1) + 'px "IBM Plex Mono", ui-monospace, monospace'; }

  // radius follows the label so text always fits inside its ring
  function measure() {
    ctx.font = font();
    nodes.forEach(function (n) {
      n.r = Math.max(26 * S, ctx.measureText(n.label).width / 2 + 15 * S) * (n.core ? 1.24 : 1);
    });
  }

  function contain(n) {
    if (n.x < n.r) n.x = n.r; else if (n.x > W - n.r) n.x = W - n.r;
    if (n.y > H - n.r) n.y = H - n.r;
  }

  function resize() {
    var w = Math.round(cv.clientWidth), h = Math.round(cv.clientHeight);
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h;
    S = Math.max(.72, Math.min(1.3, W / 950));
    measure();
    nodes.forEach(function (n) { contain(n); n.px = n.x; n.py = n.y; });
    draw();
  }

  function spawn() {
    nodes = TOOLS.map(function (t) {
      return { label: t[0].toUpperCase(), k: t[1], core: !!t[2], x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 30 };
    });
    for (var i = nodes.length - 1; i > 0; i--) { // shuffle so the groups land mixed
      var j = (Math.random() * (i + 1)) | 0, t = nodes[i];
      nodes[i] = nodes[j]; nodes[j] = t;
    }
    measure();
    nodes.forEach(function (n, k) {
      n.x = n.px = n.r + Math.random() * Math.max(1, W - 2 * n.r);
      n.y = n.py = -n.r - k * 64 * S;
    });
  }

  /* ---------- one fixed 60 Hz physics step (Verlet) ---------- */
  function step() {
    var i, j, n, m, dx, dy, d, min, o, it;

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n === grab) { // held: follows the pointer, last delta becomes the throw
        n.px = n.x; n.py = n.y;
        n.x = ptr.x; n.y = ptr.y;
        contain(n);
        continue;
      }
      n.vx = (n.x - n.px) * AIR;
      n.vy = (n.y - n.py) * AIR + G;
      d = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (d > VMAX) { n.vx *= VMAX / d; n.vy *= VMAX / d; }
      n.px = n.x; n.py = n.y;
      n.x += n.vx; n.y += n.vy;
    }

    // probe: only a moving cursor shoves, so you can rest on a node and grab it
    if (ptr.on && !grab && ptr.speed > 1.2) {
      var reach = 22 * S;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        dx = n.x - ptr.x; dy = n.y - ptr.y; min = n.r + reach; d = dx * dx + dy * dy;
        if (d >= min * min) continue;
        d = Math.sqrt(d) || .01;
        o = Math.min(min - d, 2 + ptr.speed * .5);
        n.x += dx / d * o + ptr.dx * .12;
        n.y += dy / d * o + ptr.dy * .12;
      }
    }
    ptr.speed *= .8; ptr.dx *= .8; ptr.dy *= .8;

    // overlap resolution, a few passes so piles settle without sinking
    for (it = 0; it < 4; it++) {
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          m = nodes[j];
          dx = m.x - n.x; dy = m.y - n.y; min = n.r + m.r; d = dx * dx + dy * dy;
          if (d >= min * min) continue;
          d = Math.sqrt(d);
          if (d < .01) { dx = .01; dy = 0; d = .01; }
          o = (min - d) / d;
          if (n === grab) { m.x += dx * o; m.y += dy * o; }
          else if (m === grab) { n.x -= dx * o; n.y -= dy * o; }
          else { o *= .5; n.x -= dx * o; n.y -= dy * o; m.x += dx * o; m.y += dy * o; }
        }
      }
      for (i = 0; i < nodes.length; i++) contain(nodes[i]);
    }

    // walls and floor: a little bounce, and floor friction so piles stop sliding
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n === grab) continue;
      if (n.y >= H - n.r - .5) {
        if (n.vy > 1.2) n.py = n.y + n.vy * BOUNCE;
        n.px = n.x - (n.x - n.px) * FRICTION;
      }
      if ((n.x <= n.r + .5 && n.vx < -1.2) || (n.x >= W - n.r - .5 && n.vx > 1.2)) n.px = n.x + n.vx * BOUNCE;
    }
  }

  function hit(x, y) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i], dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy <= n.r * n.r) return n;
    }
    return null;
  }

  function setReadout(s) {
    if (readout && s !== readNow) { readout.textContent = s; readNow = s; }
  }

  function pad(v) { v = Math.max(0, Math.round(v)); return ('000' + v).slice(-4); }

  /* ---------- render ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, n, dx, dy, d, reach = 210 * S, inRange = 0;

    hover = ptr.on && !grab ? hit(ptr.x, ptr.y) : null;
    var lock = grab || hover;

    if (ptr.on) {
      // the reticle eases toward the pointer, or out to frame whatever it locks onto
      var tx = lock ? lock.x : ptr.x, ty = lock ? lock.y : ptr.y, ts = lock ? lock.r + 9 * S : 12;
      if (!ret.on) { ret.x = tx; ret.y = ty; ret.s = ts; ret.on = true; }
      ret.x += (tx - ret.x) * .35;
      ret.y += (ty - ret.y) * .35;
      ret.s += (ts - ret.s) * .35;

      var px = Math.round(ptr.x) + .5, py = Math.round(ptr.y) + .5, gap = 20, k, o, t;

      // scope lines, clear in the middle, with ruler ticks near the pointer
      ctx.lineWidth = 1;
      ctx.strokeStyle = col.web;
      ctx.globalAlpha = .16;
      ctx.beginPath();
      ctx.moveTo(0, py); ctx.lineTo(px - gap, py);
      ctx.moveTo(px + gap, py); ctx.lineTo(W, py);
      ctx.moveTo(px, 0); ctx.lineTo(px, py - gap);
      ctx.moveTo(px, py + gap); ctx.lineTo(px, H);
      ctx.stroke();
      ctx.globalAlpha = .4;
      ctx.beginPath();
      for (k = 2; k <= 9; k++) {
        o = k * 12; t = k % 3 === 0 ? 5 : 2.5;
        ctx.moveTo(px - o, py - t); ctx.lineTo(px - o, py + t);
        ctx.moveTo(px + o, py - t); ctx.lineTo(px + o, py + t);
        ctx.moveTo(px - t, py - o); ctx.lineTo(px + t, py - o);
        ctx.moveTo(px - t, py + o); ctx.lineTo(px + t, py + o);
      }
      ctx.stroke();

      // dashed probe beams to anything in reach
      ctx.setLineDash([4, 4]);
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        dx = n.x - ptr.x; dy = n.y - ptr.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach || d <= n.r) continue;
        inRange++;
        ctx.globalAlpha = (1 - d / reach) * .75;
        ctx.strokeStyle = col[n.k];
        ctx.beginPath();
        ctx.moveTo(ptr.x, ptr.y);
        ctx.lineTo(n.x - dx / d * n.r, n.y - dy / d * n.r);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      setReadout('probe x:' + pad(ptr.x) + ' y:' + pad(ptr.y) + ' / ' + inRange + ' in range');
    } else {
      ret.on = false;
    }

    ctx.font = font();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.y + n.r < 0) continue;
      var c = col[n.k], lit = n === grab || n === hover;

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = lit ? c : col.fill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c;
      ctx.stroke();

      if (n.core) {
        ctx.setLineDash([2, 5]);
        ctx.lineWidth = 1;
        ctx.globalAlpha = .6;
        ctx.strokeStyle = lit ? col.bg : c;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r - 5 * S, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = lit ? col.bg : c;
      ctx.fillText(n.label, n.x, n.y + 1);
    }

    if (ptr.on) reticle(lock);
  }

  /* targeting reticle: corner brackets, a spinning ring on lock, a pip and a HUD tag */
  function reticle(lock) {
    var c = grab ? col.hot : lock ? col[lock.k] : col.web;
    var x = ret.x, y = ret.y, s = ret.s, len = Math.max(5, Math.min(14 * S, s * .42));

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s + len); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + len, y - s);
    ctx.moveTo(x + s - len, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + len);
    ctx.moveTo(x + s, y + s - len); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - len, y + s);
    ctx.moveTo(x - s + len, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - len);
    ctx.stroke();

    if (lock) {
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = -((performance.now() / 45) % 10);
      ctx.globalAlpha = .85;
      ctx.beginPath();
      ctx.arc(lock.x, lock.y, lock.r + 4 * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    }

    // pip sits on the true pointer position; the brackets trail it slightly
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(ptr.x) - 1.5, Math.round(ptr.y) - 1.5, 3, 3);

    var tag = grab ? 'HOLD // ' + grab.label : lock ? 'LOCK // ' + lock.label : pad(ptr.x) + ',' + pad(ptr.y);
    ctx.font = '600 ' + Math.max(9.5, 10 * S).toFixed(1) + 'px "IBM Plex Mono", ui-monospace, monospace';
    var tw = ctx.measureText(tag).width + 12, th = 18, bx = x + s + 6, by = y + s + 6;
    if (bx + tw > W - 4) bx = x - s - 6 - tw;
    if (by + th > H - 4) by = y - s - 6 - th;
    ctx.globalAlpha = .92;
    ctx.fillStyle = col.bg;
    ctx.fillRect(bx, by, tw, th);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = c;
    ctx.strokeRect(Math.round(bx) + .5, Math.round(by) + .5, Math.round(tw) - 1, th - 1);
    ctx.fillStyle = c;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, bx + 6, by + th / 2 + .5);
  }

  /* ---------- loop: fixed timestep, sleeps when settled ---------- */
  function frame(now) {
    if (!running) return;
    acc += Math.min(64, last ? now - last : STEP);
    last = now;
    var n = 0;
    while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; }
    if (n === 4) acc = 0;
    draw();

    var moving = grab || ptr.on || nodes.some(function (p) {
      return Math.abs(p.x - p.px) + Math.abs(p.y - p.py) > .12;
    });
    still = moving ? 0 : still + 1;
    if (still > 120) { running = false; return; }
    window.requestAnimationFrame(frame);
  }

  function wake() {
    if (running || !visible || reduce || !nodes.length) return;
    running = true; still = 0; last = 0; acc = 0;
    window.requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  function locate(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (ptr.on) { ptr.dx = x - ptr.x; ptr.dy = y - ptr.y; } else { ptr.dx = ptr.dy = 0; }
    ptr.x = x; ptr.y = y;
  }

  function idle() {
    ptr.on = false; hover = null;
    setReadout('probe idle');
    draw();
  }

  function bindInput() {
    cv.classList.add('is-live');
    cv.addEventListener('pointermove', function (e) {
      locate(e);
      ptr.on = true;
      ptr.speed = Math.min(40, Math.sqrt(ptr.dx * ptr.dx + ptr.dy * ptr.dy));
      wake();
    });
    cv.addEventListener('pointerleave', function () { if (!grab) idle(); });
    cv.addEventListener('pointerdown', function (e) {
      locate(e);
      ptr.on = true;
      var n = hit(ptr.x, ptr.y);
      if (!n) return;
      grab = n;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      wake();
    });
    function release(e) {
      if (grab) {
        grab = null;
        try { cv.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      if (e.pointerType !== 'mouse') idle();
    }
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
  }

  /* ---------- boot ---------- */
  function start() {
    readColors();
    resize();

    var rq = 0;
    window.addEventListener('resize', function () {
      window.cancelAnimationFrame(rq);
      rq = window.requestAnimationFrame(function () { resize(); wake(); });
    });
    if (document.fonts && document.fonts.load) {
      document.fonts.load(font()).then(function () { measure(); draw(); wake(); }, function () {});
    }
    if (!reduce) bindInput();

    function enter() {
      if (!dropped) {
        dropped = true;
        spawn();
        if (reduce) { for (var k = 0; k < 600; k++) step(); draw(); return; }
      }
      wake();
    }

    if (!('IntersectionObserver' in window)) { visible = true; enter(); return; }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) enter(); else running = false;
    }, { threshold: .2 }).observe(cv);
  }

  // wait for the globe intro to hand over, so the drop is not wasted behind it
  if (window.__introDone || !root.classList.contains('is-loading')) start();
  else document.addEventListener('intro:done', start, { once: true });
})();
