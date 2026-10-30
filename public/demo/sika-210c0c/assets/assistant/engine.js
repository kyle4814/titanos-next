// engine.js: createAssistant(): wires index, intents, rates, quotes, tree and answers into one pure, dependency-free product assistant.
import { normalise, tokenize, words, stemCached, compact, sentences } from './tokenize.js';
import * as SYN from './synonyms.js';
import { buildIndex } from './search.js';
import { compileFacets, detectFacets, extractExclusions, positiveLines } from './facets.js';
import { classify, parseRequest } from './intents.js';
import { productRates, parsePacks, parseRates, fmtNum } from './rates.js';
import { quoteProduct } from './quote.js';
import { buildTree } from './tree.js';
import { plain, sanitise, docOk, docLabel, DOC_ORDER, clip, bestLine } from './answer.js';

const now = () => (typeof performance !== 'undefined' ? performance : Date).now();
const TYPE_ALIASES = { safety_data_sheet: ['safety_data_sheet', 'MSDS'], certificate: ['certificate'], brochure: ['brochure', 'leaflet'], product_data_sheet: ['product_data_sheet', 'additional_technical_information'] };
const typeIs = (d, w) => (TYPE_ALIASES[w] || [w]).includes(d.type);
const DOC_WORDS = [
  ['safety_data_sheet', /\b(sds|msds|safety data|safety sheet|hazard)\b/],
  ['product_data_sheet', /\b(pds|tds|data ?sheet|datasheet|technical data|product data)\b/],
  ['brochure', /\b(brochure|literature|catalogue|catalog)\b/],
  ['environmental_product_declaration', /\b(epd|environmental product)\b/],
  ['system_data_sheet', /\bsystem data\b/],
  ['certificate', /\b(certificate|certification|approval|warranty|compliance)\b/],
];

