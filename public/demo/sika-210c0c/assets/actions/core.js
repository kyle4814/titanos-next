// Actions v2, core helpers: the data store, product lookup and the card shape. Pure code, no model, no network of its own.
// A "store" is { get(path) -> Promise<json|null> } over the portal's data folder. The browser store uses fetch (same host only);
// the tests use a file store. Every card built by the handlers carries the source sentence for every figure it shows.

export const ESTIMATE_LINE = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
export const NOT_PUBLISHED = 'Not in the published data';
export const IN_BROWSER_NOTICE = 'Demo only. Projects, recent questions and gaps live in this browser only. Nothing is sent anywhere, nothing is shared, and clearing your browser data removes them.';

/** Plain text: no em or en dashes, no registered marks. */
export const plain = (s) => String(s == null ? '' : s).replace(/[®™]/g, '').replace(/\s*—\s*/g, ' - ').replace(/[–−]/g, '-').replace(/[ \t]{2,}/g, ' ').trim();
export const norm = (s) => plain(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** A store over a base URL (browser) with per-path caching. 404 or a network failure gives null, never a throw. */
export function fetchStore(base, fetchFn) {
  const f = fetchFn || ((...a) => fetch(...a));
  const cache = new Map();
  return {
    get(path) {
      if (!cache.has(path)) cache.set(path, f(new URL(path, base)).then((r) => (r.ok ? r.json() : null)).catch(() => null));
      return cache.get(path);
    },
  };
}

/** Data access used by every handler. All lookups are lazy and cached by the store. */
export function createData(store) {
  const g = (p) => store.get(p);
  const d = {
    index: () => g('index.json'),
    documents: () => g('documents.json'),
    selector: () => g('selector.json'),
    systems: () => g('actions/systems.json'),
    product: (id) => g('p/' + encodeURIComponent(id) + '.json'),
    k: (id) => g('k/' + encodeURIComponent(id) + '.json'),
    rate: (id) => g('finder/r/' + encodeURIComponent(id) + '.json'),
    spec: (id) => g('specs/' + encodeURIComponent(id) + '.json'),
    arate: (id) => g('actions/rates/' + encodeURIComponent(id) + '.json'),
    compat: (id) => g('actions/compat/' + encodeURIComponent(id) + '.json'),
    safety: (id) => g('actions/safety/' + encodeURIComponent(id) + '.json'),
    trees: () => g('actions/trees.json'),
    kindex: () => g('k/_index.json'),
    problems: () => g('knowledge/problems.json'),
  };
  let idx;
  d.finder = async () => {
    if (idx) return idx;
    const list = (await d.index()) || [];
    const df = new Map();
    const rows = list.map((p) => {
      const brand = norm(p.b);
      const toks = [...new Set(norm(p.n).split(' ').filter(Boolean))];
      const core = toks.filter((t) => t !== brand);
      for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
      return { id: p.id, name: plain(p.n), brand: p.b, n: norm(p.n), toks, core: core.length ? core : toks, cat: p.c };
    });
    const N = rows.length || 1;
    const w = (t) => Math.log(1 + N / (df.get(t) || 1));
    idx = { rows, byId: new Map(rows.map((r) => [r.id, r])), w, N };
    return idx;
  };
  d.docs = async () => {
    const docs = (await d.documents()) || [];
    return { list: docs, byId: new Map(docs.map((x) => [x.id, x])) };
  };
  return d;
}

const stemTok = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

/**
 * Find products named in free text. Returns [{id, name, score, at}] best first (distinct products, at most `max`).
 * A product matches when its whole normalised name is in the text, or when the distinctive words of its name are (weighted by rarity).
 */
export async function findProducts(data, text, max = 3) {
  const F = await data.finder();
  const q = ' ' + norm(text) + ' ';
  const qt = new Set(q.trim().split(' ').map(stemTok));
  const hits = [];
  for (const r of F.rows) {
    const full = q.indexOf(' ' + r.n + ' ');
    if (full >= 0) { hits.push({ id: r.id, name: r.name, score: 1000 + r.n.length, at: full }); continue; }
    const core = r.core.filter((t) => t.length > 0);
    if (!core.length) continue;
    let got = 0, tot = 0, missDigit = false, nGot = 0;
    for (const t of core) {
      const wt = F.w(t); tot += wt;
      if (qt.has(stemTok(t))) { got += wt; nGot++; } else if (/\d/.test(t)) missDigit = true;
    }
    if (missDigit) continue;
    const frac = got / tot;
    // a short generic name ("adhesive") must not match on one common word: demand real weight and most of the name
    // a long name may lose its last word ("Davco Grey One Pot" for "Davco Grey One Pot adhesive"); a short one may not
    if ((frac >= 0.8 && got >= 3.2) || (core.length >= 4 && nGot >= core.length - 1 && got >= 15)) {
      const first = core.map((t) => q.indexOf(' ' + t)).filter((i) => i >= 0);
      hits.push({ id: r.id, name: r.name, score: frac * 100 + got, at: first.length ? Math.min(...first) : 0 });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  // drop a product whose match is wholly inside a better, longer match of the same family (e.g. "Sikaflex-11 FC" inside "Sikaflex-11 FC Purform")
  const out = [];
  for (const h of hits) {
    if (out.some((o) => o.id === h.id)) continue;
    out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

/** Products in order of appearance in the text (used for "A vs B"). */
export async function findProductsInOrder(data, text, max = 4) {
  const hs = await findProducts(data, text, max + 4);
  const strong = hs.filter((h) => h.score >= 1000 || h.score >= (hs[0] ? hs[0].score * 0.8 : 0));
  const picked = [];
  for (const h of strong) {
    // skip a product whose name is a prefix of an already picked longer name at the same position
    if (picked.some((p) => p.at === h.at && p.score >= h.score)) continue;
    picked.push(h);
  }
  return picked.sort((a, b) => a.at - b.at).slice(0, max);
}

/** Card builder helpers. A row is { label, value, source?, input?, derived? }; a source is { url, label, sentence }. */
export const src = (url, label, sentence) => ({ url: url || '', label: plain(label || ''), sentence: plain(sentence || '') });
export const card = (action, kind, title, o = {}) => ({ type: 'action', action, kind, title: plain(title), status: 'published', rows: [], notes: [], buttons: [], exports: [], sources: [], ...o });
export const clarifyCard = (action, question, options, need, extra = {}) => card(action, 'clarify', 'One quick question', { status: 'clarify', clarify: { question: plain(question), options: options || [], need }, ...extra });
export const unknownCard = (action, title, reason, extra = {}) => card(action, 'unknown', title, { status: 'unknown', notes: [plain(reason)], handoff: true, ...extra });

/** Every sourced sentence of a card, flattened (used by the exports and by the property test). */
export function cardCells(c) {
  const cells = [];
  for (const r of c.rows || []) cells.push(r);
  if (c.table) for (const row of c.table.rows) for (const cell of row.cells) cells.push(cell);
  for (const s of c.sections || []) for (const r of [...(s.rows || []), ...(s.more || [])]) cells.push(r);
  return cells;
}

/** CSV text (RFC 4180 quoting) for a card: label, value, source label, source link, source sentence. Quantity cards end with the estimate line. */
export function cardCsv(c) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const out = [['Item', 'Value', 'Source', 'Link', 'Source sentence'].map(q).join(',')];
  const push = (label, cell) => out.push([label, cell.value, cell.source ? cell.source.label : '', cell.source ? cell.source.url : '', cell.source ? cell.source.sentence : ''].map(q).join(','));
  for (const r of c.rows || []) push(r.label, r);
  if (c.table) c.table.rows.forEach((row) => row.cells.forEach((cell, i) => push(row.label + ' / ' + (c.table.head[i + 1] || ''), cell)));
  for (const s of c.sections || []) for (const r of [...(s.rows || []), ...(s.more || [])]) push(s.title + ' / ' + r.label, r);
  if (c.estimate) out.push(q(ESTIMATE_LINE));
  return out.join('\r\n') + '\r\n';
}

/** Plain text print form of a card. */
export function cardText(c) {
  const L = [c.title, ''];
  if (c.summary) L.push(c.summary, '');
  const line = (label, cell) => L.push(`${label}: ${cell.value}${cell.source ? `  [${cell.source.label}${cell.source.url ? ' ' + cell.source.url : ''}]` : ''}`);
  for (const r of c.rows || []) line(r.label, r);
  if (c.table) { L.push(c.table.head.join(' | ')); c.table.rows.forEach((row) => L.push(row.label + ': ' + row.cells.map((x) => x.value).join(' | '))); }
  for (const s of c.sections || []) { L.push('', s.title); for (const r of [...(s.rows || []), ...(s.more || [])]) line(r.label, r); }
  for (const n of c.notes || []) L.push('', n);
  if (c.estimate) L.push('', ESTIMATE_LINE);
  return L.join('\n') + '\n';
}
