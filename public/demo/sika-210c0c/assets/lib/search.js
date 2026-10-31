// Finder search over index.json: tokenised AND search with prefix tolerance, name-first scoring, plus category / brand / document filters and facet counts.
// What the visitor typed is read by the shared matcher (assets/brain/match.js: trade slang, old names, spelling, synonym groups), the same one the
// advisor brain and the header search box use. Pure functions, no DOM.
import { normalise, tokens, interpret } from '../brain/match.js';

/** buildSearch(index, catById, { aliases }) -> { search, suggest, size }. aliases = parsed data/brain/alias.json (old names and nicknames -> product ids), optional. */
export function buildSearch(index, catById, opts = {}) {
  const alias = opts && opts.aliases && opts.aliases.alias ? opts.aliases.alias : null;
  const df = new Map();
  const items = index.map((p) => {
    const path = p.c.split('/');
    const catNames = path.map((_, i) => (catById.get(path.slice(0, i + 1).join('/')) || {}).name || '').join(' ');
    const it = { p, nm: normalise(p.n), nt: tokens(p.n), bt: tokens(p.b), tt: tokens([p.t, p.s, ...(p.a || [])].join(' ')), ct: tokens(catNames), leaf: tokens((catById.get(p.c) || {}).name || ''), catPath: path };
    for (const w of new Set([...it.nt, ...it.bt, ...it.tt, ...it.ct])) df.set(w, (df.get(w) || 0) + 1);
    return it;
  });
  const vocab = [...df.keys()], has = (w) => df.has(w);
  const byId = new Map(items.map((it) => [it.p.id, it]));

  /** how well one item answers one word (or any of its synonyms); 0 = not at all */
  function scoreWord(it, alts) {
    let best = 0;
    for (const [a, w] of alts) {
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
    return best;
  }

  /** textual search only; returns [{it, score}] (every item, score 0, when the query has no words) */
  function text(query) {
    const rd = interpret(query, { vocab, has, df: (w) => df.get(w) || 0, alias });
    const hitIds = new Set(rd.aliasHits.flatMap((h) => h.pis));
    const words = rd.tokens.filter((t) => t.length > 1 || /\d/.test(t)), lone = rd.tokens.filter((t) => t.length === 1 && !/\d/.test(t));
    if (!rd.tokens.length && !hitIds.size) return items.map((it) => ({ it, score: 0 }));
    const qfull = normalise(query);
    // each word with its synonyms (a spelled-out synonym counts a little less than the word itself)
    const wordAlts = words.map((t) => [[t, 1], ...[...(rd.groups.get(t) || [])].map((x) => [x, 0.7])]);
    const per = wordAlts.map((alts) => items.map((it) => scoreWord(it, alts)));
    // a word nothing in the catalogue answers ("tub", a misspelling too far from any word) is left out instead of emptying the results
    const keep = per.map((arr) => arr.some((v) => v > 0));
    const live = keep.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
    const out = [];
    // the words asked for read as the name of the shelf the product sits on ("construction adhesive" -> Construction Adhesives)
    const shelf = (it) => words.length > 1 && it.leaf.length >= words.length && it.leaf.some((_, i) => words.every((w, j) => it.leaf[i + j] === w));
    const finish = (it, total) => { if (qfull && it.nm.startsWith(qfull)) total += 20; else if (qfull && it.nm.includes(qfull)) total += 10; if (hitIds.has(it.p.id)) total += 40; if (shelf(it)) total += 10; return total; };
    items.forEach((it, k) => {
      let total = 0, ok = live.length > 0 || hitIds.size > 0 || lone.length > 0;
      // a one-letter word (the T in "Sikagard-62 T") scores when it is a whole word of the name and is otherwise ignored; it used to empty the results
      for (const t of lone) if (it.nt.includes(t)) total += 12;
      for (const i of live) { if (per[i][k] === 0) { ok = false; break; } total += per[i][k]; }
      if (!ok && hitIds.has(it.p.id)) ok = true;
      if (ok && (total > 0 || hitIds.has(it.p.id))) out.push({ it, score: finish(it, total) });
    });
    // nothing answers every word: offer the items that answer all but one of three or more words, below any full match
    if (!out.length && live.length >= 3) items.forEach((it, k) => { const miss = live.filter((i) => per[i][k] === 0).length; if (miss === 1) out.push({ it, score: finish(it, live.reduce((a, i) => a + per[i][k], 0)) * 0.5 }); });
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