/** Create the assistant. Data is injected; nothing here touches the file system, network or DOM. */
export function createAssistant({ products, documents, categories, pages = [], config }, opts = {}) {
  const tStart = now();
  const syn = Object.assign({ SYNONYM_GROUPS: SYN.SYNONYM_GROUPS, FACETS: SYN.FACETS, DOMAIN_HINTS: SYN.DOMAIN_HINTS, GUIDE_SLOTS: SYN.GUIDE_SLOTS }, opts.synonyms || {});
  const company = (config && config.company) || { name: '', short: '', publishedDocsPhrase: 'the published documentation', site: '' };
  const phrase = `From ${company.publishedDocsPhrase}.`;
  const index = buildIndex({ products, documents, categories, pages });
  const pById = new Map(products.map(p => [p.id, p]));
  const dById = new Map(documents.map(d => [d.id, d]));
  const cats = categories;
  const compiled = compileFacets(syn.FACETS);
  const groups = syn.SYNONYM_GROUPS.map(g => g.map(t => { const n = normalise(t).replace(/-/g, ' ').trim(); return { n, re: new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])'), stems: [...new Set(tokenize(t))] }; }));
  const brandStem = new Set(products.map(p => stemCached(normalise(p.brand || ''))));
  const docsByProduct = new Map();
  for (const d of documents) for (const id of d.products || []) { if (!docsByProduct.has(id)) docsByProduct.set(id, []); docsByProduct.get(id).push(d); }
  const infoCache = new Map();
  const info = (p) => {
    let i = infoCache.get(p.id);
    if (!i) { i = { excl: extractExclusions(compiled, p), pos: null, rates: null, packs: parsePacks(p.packaging) }; infoCache.set(p.id, i); }
    return i;
  };
  const facetStems = new Set(); for (const dim of Object.values(syn.FACETS)) for (const f of dim) for (const t of f.terms) for (const s of tokenize(t)) facetStems.add(s);
  const headCache = new Map();
  const headSet = (p) => { let s = headCache.get(p.id); if (!s) { s = new Set(tokenize(p.name + ' ' + (p.tagline || ''))); headCache.set(p.id, s); } return s; };
  const posOf = (p) => { const i = info(p); return i.pos || (i.pos = positiveLines(compiled, p)); };
  const ratesOf = (p) => { const i = info(p); return i.rates || (i.rates = productRates(p)); };
  const catName = new Map(cats.map(c => [c.id, c.name]));
  const warm = () => { for (const p of products) { info(p); posOf(p); ratesOf(p); } };
  if (opts.warm) warm();
  const buildMs = Math.round((now() - tStart) * 10) / 10;

  // ---------- query expansion ----------
  function expand(text) {
    const n = ' ' + normalise(text).replace(/-/g, ' ') + ' ';
    const q = new Map();
    for (const t of tokenize(text)) q.set(t, Math.max(q.get(t) || 0, 1));
    for (const g of groups) {
      if (g.some(x => x.re.test(n))) {
        const hit = g.filter(x => x.re.test(n)); const hs = new Set(hit.flatMap(x => x.stems));
        for (const x of g) for (const s of x.stems) if (!hs.has(s) && !q.has(s) && !brandStem.has(s)) q.set(s, 0.45);
      }
    }
    return q;
  }

  function nameMentions(text) { return index.nameMatch(text).filter(m => m.score >= 0.65); }

  // ---------- product ranking ----------
  function rankProducts(text, o = {}) {
    const q = o.q || expand(text);
    const facets = o.facets || detectFacets(compiled, text);
    const res = index.search(q, { kinds: ['product'], limit: 60 });
    if (!res.length) return { items: [], ruledOut: [], top: 0, q, facets };
    const top = res[0].score;
    // category prior: a category whose whole name is in the query lifts its products
    const catHit = new Set();
    for (const c of index.search(q, { kinds: ['category'], limit: 4 })) {
      const cat = cats.find(x => x.id === c.id); if (!cat) continue;
      const nt = tokenize(cat.name);
      if (nt.length && nt.every(t => q.has(t) && q.get(t) >= 1)) catHit.add(cat.id);
    }
    const fset = new Set([].concat(...Object.values(facets)));
    const items = [], ruledOut = [];
    let seen = 0;
    for (const r of res) {
      const p = pById.get(r.id); if (!p) continue;
      if (++seen > 30) break;
      if (o.filter && !o.filter(p)) continue;
      let score = r.score;
      { const hs = headSet(p); let hb = 0; for (const [t, w] of q) if (w >= 1 && !facetStems.has(t) && hs.has(t)) hb++; score += Math.min(hb, 2) * 0.1 * top; }
      for (const cid of catHit) if (p.category === cid || p.category.startsWith(cid + '/')) { score += 0.3 * top; break; }
      const ex = info(p).excl.filter(e => Object.entries(e.facets).some(([dim, ids]) => (facets[dim] || []).some(id => ids.includes(id))));
      if (ex.length) { if (score >= top * 0.45) ruledOut.push({ p, quote: ex[0].text, score }); continue; }
      const pos = posOf(p).filter(l => Object.entries(l.facets).some(([dim, ids]) => (facets[dim] || []).some(id => ids.includes(id))));
      if (pos.length) score += Math.min(pos.length, 3) * 0.12 * top;
      items.push({ p, score, pos });
    }
    for (const m of o.names || []) {
      const it = items.find(x => x.p.id === m.id);
      if (it) it.score = Math.max(it.score, top * 1.3 * m.score); else { const p = pById.get(m.id); if (p && (!o.filter || o.filter(p))) items.push({ p, score: top * 1.3 * m.score, pos: [] }); }
    }
    items.sort((a, b) => b.score - a.score);
    return { items, ruledOut, top, q, facets, fset };
  }

  function reasonFor(it, q, fset) {
    const bl = bestLine(it.p, q, fset, tokenize);
    if (bl) return `${bl.kind === 'tagline' || bl.kind === 'summary' ? 'Published description' : 'Its own ' + bl.kind + ' text'}: "${clip(bl.text)}"`;
    return `Published description: "${clip(it.p.tagline || it.p.summary || it.p.name)}"`;
  }

  const cardBlock = (ps) => ({ type: 'products', title: ps.length > 1 ? 'Products' : 'Product', items: ps.map(p => ({ id: p.id, reason: `Published description: "${clip(p.tagline || p.summary || p.name)}"`, score: 1 })) });
  const productsBlock = (items, q, fset, title) => ({ type: 'products', title, items: items.map(it => ({ id: it.p.id, reason: reasonFor(it, q, fset), score: Math.round(it.score * 100) / 100 })) });

  // ---------- documents ----------
  function docsFor(p) {
    let list = (docsByProduct.get(p.id) || []).slice();
    for (const id of p.documents || []) { const d = dById.get(id); if (d && !list.includes(d)) list.push(d); }
    if (!list.length) { const c = compact(p.name); const stripped = c.startsWith(compact(p.brand || '')) ? c.slice(compact(p.brand || '').length) : c; if (stripped.length >= 5) list = documents.filter(d => compact(d.title + d.file).includes(stripped)); }
    return list.filter(docOk).sort((a, b) => DOC_ORDER.indexOf(a.type || '') - DOC_ORDER.indexOf(b.type || '') || String(b.version).localeCompare(String(a.version)));
  }
  // documents that have no product link: matched only on whole name tokens (so 62 never matches 6220); always shown as "similar name"
  let orphans = null;
  function similarDocs(p, types) {
    if (!orphans) orphans = documents.filter(d => !(d.products || []).length && docOk(d)).map(d => ({ d, t: words(d.title + ' ' + d.file) }));
    const brand = compact(p.brand || ''); const pt = words(p.name).filter(w => compact(w) !== brand); const target = pt.join('');
    if (target.length < 4) return [];
    const out = [];
    for (const o of orphans) {
      if (types.length && !types.includes(o.d.type)) continue;
      let hit = false;
      for (let i = 0; i < o.t.length && !hit; i++) { let c = ''; for (let j = i; j < Math.min(o.t.length, i + 6); j++) { c += o.t[j]; if (c === target) { hit = true; break; } if (c.length > target.length) break; } }
      if (hit) out.push(o.d);
    }
    return out.slice(0, 4);
  }
  const pdsOf = (p) => docsFor(p).find(d => d.type === 'product_data_sheet');

  // ---------- Answer assembly ----------
  const cites = [];
  const cite = (label, url, kind) => { if (url && !cites.some(c => c.url === url)) cites.push({ label: plain(label), url, kind }); };
  const citeProduct = (p) => cite(`${plain(p.name)} (product page)`, p.url, 'page');
  const citeDoc = (d) => cite(docLabel(d), d.url, 'pdf');

  function finish(intent, query, blocks, followups, state, dbg, t0) {
    blocks.push({ type: 'text', text: phrase });
    const ans = { intent, query, blocks, citations: cites.slice(), followups: (followups || []).slice(0, 5), state: state || null, debug: { tokens: dbg.tokens || [], matched: dbg.matched || [], ms: Math.round((now() - t0) * 100) / 100 } };
    return sanitise(ans);
  }

  const srcOf = (p) => ({ label: `${plain(p.name)} (product page)`, url: p.url });

  // ---------- tile path ----------
  const slotProducts = (slot, sel, qtext) => {
    const catRe = slot.cat;
    const filter = (p) => catRe.test(p.category) && (!slot.name || slot.name.test(p.name + ' ' + p.tagline));
    const facets = { tileType: sel.tileType || [], substrate: sel.substrate || [], location: sel.location || [] };
    const r = rankProducts(qtext, { facets, filter, q: expand(qtext) });
    let items = r.items;
    if (slot.text) items = items.filter(it => slot.text.test([it.p.summary, it.p.tagline, ...(it.p.usage || []), ...(it.p.attributes || [])].join(' ')));
    return { items: items.slice(0, 3), ruledOut: r.ruledOut, q: r.q, fset: new Set([].concat(...Object.values(facets))) };
  };

  let adhCands = null;
  function tileAdhesiveIds(sel) {
    const slot = syn.GUIDE_SLOTS.find(s => s.id === 'adhesive'); if (!slot) return [];
    if (!adhCands) adhCands = products.filter(p => slot.cat.test(p.category));
    return adhCands.filter(p => !info(p).excl.some(e => Object.entries(e.facets).some(([dim, ids]) => (sel[dim] || []).some(id => ids.includes(id))))).map(p => p.id);
  }

  function guide(selection, t0 = now(), query = '') {
    const sel = {}; for (const k of ['tileType', 'substrate', 'location']) if (selection && selection[k]) sel[k] = [].concat(selection[k]);
    const label = (dim, id) => (syn.FACETS[dim].find(f => f.id === id) || { label: id }).label;
    const desc = ['tileType', 'substrate', 'location'].filter(k => sel[k]).map(k => `${label(k, sel[k][0])}`).join(', ');
    const blocks = [{ type: 'text', text: `Tile system for: ${desc || 'your job'}. Each product below is chosen from the published categories and its own published text; products whose text says "not suitable" for your tile, surface or location are left out.` }];
    const qtext = ['tile', sel.tileType && label('tileType', sel.tileType[0]), sel.substrate && label('substrate', sel.substrate[0]), sel.location && label('location', sel.location[0])].filter(Boolean).join(' ');
    const slots = []; const matched = [];
    for (const slot of syn.GUIDE_SLOTS) {
      if (slot.needs && !(sel.location || []).some(l => slot.needs.includes(l))) continue;
      const r = slotProducts(slot, sel, `${slot.id === 'adhesive' ? 'tile adhesive' : slot.id} ${qtext}`);
      slots.push({ slot, r });
      if (r.items.length) { blocks.push(productsBlock(r.items, r.q, r.fset, slot.title)); for (const it of r.items) { citeProduct(it.p); matched.push({ id: it.p.id, score: Math.round(it.score * 100) / 100 }); } }
      else blocks.push({ type: 'text', text: `${slot.title}: I do not have a matching product in the published pages I hold for this combination. Check the product range on ${company.site || 'the website'}.` });
      if (r.ruledOut.length) blocks.push({ type: 'text', text: `Ruled out for ${slot.title.toLowerCase()} by their own published text: ` + r.ruledOut.slice(0, 3).map(x => `${plain(x.p.name)} ("${clip(x.quote, 160)}")`).join('; ') + '.' });
    }
    const adh = slots.find(s => s.slot.id === 'adhesive');
    const docs = []; if (adh && adh.r.items[0]) for (const d of docsFor(adh.r.items[0].p).filter(d => d.type === 'product_data_sheet' || d.type === 'safety_data_sheet').slice(0, 2)) { docs.push({ id: d.id, label: docLabel(d) }); citeDoc(d); }
    if (docs.length) blocks.push({ type: 'docs', title: `Documents for ${plain(adh.r.items[0].p.name)}`, items: docs });
    const topIds = slots.filter(s => s.r.items[0]).map(s => s.r.items[0].p.id);
    const first = adh && adh.r.items[0];
    return finish('find_product', query || `guided tile path: ${desc}`, blocks,
      first ? [`How much ${plain(first.p.name)} for 20 m2?`, `Datasheet for ${plain(first.p.name)}`, `What primer for ${plain(first.p.name)}?`] : ['Waterproofing a balcony', 'Self-levelling for a timber floor'],
      { intent: 'find_product', productId: first ? first.p.id : null, productIds: topIds, slots: Object.fromEntries(slots.map(s => [s.slot.id, s.r.items.map(i => i.p.id)])), facets: sel, req: {} }, { matched }, t0);
  }

  // ---------- helpers ----------
  const openOptions = () => tree().options.slice(0, 8).map(o => ({ label: o.label, value: o.value }));

  function resolveProducts(text, state) {
    const names = nameMentions(text).filter((n, i, a) => n.score >= a[0].score - 0.15);
    if (names.length) return { ids: names.slice(0, 3).map(n => n.id), names, from: 'text' };
    const sIds = state && Array.isArray(state.productIds) ? state.productIds.filter(id => pById.has(id)) : [];
    if (state && state.intent === 'quote' && sIds.length > 1) return { ids: sIds, names: [], from: 'state' };
    if (state && state.productId && pById.has(state.productId)) return { ids: [state.productId], names: [], from: 'state' };
    return { ids: [], names: [], from: 'none' };
  }

  function outOfScope(query, text, t0, tokens, q) {
    const r = rankProducts(text, { q });
    const blocks = [{ type: 'text', text: 'I do not have that in the published documentation, so I will not guess. Here is the closest I can find.' }];
    const near = r.items.slice(0, 3);
    let pot = 0; for (const [t, w] of q) { const en = index.post.get(t); if (en) pot += index.idf(en.d.length) * w * 2.2; }
    if (near.length && r.top > 0 && r.top / (pot || 1) >= 0.25 && tokenize(text).some(t => /[a-z]/.test(t))) { blocks.push(productsBlock(near, r.q, r.fset, 'Nearest matches')); near.forEach(it => citeProduct(it.p)); }
    blocks.push({ type: 'text', text: `For anything outside the published documents, contact ${company.name || 'the company'}${company.site ? ' via ' + company.site : ''}.` });
    return finish('out_of_scope', query, blocks, ['Show me tile adhesives', 'Waterproofing a balcony', 'Datasheet for a product'], { intent: 'out_of_scope' }, { tokens, matched: near.map(it => ({ id: it.p.id, score: Math.round(it.score * 100) / 100 })) }, t0);
  }

  function weak(r, q, text, names) {
    if (names.length) return false;
    if (!tokenize(text).some(t => /[a-z]/.test(t))) return true;
    const n = normalise(text);
    const hint = syn.DOMAIN_HINTS.some(h => n.includes(h));
    const fac = Object.keys(detectFacets(compiled, text)).length > 0;
    if (!r.items.length && !r.ruledOut.length) return true;
    let potential = 0; for (const [t, w] of q) { const e = index.post.get(t); potential += (e ? index.idf(e.d.length) : index.idf(0)) * w * 2.2; }
    const ratio = r.top / (potential || 1);
    return !hint && !fac && ratio < 0.3;
  }

  // ---------- intent handlers ----------
  function findProduct(query, text, state, t0, ctx) {
    const facets = Object.assign({}, state && state.facets ? state.facets : {}, detectFacets(compiled, text));
    const q = expand(text); const names = ctx.names;
    const r = rankProducts(text, { q, facets, names });
    const tokens = [...q.keys()];
    if (weak(r, q, text, names)) return outOfScope(query, text, t0, tokens, q);
    const content = tokenize(text).filter(t => !brandStem.has(t));
    if (!names.length && content.length <= 1 && !Object.keys(facets).length && !/\b(tile|tiling|tiles)\b/.test(normalise(text))) {
      return finish('clarify', query, [{ type: 'ask', question: 'That could mean a few things. What are you working on?', options: openOptions() }], ['Waterproofing a balcony', 'What adhesive for porcelain tiles on concrete?'], { intent: 'clarify', lastQuery: text }, { tokens }, t0);
    }
    // guided tile path when the question is a tiling job
    const nq = normalise(text);
    if (facets.tileType && facets.tileType.length && /\badhesive|glue|fix|lay|tile|tiling\b/.test(nq) && !/\b(sealant|waterproof|membrane|grout|primer)\b/.test(nq) && facets.substrate && /\b(system|everything|full)\b/.test(nq)) return guide(facets, t0, query);
    const items = r.items.filter(it => it.score >= r.top * 0.3).slice(0, 4);
    if (!items.length) return outOfScope(query, text, t0, tokens, q);
    const blocks = [];
    const fl = Object.entries(facets).flatMap(([d, ids]) => ids.map(id => (syn.FACETS[d].find(f => f.id === id) || { label: id }).label.split(' (')[0].toLowerCase()));
    blocks.push({ type: 'text', text: `Here ${items.length === 1 ? 'is the best match' : 'are the best matches'} in the published documentation${fl.length ? ' for ' + fl.join(', ') : ''}. Each reason quotes the product's own text.` });
    blocks.push(productsBlock(items, r.q, r.fset, 'Suggested products'));
    if (r.ruledOut.length) blocks.push({ type: 'text', text: 'Left out because their own text says they are not suitable: ' + r.ruledOut.slice(0, 3).map(x => `${plain(x.p.name)} ("${clip(x.quote, 170)}")`).join('; ') + '.' });
    const matched = items.map(it => ({ id: it.p.id, score: Math.round(it.score * 100) / 100 }));
    const dd = docsFor(items[0].p).filter(d => d.type === 'product_data_sheet' || d.type === 'safety_data_sheet').slice(0, 2);
    if (dd.length) { blocks.push({ type: 'docs', title: `Documents for ${plain(items[0].p.name)}`, items: dd.map(d => ({ id: d.id, label: docLabel(d) })) }); dd.forEach(citeDoc); }
    items.forEach(it => citeProduct(it.p));
    const top = items[0].p;
    if (items.length > 1 && r.items[0].score - r.items[1].score < r.top * 0.08 && !Object.keys(facets).length)
      blocks.push({ type: 'ask', question: 'To narrow this down, what surface or location is it for?', options: [{ label: 'Concrete', value: 'on concrete' }, { label: 'Wet area or shower', value: 'in a wet area' }, { label: 'External or balcony', value: 'for an external balcony' }] });
    return finish('find_product', query, blocks, [`Datasheet for ${plain(top.name)}`, `How much ${plain(top.name)} for 20 m2?`, `What is the coverage of ${plain(top.name)}?`, `What primer for ${plain(top.name)}?`],
      { intent: 'find_product', productId: top.id, productIds: items.map(i => i.p.id), facets, req: {}, lastQuery: text }, { tokens, matched }, t0);
  }

  function consumption(query, text, state, t0, ctx) {
    const res = resolveProducts(text, state); const tokens = [...expand(text).keys()];
    let ids = res.ids; let matched = [];
    if (!ids.length) { const r = rankProducts(text, {}); ids = r.items.filter(it => ratesOf(it.p).length || sectionOf(it.p, 'Consumption')).slice(0, 3).map(it => it.p.id); matched = r.items.slice(0, 3).map(it => ({ id: it.p.id, score: it.score })); if (!ids.length) return outOfScope(query, text, t0, tokens, expand(text)); }
    const blocks = []; const prods = ids.map(id => pById.get(id));
    blocks.push(cardBlock(prods));
    for (const p of prods) {
      const sec = (p.sections || []).find(s => s.title === 'Consumption');
      citeProduct(p);
      if (!sec || !sec.items.length) {
        const d = pdsOf(p); if (d) citeDoc(d);
        blocks.push({ type: 'text', text: `The published page for ${plain(p.name)} does not list a consumption, coverage or yield figure. ${d ? 'The datasheet may have it: ' + docLabel(d) + '.' : 'Please check the datasheet or contact technical services.'}` });
        if (d) blocks.push({ type: 'docs', title: 'Datasheet', items: [{ id: d.id, label: docLabel(d) }] });
        continue;
      }
      blocks.push({ type: 'facts', title: `${plain(p.name)}: published ${sec.items.map(i => i.label.toLowerCase()).join(' and ')}`, rows: sec.items.map(it => ({ label: it.label, value: clip(it.text.replace(/\n+/g, '; '), 420), source: srcOf(p) })) });
      const rs = ratesOf(p).filter(r => r.kind === 'per_area' || r.kind === 'area_per_pack' || r.kind === 'per_m3');
      if (!rs.length) blocks.push({ type: 'text', text: 'This figure is not a simple per-area rate, so I will not convert it into a quantity without more detail. Ask me for a quantity and I will say what I need.' });
      const pk = info(p).packs.filter(x => !x.bulk).map(x => x.label); if (pk.length) blocks.push({ type: 'text', text: `Pack sizes published: ${pk.join(', ')}.` });
    }
    const p0 = prods[0];
    return finish('consumption', query, blocks, [`How much ${plain(p0.name)} for 40 m2?`, `Datasheet for ${plain(p0.name)}`, `What is ${plain(p0.name)} compatible with?`],
      { intent: 'consumption', productId: p0.id, productIds: ids, req: (state && state.req) || {}, facets: (state && state.facets) || {} }, { tokens, matched: matched.length ? matched : ids.map(id => ({ id, score: 1 })) }, t0);
  }
  const sectionOf = (p, t) => (p.sections || []).find(s => s.title === t);

  function documentsIntent(query, text, state, t0) {
    const n = normalise(text); const res = resolveProducts(text, state); const tokens = [...expand(text).keys()];
    const want = DOC_WORDS.filter(([, re]) => re.test(n)).map(([t]) => t);
    const blocks = []; let items = [];
    let ids = res.ids; let inferred = false;
    if (!ids.length) { const r = rankProducts(text.replace(/\b(sds|msds|pds|tds|data ?sheet|datasheet|safety|brochure|certificate|epd)\b/gi, ' '), {}); if (r.items.length && r.top > 0 && !weak(r, expand(text), text, [])) ids = r.items.slice(0, 1).map(it => it.p.id), inferred = true; }
    if (!ids.length) return finish('clarify', query, [{ type: 'ask', question: 'Which product do you need the document for? Give me the product name, or pick a category.', options: openOptions() }], suggestionsList().slice(0, 3), { intent: 'documents', want, pending: 'documents' }, { tokens }, t0);
    const p = pById.get(ids[0]); citeProduct(p);
    if (inferred) blocks.push({ type: 'text', text: `You did not name a product, so I have used the best match, ${plain(p.name)}. Name another product to change it.` });
    const all = docsFor(p);
    const typed = want.filter(w => w !== 'certificate');
    let pick = typed.length ? all.filter(d => typed.some(w => typeIs(d, w))) : [];
    if (want.includes('certificate')) pick = pick.concat(all.filter(d => (d.type === 'certificate' || /certif|approval|warrant|complian|declaration/i.test(d.title + d.typeLabel)) && !pick.includes(d)));
    if (!want.length) pick = all;
    blocks.push({ type: 'text', text: pick.length ? `Documents for ${plain(p.name)} from the published list:` : `No ${want.length ? want.map(w => w.replace(/_/g, ' ')).join(' or ') : 'document'} is listed for ${plain(p.name)}. ${all.length ? 'These are the documents that are listed:' : 'No documents are listed for it.'}` });
    items = (pick.length ? pick : all).slice(0, 8);
    if (!pick.length && typed.length) {
      const sim = similarDocs(p, typed.flatMap(w => TYPE_ALIASES[w] || [w]));
      if (sim.length) { blocks.push({ type: 'text', text: `No ${typed.map(w => w.replace(/_/g, ' ')).join(' or ')} is linked to ${plain(p.name)} on its page. These files have a similar name in the published document list, so check the product name before relying on them:` }); blocks.push({ type: 'docs', title: 'Similar file names (not linked to this product)', items: sim.map(d => ({ id: d.id, label: docLabel(d) })) }); sim.forEach(citeDoc); }
    }
    if (items.length) { blocks.push({ type: 'docs', title: `Documents: ${plain(p.name)}`, items: items.map(d => ({ id: d.id, label: docLabel(d) })) }); items.forEach(citeDoc); }
    const cert = sectionOf(p, 'Sustainability / Certifications / Approvals');
    if (want.includes('certificate') && cert) blocks.push({ type: 'facts', title: 'Published approvals and certificates', rows: cert.items.map(it => ({ label: it.label, value: clip(it.text.replace(/\n+/g, '; '), 400), source: srcOf(p) })) });
    if (!items.length) blocks.push({ type: 'text', text: `Check the document search on ${company.site || 'the website'} or contact technical services.` });
    return finish('documents', query, blocks, [`How much ${plain(p.name)} for 20 m2?`, `What is the coverage of ${plain(p.name)}?`, `What is ${plain(p.name)} compatible with?`],
      { intent: 'documents', productId: p.id, productIds: ids, req: (state && state.req) || {}, facets: (state && state.facets) || {} }, { tokens, matched: ids.map(id => ({ id, score: 1 })) }, t0);
  }

  const COMPAT_RE = /compatib|incompat|in conjunction|used? with|combin|together|except|exclusion|do not (mix|add)|primer|priming/i;
  function compatibility(query, text, state, t0, ctx) {
    const n = normalise(text); const res = resolveProducts(text, state); const tokens = [...expand(text).keys()];
    if (!res.ids.length) {
      const r = rankProducts(text, {}); if (!r.items.length || weak(r, expand(text), text, [])) return outOfScope(query, text, t0, tokens, expand(text));
      res.ids = [r.items[0].p.id];
    }
    const p = pById.get(res.ids[0]); const p2 = res.ids[1] ? pById.get(res.ids[1]) : null; citeProduct(p);
    const blocks = [cardBlock(res.ids.map(id => pById.get(id)).slice(0, 2))]; const matched = res.ids.map(id => ({ id, score: 1 }));
    const wantsPrimer = /\bprimer|prime\b|priming/.test(n);
    const tail = (/\b(?:over|onto|on top of|on|with|to|under)\s+(.+)$/.exec(n) || [])[1] || '';
    const tailF = tail ? detectFacets(compiled, tail) : {};
    const lines = [];
    for (const s of p.sections || []) for (const it of s.items || []) {
      if (/^(Technical|Product) Information$/.test(s.title) && !/compat/i.test(it.label)) continue;
      if (s.title === 'Consumption') continue;
      if (Object.keys(tailF).length && !wantsPrimer) continue;
      for (const sent of sentences(it.text || '')) if (COMPAT_RE.test(sent) || /compat/i.test(it.label)) lines.push({ label: it.label, text: sent });
    }
    if (wantsPrimer) for (const u of [].concat(p.usage || [], p.attributes || [])) for (const sent of sentences(u)) if (COMPAT_RE.test(sent)) lines.push({ label: 'Usage', text: sent });
    // case: can I use X over Y (substrate / tile type)
    if (Object.keys(tailF).length && !p2) {
      const ex = info(p).excl.filter(e => Object.entries(e.facets).some(([d, ids]) => (tailF[d] || []).some(id => ids.includes(id))));
      const pos = posOf(p).filter(l => Object.entries(l.facets).some(([d, ids]) => (tailF[d] || []).some(id => ids.includes(id))));
      const what = Object.entries(tailF).flatMap(([d, ids]) => ids.map(id => (syn.FACETS[d].find(f => f.id === id) || { label: id }).label.split(' (')[0].toLowerCase())).join(', ');
      if (ex.length) blocks.push({ type: 'text', text: `No. The published text for ${plain(p.name)} says it is not suitable for ${what}: "${clip(ex[0].text, 300)}"` });
      else if (pos.length) blocks.push({ type: 'text', text: `Yes, according to the published text for ${plain(p.name)} (${what}): "${clip(pos[0].text, 300)}"` });
      else blocks.push({ type: 'text', text: `The published text for ${plain(p.name)} does not say whether it can be used on or over ${what}. I will not guess; check the datasheet or ask technical services.` });
    }
    if (p2) {
      const hit = []; const nm = compact(p2.name).replace(compact(p2.brand || ''), '');
      for (const s of p.sections || []) for (const it of s.items || []) for (const sent of sentences(it.text || '')) if (compact(sent).includes(nm) && nm.length >= 5) hit.push(sent);
      const rev = []; for (const s of p2.sections || []) for (const it of s.items || []) for (const sent of sentences(it.text || '')) if (compact(sent).includes(compact(p.name).replace(compact(p.brand || ''), '')) ) rev.push(sent);
      citeProduct(p2);
      if (hit.length || rev.length) blocks.push({ type: 'facts', title: `What the published text says about ${plain(p.name)} and ${plain(p2.name)}`, rows: hit.slice(0, 2).map(t => ({ label: plain(p.name), value: clip(t, 400), source: srcOf(p) })).concat(rev.slice(0, 2).map(t => ({ label: plain(p2.name), value: clip(t, 400), source: srcOf(p2) }))) });
      else blocks.push({ type: 'text', text: `The published text for ${plain(p.name)} and ${plain(p2.name)} does not say whether they can be used together. I will not guess; check the datasheets.` });
    } else {
      const sel = lines.filter((l, i, a) => a.findIndex(x => x.text === l.text) === i).filter(l => wantsPrimer ? /primer|prime|priming/i.test(l.text) : true);
      if (sel.length) blocks.push({ type: 'facts', title: wantsPrimer ? `Primer guidance in the published text for ${plain(p.name)}` : `Compatibility and system notes for ${plain(p.name)}`, rows: sel.slice(0, 6).map(l => ({ label: l.label, value: clip(l.text, 380), source: srcOf(p) })) });
      else if (!Object.keys(tailF).length) blocks.push({ type: 'text', text: `The published page for ${plain(p.name)} has no ${wantsPrimer ? 'primer' : 'compatibility'} statement that I can quote.` });
      if (wantsPrimer) {
        const mentioned = new Set(); for (const l of sel) for (const m of nameMentions(l.text)) if (m.id !== p.id && m.score >= 0.85) mentioned.add(m.id);
        let prim = [...mentioned].map(id => pById.get(id));
        if (!prim.length) {
          const leaf = (catName.get(p.category.split('/').slice(0, 3).join('/')) || '') + ' ' + p.name;
          const r = rankProducts('primer ' + leaf, { filter: (x) => x.id !== p.id && /primer/i.test(x.name + ' ' + x.tagline + ' ' + x.category) });
          prim = r.items.slice(0, 3).map(it => it.p);
          if (prim.length) blocks.push({ type: 'text', text: `The page for ${plain(p.name)} does not name a primer product. These primers are published in the range; confirm the match on their datasheets.` });
        }
        if (prim.length) { const q = expand('primer ' + p.name); blocks.push({ type: 'products', title: 'Primers named or published', items: prim.slice(0, 3).map(x => ({ id: x.id, reason: reasonFor({ p: x }, q, new Set()), score: 1 })) }); prim.forEach(citeProduct); }
      } else {
        const mentioned = new Set(); for (const l of sel) for (const m of nameMentions(l.text)) if (m.id !== p.id && m.score >= 0.85) mentioned.add(m.id);
        const rel = [...mentioned].slice(0, 4).map(id => pById.get(id));
        if (rel.length) { blocks.push({ type: 'products', title: 'Products named in that text', items: rel.map(x => ({ id: x.id, reason: `Named in the published text for ${plain(p.name)}.`, score: 1 })) }); rel.forEach(citeProduct); }
      }
    }
    const d = pdsOf(p); if (d) { citeDoc(d); blocks.push({ type: 'docs', title: 'Datasheet', items: [{ id: d.id, label: docLabel(d) }] }); }
    return finish('compatibility', query, blocks, [`Datasheet for ${plain(p.name)}`, `How much ${plain(p.name)} for 20 m2?`],
      { intent: 'compatibility', productId: p.id, productIds: res.ids, req: (state && state.req) || {}, facets: (state && state.facets) || {} }, { tokens, matched }, t0);
  }

  function quote(query, text, state, t0, ctx) {
    const prev = (state && state.req) || {};
    const parsed = parseRequest(text);
    const req = Object.assign({}, prev, parsed);
    if (parsed.thicknessGuess != null && req.thickness == null && state && state.need === 'thickness') req.thickness = parsed.thicknessGuess;
    if (state && state.need === 'thickness' && req.thickness == null && /^\s*\d/.test(text)) req.thickness = parseFloat(text);
    const ur = parseRates(text); if (ur.length && ur[0].kind === 'per_area') { req.userRate = Object.assign({}, ur[0], { basis: 'rate supplied by you' }); }
    else if (state && state.req && state.req.userRate) req.userRate = state.req.userRate;
    const tokens = [...expand(text).keys()];
    const res = resolveProducts(text, state);
    let plist = res.ids.map(id => pById.get(id));
    const facets = Object.assign({}, (state && state.facets) || {}, detectFacets(compiled, text));
    const blocks = []; let matched = [];
    if (!plist.length) {
      const hasTile = (facets.tileType && facets.tileType.length) || /\btile|tiling\b/.test(normalise(text));
      if (hasTile) {
        const g = guide(facets, t0, query); const adh = pById.get(g.state.productId);
        if (adh) { plist = Object.values(g.state.slots || {}).filter(l => l.length).map(l => pById.get(l.find(id => ratesOf(pById.get(id)).length) || l[0])); blocks.push({ type: 'text', text: `For ${req.area != null ? req.area + ' m2' : 'your job'} I have used the guided tile path. Quantities below come from each product's own published rate.` }); }
      }
      if (!plist.length) {
        const r = rankProducts(text.replace(/\d+(\.\d+)?\s*(m2|m3)/gi, ' '), { facets });
        if (!r.items.length || weak(r, expand(text), text, [])) return finish('clarify', query, [{ type: 'ask', question: 'Which product is the quantity for? Give me the product name, or tell me the job (for example "porcelain tiles on a balcony").', options: openOptions() }], suggestionsList().slice(0, 3), { intent: 'quote', req, facets }, { tokens }, t0);
        const kindsFor = req.length != null ? ['joint_table', 'linear_per_pack'] : req.area == null ? ['per_m3', 'per_100kg', 'pct_binder'] : ['per_area', 'area_per_pack', 'grout_table'];
        plist = r.items.filter(it => ratesOf(it.p).some(x => kindsFor.includes(x.kind))).slice(0, 2).map(it => it.p); if (!plist.length) plist = r.items.slice(0, 1).map(it => it.p);
        matched = r.items.slice(0, 3).map(it => ({ id: it.p.id, score: Math.round(it.score * 100) / 100 }));
        blocks.push({ type: 'text', text: 'You did not name a product, so I have used the best match(es) for the job. Say a product name to change that.' });
      }
    }
    if (req.area == null && req.volume == null && req.length == null) {
      const p = plist[0]; citeProduct(p);
      return finish('quote', query, blocks.concat([{ type: 'ask', question: `How big is the job for ${plain(p.name)}? Give me the area in m2 (or volume in m3, or length in metres for joints).` }]), [], { intent: 'quote', productId: p.id, productIds: plist.map(x => x.id), req, facets, need: 'area' }, { tokens, matched }, t0);
    }
    const lines = []; const assumptions = []; let needs = []; let noRate = [];
    for (const p of plist) {
      citeProduct(p);
      const pds = pdsOf(p); if (pds) citeDoc(pds);
      const out = quoteProduct(p, ratesOf(p), req, srcOf(p));
      for (const l of out.lines) { if (pds) l.note = (l.note ? l.note + ' ' : '') + `Datasheet: ${docLabel(pds)}.`; lines.push(l); }
      for (const a of out.assumptions) if (!assumptions.includes(a)) assumptions.push(a);
      needs.push(...out.needs.map(nd => ({ ...nd, p })));
      if (out.noRate) noRate.push(p);
    }
    if (lines.length) {
      const m3 = req.volume != null && req.area == null; const what = req.area != null ? `${req.area} m2` : req.volume != null ? `${req.volume} m3` : `${req.length} m`;
      blocks.push({ type: 'quote', title: `Estimate for ${what}`, lines, assumptions: ['Pack counts are rounded up to whole packs.'].concat(assumptions) });
    }
    if (noRate.length === 1 && plist.length === 1) {
      const p = noRate[0]; const pds = pdsOf(p);
      blocks.push({ type: 'text', text: `The published pages for ${plain(p.name)} do not give a rate I can use to work out a quantity, so I will not invent one. ${pds ? 'The datasheet may list it: ' + docLabel(pds) + '.' : 'Please check the datasheet or technical services.'}` });
      blocks.push({ type: 'ask', question: `If you have the rate for ${plain(p.name)} (for example "1.5 kg per m2"), tell me and I will work out the packs. Otherwise the datasheet is the place to confirm it.` });
      if (pds) blocks.push({ type: 'docs', title: 'Datasheet', items: [{ id: pds.id, label: docLabel(pds) }] });
    } else if (noRate.length) {
      blocks.push({ type: 'text', text: `No usable published rate for: ${noRate.map(p => plain(p.name)).join(', ')}. I have not invented one; ask me about one of them by name and I will point to its datasheet, or tell me the rate you have.` });
    }
    const nd = needs[0];
    if (nd) blocks.push({ type: 'ask', question: (plist.length > 1 ? `For ${plain(nd.p.name)}: ` : '') + nd.question, options: nd.options });
    const st = { intent: 'quote', productId: plist[0].id, productIds: plist.map(x => x.id), req: Object.assign({}, req, { userRate: req.userRate }), facets, need: nd ? nd.key : (noRate.length ? 'rate' : null) };
    return finish('quote', query, blocks, lines.length ? ['Add 10% waste', 'What about 60 m2?', `Datasheet for ${plain(plist[0].name)}`] : [], st, { tokens, matched: matched.length ? matched : plist.map(p => ({ id: p.id, score: 1 })) }, t0);
  }

  function pageSearch(text, kinds = ['page']) { return index.search(expand(text), { kinds, limit: 3 }); }
  function simple(intent, query, t0, lines, followups, state) {
    return finish(intent, query, lines.map(text => ({ type: 'text', text })), followups, state || { intent }, {}, t0);
  }

  function ask(input, state) {
    const t0 = now(); cites.length = 0;
    const query = String(input == null ? "" : input);
    const st = state && typeof state === 'object' && !Array.isArray(state) ? state : null;
    // guided selections: "tileType=porcelain; substrate=concrete; location=wet-area" or "product:<id>"
    const pm = /^\s*product:(\S+)\s*$/.exec(query);
    if (pm && pById.has(pm[1])) {
      const p = pById.get(pm[1]); citeProduct(p);
      const items = [{ p, score: 1, pos: [] }]; const dd = docsFor(p).filter(d => d.type === 'product_data_sheet' || d.type === 'safety_data_sheet').slice(0, 2); dd.forEach(citeDoc);
      const blocks = [{ type: 'products', title: 'Selected product', items: [{ id: p.id, reason: reasonFor({ p }, new Map(), new Set()), score: 1 }] }];
      if (dd.length) blocks.push({ type: 'docs', title: 'Documents', items: dd.map(d => ({ id: d.id, label: docLabel(d) })) });
      return finish('find_product', query, blocks, [`How much ${plain(p.name)} for 20 m2?`, `What is the coverage of ${plain(p.name)}?`], { intent: 'find_product', productId: p.id, productIds: [p.id], req: {}, facets: {} }, { matched: [{ id: p.id, score: 1 }] }, t0);
    }
    const cm = /^\s*category:(\S+)\s*$/.exec(query);
    if (cm && cats.some(c => c.id === cm[1])) {
      const ids = products.filter(p => p.category === cm[1] || p.category.startsWith(cm[1] + '/')).map(p => p.id);
      const ps = ids.slice(0, 12).map(id => pById.get(id)); ps.forEach(citeProduct);
      return finish('find_product', query, [{ type: 'text', text: `${ids.length} product${ids.length === 1 ? '' : 's'} in ${plain(catName.get(cm[1]))}.` }, cardBlock(ps)], ps.slice(0, 2).map(p => `Datasheet for ${plain(p.name)}`), { intent: 'find_product', productId: ps[0] ? ps[0].id : null, productIds: ids, req: {}, facets: {} }, { matched: ps.map(p => ({ id: p.id, score: 1 })) }, t0);
    }
    if (/(tileType|substrate|location)=/.test(query)) {
      const sel = {}; for (const m of query.matchAll(/(tileType|substrate|location)=([\w-]+)/g)) sel[m[1]] = [m[2]];
      return guide(Object.assign({}, st && st.facets, sel), t0, query);
    }
    let text = query.replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, ' ').trim();
    // follow-up to a clarify: join with the previous query
    if (st && st.intent === 'clarify' && st.lastQuery && query.trim().split(/\s+/).length <= 6 && !/\?/.test(query)) text = st.lastQuery + ' ' + query;
    const ctx = {}; const n = normalise(text);
    ctx.names = nameMentions(text);
    ctx.req = parseRequest(text);
    ctx.hasArea = ctx.req.area != null || ctx.req.volume != null || ctx.req.length != null;
    let cls = classify(text, { hasProduct: ctx.names.length > 0, hasState: !!(st && st.productId), hasArea: ctx.hasArea });
    let intent = cls.intent;
    if (intent === 'compatibility' && !ctx.names.length && !(st && st.productId)) intent = 'find_product';
    // follow-up handling: a bare number / pack / rate continues the previous quote
    const bare = !/[a-z]{4,}/.test(n.replace(/\b(m2|m3|kg|litres?|ltr|mm|coats?|waste|add|pack|bag|pail|one|the|and|per|rate)\b/g, ''));
    if (st && st.productId && st.need && /\d/.test(n) && st.need !== 'rate') intent = 'quote';
    else if (st && st.productId && (st.intent === 'quote' || st.need) && (bare || /^\s*(the |a |an )?\d+(\.\d+)?\s*(kg|l|ltr|litre|ml)\b/.test(n) || /\b(waste|allowance|coats?)\b/.test(n) || (ctx.hasArea && intent !== 'documents'))) intent = 'quote';
    else if (st && st.need === 'rate' && parseRates(text).length) intent = 'quote';
    else if (st && st.productId && /^\s*(and |what about |how about )?(the )?(sds|msds|pds|datasheet|data sheet|brochure|safety data sheet)/.test(n)) intent = 'documents';
    if (/^\s*$/.test(text)) intent = 'help';
    if (!ctx.names.length && !(st && st.productId) && ctx.req.pack && !ctx.hasArea && !tokenize(text).filter(t => /[a-z]{3,}/.test(t) && !/^(kg|litre|ltr|ml|one)$/.test(t)).length) return finish('clarify', query, [{ type: 'ask', question: 'Which product is that pack size for? Give me the product name, or pick a category.', options: openOptions() }], suggestionsList().slice(0, 3), { intent: 'clarify', lastQuery: text }, {}, t0);
    if (intent === 'greeting' && ctx.names.length) intent = 'find_product';
    switch (intent) {
      case 'greeting': return simple('greeting', query, t0, [`G'day. I can help you find the right ${company.short || ''} product, check coverage, pull up datasheets and safety data sheets, check compatibility and work out how many packs you need. What are you working on?`.replace('  ', ' ')], suggestionsList().slice(0, 4));
      case 'help': return finish('help', query, [{ type: 'text', text: 'I can: find a product for a job (for example "what adhesive for porcelain tiles on concrete"), give coverage and consumption, find datasheets (PDS) and safety data sheets (SDS), check compatibility and primers, and work out quantities from an area, always from the published documentation.' }, { type: 'steps', title: 'Or start with a guided finder', options: openOptions() }], suggestionsList().slice(0, 4), { intent: 'help' }, {}, t0);
      case 'where_to_buy': case 'contact': {
        const want = intent === 'contact' ? /contact(?!-adhesives)|enquir|get-in-touch/i : /where-to-buy|distributor|stockist|retailer|dealer/i;
        const direct = pages.filter(p => want.test(p.url) && !/contact-adhesives/.test(p.url)).slice(0, 3);
        const useful = direct;
        useful.forEach(p => cite(p.title || p.url, p.url, 'page'));
        if (company.site) cite(company.name || company.site, company.site, 'page');
        const lead = intent === 'contact' ? 'I do not hold contact details in the published documentation I have.' : 'I do not hold stockist, distributor or price information in the published documentation I have.';
        const blocks = [{ type: 'text', text: `${lead} ${useful.length ? 'The website has a dedicated page: ' + useful.map(p => (p.title || p.url) + ' (' + p.url + ')').join('; ') + '.' : (company.site ? 'Please use ' + company.site + ' (the contact and where-to-buy sections) or ask your usual distributor.' : '')}`.trim() }];
        return finish(intent, query, blocks, ['Datasheet for a product', 'Which product for a leaking basement?'], { intent }, {}, t0);
      }
      case 'documents': return documentsIntent(query, text, st, t0);
      case 'compatibility': return compatibility(query, text, st, t0, ctx);
      case 'consumption': return consumption(query, text, st, t0, ctx);
      case 'quote': return quote(query, text, st, t0, ctx);
      default: return findProduct(query, text, st, t0, ctx);
    }
  }

  // ---------- tree / suggestions / stats ----------
  let treeCache = null;
  function tree() {
    if (treeCache) return treeCache;
    const catMap = new Map();
    for (const p of products) { const segs = p.category.split('/'); for (let i = 1; i <= segs.length; i++) { const k = segs.slice(0, i).join('/'); if (!catMap.has(k)) catMap.set(k, []); catMap.get(k).push(p.id); } }
    const productsIn = (cid) => catMap.get(cid) || [];
    const fcCache = {}; let ptext = null;
    const facetCount = (dim, id) => { const k = dim + id; if (fcCache[k] == null) { if (!ptext) ptext = products.map(p => normalise([p.summary, p.tagline, ...(p.usage || []), ...(p.attributes || [])].join(' '))); const f = syn.FACETS[dim].find(x => x.id === id); const ts = f.terms.map(normalise); fcCache[k] = ptext.filter(t => ts.some(tm => t.includes(tm))).length; } return fcCache[k]; };
    const t = buildTree({ products, categories: cats, FACETS: syn.FACETS, productsIn, facetCount, tileAdhesives: tileAdhesiveIds });
    treeCache = Object.assign({}, t.nodes.root, { nodes: t.nodes });
    return treeCache;
  }

  function suggestionsList() {
    const out = ['What adhesive for porcelain tiles on concrete?', 'Waterproofing a balcony', 'Which sealant for a shower?', 'Self-levelling for a timber floor'];
    const withRate = products.find(p => ratesOf(p).some(r => r.kind === 'per_area' || r.kind === 'area_per_pack') && /tile-adhesives/.test(p.category)) || products.find(p => ratesOf(p).some(r => r.kind === 'per_area'));
    if (withRate) out.push(`How much ${plain(withRate.name)} for 40 m2?`);
    const dp = products.find(p => docsFor(p).some(d => d.type === 'safety_data_sheet')); if (dp) out.push(`Safety data sheet for ${plain(dp.name)}`);
    return out;
  }
  const suggestions = () => suggestionsList();
  const stats = () => ({ products: products.length, documents: documents.length, categories: categories.length, pages: pages.length, terms: index.stats.terms, postings: index.stats.postings, buildMs, indexMs: index.stats.buildMs });

  return { ask, tree, suggestions, stats, warm, guide: (sel) => { cites.length = 0; return guide(sel); }, _internals: { index, expand, rankProducts, nameMentions, info, ratesOf, docsFor, detectFacets: (t) => detectFacets(compiled, t) } };
}
