/* ============================================================
   Intro: dotted globe spins to India, pins Bhubaneswar, zooms in,
   flashes white, hands over to the page.

   Loaded synchronously in <head> so the play / don't-play decision
   lands before first paint. Hand-drawn on a 2D canvas: no libraries,
   nothing inline, so it stays inside the CSP (script-src 'self').

   Plays on every load. Never plays under reduced-motion.
   Any key, click, wheel or touch skips it.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  function announce() {
    window.__introDone = true;
    var ev;
    try { ev = new CustomEvent('intro:done'); }
    catch (e) { ev = document.createEvent('Event'); ev.initEvent('intro:done', false, false); }
    document.dispatchEvent(ev);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvasOk = !!document.createElement('canvas').getContext;

  if (reduce || !canvasOk) { window.__introDone = true; return; }

  root.classList.add('is-loading');

  /* ---------- geography ---------- */
  var D = Math.PI / 180;
  var PIN = { lat: 20.2961, lon: 85.8245 }; // Bhubaneswar

  // India outline, [lon, lat]. Simplified by hand; good to about half a degree.
  var IN = [
    [68.2,23.6],[69.9,22.4],[70.6,20.8],[72.6,21.3],[72.8,19.0],[73.7,15.6],[74.8,12.9],[76.2,9.9],
    [77.5,8.1],[78.2,8.9],[79.8,10.3],[80.3,13.1],[80.2,15.2],[82.3,16.6],[84.8,19.2],[86.8,20.4],
    [87.0,21.5],[88.2,21.6],[88.9,21.9],[88.7,23.0],[88.6,24.3],[88.0,25.3],[88.4,26.4],[89.9,25.9],
    [92.0,25.1],[91.9,24.1],[92.4,22.8],[92.7,22.0],[93.3,22.4],[94.2,23.9],[94.6,25.5],[95.3,26.7],
    [97.2,27.8],[96.2,29.2],[94.3,29.3],[92.0,27.8],[89.0,26.8],[88.9,27.9],[88.0,27.1],[84.0,27.4],
    [80.1,28.8],[81.0,30.2],[79.2,31.4],[78.7,32.5],[79.5,33.0],[79.9,34.4],[77.8,35.5],[75.8,36.0],
    [73.9,34.7],[74.3,32.9],[74.6,31.0],[73.9,30.1],[71.9,27.9],[70.4,28.0],[69.5,26.7],[70.8,25.2],
    [68.8,24.3]
  ];

  function inIndia(lon, lat) {
    var hit = false;
    for (var i = 0, j = IN.length - 1; i < IN.length; j = i++) {
      var xi = IN[i][0], yi = IN[i][1], xj = IN[j][0], yj = IN[j][1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  // point = [sinLat, cosLat, lon(rad)]
  function pt(latDeg, lonDeg) { var la = latDeg * D; return [Math.sin(la), Math.cos(la), lonDeg * D]; }

  /* ---------- state ---------- */
  var loader, flash, cv, ctx, lines, W, H, cx, cy, R0;
  var bg = [], ind = [], grat = [];
  var t0 = 0, flashed = false, finished = false, failsafe = 0;
  var L0 = 0, sP = 0, cP = 1;
  var LINE_AT = [0, 400, 1100, 1750, 2350, 2900];
  var T_ROT = 1900, T_ZOOM0 = 2550, T_ZOOM1 = 3500, T_FLASH = 3320, ZMAX = 9;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
  function lerp(a, b, v) { return a + (b - a) * v; }

  function build() {
    // uniform dotted sphere (Fibonacci lattice); India is drawn separately at higher density
    var N = 2600, GA = Math.PI * (3 - Math.sqrt(5)), i;
    for (i = 0; i < N; i++) {
      var y = 1 - 2 * (i + .5) / N;
      var lat = Math.asin(y) / D;
      var lon = ((i * GA) % (2 * Math.PI)) / D - 180;
      if (!inIndia(lon, lat)) bg.push(pt(lat, lon));
    }
    for (var la = 6; la <= 37; la += .5) {
      for (var lo = 68; lo <= 97.5; lo += .5) if (inIndia(lo, la)) ind.push(pt(la, lo));
    }
    // graticule every 20 degrees, sampled every 3
    var a, b, line;
    for (a = -180; a < 180; a += 20) { line = []; for (b = -90; b <= 90; b += 3) line.push(pt(b, a)); grat.push(line); }
    for (a = -80; a <= 80; a += 20) { line = []; for (b = -180; b <= 180; b += 3) line.push(pt(a, b)); grat.push(line); }
  }

  var P = [0, 0, 0];
  function proj(p, R) {
    var dl = p[2] - L0, cdl = Math.cos(dl);
    P[0] = cx + R * p[1] * Math.sin(dl);
    P[1] = cy - R * (cP * p[0] - sP * p[1] * cdl);
    P[2] = sP * p[0] + cP * p[1] * cdl; // > 0 means front hemisphere
    return P;
  }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var wide = W > 760;
    cx = wide ? W * .62 : W * .5;
    cy = wide ? H * .5 : H * .4;
    R0 = Math.min(wide ? W * .28 : W * .42, H * .34);
  }

  function frame(now) {
    if (finished) return;
    if (!t0) t0 = now;
    var t = now - t0, k, i, p;

    for (k = 0; k < lines.length; k++) if (t >= LINE_AT[k]) lines[k].classList.add('on');

    var a = ease(clamp(t / T_ROT));
    L0 = lerp(-40, PIN.lon, a) * D;
    var P0 = lerp(-8, PIN.lat, a) * D;
    sP = Math.sin(P0); cP = Math.cos(P0);

    var z = clamp((t - T_ZOOM0) / (T_ZOOM1 - T_ZOOM0));
    var R = R0 * (.84 + .16 * ease(clamp(t / 800))) * Math.pow(ZMAX, z * z);
    var fade = clamp(t / 450);

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0b0a';
    ctx.fillRect(0, 0, W, H);

    // graticule
    ctx.globalAlpha = fade * (1 - z) * .9;
    ctx.strokeStyle = 'rgba(235,232,223,.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < grat.length; i++) {
      var pen = false;
      for (k = 0; k < grat[i].length; k++) {
        p = proj(grat[i][k], R);
        if (p[2] > 0) { if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); pen = true; }
        else pen = false;
      }
    }
    ctx.stroke();

    // rim
    ctx.globalAlpha = fade * (1 - z);
    ctx.strokeStyle = 'rgba(200,255,46,.32)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // sphere dots
    var ds = Math.max(1.7, R / 190);
    ctx.fillStyle = '#a19d90';
    for (i = 0; i < bg.length; i++) {
      p = proj(bg[i], R);
      if (p[2] <= 0 || p[0] < -ds || p[0] > W + ds || p[1] < -ds || p[1] > H + ds) continue;
      ctx.globalAlpha = fade * (.2 + .65 * p[2]);
      ctx.fillRect(p[0] - ds / 2, p[1] - ds / 2, ds, ds);
    }

    // India, lit
    var is = Math.max(1.5, R * .0087 * .42);
    ctx.fillStyle = '#c8ff2e';
    for (i = 0; i < ind.length; i++) {
      p = proj(ind[i], R);
      if (p[2] <= 0 || p[0] < -is || p[0] > W + is || p[1] < -is || p[1] > H + is) continue;
      ctx.globalAlpha = fade * (.3 + .7 * p[2]);
      ctx.fillRect(p[0] - is / 2, p[1] - is / 2, is, is);
    }

    // pin, crosshair, label
    var pa = clamp((t - (T_ROT - 250)) / 380);
    if (pa > 0) {
      p = proj(pt(PIN.lat, PIN.lon), R);
      var px = p[0], py = p[1], cl = ease(pa), lab = pa * (1 - z * 1.6);

      ctx.globalAlpha = .5 * (1 - z * .6);
      ctx.strokeStyle = '#c8ff2e';
      ctx.beginPath();
      ctx.moveTo(px - cl * px, py); ctx.lineTo(px - 16, py);
      ctx.moveTo(px + 16, py);      ctx.lineTo(px + cl * (W - px), py);
      ctx.moveTo(px, py - cl * py); ctx.lineTo(px, py - 16);
      ctx.moveTo(px, py + 16);      ctx.lineTo(px, py + cl * (H - py));
      ctx.stroke();

      var ph = ((t - T_ROT + 900) % 900) / 900;
      ctx.globalAlpha = pa * (1 - ph);
      ctx.strokeStyle = '#ff5a1f';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 6 + 30 * ph, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;

      var s = 5 * pa * (1 + z * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff5a1f';
      ctx.beginPath();
      ctx.moveTo(px, py - s); ctx.lineTo(px + s, py); ctx.lineTo(px, py + s); ctx.lineTo(px - s, py);
      ctx.closePath(); ctx.fill();

      if (lab > 0) {
        ctx.globalAlpha = lab;
        ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillStyle = '#c8ff2e';
        ctx.fillText('BHUBANESWAR, IN', px + 22, py - 24);
        ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillStyle = '#a9a597';
        ctx.fillText('20.2961 N  85.8245 E', px + 22, py - 8);
      }
    }

    if (t >= T_FLASH) skip();
    window.requestAnimationFrame(frame);
  }

  function skip() {
    if (flashed) return;
    flashed = true;
    if (flash) flash.classList.add('on');
    window.setTimeout(finish, 270);
  }

  function onKey(e) { if (!e.ctrlKey && !e.metaKey && !e.altKey) skip(); }

  function finish() {
    if (finished) return;
    finished = true;
    window.clearTimeout(failsafe);
    window.removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('is-loading');
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    if (document.body) document.body.style.overflow = '';
    if (flash) {
      flash.classList.remove('on');
      flash.classList.add('off');
      window.setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 900);
    }
    announce();
  }

  function start() {
    loader = document.getElementById('loader');
    flash = document.getElementById('loaderFlash');
    cv = document.getElementById('loaderGlobe');
    if (!loader || !cv) { finish(); return; }
    ctx = cv.getContext('2d');
    lines = loader.querySelectorAll('.loader-log p');

    document.body.style.overflow = 'hidden';
    build();
    size();
    window.addEventListener('resize', size);

    var skipBtn = document.getElementById('loaderSkip');
    if (skipBtn) skipBtn.addEventListener('click', skip);
    loader.addEventListener('click', skip);
    loader.addEventListener('wheel', skip, { passive: true });
    loader.addEventListener('touchstart', skip, { passive: true });
    document.addEventListener('keydown', onKey, true);

    failsafe = window.setTimeout(skip, 7000);
    window.requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', function () {
    try { start(); }
    catch (err) {
      // never leave the page covered: drop the overlay and carry on without the intro
      flashed = true;
      finish();
    }
  });
})();
