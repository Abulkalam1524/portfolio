/* Shows the path that was actually requested on the 404 page.
   External (not inline) so it satisfies the site CSP: script-src 'self'.
   textContent only - never innerHTML - so a crafted path cannot inject markup. */
(function () {
  'use strict';
  var el = document.getElementById('nf-path');
  if (el) el.textContent = location.pathname.slice(0, 80) || '/';
})();
