// Data layer UI: provenance chip and "How I know" (T04), page-cited rates and published times (T15, T21), safety quotes (T16),
// document link health on the product page (T03). The per-product draft specification is the portal builder's Specification tab; the system-level one is in sheet_data.js (T20). Everything is read from same-host files; nothing here calls out.
import { h, icon } from './util.js';
import { data, documents } from './data.js';

// The rule modules are loaded on first use (a product page with data, or the first advisor question), not on every page.
let M;
const mods = () => (mods.p ||= Promise.all([import('../assistant/apply.js'), import('../assistant/times.js'), import('../assistant/clause.js'), import('../assistant/answer.js')]).then(([a, t, c, n]) => (M = { ...a, ...t, ...c, plain: n.plain })));
const plain = (x) => (M ? M.plain(x) : String(x));

const base = new URL('../../data/', import.meta.url);
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../apply_data.css', import.meta.url).href; document.head.append(l); }
css();

/* ---- T03: link health. The status file is merged into the product page's own document copies. */
export async function mergeDocStatus(list) {
  if ((list || []).every((d) => d.http)) return; // speed: the split build already carries the verdicts inside the product file, so documents.json is not fetched
  const D = await documents();
  for (const d of list || []) { const m = D.byId.get(d.id); if (m) d.http = m.http; }
}
/** Is a data sheet URL safe to offer? Looks the URL up in the documents list; unknown URLs are offered (they came from a data sheet we read). */
let urlMap;
export async function linkOk(url) {
  if (!urlMap) { const D = await documents(); urlMap = new Map(D.docs.map((d) => [d.url, d])); }
  const d = urlMap.get(url); return !d || !d.http || d.http.status === 200;
}

