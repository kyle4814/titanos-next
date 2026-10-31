// Shared UI parts: placeholder media, product card, breadcrumb, pager, empty and loading states.
import { h, icon, nf, hashHref, announce } from './util.js';
import { projects } from './projects.js';

export function shapeFor(catId = '') {
  if (/sheet|torch|membranes-accessories|tapes/.test(catId)) return 'roll';
  const l2 = catId.split('/').slice(0, 2).join('/');
  const MAP = { 'construction/concrete': 'block', 'construction/concrete-repair-protection': 'wrench', 'construction/tile-stone-installationsystems': 'tile', 'construction/sealants-adhesives': 'cartridge', 'construction/waterproofing': 'drop', 'construction/flooring': 'layers', 'construction/grouts-anchoring': 'bolt', 'construction/structural-strengthening': 'beam', 'construction/roofing': 'roof', 'construction/landscape-buildingproducts': 'leaf' };
  if (MAP[l2]) return MAP[l2];
  if (/^industry\//.test(catId)) return 'cartridge';
  if (catId === 'construction') return 'wall';
  return 'pail';
}
/** Neutral placeholder: drawn for categories, and for any product without a published packshot or whose picture fails to load. */
export function placeholder(catId, label = 'Product image') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + shapeFor(catId)); s.append(u);
  return h('div', { class: 'ph', role: 'img', 'aria-label': label + ' (placeholder)' }, s, h('small', null, 'Image placeholder'));
}

/** Product packshot: a fixed-size box (width/height set, so the layout never shifts), loaded on demand, falls back to the placeholder. */
export function packshot(img, catId, name, big = false) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return placeholder(catId, name); // offline: pictures are never cached, so draw the placeholder instead of a failed request
  const alt = img && img.alt ? img.alt : name;
  const i = h('img', { class: 'packshot' + (img.stock ? ' packshot--stock' : ''), src: big ? img.src2x : img.src, width: String(img.width), height: String(img.height), alt, loading: big ? 'eager' : 'lazy', decoding: 'async' });
  if (!big) i.setAttribute('srcset', img.src + ' 480w, ' + img.src2x + ' 960w'), i.setAttribute('sizes', '(min-width:64em) 25vw, (min-width:40em) 50vw, 100vw');
  i.addEventListener('error', () => { const tag = i.parentNode && i.parentNode.querySelector('.stock-tag'); if (tag) tag.remove(); i.replaceWith(placeholder(catId, name)); }, { once: true });
  return i;
}

/** Stock photo record for a category slug (the owner file of the photo, see data/cats.lite.json im). Illustrative, never a product picture. */
export const stockOf = (slug, alt) => ({ src: `assets/img/s/${slug}-480.webp`, src2x: `assets/img/s/${slug}-960.webp`, width: 480, height: 320, alt, stock: true });
/** Slug of a category's photo: the lite file carries it as im, the full categories file as image.src. */
export const catSlug = (c) => (c && (c.im || (c.image && (/img\/s\/(.+)-480\.webp$/.exec(c.image.src) || [])[1]))) || null;
export const STOCK_NOTE = 'Illustrative photo, not the product';
/** The fixed media box for a stock photo: the picture plus (for product photos) the small caption. Falls back to the placeholder. */
export function stockMedia(img, catId, name, { caption = false, big = false } = {}) {
  const pic = packshot(img, catId, name, big);
  const box = [pic];
  if (caption && pic.tagName === 'IMG') box.push(h('span', { class: 'stock-tag' }, STOCK_NOTE));
  return box;
}

/** One visible line: photo credit (author, licence, link to the Commons file page). Text comes from the API response saved in stock_source.json. */
export function creditLine(cr) {
  return h('p', { class: 'credit-line' }, h('span', { class: 'cl-k' }, 'Photo:'), h('a', { class: 'au link link--ext', href: cr.page, target: '_blank', rel: 'noopener noreferrer', title: cr.author }, cr.author),
    cr.licenseUrl ? h('a', { class: 'lic link link--ext', href: cr.licenseUrl, target: '_blank', rel: 'noopener noreferrer' }, cr.license) : h('span', { class: 'lic' }, cr.license), h('span', { class: 'cl-k' }, 'Wikimedia Commons'));
}

export function addButton(id, name) {
  const b = h('button', { type: 'button', class: 'btn btn--hollow', 'aria-pressed': String(projects.has(id)) });
  const paint = () => { const on = projects.has(id); b.setAttribute('aria-pressed', String(on)); b.replaceChildren(icon(on ? 'check' : 'plus', 'i--sm'), on ? 'In my projects' : 'Add to project'); b.setAttribute('aria-label', (on ? 'In my projects: ' : 'Add to project: ') + name); }; // the accessible name starts with the visible text (voice control says what it sees)
  b.addEventListener('click', () => { const on = projects.toggle(id, name); paint(); announce(on ? `${name} added to my projects` : `${name} removed from my projects`); });
  paint(); projects.onChange(() => { if (b.isConnected) paint(); });
  return b;
}

