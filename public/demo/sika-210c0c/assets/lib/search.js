// Finder search over index.json: tokenised AND search with prefix tolerance, name-first scoring, small synonym map,
// plus category / brand / document filters and facet counts. Pure functions, no DOM.
import { norm, tokens } from './util.js';

const SYN = {
  glue: ['adhesive'], adhesive: ['glue', 'bond'], bond: ['adhesive'], caulk: ['sealant'], sealant: ['caulk', 'sealer'], tanking: ['waterproofing', 'membrane'],
  waterproof: ['waterproofing', 'membrane'], waterproofing: ['membrane', 'waterproof'], membrane: ['waterproofing'], leveller: ['levelling', 'self-levelling', 'screed'],
  screed: ['leveller', 'levelling'], levelling: ['leveller', 'screed'], grouting: ['grout'], grout: ['grouting'], tile: ['tiles', 'tiling'], tiles: ['tile', 'tiling'],
  tiling: ['tile', 'tiles'], porcelain: ['tile'], concrete: ['cement'], primer: ['primers', 'prime'], sds: ['safety'], msds: ['safety'], pds: ['data'],
};
const stem = (w) => w.replace(/(ing|ers|er|es|s)$/i, (m, g, off) => (off >= 3 ? '' : m));

export function buildSearch(index, catById) {
  const items = index.map((p) => {
    const path = p.c.split('/');
    const catNames = path.map((_, i) => (catById.get(path.slice(0, i + 1).join('/')) || {}).name || '').join(' ');
    return {
      p, nm: norm(p.n), nt: tokens(p.n), bt: tokens(p.b), tt: tokens([p.t, p.s, ...(p.a || [])].join(' ')), ct: tokens(catNames),
      catPath: path,
    };
  });
  const expand = (t) => { const out = new Set([t, stem(t)]); (SYN[t] || []).forEach((s) => { out.add(s); out.add(stem(s)); }); return [...out].filter((x) => x.length > 1 || /\d/.test(x)); };

  function scoreItem(it, qt, qfull) {
    let total = 0;
    for (const t of qt) {
      const alts = expand(t); let best = 0;
      // a one-letter word (the T in "Sikagard-62 T", the S in "SikaSwell S-2") scores when it is a whole word of the name and is otherwise ignored; it used to empty the results
      if (!alts.length) { if (it.nt.includes(t)) total += 12; continue; }
      for (const a of alts) {
        const w = a === t ? 1 : 0.7;
        let s = 0;
        if (it.nt.includes(a)) s = Math.max(s, 12 * w);
        else if (it.nt.some((x) => x.startsWith(a))) s = Math.max(s, 8 * w);
        else if (a.length >= 3 && it.nm.includes(a)) s = Math.max(s, 5 * w);
        if (it.bt.includes(a)) s = Math.max(s, 6 * w);
        if (it.ct.includes(a)) s = Math.max(s, 3 * w);
        else if (it.ct.some((x) => x.startsWith(a))) s = Math.max(s, 2 * w);
        if (it.tt.includes(a)) s = Math.max(s, 3 * w);
        else if (a.length >= 3 && it.tt.some((x) => x.startsWith(a))) s = Math.max(s, 2 * w);
        best = Math.max(best, s);
      }
      if (best === 0) return 0;
      total += best;
    }
    if (qfull && it.nm.startsWith(qfull)) total += 20;
    else if (qfull && it.nm.includes(qfull)) total += 10;
    return total;
  }

  /** textual search only; returns [{it, score}] (every item, score 0, when the query is empty) */
  function text(query) {
    const qt = tokens(query);
    if (!qt.length) return items.map((it) => ({ it, score: 0 }));
    const qfull = norm(query).trim();
    const out = [];
    for (const it of items) { const s = scoreItem(it, qt, qfull); if (s > 0) out.push({ it, score: s }); }
    return out;
  }

  /**
   * search({q, cat, brand:[...], docs:['pds','sds'], sort}) ->
   *   { rows:[index item], total, facets:{ cats: Map(catId -> n), brands: Map(brand -> n), pds:n, sds:n } }
   * Facet counts come from the text-matched set with every OTHER filter applied, so counts stay meaningful.
   */
  function search({ q = '', cat = '', brand = [], docs = [], sort = '' } = {}) {
    const base = text(q);
    const brandSet = new Set(brand);
    const passCat = (it) => !cat || it.p.c === cat || it.p.c.startsWith(cat + '/');
    const passBrand = (it) => !brandSet.size || brandSet.has(it.p.b);
    const passDocs = (it) => docs.every((d) => (d === 'pds' ? it.p.pds : d === 'sds' ? it.p.sds : true));
    const facets = { cats: new Map(), brands: new Map(), pds: 0, sds: 0 };
    for (const r of base) {
      const it = r.it;
      if (passBrand(it) && passDocs(it)) for (let i = 1; i <= it.catPath.length; i++) { const id = it.catPath.slice(0, i).join('/'); facets.cats.set(id, (facets.cats.get(id) || 0) + 1); }
      if (passCat(it) && passDocs(it)) facets.brands.set(it.p.b, (facets.brands.get(it.p.b) || 0) + 1);
      if (passCat(it) && passBrand(it)) { if (it.p.pds) facets.pds++; if (it.p.sds) facets.sds++; }
    }
    const rows = base.filter((r) => passCat(r.it) && passBrand(r.it) && passDocs(r.it));
    const byName = (a, b) => a.it.p.n.localeCompare(b.it.p.n, 'en', { sensitivity: 'base' });
    if (sort === 'name') rows.sort(byName);
    else if (sort === 'name-desc') rows.sort((a, b) => byName(b, a));
    else if (sort === 'docs') rows.sort((a, b) => b.it.p.d - a.it.p.d || byName(a, b));
    else if (q) rows.sort((a, b) => b.score - a.score || byName(a, b));
    else rows.sort((a, b) => a.it.p.c.localeCompare(b.it.p.c) || byName(a, b));
    return { rows: rows.map((r) => r.it.p), total: rows.length, facets };
  }

  /** quick suggestions for the header box */
  function suggest(query, n = 6) {
    return text(query).sort((a, b) => b.score - a.score || a.it.p.n.localeCompare(b.it.p.n)).slice(0, n).map((x) => x.it.p);
  }
  return { search, suggest, size: items.length };
}