/* ---- lazy per-product data */
const cache = new Map(); let idxP;
async function manifestHas(name) { const m = await data.manifest(); return m.files.includes(name); }
function index() { return (idxP ||= fetch(new URL('k/_index.json', base)).then((r) => (r.ok ? r.json() : null)).catch(() => null)); } // speed: read directly (no manifest round trip first)
async function fetchOpt(dir, id, listKey) {
  const ix = await index(); if (!ix || !ix[listKey].includes(id)) return null;
  const key = dir + '/' + id; if (!cache.has(key)) cache.set(key, fetch(new URL(`${dir}/${encodeURIComponent(id)}.json`, base)).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(key);
}
export const loadK = (id) => fetchOpt('k', id, 'k');
/** Speed: called by app.js the moment a product route is opened. Starts the files the product page will ask for, in parallel with the product file itself. */
export function warmProduct(id) {
  index(); mods().catch(() => {}); data.specIndex().catch(() => {});
  data.product(id).then((p) => { if (p && p.kk) { const key = 'k/' + id; if (!cache.has(key)) cache.set(key, fetch(new URL(`k/${encodeURIComponent(id)}.json`, base)).then((r) => (r.ok ? r.json() : null)).catch(() => null)); } }).catch(() => {});
}

let depsP;
async function deps() {
  return (depsP ||= (async () => {
    const [ix, products] = await Promise.all([index(), data.products()]);
    return { tax: ix ? ix.taxonomy : null, products: new Map(products.map((p) => [p.id, p])), load: loadK, mismatch: new Set(ix ? ix.rate_mismatch || [] : []) };
  })());
}
/** Drop-in for engine.ask: the engine's answer plus evidence, page-cited rates, safety quotes and published times. */
export async function askWithData(engine, text, state) { await mods(); return M.applyAsk(engine, text, state, await deps()); }

/* ---- T04: chip and How I know, used by the advisor panel */
export function chipEl(status, text) { return h('span', { class: 'chip-status', 'data-status': status }, text); }
export function hikEl(evs) {
  const list = (evs || []).filter((e) => e && (e.quote || e.url));
  if (!list.length) return null;
  return h('details', { class: 'hik' }, h('summary', null, 'How I know'),
    h('ul', null, list.map((e) => h('li', null,
      e.quote ? h('blockquote', null, e.quote) : null,
      h('span', { class: 'hik-src' }, e.url ? h('a', { href: e.url + (e.kind === 'pds' && e.page ? `#page=${e.page}` : ''), target: '_blank', rel: 'noopener noreferrer' }, e.label || 'Source', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')) : (e.label || 'Source'))))));
}
/** Wraps a rendered block with its status chip, a collapsed How I know, and any note or conditions. */
export function decorateBlock(node, b) {
  if (!node || !b || !b.chip) return node;
  const kids = [node];
  if (b.note) kids.push(h('p', { class: 'blk-note' }, b.note));
  const conds = (b.rows || []).flatMap((r) => r.conds || []); if (conds.length) kids.push(h('p', { class: 'blk-note' }, [...new Set(conds)].join(' ')));
  kids.push(chipEl(b.status || 'UNKNOWN', b.chip));
  const hk = hikEl(b.evidence); if (hk) kids.push(hk);
  return h('div', { class: 'blk' }, kids);
}

/* ---- product page tabs */
const srcLine = (s) => !s ? null : h('span', { class: 'src' }, ' ', h('a', { class: 'link link--ext', href: s.u + (s.t === 'PDS' && s.p ? `#page=${s.p}` : ''), target: '_blank', rel: 'noopener noreferrer' }, `${s.t === 'PDS' ? 'Data sheet' : s.t === 'SDS' ? 'Safety data sheet' : 'Product page'}${s.v ? ', ' + plain(s.v) : ''}${s.p ? ', page ' + s.p : ''}`));
const notice = (t) => h('p', { class: 'notice' }, icon('info'), t);

function ratesTimesBody(k) {
  const { rateFacts, timesOf, programmeOf, PROGRAMME_CAVEAT } = M; const facts = rateFacts(k); const times = timesOf(k);
  const rate = facts.length ? h('div', null, h('h3', null, 'Published rate'), h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['What it is', 'The data sheet says', 'Source'].map((x) => h('th', null, x)))),
    h('tbody', null, facts.map((f) => h('tr', null, h('td', null, f.label), h('td', null, h('blockquote', null, f.text)), h('td', null, srcLine(f.s))))))))
    : h('div', null, h('h3', null, 'Published rate'), h('p', null, 'Not in the published data. ' + (k.rates && k.rates.status && /^published$/.test(k.rates.status) ? '' : 'Neither the data sheet nor the product page gives a consumption figure. Check the data sheet or ask technical services.')));
  let tm;
  if (times.length) {
    const cond = (t) => [t.at_c != null ? `${t.at_c} degrees C` : null, ...t.conditions].filter(Boolean).join('. ') || 'None stated beside the time';
    const trow = (label, t) => h('tr', null, h('td', null, label), h('td', null, h('blockquote', null, t.text)), h('td', null, cond(t)), h('td', null, srcLine(t.s)));
    const trs = programmeOf(k).flatMap((st) => (st.notPublished ? [h('tr', null, h('td', null, st.label), h('td', { colspan: '3' }, 'Time not published'))] : st.items.map((t) => trow(st.label, t))));
    for (const t of times.filter((x) => x.step === 'other')) trs.push(trow(t.label, t));
    tm = h('div', null, h('h3', null, 'Published times'), h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Step', 'The data sheet says', 'Conditions', 'Source'].map((x) => h('th', null, x)))), h('tbody', null, trs))), h('p', { class: 'blk-note' }, PROGRAMME_CAVEAT));
  } else tm = h('div', null, h('h3', null, 'Published times'), h('p', null, 'Not in the published data. No open, setting, pot life or recoat time was found for this product.'));
  return h('div', { class: 'data-tab' }, notice('Each line is the data sheet sentence, with its version and page. Where the data sheet is silent this page says so.'), rate, tm);
}

async function safetyBody(k) {
  const sds = M.pickSds(k);
  if (!sds) return h('div', { class: 'data-tab' }, notice('Quoted from the safety data sheet. Check the current SDS before use.'), h('p', null, 'No safety data sheet is listed for this product in the published data I hold. Check the company website or ask technical services.'));
  const ok = await linkOk(sds.url);
  const row = (label, it) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, it && it.text ? h('blockquote', null, plain(it.text)) : 'Not stated in this SDS'), h('td', null, it && it.s ? srcLine(it.s) : null));
  const list = (label, items) => (items && items.length ? items.map((it, i) => row(i ? '' : label, it)) : [row(label, null)]);
  const ppe = sds.ppe || {};
  const rows = [
    row('Signal word', sds.signal_word && sds.signal_word.value ? { text: sds.signal_word.value, s: sds.signal_word.s } : null),
    ...list('Hazard statements', sds.hazard_statements),
    ...Object.keys(ppe).map((key) => row(plain(ppe[key].label || key), ppe[key])),
    ...list('Storage', sds.storage), ...list('Handling', sds.handling),
    row('Transport (ADG)', sds.transport_adg && sds.transport_adg.text ? { text: sds.transport_adg.text, s: sds.transport_adg.s } : null),
    row('First aid', null),
  ];
  const pre = (sds.precautionary_statements || []);
  return h('div', { class: 'data-tab' },
    notice(`Quoted from the safety data sheet dated ${plain(sds.revision_date)}. Check the current SDS before use.`),
    h('p', null, `SDS revision date ${plain(sds.revision_date)}, version ${plain(sds.version)}${sds.sds_number ? ', SDS number ' + plain(sds.sds_number) : ''}${sds.pages ? ', ' + sds.pages + ' pages' : ''}. `,
      ok ? h('a', { class: 'link link--ext', href: sds.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the safety data sheet (PDF)') : h('span', { class: 'badge badge--warn' }, 'Link unavailable')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['What', 'The SDS says', 'Source'].map((x) => h('th', null, x)))), h('tbody', null, rows))),
    pre.length ? h('details', { class: 'hik' }, h('summary', null, `Precautionary statements (${pre.length})`), h('ul', null, pre.map((p) => h('li', null, h('blockquote', null, plain(p.text)), srcLine(p.s))))) : null,
    h('p', { class: 'blk-note' }, 'First aid measures are not held in the data behind this page: read section 4 of the safety data sheet.'));
}

/** Extra tabs for the product page: [{id,label,body()}]. Only tabs with data are returned. */
export async function extraTabs(p, ctx, docs) {
  const [, k] = await Promise.all([mods(), loadK(p.id)]);
  const tabs = [];
  if (k && k.rates) tabs.push({ id: 'rates', label: 'Rates and times', body: () => ratesTimesBody(k) });
  if (k && k.safety) { const holder = h('div', null, h('p', null, 'Loading the safety data sheet quotes...')); tabs.push({ id: 'safety', label: 'Safety', body: () => { safetyBody(k).then((el) => holder.replaceChildren(el)); return holder; } }); }
  return tabs;
}
