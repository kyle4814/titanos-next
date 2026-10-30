/* spec.js: copies specification.txt to the clipboard. Same-origin only, no dependencies. */
(function () {
  'use strict';
  var b = document.getElementById('spec-copy');
  if (!b) return;
  b.hidden = false;
  b.addEventListener('click', function () {
    fetch(b.getAttribute('data-src')).then(function (r) { return r.text(); }).then(function (t) {
      if (navigator.clipboard) return navigator.clipboard.writeText(t);
      var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a);
    }).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Copy failed, use the download'; });
  });
})();
