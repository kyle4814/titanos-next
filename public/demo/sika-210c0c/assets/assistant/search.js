// search.js: BM25 inverted index over products, categories, documents and pages, plus tolerant product-name matching.
import { tokenize, words, compact, normalise, stemCached, isStop, within1 } from './tokenize.js';

const K1 = 1.2, B = 0.6;

function addField(map, text, w) {
  if (!text) return;
  let n = 0;
  for (const t of tokenize(text)) { map.set(t, (map.get(t) || 0) + w); n += w; }
  map.__len = (map.__len || 0) + n;
}

function productFields(p) {
  const m = new Map();
  addField(m, p.name, 6);
  addField(m, String(p.id).replace(/-/g, ' '), 2);
  addField(m, p.brand, 1);
  addField(m, p.tagline, 3);
  addField(m, (p.breadcrumb || []).map(b => b.name).join(' '), 3);
  addField(m, p.summary, 2);
  addField(m, p.metaDescription, 1);
  addField(m, (p.attributes || []).join(' '), 2);
  addField(m, (p.usage || []).join(' '), 2.5);
  addField(m, (p.advantages || []).join(' '), 1.2);
  addField(m, p.packaging, 0.5);
  for (const s of p.sections || []) {
    const isFaq = !/^(Product Information|Application Information|Consumption|Technical Information|System information|Application steps|Sustainability)/.test(s.title);
    if (isFaq) addField(m, s.title, 1.5);
    if (s.title === 'Technical Information') continue;
    for (const it of s.items || []) { if (/^(Shelf life|Storage conditions|Density|Specific gravity|Composition)$/i.test(it.label)) continue; addField(m, it.label, 0.6); addField(m, it.text, isFaq ? 1 : 0.8); }
  }
  return m;
}

/** Build the index. Returns {search, nameMatch, docs, stats}. */
export function buildIndex({ products, documents, categories, pages }) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const docs = [];
  const maps = [];
  const prodName = new Map(products.map(p => [p.id, p.name]));
  for (const p of products) { docs.push({ kind: 'product', id: p.id }); maps.push(productFields(p)); }
  for (const c of categories) {
    const m = new Map(); addField(m, c.name, 5); addField(m, c.id.replace(/[-/]/g, ' '), 2); addField(m, c.description, 1);
    docs.push({ kind: 'category', id: c.id }); maps.push(m);
  }
  for (const d of documents) {
    const m = new Map(); addField(m, d.title, 4); addField(m, d.typeLabel || d.type, 3); addField(m, (d.products || []).map(id => prodName.get(id) || id).join(' '), 3);
    docs.push({ kind: 'document', id: d.id }); maps.push(m);
  }
  for (const pg of pages) {
    const m = new Map(); addField(m, pg.title, 4); addField(m, (pg.headings || []).join(' '), 2); addField(m, pg.excerpt, 1); addField(m, pg.metaDescription, 1);
    docs.push({ kind: 'page', id: pg.url }); maps.push(m);
  }
  const N = docs.length;
  const post = new Map();
  let total = 0, postings = 0;
  for (let i = 0; i < N; i++) {
    const m = maps[i]; const len = m.__len || 1; docs[i].len = len; total += len;
    for (const [t, tf] of m) {
      if (t === '__len') continue;
      let e = post.get(t); if (!e) { e = { d: [], f: [] }; post.set(t, e); }
      e.d.push(i); e.f.push(tf); postings++;
    }
    maps[i] = null;
  }
  const avg = total / Math.max(1, N);
  const byChar = new Map();
  for (const t of post.keys()) { const c = t[0]; (byChar.get(c) || byChar.set(c, []).get(c)).push(t); }
  const idf = df => Math.log(1 + (N - df + 0.5) / (df + 0.5));

  // product-name matching tables
  const nameDf = new Map();
  const prodMeta = products.map(p => {
    const nt = [...new Set(words(p.name).filter(w => !isStop(w)).map(stemCached))];
    for (const t of nt) nameDf.set(t, (nameDf.get(t) || 0) + 1);
    const brand = compact(p.brand || '');
    const cn = compact(p.name), ci = compact(String(p.id));
    const cnNoBrand = brand && cn.startsWith(brand) ? cn.slice(brand.length) : cn;
    return { p, nt, cn, ci, cnNoBrand };
  });
  const brandStems = new Set(products.map(p => stemCached(normalise(p.brand || ''))));

  function termInfo(t) {
    const e = post.get(t); if (e) return [t, e, 1];
    if (t.length >= 5 && !/\d/.test(t)) {
      for (const c of byChar.get(t[0]) || []) if (Math.abs(c.length - t.length) <= 1 && within1(t, c) && post.get(c).d.length >= 2) return [c, post.get(c), 0.6];
    }
    return null;
  }

  /** BM25 search: qTerms is Map(stem -> weight). Returns [{idx, kind, id, score}] best first. */
  function search(qTerms, { kinds, limit = 50, filter } = {}) {
    const acc = new Map();
    for (const [t, w] of qTerms) {
      const info = termInfo(t); if (!info) continue;
      const [, e, fz] = info; const I = idf(e.d.length) * w * fz;
      for (let k = 0; k < e.d.length; k++) {
        const i = e.d[k]; const dc = docs[i];
        if (kinds && !kinds.includes(dc.kind)) continue;
        const tf = e.f[k];
        acc.set(i, (acc.get(i) || 0) + I * tf * (K1 + 1) / (tf + K1 * (1 - B + B * dc.len / avg)));
      }
    }
    const out = [];
    for (const [i, s] of acc) { const dc = docs[i]; if (!filter || filter(dc)) out.push({ idx: i, kind: dc.kind, id: dc.id, score: s }); }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  /** Tolerant product-name matching: spacing, hyphens, case, registered marks. Returns [{id, score}] best first. */
  function nameMatch(text) {
    const ws = words(text).filter(Boolean);
    const out = new Map();
    const comps = new Set();
    const raw = normalise(text).match(/[a-z0-9]+/g) || [];
    for (let i = 0; i < raw.length; i++) { let c = ''; for (let j = i; j < Math.min(raw.length, i + 7); j++) { c += raw[j]; if (c.length >= 5) comps.add(c); } }
    const qs = new Set(ws.map(stemCached));
    for (const m of prodMeta) {
      let s = 0;
      if (comps.has(m.cn) || comps.has(m.cnNoBrand) && m.cnNoBrand.length >= 6 || (m.ci.length >= 5 && comps.has(m.ci))) s = 1;
      else if (m.nt.length) {
        let hit = 0, all = 0, distinct = 0;
        for (const t of m.nt) {
          const w = brandStems.has(t) ? 0.3 : Math.log(1 + products.length / (nameDf.get(t) || 1));
          all += w;
          if (qs.has(t)) { hit += w; const pe = post.get(t); const dfr = pe ? pe.d.length / N : 0; if (!brandStems.has(t) && (/\d/.test(t) || (nameDf.get(t) <= 3 && dfr < 0.2))) distinct++; }
        }
        s = distinct ? 0.95 * hit / all : 0;
        if (s < 0.6) s = 0;
      }
      if (s > 0) out.set(m.p.id, [s, m.cn.length]);
    }
    return [...out].map(([id, [score, len]]) => ({ id, score, len })).sort((a, b) => b.score - a.score || b.len - a.len);
  }

  const now = (typeof performance !== 'undefined' ? performance : Date).now();
  return { search, nameMatch, docs, idf, post, stats: { terms: post.size, postings, buildMs: Math.round((now - t0) * 10) / 10 } };
}
