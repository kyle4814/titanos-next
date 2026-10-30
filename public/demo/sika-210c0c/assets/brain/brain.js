// brain.js: the deterministic retrieval stack. No model, no network beyond the shard loader, no randomness.
// Order: corrected rules, exact product and alias, synonym and spelling tolerance, weighted token index, facet constraints, decision trees, honest unknown.
import { normalise, tokens, stem, words, STOP, GENERIC, dist, compact } from './text.js';
import { SYNONYM_GROUPS } from './syn.js';
import { parseFacets, systemLocation, adhesiveEnvironment, labelOf, SUBSTRATE, ENVIRONMENT, TILE } from './facets.js';
import { ANSWER_SCHEMA, CHIPS, NOT_KNOWN, validateCard } from './schema.js';
import * as C from './cards.js';

const now = () => (typeof performance !== 'undefined' ? performance : Date).now();
const FIELD_W = { 1: 10, 2: 4, 3: 3.5, 4: 2.5, 5: 1.2 };
const HARD_ENV = new Set(['wet_area', 'submerged', 'external', 'balcony_deck', 'freeze_thaw']);

// ---------------------------------------------------------------- intents
const RX = {
  price: /\b(price|prices|pricing|cost|costs|costing|quote|stockist|stockists|buy|purchase|retailer|discount|cheap|cheapest|afford|where can i get)\b/,
  compare: /\b(vs|versus|compare|comparison|difference between|differences between|better than)\b/,
  calcWords: /\b(how much|how many|quantity|quantities|work out|calculate|calculation|estimate|need for|required for|order|buy)\b|\bhow (much|many) .* (for|to cover)\b/,
  time: /\b(how long|dry|dries|drying|cure|cures|curing|cured|setting|sets|set time|open time|pot life|potlife|recoat|re ?coat|overcoat|wait|waiting|skin time|tack free|working time|adjust|adjustability|before (i can |you can )?(grout|walking|walk|traffic|tiling|tile|coat|apply|seal)|when can i)\b/,
  rate: /\b(coverage|consumption|spread rate|how far|cover|covers|yield|usage rate|application rate|dosage|dose|rate|rates)\b/,
  safety: /\b(ppe|gloves|glove|respirator|mask|hazard|hazards|first aid|signal word|storage|store|flammable|toxic|dangerous|safety|protective|goggles|ventilation|hazardous)\b/,
  doc: /\b(sds|msds|safety data|data ?sheet|pds|tds|brochure|document|documents|download|epd|certificate|technical data|datasheet|manual|literature)\b/,
  spec: /\b(specification|specifications|spec|specs|clause|clauses|standard|standards|comply|compliance|conform|conforms|tender|iso)\b|\bas ?\d{4}\b/,
  compat: /\b(can i|could i|suitable|compatible|compatibility|work with|ok to|okay to|safe to|use|used|over|on top of|onto|stick to|bond to|go over|apply|fix|install|lay|good for|right for|fit)\b/,
  system: /\b(system|full system|build ?up|steps|layers|what do i need|complete|everything i need)\b/,
};
export function classify(n, hasArea) {
  if (RX.price.test(n)) return 'price';
  if (RX.compare.test(n)) return 'compare';
  if ((hasArea && (RX.calcWords.test(n) || /\b(need|require|cover|packs?|pails?|buckets?|bags?|litres?|liters?)\b/.test(n))) || /\b(how many|how much) (packs?|pails?|buckets?|bags?|litres?|liters?|kg)\b/.test(n)) return 'calc';
  if (RX.time.test(n)) return 'time';
  if (RX.rate.test(n)) return 'rate';
  if (RX.safety.test(n) && !/\b(sds|msds|safety data)\b/.test(n)) return 'safety';
  if (RX.doc.test(n)) return 'document';
  if (RX.spec.test(n)) return 'spec';
  if (RX.system.test(n)) return 'system';
  if (RX.compat.test(n)) return 'compat';
  return 'which';
}
const DOC_TYPES = [
  ['safety_data_sheet', /\b(sds|msds|safety data|safety sheet)\b/, 'Safety data sheet'],
  ['product_data_sheet', /\b(pds|tds|data ?sheet|datasheet|technical data|product data)\b/, 'Product data sheet'],
  ['brochure', /\b(brochure|literature)\b/, 'Brochure'],
  ['environmental_product_declaration', /\b(epd|environmental)\b/, 'Environmental product declaration'],
  ['certificate', /\b(certificate)\b/, 'Certificate'],
  ['system_data_sheet', /\bsystem data\b/, 'System data sheet'],
];
const TIME_KIND = [
  ['open_time', /\b(open time|open|working time)\b/], ['adjustability_time', /\b(adjust|adjustability|reposition)\b/], ['pot_life', /\b(pot life|potlife|pot)\b/], ['skin_tack_times', /\b(skin|tack)\b/],
  ['recoat_times', /\b(recoat|re coat|overcoat|re ?apply|second coat|next coat)\b/], ['cure_times', /\b(cure|cures|curing|cured|dry|dries|drying|set|sets|setting|grout|grouting|walk|walking|traffic|wait|waiting|tiling|service|load|before)\b/],
];

