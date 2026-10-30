(function () {
'use strict';
function rnd(x) { return Math.floor(x * 1e9 + 0.5) / 1e9; }
function fmt(n) { return String(Math.round(n * 100) / 100); }
function pairs(s) {
var out = [];
String(s || '').split(',').forEach(function (p) {
var b = p.split(':'), v = parseFloat(b[0]);
if (b.length === 2 && v > 0) out.push({ size: v, unit: b[1] });
});
return out;
}
function calc(o, m2, allow) {
var lo = parseFloat(o.low), hi = parseFloat(o.high), area = m2 * (1 + allow / 100), q1, q2;
if (!(lo > 0 && hi > 0) || !(m2 >= 1)) return null;
if (o.per === 'm2') { q1 = lo * area; q2 = hi * area; }
else if (o.per === 'm2-per-pack') {
var rp = pairs(o.ratePack)[0];
if (!rp) return null;
q1 = area / hi * rp.size; q2 = area / lo * rp.size;
} else return null;
var packs = pairs(o.packSizes).filter(function (p) { return p.unit === o.unit; }).map(function (p) {
return { size: p.size, unit: p.unit, low: Math.ceil(rnd(q1) / p.size), high: Math.ceil(rnd(q2) / p.size) };
});
return { low: q1, high: q2, unit: o.unit, packs: packs };
}
function text(r, basis) {
var u = r.unit === 'l' ? 'litres' : r.unit;
var s = 'You need about ' + (fmt(r.low) === fmt(r.high) ? fmt(r.low) : fmt(r.low) + ' to ' + fmt(r.high)) + ' ' + u;
if (basis) s += ' (based on ' + basis + ')';
s += '.';
if (r.packs.length) {
s += ' Packs, rounded up: ' + r.packs.map(function (p) {
return (p.low === p.high ? p.low : p.low + ' to ' + p.high) + ' x ' + fmt(p.size) + ' ' + p.unit;
}).join('; ') + '.';
}
return s;
}
function ptext(r) {
return text(r, null).replace('You need about ', '').replace('Packs, rounded up:', 'Packs:');
}
function read(el) {
return { low: el.getAttribute('data-rate-low'), high: el.getAttribute('data-rate-high'), unit: el.getAttribute('data-rate-unit'),
per: el.getAttribute('data-per'), ratePack: el.getAttribute('data-rate-pack'), packSizes: el.getAttribute('data-pack-sizes'), basis: el.getAttribute('data-basis') };
}
function update(doc) {
var m2 = parseFloat(doc.getElementById('m2').value), allow = parseFloat(doc.getElementById('allow').value);
if (!(allow >= 0)) allow = 0;
var res = doc.getElementById('m2-result'), ok = m2 >= 1;
res.textContent = ok ? 'For ' + fmt(m2) + ' m2' + (allow ? ' plus an allowance of ' + fmt(allow) + '%' : ' with no allowance') + '. Amounts are shown under each product.'
: 'Enter an area of at least 1 m2.';
var pm = doc.getElementById('ps-m2');
if (pm) pm.textContent = ok ? 'Area: ' + fmt(m2) + ' m2' + (allow ? ', allowance ' + fmt(allow) + '%.' : ', no allowance.') : 'Enter an area of at least 1 m2.';
doc.querySelectorAll('[data-rate-low]').forEach(function (el) {
var o = read(el), r = ok ? calc(o, m2, allow) : null;
if (el.getAttribute('data-pq')) { el.textContent = r ? ptext(r) : 'See data sheet'; return; }
var out = el.querySelector('.calc');
if (!out) return;
out.textContent = r ? text(r, o.basis) : (ok ? 'No quantity can be worked out from the published text. Check the data sheet.' : 'Enter an area of at least 1 m2.');
});
}
function num(v) { var n = parseFloat(v); return n === n && n >= 0 && n < 1e7 ? n : null; }
function shareUrl(doc, win) {
var base = win.location.href.split('#')[0].split('?')[0];
var m2 = num(doc.getElementById('m2').value), al = num(doc.getElementById('allow').value);
var q = [];
if (m2 !== null) q.push('m2=' + encodeURIComponent(fmt(m2)));
if (al) q.push('allow=' + encodeURIComponent(fmt(al)));
return base + (q.length ? '?' + q.join('&') : '');
}
function init(doc, win) {
var m = /[?&]m2=([^&#]*)/.exec(win.location.search || ''), a = /[?&]allow=([^&#]*)/.exec(win.location.search || '');
if (m && num(decodeURIComponent(m[1])) !== null) doc.getElementById('m2').value = fmt(num(decodeURIComponent(m[1])));
if (a && num(decodeURIComponent(a[1])) !== null) doc.getElementById('allow').value = fmt(num(decodeURIComponent(a[1])));
var tools = doc.getElementById('tools'), share = doc.getElementById('share-url');
function refresh() { update(doc); if (share) share.value = shareUrl(doc, win); }
refresh();
['m2', 'allow'].forEach(function (id) { doc.getElementById(id).addEventListener('input', refresh); });
if (tools) tools.hidden = false;
var pb = doc.getElementById('print-btn'), cb = doc.getElementById('copy-btn');
if (pb) pb.addEventListener('click', function () { win.print(); });
if (cb) cb.addEventListener('click', function () {
share.value = shareUrl(doc, win); share.select();
if (win.navigator.clipboard) win.navigator.clipboard.writeText(share.value).then(function () { cb.textContent = 'Copied'; }, function () { doc.execCommand('copy'); cb.textContent = 'Copied'; });
else { doc.execCommand('copy'); cb.textContent = 'Copied'; }
});
}
if (typeof module !== 'undefined' && module.exports) module.exports = { calc: calc, ptext: ptext, text: text, update: update, fmt: fmt, read: read, init: init, shareUrl: shareUrl };
if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);
})();
