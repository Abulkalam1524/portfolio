/* 404 page: shows the path that was actually requested and decrypts the
   status code out of random hex. External (not inline) so it satisfies the
   site CSP: script-src 'self'. textContent only, never innerHTML, so a
   crafted path cannot inject markup. */
(function () {
  'use strict';

  var path = location.pathname.slice(0, 80) || '/';
  var url = document.getElementById('nf-url');
  var ls = document.getElementById('nf-path');
  if (url) url.textContent = (location.host ? location.protocol + '//' + location.host : '') + path;
  if (ls) ls.textContent = path;

  var code = document.getElementById('nf-code');
  if (!code || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var HEX = '0123456789abcdef', plain = code.textContent, n = plain.length, t0 = 0, last = 0;
  var cur = plain.split('').map(function () { return HEX.charAt((Math.random() * 16) | 0); });
  code.textContent = cur.join('');

  window.requestAnimationFrame(function frame(now) {
    if (!t0) t0 = last = now;
    var t = now - t0, k = t < 500 ? 0 : Math.min(n, Math.floor((t - 500) / 180) + 1);
    if (t >= 500 && now - last > 60) {
      last = now;
      for (var i = k; i < n; i++) cur[i] = HEX.charAt((Math.random() * 16) | 0);
    }
    code.textContent = plain.slice(0, k) + cur.slice(k).join('');
    if (k < n) window.requestAnimationFrame(frame);
  });
})();