const imgOf = (id) => ({ src: `assets/img/p/${id}-480.webp`, src2x: `assets/img/p/${id}-960.webp`, width: 480, height: 480 });

export function productCard(p, dv) {
  const cat = dv.catById.get(p.c);
  const badges = [];
  if (p.pds) badges.push(h('span', { class: 'badge badge--ok' }, 'PDS'));
  if (p.sds) badges.push(h('span', { class: 'badge badge--ok' }, 'SDS'));
  if (!p.pds && !p.sds && p.d) badges.push(h('span', { class: 'badge' }, `${p.d} doc${p.d === 1 ? '' : 's'}`));
  return h('article', { class: 'card product-card' },
    h('div', { class: 'card-media' + (p.im === 1 ? ' card-media--shot' : '') + (p.im === 2 && catSlug(cat) ? ' card-media--stock' : '') },
      p.im === 1 ? packshot(imgOf(p.id), p.c, p.n) : (p.im === 2 && catSlug(cat) ? stockMedia(stockOf(catSlug(cat), `Illustrative photo of ${cat.name}, not the product`), p.c, p.n, { caption: true }) : placeholder(p.c, p.n))),
    h('div', { class: 'card-body' },
      h('div', { class: 'eyebrow' }, [p.b, cat ? cat.name : ''].filter(Boolean).join(' · ')),
      h('h3', null, h('a', { class: 'card-link', href: '#/product/' + p.id }, p.n)),
      p.s ? h('p', { class: 'clamp-3' }, p.s) : (p.t ? h('p', { class: 'tag-line clamp-2' }, p.t) : null),
      h('div', { class: 'badges' }, badges),
      h('div', { class: 'card-actions' }, addButton(p.id, p.n))));
}

export function categoryCard(c, dv) {
  return h('article', { class: 'card cat-card' },
    h('div', { class: 'card-media' + (catSlug(c) ? ' card-media--stock' : '') }, catSlug(c) ? stockMedia(stockOf(catSlug(c), `Illustrative photo for ${c.name}`), c.id, c.name) : placeholder(c.id, c.name)),
    h('div', { class: 'card-body' },
      h('h3', null, h('a', { class: 'card-link', href: '#/category/' + c.id }, c.name)),
      c.description ? h('p', { class: 'clamp-3' }, c.description) : null,
      h('p', { class: 'count' }, `${nf.format(c.productCount)} product${c.productCount === 1 ? '' : 's'}`)));
}

export function breadcrumb(items) {
  return h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('ol', null, items.map((it, i) => h('li', null, i === items.length - 1 || !it.href ? h('span', { 'aria-current': i === items.length - 1 ? 'page' : null }, it.label) : h('a', { href: it.href }, it.label)))));
}

export function pager({ page, pages, onPage }) {
  if (pages <= 1) return h('div');
  const mk = (label, p, opts = {}) => h('button', { type: 'button', disabled: opts.disabled, 'aria-current': opts.current ? 'page' : null, 'aria-label': opts.aria || `Page ${p}`, onclick: () => onPage(p) }, label);
  const nums = []; const add = (p) => nums.push(mk(String(p), p, { current: p === page }));
  const set = new Set([1, pages, page, page - 1, page + 1, page - 2, page + 2].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b); let prev = 0;
  for (const p of sorted) { if (p - prev > 1) nums.push(h('span', { 'aria-hidden': 'true' }, '…')); add(p); prev = p; }
  return h('nav', { class: 'pager', 'aria-label': 'Pagination' }, mk('Previous', page - 1, { disabled: page <= 1, aria: 'Previous page' }), ...nums, mk('Next', page + 1, { disabled: page >= pages, aria: 'Next page' }));
}

export function emptyState({ title, text, actions = [], tag = 'h2' }) {
  return h('div', { class: 'empty', role: 'status' }, h(tag, null, title), text ? h('p', null, text) : null, h('div', { class: 'btn-row btn-row--center' }, actions));
}
export function skeletonGrid(n = 6) {
  return h('div', { class: 'grid grid--3', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('div', { class: 'card' }, h('div', { class: 'card-media skeleton' }), h('div', { class: 'card-body' }, h('div', { class: 'sk-line', style: 'width:40%' }), h('div', { class: 'sk-line', style: 'width:80%;height:1.4rem' }), h('div', { class: 'sk-line' }), h('div', { class: 'sk-line', style: 'width:70%' })))));
}
export function errorState(err, retry) {
  return h('div', { class: 'container section' }, h('div', { class: 'notice notice--err', role: 'alert' }, icon('alert'), h('div', null, h('strong', null, 'This page could not load its data. '), String(err && err.message || err), ' ', retry ? h('button', { class: 'btn btn--hollow', type: 'button', onclick: retry }, 'Try again') : null)));
}
export { hashHref };