// ---------------------------------------------------------------- the brain
export function createBrain({ load, config } = {}) {
  let core = null, vocab = null, aliasList = null, rulesList = null, ruleTok = null;
  const pIndex = new Map();

  async function boot() {
    if (core) return core;
    core = await load.core(); if (!core) throw new Error('brain: core shard missing');
    core.P.forEach((p, i) => pIndex.set(p.id, i));
    vocab = Object.keys(core.post);
    return core;
  }

  // ---- stage 1 and 2: exact and fuzzy product match
  const aliasToks = new Map();
  function findExact(n) {
    const w = n.split(' ').filter(Boolean); const hits = [];
    for (let i = 0; i < w.length; i++) for (let k = Math.min(8, w.length - i); k >= 1; k--) {
      const phrase = w.slice(i, i + k).join(' '); const a = core.alias[phrase] || (k > 1 ? core.alias[compact(phrase)] : null) || core.alias[stemmedPhrase(phrase)];
      if (a) { hits.push({ i, k, pis: a, key: phrase }); }
    }
    // compact join of adjacent words handles "sikaflex 11 fc" vs "sikaflex-11fc"
    return pickSpans(hits);
  }
  const stemmedPhrase = (p) => p; // alias keys are raw words; stem tolerance is handled by the fuzzy stage
  function pickSpans(hits) {
    hits.sort((a, b) => b.k - a.k || a.i - b.i); const used = new Set(), out = [];
    for (const h of hits) { let clash = false; for (let j = h.i; j < h.i + h.k; j++) if (used.has(j)) clash = true; if (clash) continue; for (let j = h.i; j < h.i + h.k; j++) used.add(j); out.push(h); }
    return out;
  }
  function fuzzyAliases(n) {
    if (!aliasList) aliasList = Object.entries(core.alias).filter(([k]) => k.includes(' ') || /\d/.test(k)).map(([k, v]) => ({ k, toks: k.split(' ').map(stem), pis: v }));
    const q = n.split(' ').filter(Boolean).map(stem); const hits = [];
    const tokEq = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && !/\d/.test(a + b) && dist(a, b, a.length >= 8 ? 2 : 1) <= (a.length >= 8 ? 2 : 1));
    for (const a of aliasList) {
      const k = a.toks.length; if (k < 2 && !/\d/.test(a.k)) continue;
      for (let i = 0; i + k <= q.length; i++) { let ok = true, fuzzy = 0; for (let j = 0; j < k; j++) { if (q[i + j] === a.toks[j]) continue; if (tokEq(q[i + j], a.toks[j])) { fuzzy++; continue; } ok = false; break; } if (ok && fuzzy && (fuzzy <= 1 || k >= 4)) { hits.push({ i, k, pis: a.pis, key: a.k, fuzzy }); break; } }
    }
    return pickSpans(hits);
  }

  // ---- stage 3: weighted token index with synonym and spelling tolerance
  function spell(t) {
    if (core.post[t] || t.length < 4 || /\d/.test(t)) return t;
    const max = t.length >= 8 ? 2 : 1; let best = null, bd = 9, bdf = -1;
    for (const v of vocab) { if (Math.abs(v.length - t.length) > max) continue; const d = dist(t, v, max); if (d > max) continue; const df = core.post[v].length; if (d < bd || (d === bd && df > bdf)) { best = v; bd = d; bdf = df; } }
    return best || t;
  }
  const groups = SYNONYM_GROUPS.map((g) => g.map((t) => ({ n: normalise(t), toks: tokens(t, true).filter((x) => !STOP.has(x)) })));
  function expand(n, qtoks) {
    const q = new Map(); for (const t of qtoks) q.set(t, 1);
    const padded = ' ' + n + ' ';
    for (const g of groups) {
      const hit = g.filter((x) => padded.includes(' ' + x.n + ' '));
      if (!hit.length) continue; const hs = new Set(hit.flatMap((x) => x.toks));
      for (const x of g) for (const s of x.toks) if (!hs.has(s) && !q.has(s)) q.set(s, 0.4);
    }
    return q;
  }
  function search(n, extraTokens) {
    const base = tokens(n).filter((t) => !GENERIC.has(t)).map(spell);
    const qm = expand(n, [...new Set(base.concat(extraTokens || []))]);
    const N = core.P.length, score = new Map(), hit = new Map();
    for (const [t, w] of qm) {
      const post = core.post[t]; if (!post) continue;
      const best = new Map(); for (const v of post) { const pi = v >> 3, f = v & 7; const ws = FIELD_W[f] || 1; if (ws > (best.get(pi) || 0)) best.set(pi, ws); }
      const idf = Math.log(1 + N / best.size);
      for (const [pi, ws] of best) { score.set(pi, (score.get(pi) || 0) + w * idf * ws); if (w >= 1) hit.set(pi, (hit.get(pi) || 0) + 1); }
    }
    const nPrim = [...qm.values()].filter((w) => w >= 1).length;
    const items = [];
    for (const [pi, s] of score) { const cov = (hit.get(pi) || 0) / Math.max(1, nPrim); items.push({ pi, score: s * (0.4 + 0.6 * cov), cov }); }
    items.sort((a, b) => b.score - a.score || a.pi - b.pi);
    return { items, qm };
  }

  // ---- corrected rules (stage 0)
  const ruleTokens = (text) => { const out = new Set(); for (let t of String(text).toLowerCase().split(/[^a-z0-9]+/)) { if (!t || STOP.has(t)) continue; if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1); out.add(t); } return [...out].sort(); };
  const jacc = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  async function matchRule(q) {
    if (rulesList === null) { const r = await load.rules(); rulesList = r && Array.isArray(r.rules) ? r.rules : []; }
    if (!rulesList.length) return null; const qt = ruleTokens(q); let best = null;
    for (const r of rulesList) { const s = jacc(qt, r.pattern || ruleTokens(r.question)); if (s >= 0.75 && (!best || s > best.s || (s === best.s && String(r.corrected_at) > String(best.r.corrected_at)))) best = { r, s }; }
    return best ? best.r : null;
  }

  // ---- helpers over shards
  const shard = async (pi) => load.product(core.P[pi].id);
  async function bestSentence(sh, qset) {
    const cands = [...(sh.d.us || []), ...(sh.d.a || []), sh.d.s, sh.d.t].filter(Boolean);
    let best = null, bs = 0;
    for (const s of cands) { const st = new Set(tokens(s)); let c = 0; for (const t of qset) if (st.has(t)) c++; if (c > bs) { bs = c; best = s; } }
    return best || cands[0] || sh.n;
  }

  // ---- compatibility
  function conditionsOf(facets) {
    const out = [];
    const termOf = (list, id) => (list.find((x) => x.id === id) || { terms: [] }).terms;
    for (const h of facets.hits) {
      const dim = SUBSTRATE.some((f) => f.id === h.id) ? 'substrate' : TILE.some((f) => f.id === h.id) ? 'tile_type' : 'environment';
      if (dim === 'environment' && ['floor', 'wall', 'internal', 'commercial', 'domestic'].includes(h.id) && false) continue;
      const list = dim === 'substrate' ? SUBSTRATE : dim === 'tile_type' ? TILE : ENVIRONMENT;
      out.push({ id: h.id, dim, label: h.term, hard: dim !== 'environment' || HARD_ENV.has(h.id), toks: termOf(list, h.id).map((t) => t.toks) });
    }
    return out;
  }
  function covers(rule, cond) {
    if ((rule.tags[cond.dim] || []).includes(cond.id)) return true;
    const rt = tokens(rule.text, true).map((x) => x); const set = rt.join(' ');
    return cond.toks.some((tk) => (' ' + set + ' ').includes(' ' + tk.join(' ') + ' '));
  }
  function verdictFor(sh, conds) {
    const rules = (sh.cp || []).filter((r) => r.pol === 'yes' || r.pol === 'no');
    const hard = conds.filter((c) => c.hard); const need = hard.length ? hard : conds;
    if (!need.length) return { verdict: 'unknown', rule: null, uncovered: [] };
    const score = (r, list) => list.filter((c) => covers(r, c)).length;
    const textCovers = (r, c) => { const set = ' ' + tokens(r.text, true).join(' ') + ' '; return c.toks.some((tk) => set.includes(' ' + tk.join(' ') + ' ')); };
    const nos = rules.filter((r) => r.pol === 'no' && !r.cond && need.some((c) => textCovers(r, c))).sort((a, b) => need.filter((c) => textCovers(b, c)).length - need.filter((c) => textCovers(a, c)).length);
    if (nos.length) return { verdict: 'no', rule: nos[0], uncovered: [] };
    const yes = rules.filter((r) => r.pol === 'yes' && score(r, need) > 0).sort((a, b) => score(b, need) - score(a, need) || (a.cond ? 1 : 0) - (b.cond ? 1 : 0));
    if (!yes.length) return { verdict: 'unknown', rule: null, uncovered: need.map((c) => c.label) };
    const best = yes[0]; const unc = need.filter((c) => !covers(best, c));
    if (unc.length) return { verdict: 'unknown', rule: best, uncovered: unc.map((c) => c.label) };
    return { verdict: best.cond ? 'conditional' : 'yes', rule: best, uncovered: [] };
  }

  const TAG_TERMS = (() => { const m = new Map(); for (const [dim, list] of [['substrate', SUBSTRATE], ['tile_type', TILE], ['environment', ENVIRONMENT]]) for (const f of list) m.set(dim + ':' + f.id, f.terms.map((t) => t.toks)); return m; })();
  function mentionsTag(text, tag) { const set = ' ' + tokens(text, true).join(' ') + ' '; return (TAG_TERMS.get(tag) || []).some((tk) => set.includes(' ' + tk.join(' ') + ' ')); }

  // ---- decision trees
  const TREE_TILE = { ceramic: 'ceramic', porcelain: 'porcelain', mosaic: 'mosaic', glass_tile: 'glass_tile', natural_stone: 'natural_stone', moisture_sensitive_stone: 'moisture_sensitive_stone', large_format: 'large_format', terracotta: 'terracotta', brick_slip: 'brick_slip' };
  const TREE_SUB = ['concrete', 'cement_screed', 'cement_render', 'brick_block', 'fibre_cement', 'tile_underlay', 'plasterboard', 'existing_tiles', 'waterproofing_membrane', 'timber', 'aac', 'underfloor_heating', 'self_levelling_underlayment'];
  async function treeAnswer(n, facets, q) {
    const tree = await load.tree(); if (!tree) return null;
    const wantWp = /\b(waterproof|membrane|tanking)\b/.test(n) && !/\badhesive|glue\b/.test(n);
    const t = tree.trees.find((x) => x.id === (wantWp ? 'waterproofing-membrane' : 'tile-adhesive'));
    if (!t) return null;
    const env = adhesiveEnvironment(facets.environment); const tile = facets.tile_type.map((x) => TREE_TILE[x]).find(Boolean); const sub = facets.substrate.find((x) => TREE_SUB.includes(x));
    const key = wantWp ? [env, sub] : [env, tile, sub];
    const names = wantWp ? ['environment', 'substrate'] : ['environment', 'tile', 'substrate'];
    const missing = names.filter((_, i) => !key[i]);
    if (missing.length) {
      const first = t.questions.find((x) => x.id === missing[0]);
      const opts = first.options.map((o) => `${q.replace(/[?.!]+$/, '')}, ${o.label.toLowerCase()}`);
      return { choose: C.chooseCard(t.title, first.text, opts) };
    }
    const leaf = t.leaves[key.join('|')];
    if (!leaf || !leaf.fit.length) return { none: true, tree: t, key };
    return { leaf, tree: t, key, rulesTable: tree.rules };
  }

  // ---- main entry
  async function ask(question, state = null) {
    const t0 = now(); const trace = [];
    const q = String(question || '').trim();
    const out = (intent, stage, cards, extra = {}) => {
      for (const c of cards) { const bad = validateCard(c); if (bad.length) c._invalid = bad; }
      return { schema: ANSWER_SCHEMA, query: q, intent, stage, cards, followups: extra.followups || [...new Set(cards.flatMap((c) => c.followups || []))].slice(0, 4), state: extra.state || null, ms: Math.round((now() - t0) * 100) / 100, trace };
    };
    await boot();
    const rule = await matchRule(q);
    trace.push('rules:' + (rule ? 'hit' : 'miss'));
    if (rule) return out('rule', 'rules', [C.ruleCard(rule)]);
    const n0 = normalise(q);
    // product mentions: exact, then fuzzy
    let mentions = findExact(n0); let stage = 'exact';
    if (!mentions.length) { mentions = fuzzyAliases(n0); stage = mentions.length ? 'fuzzy' : 'index'; }
    trace.push(`products:${stage}:${mentions.length}`);
    // the words of a product name are not intent or facet words ("Opti-Cure" is not a cure question, "Concrete Fix" is not concrete)
    const w0 = n0.split(' ').filter(Boolean), cut = new Set(); for (const m of mentions) for (let j = m.i; j < m.i + m.k; j++) cut.add(j);
    const n = mentions.length ? w0.filter((_, j) => !cut.has(j)).join(' ') : n0;
    const facets = parseFacets(n); let intent = classify(n, facets.area != null);
    const resolve = (m) => m.pis.length === 1 ? m.pis[0] : null;
    let pis = []; let ambiguous = null;
    for (const m of mentions) { const one = resolve(m); if (one != null) { if (!pis.includes(one)) pis.push(one); } else if (!ambiguous) ambiguous = m; }
    if (!pis.length && ambiguous) { pis = ambiguous.pis.slice(0, 4); }
    // a follow-up ("and its SDS?") keeps the last product
    const followUp = /^(and |also |what about |how about )|\b(it|its|this one|that one|the same|them)\b/.test(n) || tokens(n).length <= 3;
    const fromState = !pis.length && state && state.productId && pIndex.has(state.productId) && intent !== 'which' && followUp;
    if (fromState) { pis = [pIndex.get(state.productId)]; trace.push('state:product'); }
    const namedAll = pis.length && !ambiguous;
    const st = (pi) => ({ productId: core.P[pi].id, intent });

    if (intent === 'price') {
      const sh = pis.length ? await shard(pis[0]) : null;
      return out(intent, stage, [C.unknown(q, sh, 'Prices are not published in the documentation I work from, and I will not guess one. Please ask Sika Australia or a stockist.', ['price'])], { state: pis.length ? st(pis[0]) : null });
    }
    if (intent === 'compare') {
      if (pis.length >= 2) { const [a, b] = await Promise.all([shard(pis[0]), shard(pis[1])]); return out(intent, stage, [C.compareCard(a, b)], { state: st(pis[0]) }); }
      intent = 'which';
    }
    if (!pis.length && ['compat', 'time', 'rate', 'document', 'safety', 'spec'].includes(intent) && /^(what|which|recommend|suggest|best|any|is there)\b/.test(n)) intent = 'which';
    if (!pis.length && intent === 'compat') intent = 'which';
    const needsProduct = ['calc', 'time', 'rate', 'safety', 'document', 'spec', 'compat'].includes(intent);
    if (needsProduct && !pis.length) {
      // name the products that fit and let the visitor pick: never guess one
      const { items } = search(n, []);
      const top = items.slice(0, 4);
      if (!top.length || top[0].score < 4) return out(intent, 'unknown', [C.unknown(q, null, 'I could not tell which product you mean, and the published documentation I work from does not answer this without one.', ['product name'])]);
      const verb = { calc: 'How much', time: 'How long does', rate: 'Coverage of', safety: 'Safety information for', document: 'Data sheet for', spec: 'Specification clauses for', compat: 'Is it suitable: ' }[intent];
      const opts = top.map((x) => intent === 'calc' ? `How much ${core.P[x.pi].n} for ${facets.area || 20} m2` : intent === 'time' ? `How long does ${core.P[x.pi].n} take to cure` : `${verb} ${core.P[x.pi].n}`);
      trace.push('index:choose');
      return out(intent, 'index', [C.chooseCard('Which product do you mean?', 'That question needs a product. These are the closest matches in the published range. Pick one.', opts)], { state: null });
    }
    if (needsProduct || (namedAll && intent === 'which' && pis.length === 1)) {
      const sh = await shard(pis[0]); if (!sh) return out(intent, stage, [C.unknown(q, null, 'The product data could not be loaded.', [])]);
      const s = st(pis[0]);
      if (intent === 'calc') { if (facets.area == null) return out(intent, stage, [C.chooseCard(`How much ${sh.n}?`, 'How many square metres is the area?', [10, 20, 50].map((a) => `How much ${sh.n} for ${a} m2`))], { state: s }); return out(intent, stage, [C.calcCard(sh, facets.area, q)], { state: s }); }
      if (intent === 'rate') return out(intent, stage, [C.rateCard(sh, q)], { state: s });
      if (intent === 'time') { const kinds = TIME_KIND.filter(([, rx]) => rx.test(n)).map(([k]) => k); const ks = kinds.length ? kinds : ['open_time', 'cure_times', 'pot_life', 'recoat_times']; let card = C.timeCard(sh, ks, q); if (card.type === 'unknown' && kinds.length) { const all = C.timeCard(sh, Object.keys(sh.tm || {}), q); if (all.type !== 'unknown') { all.headline = 'The documentation gives no time of exactly that kind. These are the published times it does give, quoted as written.'; card = all; } } return out(intent, stage, [card], { state: s }); }
      if (intent === 'safety') return out(intent, stage, [C.safetyCard(sh, n, q)], { state: s });
      if (intent === 'document') { const want = DOC_TYPES.filter(([, rx]) => rx.test(n)); const types = want.length ? want : [DOC_TYPES[1], DOC_TYPES[0]]; const cards = []; for (const [ty, , label] of types) { const docs = (sh.dc || []).filter((d) => d.ok && (d.ty === ty)); if (docs.length) cards.push(C.documentCard(sh, docs, label)); } if (!cards.length) cards.push(C.unknown(q, sh, `No ${types.map((t) => t[2].toLowerCase()).join(' or ')} is published for this product.`, types.map((t) => t[2]))); return out(intent, stage, cards, { state: s }); }
      if (intent === 'spec') {
        let clauses = []; let ds = null;
        if (/\b(clause|clauses|specification|spec)\b/.test(n)) { const sp = await load.spec(sh.id).catch(() => null); if (sp) { ds = sp.ds; const qt = new Set(tokens(n).filter((t) => !['specification', 'spec', 'clause', 'clauses'].includes(t))); const all = sp.sections.flatMap((x) => x.cl); const sc = all.map((c) => ({ c, s: tokens(c.t + ' ' + (c.c || '')).filter((t) => qt.has(t)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s); clauses = sc.slice(0, 3).map((x) => x.c); } }
        return out(intent, stage, [C.specCard(sh, clauses, ds || (sh.sp && sh.sp.ds), q)], { state: s });
      }
      if (intent === 'compat') {
        const conds = conditionsOf(facets);
        const v = verdictFor(sh, conds);
        return out(intent, stage, [C.compatCard(sh, v.verdict, v.rule, q, conds.map((c) => c.label), v.uncovered)], { state: s });
      }
      // a named product with nothing else asked: its product card with the useful next steps
      const sentence = await bestSentence(sh, new Set(tokens(n)));
      return out('product', stage, [C.productCard(sh, sentence)], { state: s });
    }
    if (ambiguous && !needsProduct) {
      const shs = await Promise.all(pis.map(shard)); return out('product', stage, shs.map((sh) => C.productCard(sh, sh.d.t)), { followups: [] });
    }

    // ---- which product / system / tree
    const hasTile = facets.tile_type.length, hasSub = facets.substrate.length, loc = systemLocation(facets.environment);
    if ((intent === 'system' || (hasTile && hasSub && loc && !/\b(adhesive|glue|grout|primer|membrane|waterproof)\b/.test(n))) && hasSub) {
      const sysMap = { porcelain: 'porcelain', ceramic: 'ceramic', mosaic: 'mosaic', glass_tile: 'glass', natural_stone: 'natural-stone', large_format: 'large-format', terracotta: 'quarry-terracotta' };
      const subMap = { concrete: 'concrete', cement_screed: 'screed-render', cement_render: 'screed-render', brick_block: 'masonry', fibre_cement: 'cement-board', plasterboard: 'plasterboard', existing_tiles: 'existing-tiles', aac: 'aac', timber: 'timber' };
      const tile = facets.tile_type.map((x) => sysMap[x]).find(Boolean), sub = facets.substrate.map((x) => subMap[x]).find(Boolean);
      if (tile && sub && loc) {
        const cat = await load.category('construction/tile-stone-installationsystems');
        const sys = cat && cat.systems && cat.systems[`${tile}|${sub}|${loc}`];
        if (sys) { trace.push('system:' + sys.slug); return out('system', 'tree', [C.systemCard(sys)], {}); }
        trace.push('system:none');
        return out('system', 'tree', [C.unknown(q, null, 'The published documentation does not support a complete system for this combination. Please contact Sika Australia technical services.', ['system for this combination'])]);
      }
    }
    if ((hasTile || /\b(tile|tiles|tiling|tiled|porcelain|ceramic|mosaic|grout)\b/.test(n)) && (hasSub || facets.environment.length) && /\b(adhesive|glue|bond|membrane|waterproof|waterproofing|tanking)\b/.test(n)) {
      const t = await treeAnswer(n, facets, q);
      if (t && t.choose) { trace.push('tree:ask'); return out('tree', 'tree', [t.choose]); }
      if (t && t.leaf) {
        trace.push('tree:leaf:' + t.key.join('|'));
        const cards = [];
        for (const f of t.leaf.fit.slice(0, 4)) {
          const sh = await load.product(f.p); if (!sh) continue;
          const ev = f.ev.map((id) => t.rulesTable[id]).filter(Boolean).sort((a, b) => (/suit|designed|intended|recommend/i.test(b.text) - /suit|designed|intended|recommend/i.test(a.text)) || b.text.length - a.text.length);
          const c = C.productCard(sh, ev[0] ? ev[0].text : sh.d.t, `The data sheet says it suits this job`);
          if (ev[0]) { c.facts = ev.slice(0, 2).map((r) => ({ source_url: r.url, page: r.page, sentence: r.text, status: 'PUBLISHED', doc_type: 'PDS', doc_version: r.doc_version })); c.source = c.facts[0]; c.chip = CHIPS.DATASHEET; c.lines = [{ label: 'The data sheet says', text: ev[0].text }]; }
          if (f.pr && f.pr.length) { const pn = f.pr.map((id) => (core.P[pIndex.get(id)] || {}).n).filter(Boolean); if (pn.length) c.lines.push({ label: 'Primer it names', text: pn.join(', ') }); }
          cards.push(c);
        }
        if (cards.length) return out('tree', 'tree', cards, { followups: [] });
      }
      if (t && t.none) trace.push('tree:none');
    }
    // stage 3 and 4: index, then facet constraints from the compatibility tags
    const { items, qm } = search(n, []);
    trace.push('index:' + items.length);
    if (!items.length || items[0].score < 3 || items[0].cov < 0.5) return out(intent, 'unknown', [C.unknown(q, null, 'Nothing in the published documentation I work from matches that clearly enough to name a product.', [])]);
    let list = items.slice(0, 30); const ruled = [];
    if (facets.substrate.length || facets.tile_type.length || facets.environment.some((e) => HARD_ENV.has(e))) {
      trace.push('facets');
      const cats = [...new Set(list.slice(0, 12).map((x) => core.P[x.pi].c.split('/').slice(0, 2).join('/')))].slice(0, 3);
      const shards = (await Promise.all(cats.map((c) => load.category(c)))).filter(Boolean);
      const asks = [...facets.substrate.map((x) => 'substrate:' + x), ...facets.tile_type.map((x) => 'tile_type:' + x), ...facets.environment.filter((e) => HARD_ENV.has(e)).map((x) => 'environment:' + x)];
      const top = list[0].score;
      list = list.map((it) => {
        const id = core.P[it.pi].id; let mult = 1, no = null;
        for (const sd of shards) for (const tag of asks) { const e = sd.tags[tag]; if (!e) continue; const nr = e.no.find((r) => r.p === id && !r.c && mentionsTag(r.t, tag)); if (nr) no = no || nr; else if (e.yes.some((r) => r.p === id && !r.c)) mult *= 1.25; else if (e.yes.some((r) => r.p === id)) mult *= 1.1; }
        if (no) { if (it.score >= top * 0.5) ruled.push({ it, rule: no }); return null; }
        return { ...it, score: it.score * mult };
      }).filter(Boolean);
      list.sort((a, b) => b.score - a.score || a.pi - b.pi);
    }
    const top = list.slice(0, 4);
    const qset = new Set([...qm.keys()].filter((k) => qm.get(k) >= 1));
    const cards = [];
    for (const it of top) { const sh = await shard(it.pi); if (sh) cards.push(C.productCard(sh, await bestSentence(sh, qset))); }
    if (ruled.length) { const r = ruled[0]; const sh = await shard(r.it.pi); if (sh) { const c = C.compatCard(sh, 'no', { id: r.rule.r, text: r.rule.t, s: { u: r.rule.u, p: r.rule.pg, v: r.rule.v, t: 'PDS' } }, q, [], []); c.title = `Ruled out: ${sh.n}`; c.headline = 'No. This product matches your words but its own data sheet rules it out for this job.'; cards.push(c); } }
    return out(cards.length ? 'which' : intent, 'index', cards, { state: top.length === 1 ? { productId: core.P[top[0].pi].id, intent: 'which' } : null });
  }
  return { ask, boot, search: (n) => search(normalise(n), []), core: () => core };
}
export { NOT_KNOWN };
