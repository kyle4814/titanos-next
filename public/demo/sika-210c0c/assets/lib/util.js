// Small DOM and text helpers. No dependencies.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** h('div', {class:'x', onclick:fn, 'aria-label':'..'}, child, [children], 'text') -> Element. null/false children are skipped. */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export function frag(...kids) { const f = document.createDocumentFragment(); add(f, kids); return f; }

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** SVG icon from the inline sprite in index.html */
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'i ' + cls); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + name);
  s.append(u); return s;
}

export function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export const nf = new Intl.NumberFormat('en-AU');
export const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : (many || one + 's')}`;

export function debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/** lower case, strip marks (R) and (TM), diacritics, normalise dashes */
export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[®™©]/g, '').replace(/[‐-―]/g, '-');
}
const STOP = new Set(['a', 'an', 'the', 'for', 'and', 'or', 'of', 'on', 'in', 'to', 'with', 'my', 'is', 'it', 'at', 'by', 'me', 'i']);
export function tokens(s, keepStop = false) {
  const t = norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  return keepStop ? t : t.filter((w) => !STOP.has(w));
}

/** localStorage that never throws (private windows, blocked storage) */
export const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
};

export function hashParams(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  return { path: path || '/', params };
}
export function hashHref(path, params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  const qs = p.toString();
  return '#' + path + (qs ? '?' + qs : '');
}
export function setTitle(t, company = '') { document.title = t ? `${t} | ${company}` : company; }
export function announce(msg) { const r = document.getElementById('live'); if (r) { r.textContent = ''; setTimeout(() => { r.textContent = msg; }, 30); } }
export function titleCase(s) { return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

/** Move focus to el, retrying briefly: right after a panel opens the browser may not accept focus yet (visibility/transition timing). */
export function focusSoon(el, tries = 12, gap = 40) {
  let n = 0;
  const go = () => { if (!el || !el.isConnected) return; el.focus({ preventScroll: true }); if (document.activeElement !== el && ++n < tries) setTimeout(go, gap); };
  setTimeout(go, 0);
}
