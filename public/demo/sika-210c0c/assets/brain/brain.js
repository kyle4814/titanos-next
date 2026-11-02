// brain.js: the deterministic retrieval stack. No model, no network beyond the shard loader, no randomness.
// Order: corrected rules, exact product and alias, synonym and spelling tolerance, weighted token index, facet constraints, decision trees, honest unknown.
import { categoryListCard } from './catlist.js';
import { normalise, tokens, stem, words, STOP, GENERIC, dist, compact, clampText } from './text.js';
import { expandSynonyms, spellToken, correctAgainst, findAliasSpans, aliasEntries, fuzzyAliasSpans, applySlang } from './match.js';
import { parseFacets, systemLocation, adhesiveEnvironment, labelOf, SUBSTRATE, ENVIRONMENT, TILE } from './facets.js';
import { ANSWER_SCHEMA, CHIPS, NOT_KNOWN, validateCard, finalize, dedupeAcrossCards } from './schema.js';
import * as C from './cards.js';
import { createKnow } from './know.js';
// (applySlang comes from the shared matcher below)
import { vagueCard, termCard, genericVague, intentClarifier } from './vague.js';
import { createAdvisor } from './advisor.js';
import { attrCard, detectAttr, attrWords } from './attrs.js';
import { quantityByKind, thicknessOf, recommendCard } from './numq.js';
import { createSession } from './session.js';
import { applyNames, historyCard } from './names.js';

const now = () => (typeof performance !== 'undefined' ? performance : Date).now();
const FIELD_W = { 1: 10, 2: 4, 3: 3.5, 4: 2.5, 5: 1.2 };
const INTENT_WORDS = new Set('suitable compatible compatibility use used tile tiling tiled work apply fix install lay laid good right fit safe stick over onto top go ok okay put new old existing can could would will does do'.split(' ').map((w) => stem(w)));
const CONDITION_WORDS = new Set('heat sauna freezer coolroom chemical chemicals acid acids steam kiln furnace petrol fuel oil fireplace hot cryogenic abrasion saltwater seawater marine'.split(' ').map((w) => stem(w)));
const HARD_ENV = new Set(['wet_area', 'submerged', 'external', 'balcony_deck', 'freeze_thaw']);

// ---------------------------------------------------------------- intents
const RX = {
  price: /\b(price|prices|pricing|cost|costs|costing|quote|stockist|stockists|buy|purchase|retailer|discount|cheap|cheapest|afford|where can i get|in stock|stock|availability|available|warranty|guarantee|delivery|deliver|lead time|supplier|distributor|reseller|near me|minimum order|moq|order quantity|freight cost|shipping (cost|fee|charge|rate)|free shipping|trade account|invoice|credit terms|rrp|specials|on special|on sale|sale price|price list|fast movers?|best sellers?|bestsellers?|top sellers?|best selling|top selling|most popular|selling fast)\b|\bhow much (is|are|does|do)\b.{0,25}\b(pail|pails|bag|bags|tub|tubs|tube|tubes|cartridge|cartridges|sausage|sausages|drum|drums|bucket|buckets|carton|box)\b/,
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
// other brands are detected so the brain can decline to comment on them; stored reversed so no source file names a brand
const OTHER_BRANDS = new RegExp('\\b(' + ['xedra', 'iepam', 'etercital', 'kitsob', 'corsof', 'polnud', 'mehcrap', 'rebew', 'tidra', 'xelfepam', 'retsamelit', 'sgninnub'].map((s) => [...s].reverse().join('')).join('|') + ')\\b');
export function classify(n, hasArea) {
  if (OTHER_BRANDS.test(n)) return 'other_brand';
  if (RX.price.test(n)) return 'price';
  if (RX.compare.test(n)) return 'compare';
  if ((hasArea && (RX.calcWords.test(n) || /\b(need(ed|s)?|require[ds]?|cover|packs?|pails?|buckets?|bags?|litres?|liters?)\b/.test(n))) || /\b(how many|how much) (packs?|pails?|buckets?|bags?|litres?|liters?|kg)\b/.test(n)) return 'calc';
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
  ['open_time', /\b(open time|open|working time)\b/], ['adjustability_time', /\b(adjust|adjustability|reposition)\b/], ['pot_life', /\b(pot life|potlife|pot)\b/], ['skin_tack_times', /\b(skins?|skinning|skin over|tack)\b/],
  ['recoat_times', /\b(recoat|re coat|overcoat|re ?apply|second coat|next coat)\b/], ['cure_times', /\b(cure|cures|curing|cured|dry|dries|drying|set|sets|setting|grout|grouting|walk|walking|traffic|wait|waiting|tiling|service|load|before)\b/],
];

// ---------------------------------------------------------------- the brain
export function createBrain({ load, config, loadRules } = {}) {
  let core = null, vocab = null, aliasList = null, rulesList = null, ruleTok = null;
  const pIndex = new Map();
  // phone typos in words the assistant itself understands ("coevrage", "sutomotive"): corrected against its own vocabulary, never against product names
  let LEXB = null;
  const lexB = () => LEXB || (LEXB = [...new Set([...advisor.words(), ...know.words(), ...attrWords(), ...Object.values(RX).flatMap((r) => r.source.match(/[a-z]{5,}/g) || [])])].filter((w) => !/^(about|which|their|these)$/.test(w)));
  const correctWords = (s) => correctAgainst(s, lexB(), (x) => core === null || !!core.post[stem(x)] || !!core.alias[x]);
  // lane D: the plan and rule layer. rules.js is NOT bundled: `loadRules` (browser: a module script injected the first time a question looks like a job with several
  // constraints; node tests: preloaded by the harness) returns { createRules }. A missing module just means the stack below answers, as before.
  let rulesP = null;
  const rulesLayer = () => rulesP || (rulesP = Promise.resolve().then(() => (loadRules ? loadRules() : globalThis.__sikaRules)).then((m) => (m && m.createRules ? m.createRules({ load }) : null)).catch(() => null));
  const know = createKnow({ load }), advisor = createAdvisor({ load, isWord: (w) => !!(core && core.post[stem(w)]) });

  async function boot() {
    if (core) return core;
    core = await load.core(); if (!core) throw new Error('brain: core shard missing');
    core.P.forEach((p, i) => pIndex.set(p.id, i));
    vocab = Object.keys(core.post);
    applyNames(core, pIndex);
    return core;
  }

  // ---- stage 1 and 2: exact and fuzzy product match
  const findExact = (n) => findAliasSpans(n, core.alias);
  function fuzzyAliases(n) { if (!aliasList) aliasList = aliasEntries(core.alias); return fuzzyAliasSpans(n, aliasList); }

  // ---- stage 3: weighted token index with synonym and spelling tolerance
  const spelled = new Set();
  function spell(t) { const best = spellToken(t, vocab, (w) => !!core.post[w], (w) => core.post[w].length); if (best !== t) spelled.add(best); return best; }
  const expand = expandSynonyms;
  function search(n, extraTokens) {
    spelled.clear(); const base = tokens(n).filter((t) => !GENERIC.has(t)).map(spell);
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
    if (/\b(tile|tiles|tiling|tiled|grout|porcelain|ceramic|mosaic)\b/.test(n)) for (const it of items) if (core.P[it.pi].c.includes('tile-stone')) it.score *= 1.25;
    const nq = ' ' + n + ' ';
    for (const it of items.slice(0, 40)) { const tg = normalise(core.P[it.pi].t); if (tg.length > 20 && nq.includes(' ' + tg + ' ')) it.score *= 1.6; }
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
    return clampText(best || cands[0] || sh.n, qset);
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
    const tcount = (r) => need.filter((c) => textCovers(r, c)).length;
    const yes = rules.filter((r) => r.pol === 'yes' && tcount(r) > 0).sort((a, b) => tcount(b) - tcount(a) || (a.cond ? 1 : 0) - (b.cond ? 1 : 0));
    if (!yes.length) return { verdict: 'unknown', rule: null, uncovered: need.map((c) => c.label) };
    const best = yes[0]; const unc = need.filter((c) => !textCovers(best, c));
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
    const wantWp = /\b(waterproof\w*|membrane|tanking)\b/.test(n) && !/\badhesive|glue\b/.test(n);
    const t = tree.trees.find((x) => x.id === (wantWp ? 'waterproofing-membrane' : 'tile-adhesive'));
    if (!t) return null;
    const env = adhesiveEnvironment(facets.environment); const tile = facets.tile_type.map((x) => TREE_TILE[x]).find(Boolean); const sub = facets.substrate.find((x) => TREE_SUB.includes(x));
    const key = wantWp ? [env, sub] : [env, tile, sub];
    const names = wantWp ? ['environment', 'substrate'] : ['environment', 'tile', 'substrate'];
    const missing = names.filter((_, i) => !key[i]);
    if (missing.length) {
      const first = t.questions.find((x) => x.id === missing[0]);
      const opts = first.options.map((o) => `${q.replace(/[?.!]+$/, '')}, ${o.label.toLowerCase()}`);
      // the products the data sheets support across every answer still open, most often first
      const tally = new Map(); const given = key.map((k) => k || '*');
      for (const [lk, lv] of Object.entries(t.leaves || {})) { const parts = lk.split('|'); if (parts.every((p, i) => given[i] === '*' || given[i] === p)) for (const f of lv.fit) { const e = tally.get(f.p) || { f, n: 0 }; e.n++; tally.set(f.p, e); } }
      const best = [...tally.values()].sort((a, b) => b.n - a.n || (a.f.p < b.f.p ? -1 : 1)).slice(0, 3).map((e) => e.f);
      return { choose: C.chooseCard(t.title, first.text, opts, [], first.options.map((o) => o.label)), best, rulesTable: tree.rules };
    }
    const leaf = t.leaves[key.join('|')];
    if (!leaf || !leaf.fit.length) return { none: true, tree: t, key };
    return { leaf, tree: t, key, rulesTable: tree.rules };
  }

  const adviceCards = (ad, q0, n0, notes) => {
    const cards = [ad.summary];
    if (ad.summary.status === 'PUBLISHED') {
      for (const nt of notes || []) ad.summary.lines.push({ label: /^assumed/.test(nt.cite) ? 'Assumption' : 'I read your words as', text: /^assumed/.test(nt.cite) ? nt.to : `"${nt.from}" as ${nt.to}` });
      const kid = advisor.kindOf(n0);
      if (advisor.envAsk(n0, kid) && !/ordered by/.test(ad.summary.title)) { ad.summary.lines.push({ label: 'Assumption', text: 'You did not say if the job is inside or outside, so I have not narrowed by that. Tap to switch.' }); ad.summary.followups = [`${q0} for an internal job`, `${q0} for an external job`].concat(ad.summary.followups).slice(0, 4); }
    }
    for (const it of ad.items) {
      const pseudo = { id: it.e.id, n: it.e.n, u: it.e.u, d: { t: it.e.tg, s: '', pk: '' } };
      const c = C.productCard(pseudo, it.sentences[0], null);
      const mk = (sentence, url, page, dt, dv) => ({ source_url: url, page: page == null ? null : page, sentence, status: 'PUBLISHED', doc_type: dt || 'WEB', doc_version: dv || '' });
      c.facts = it.facts ? it.facts.map((f) => mk(f.sentence, f.source_url, f.page, f.doc_type, f.doc_version)) : it.sentences.map((x) => mk(x, it.e.u));
      if (it.th) c.facts.push(mk(it.th.t, it.e.u));
      c.source = c.facts[0]; c.headline = ''; c.lines = it.weak ? [{ label: 'Partly relevant', text: 'Only part of your question is covered by this published text.' }] : [];
      c.chip = c.facts[0].doc_type === 'PDS' ? CHIPS.DATASHEET : CHIPS.PAGE;
      c.followups = [`Data sheet for ${it.e.n}`, `Coverage of ${it.e.n}`]; cards.push(c);
    }
    return cards;
  };
  // only a short, non-question message made wholly of catalogue words gets the three-jobs clarifier; anything else keeps its honest no-data
  const CONDITION_WORDS_RX = /\b(sauna|freezer|chemical|acid|pool|swimming)\b/;
  const shortAsk = (n0) => { const w = n0.split(' ').filter(Boolean); if (w.length > 4 || /^(what|whats|how|why|is|are|does|do|can|could|will|who|where|when|which|tell)\b/.test(n0)) return false; const c = w.filter((x) => !STOP.has(x) && !GENERIC.has(x) && x.length > 2); return c.length >= 1 && c.every((x) => core.post[spell(stem(x))] || core.post[spell(x)]); };
  // the product groups whose published text uses the message's words (catalogue vocabulary), most likely first, for the generic clarifier
  function likelyKinds(n0) {
    const toks = [...new Set(tokens(n0).map((t) => spell(t)).filter((t) => core.post[t] && t.length > 2 && !GENERIC.has(t)))]; if (!toks.length) return [];
    const tally = new Map();
    for (const t of toks) { const seen = new Set(); for (const v of core.post[t]) { const pi = v >> 3; const parts = core.P[pi].c.split('/').slice(1); for (let d = Math.min(parts.length, 3); d >= 1; d--) { const lab = parts[d - 1].replace(/-/g, ' '); if (advisor.hasKind(lab)) { if (!seen.has(lab)) { seen.add(lab); tally.set(lab, (tally.get(lab) || 0) + 1 / Math.sqrt(core.post[t].length)); } break; } } } }
    return [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([label]) => ({ label }));
  }
  // wave 3: a very thin ask ("tile", "need glue", "floor is cracked", "wall is damp", "something for outside") names no product and no kind of product, and every content word is a broad one:
  // ask the job, never show a product list or a page picked by a stray word. A specific word (grinding aid, dusty, bleeding, a product code) is never thin.
  const VAGUE_OK = /^(someth|anyth|stuff|outsid|insid|outdoor|indoor|damp|wet|old|new|leak|crack|wall|floor|roof|put|use|fix|top|paint)\w*$/;
  function thinAsk(n0) {
    if (n0.split(' ').filter(Boolean).length > 7 || /\b(sika|davco|lanko|sikatile|sikafloor|sikaflex|sikalastic|sikadur|sikagard)\b/.test(n0) || CONDITION_WORDS_RX.test(n0)) return null;
    if (/^(how (do|can|should|would|to) (i|we|you)?|how to)\b/.test(n0)) return null;
    const cw = tokens(n0).filter((w) => !STOP.has(w) && !GENERIC.has(w) && w.length > 2);
    if (cw.length > 2 || /^(i need|i want|looking for)\b/.test(n0) || !cw.every((w) => VAGUE_OK.test(w) || advisor.hasKind(w) || (core.post[spell(stem(w))] || core.post[spell(w)] || []).length >= 100)) return null;
    return intentClarifier(n0, likelyKinds(n0)) || genericVague(n0) || genericVague('something for ' + n0);
  }
  // wave 3: a fact that only the data sheet (PDF) prints, read from the data/brain/num shard when the product page has no such label (shelf life, overcoat wait, Shore, VOC, movement, service temperature, layer)
  const NUMF = { shelf: ['shelf_life', 'shelf life'], overcoat: ['overcoat_wait', 'waiting time before overcoating'], hardness: ['shore', 'Shore hardness'], voc: ['voc', 'VOC content'], movement: ['movement', 'movement capability'], service_temp: ['service_temp', 'service temperature'], thickness: ['layer', 'layer thickness'] };
  async function numAttrCard(sh, attrId) {
    const m = NUMF[attrId]; if (!m) return null; const ns = await load.num(sh.id); const recs = ns && ns.f && ns.f[m[0]]; if (!recs || !recs.length) return null;
    const facts = recs.slice(0, 2).map((r) => ({ source_url: r.s.u, page: r.s.p == null ? null : r.s.p, sentence: `${r.l}: ${r.t}`, status: 'PUBLISHED', doc_type: r.s.t || 'PDS', doc_version: r.s.v || '' }));
    return C.numInfoCard ? C.numInfoCard(sh, m[1], recs.slice(0, 2), facts) : null;
  }
  // ---- main entry
  async function askInner(question, state = null) {
    const t0 = now(); const trace = [];
    const q = String(question || '').trim();
    let akaNote = null;
    let jobHint = null; // wave 2b: the kind of job a product-less question described, carried in the state so "recommend me one" and "how much for N m2" can follow it
    const out = (intent, stage, cards, extra = {}) => {
      if (akaNote && cards[0] && cards[0].product && cards[0].product.id === akaNote.id) { const f = { source_url: cards[0].product.url, page: null, sentence: akaNote.s, status: 'PUBLISHED', doc_type: 'WEB', doc_version: '' }; cards[0].lines = (cards[0].lines || []).concat([{ label: 'Published name history', text: akaNote.s }]); cards[0].facts = (cards[0].facts || []).concat([f]); }
      for (const c of cards) { finalize(c); const bad = validateCard(c); if (bad.length) c._invalid = bad; }
      dedupeAcrossCards(cards);
      return { schema: ANSWER_SCHEMA, query: q, intent, stage, cards, followups: extra.followups || [...new Set(cards.flatMap((c) => c.followups || []))].slice(0, 4), state: (jobHint && !(extra.state && extra.state.job) && cards.some((c) => c.type !== 'unknown' && c.type !== 'choose')) ? { ...(extra.state || {}), job: jobHint } : (extra.state || null), ms: Math.round((now() - t0) * 100) / 100, trace };
    };
    await boot();
    const rule = await matchRule(q);
    trace.push('rules:' + (rule ? 'hit' : 'miss'));
    if (rule) return out('rule', 'rules', [C.ruleCard(rule)]);
    // ---- lane D (rules.js): a job with several constraints gets a cited step plan; a rule question about a named product gets its published rule.
    // One small section: it returns null for everything else, so the stack below is unchanged.
    { const qn = normalise(q); const mm = findExact(qn);
      const fx = parseFacets(qn); // gate: the plan engine is fetched only for a question that names two of: a tile, a surface, a place, a product
      if ((state && state.plan) || (fx.tile_type.length ? 1 : 0) + (fx.substrate.length ? 1 : 0) + (fx.environment.length ? 1 : 0) + (mm.length ? 1 : 0) + (/\b(tiles?|tiling|engineered|hallway|garage|vinyl|laminate|carpet|sauna|kiln)\b/.test(qn) ? 1 : 0) > 1) {
        const pid = [...new Set(mm.filter((m) => m.pis.length === 1).map((m) => core.P[m.pis[0]].id))];
        let text = q; if (mm.length) { const w = qn.split(' '); for (const m of mm) text = text.replace(new RegExp(w.slice(m.i, m.i + m.k).join('[^a-z0-9]+'), 'i'), ' '); } // a product name is not a constraint
        const rl = await rulesLayer(); const rr = rl && await rl.handle(q, { state, productIds: pid, hasProduct: mm.length > 0, text });
        if (rr) { trace.push('rules:' + rr.intent); return out(rr.intent, 'rules', rr.cards, { state: rr.state }); } } }
    const slang0 = applySlang(normalise(q));
    const slang = slang0; const n0 = correctWords(slang.text); if (n0 !== slang.text) trace.push('read:' + n0); if (slang.notes.length) trace.push('slang:' + slang.notes.map((x) => x.from + '>' + x.to).join(','));
    if (core.aka) { const hit = Object.entries(core.aka).find(([k]) => (' ' + n0 + ' ').includes(' ' + k + ' ')); if (hit) akaNote = { id: core.P[hit[1].pi].id, s: hit[1].s }; }
    { const hc = historyCard(n0); if (hc) { trace.push('names:history'); return out(hc.type === 'unknown' ? 'oos' : 'info', 'names', [hc], { followups: hc.followups }); } }
    { const vc = vagueCard(n0) || termCard(n0); if (vc) { trace.push('vague'); return out('vague', 'clarify', [vc], { followups: vc.followups }); } }
    // product mentions: exact, then fuzzy
    let mentions = findExact(n0); let stage = 'exact';
    if (!mentions.length) { mentions = fuzzyAliases(n0); stage = mentions.length ? 'fuzzy' : 'index'; }
    { const leftover = (m) => { const used = new Set(); for (const h of m) for (let j = h.i; j < h.i + h.k; j++) used.add(j); return n0.split(' ').filter((w, j) => !used.has(j) && !STOP.has(w) && !GENERIC.has(w) && w.length > 3 && !/^(tell|about|data|sheet|coverage|safety|cure|take|long|much|many)$/.test(w) && !core.post[stem(w)]).length; };
      if (mentions.length && leftover(mentions) >= 2) { const fz = fuzzyAliases(n0); const kx = (m) => m.reduce((s, h) => s + h.k, 0); if (fz.length && kx(fz) > kx(mentions)) { mentions = fz; stage = 'fuzzy'; } } }
    trace.push(`products:${stage}:${mentions.length}`);
    // the words of a product name are not intent or facet words ("Opti-Cure" is not a cure question, "Concrete Fix" is not concrete)
    const w0 = n0.split(' ').filter(Boolean), cut = new Set(); for (const m of mentions) for (let j = m.i; j < m.i + m.k; j++) cut.add(j);
    const n = mentions.length ? w0.filter((_, j) => !cut.has(j)).join(' ') : n0;
    const facets = parseFacets(n); let intent = classify(n, facets.area != null || !!facets.dose);
    if (intent === 'calc' && /\bpallets?\b/.test(n)) intent = 'which';
    if (['which', 'compat', 'time', 'rate'].includes(intent) && /\bor\b|\bwhich (one|is better|should i)\b|\bsame (thing|as|product)\b/.test(n0) && mentions.filter((m) => m.pis.length === 1).length >= 2) intent = 'compare';
    const resolve = (m) => m.pis.length === 1 ? m.pis[0] : null;
    let pis = []; let ambiguous = null;
    for (const m of mentions) { const one = resolve(m); if (one != null) { if (!pis.includes(one)) pis.push(one); } else if (!ambiguous) ambiguous = m; }
    if (!pis.length && ambiguous) { pis = ambiguous.pis.slice(0, 4); }
    if (!pis.length && advisor.hasKind(n0)) jobHint = { kindId: advisor.kindOf(n0), area: facets.area != null ? facets.area : null, thickness: thicknessOf(n), n: n0 };
    // wave 2b: at any point after a job was described (an advice answer or a quantity answer), "recommend me one" and "how much for 40 m2" use the SAME entry point (advisor.recommendForJob) without re-asking the kind
    if (state && !pis.length && !advisor.hasKind(n0) && ((state.job && state.job.kindId) || (state.advice && state.advice.n))) {
      const kindId = (state.job && state.job.kindId) || advisor.kindOf(state.advice.n); const jn = (state.job && state.job.n) || (state.advice && state.advice.n) || '';
      const area = facets.area != null ? facets.area : state.job && state.job.area != null ? state.job.area : null;
      const thick = thicknessOf(n) || (state.job && state.job.thickness) || null;
      const qtyAsk = intent === 'calc' || /\b(how (much|many)|quantity|how many (bags?|pails?|litres?))\b/.test(n0);
      const recAsk = /\b(recommend|suggest|which one|best one|pick one|choose one|what should i (use|get|buy))\b/.test(n0) && tokens(n0).length <= 9;
      if (kindId && (qtyAsk || recAsk)) {
        const rel4 = (() => { let m = null; return (id) => { if (!m) m = new Map(search(jn, []).items.map((it) => [core.P[it.pi].id, it.score])); return m.get(id) || 0; }; })();
        const ctx = (jn + ' ' + n).trim();
        if (area != null) { const nq = await quantityByKind({ q, n: ctx, area, thickness: thick, advisor, load, rel: rel4, kindId, pick: recAsk ? 1 : 3 }); if (nq) { trace.push('calc:job'); return out('calc', 'advisor', nq.cards, { state: nq.state }); } }
        else if (recAsk) {
          const rec = await advisor.recommendForJob({ kindId, question: ctx, rel: rel4, excludeIds: (state.job && state.job.exclude) || [] });
          trace.push('recommend:job');
          return out('which', 'advisor', [recommendCard(rec, q)], { state: { advice: { n: ctx, ids: rec.picks.map((p) => p.id) }, job: { kindId, area: null, thickness: thick, n: ctx } } });
        }
      }
    }
    // a follow-up ("and its SDS?") keeps the last product
    // a follow-up to a "best X for Y" answer: "and for outside?", "what about the second one?", "tell me more about the first"
    if (state && state.advice && !pis.length && !advisor.hasKind(n0) && (/^(and |also |what about |how about |but |or |ok |okay |now )/.test(n0) || tokens(n0).length <= 5)) {
      const ord = /\b(first|1st|top|number one|that one|the first one)\b/.test(n0) ? 0 : /\b(second|2nd|number two)\b/.test(n0) ? 1 : /\b(third|3rd)\b/.test(n0) ? 2 : /\b(last|fourth|4th)\b/.test(n0) ? 3 : -1;
      if (ord >= 0 && state.advice.ids[ord] && pIndex.has(state.advice.ids[ord])) { const sh = await shard(pIndex.get(state.advice.ids[ord])); trace.push('followup:ordinal'); return out('product', 'followup', [C.productCard(sh, sh.d.t, null, true)], { state: { productId: sh.id, intent: 'which', advice: state.advice } }); }
      const merged = state.advice.n + ' ' + n0.replace(/^(and |also |what about |how about |but |or |ok |okay |now )/, '');
      const rel2 = (() => { let m = null; return (id) => { if (!m) m = new Map(search(merged, []).items.map((it) => [core.P[it.pi].id, it.score])); return m.get(id) || 0; }; })();
      const ad2 = await advisor.advise(q, merged, rel2, true);
      if (ad2) { trace.push('followup:advice'); return out(ad2.items.length ? 'which' : 'advice', 'advisor', adviceCards(ad2, q, merged, []), { state: { advice: { n: merged, ids: ad2.items.map((x) => x.e.id) } } }); }
    }
    const stateOk = state && state.productId && pIndex.has(state.productId);
    const followUp = /^(and |also |what about |how about )|\b(it|its|this one|that one|the same|them)\b/.test(n) || tokens(n).length <= 3;
    if (intent === 'compat' && pis.length >= 1 && (/^((hi|hey|hello|um|umm|ok|okay|so|righto|quick one|g day|gday|sorry to bug you|mate|yo|thanks) )*(what is|what are|what s|whats|tell me about|describe)\b/.test(n0) || (/\b(uses?|used for)( mate| thx| thanks| pls| please)?$/.test(n0) && !/^(can|could|is|will|does|would|do|ok|okay)\b/.test(n0)))) intent = 'which';
    const askBack = intent === 'compat' && /^(can|could|is|will|does|would|do)\b/.test(n); // "Can I tile over a heated floor?" right after a product answer
    const fromState = !pis.length && stateOk && intent !== 'which' && (followUp || askBack);
    if (fromState) { pis = [pIndex.get(state.productId)]; trace.push('state:product'); }
    if (!pis.length && ['compat', 'time', 'rate', 'document', 'safety', 'spec'].includes(intent) && /^(what|which|recommend|suggest|best|any|is there|i need|i want|need|looking for|show me|something)\b/.test(n)) intent = 'which';
    if (!pis.length && intent === 'compat') intent = 'which';
    if (!pis.length && !know.signal(n0) && (['compat', 'time', 'rate', 'calc', 'safety', 'document', 'spec'].includes(intent) || (intent === 'which' && !advisor.hasKind(n0)) || /^(can|could|is|will|does|would|do|how long|how much)\b/.test(n0))) {
      const fam = /\b(sikaflex|sikafloor|sikadur|sikagard|sikalastic|sikatile|sikabond|sikaseal|sikagrout|sikaproof|sikaswell|sikasil)\b/.exec(n0);
      if (fam && intent === 'which') { const sr0 = search(n0, []); const t0 = sr0.items[0]; if (t0 && t0.cov >= 0.99 && normalise(core.P[t0.pi].n).startsWith(fam[1])) fam.skip = true; }
      if (fam && !fam.skip) { const list = core.P.filter((p) => normalise(p.n).startsWith(fam[1])).slice(0, 4); if (list.length >= 2) { const opts = list.map((p) => q.replace(new RegExp(fam[1], 'i'), p.n)); trace.push('family:' + fam[1]); return out(intent, 'family', [C.chooseCard(`Which ${fam[1]} product?`, `${fam[1]} is a range, and the answer depends on the product. Pick one.`, opts, [], list.map((p) => p.n))], { state: null }); } }
    }
    const namedAll = pis.length && !ambiguous;
    const st = (pi) => ({ productId: core.P[pi].id, intent });

    if (/\b(who (owns|owned|founded|runs)|who is the (ceo|owner|boss|founder)|\bceo\b|how many (people|employees|staff|workers) (work|does|are)|shareholders?|share price|stock price|annual revenue|turnover|annual report|parent company)\b/.test(n0) && !pis.length) return out('company', 'unknown', [C.unknown(q, null, 'Facts about who owns or runs the company are not in the product and site documentation I work from, and I will not guess them. Please ask Sika Australia.', ['company facts'])], { state: null });
    if (/\b(recommend|find|know|suggest)\b.*\b(tiler|plumber|builder|installer|contractor|electrician|tradie|applicator)\b.*\b(in|near|around)\b|\b(tiler|plumber|builder|installer|electrician) (in|near) [a-z]+/.test(n0) && !/\b(sika|davco|lanko)\b/.test(n0)) return out('oos', 'unknown', [C.unknown(q, null, 'I do not recommend tradespeople or installers. I answer about Sika Australia products and business from the published documentation. Please ask Sika Australia.', ['installer recommendation'])], { state: null });
    if (/\b(meaning of life|(what is|whats|how is) the weather|weather (today|tomorrow|forecast|report)|joke|poem|recipe|horoscope|footy|football|cricket|movie|song lyrics|bitcoin|calories|president|prime minister|capital of|dating|homework|what time is it|news|election|tiler per hour|per hour|^(what s |whats |what is |calculate )?\d+ ?(plus|times|minus|divided by) ?\d+$|hourly rate|is (concrete|cement|mortar|grout|a tile|tiles) made of|history of|who invented|best brand|tile (shop|store)|recommend a (good )?(tile )?(shop|store|supplier|retailer)|my (dog|cat|car|phone|computer)|wifi)\b/.test(n0) && !pis.length) return out('oos', 'unknown', [C.unknown(q, null, 'That is outside what I can help with. I answer about Sika Australia products and business from the published documentation.', ['topic'])], { state: null });
    if (/\b(what (could|might|would) (have )?(caused?|be causing)|what caused|why (is|are|do|does|did) (my|the))\b/.test(n0) && /\b(lifting|lift|cracking|cracks|peeling|failing|hollow|drummy|popping|bubbling|stain\w*|mould|leaking|efflorescence|debonding|coming off|loose)\b/.test(n0) && !pis.length) return out('diagnosis', 'unknown', [C.unknown(q, null, 'Working out why something failed needs a look at the job, which I cannot do. I answer from the published documentation. Please ask Sika Technical Services with photos and the products used.', ['diagnosis'])], { state: null });
    if (/\b(tiles?|grout|screed|membrane|floor|wall|render|paint|sealant|silicone)\b.*\b(lifting|cracking|peeling|failing|hollow|drummy|popping|bubbling|coming off|loose|leaking|mouldy|stained)\b/.test(n0) && !/\b(what|which|best|recommend|use|product|fix with|repair with|adhesive|sealant for|glue|additive|stop|prevent|solution|fix|repair|treat|seal\w*|goop|for)\b/.test(n0.replace(/\b(tiles?|grout|screed|membrane|floor|wall)\b/g, '')) && !pis.length) return out('diagnosis', 'unknown', [C.unknown(q, null, 'Working out why something has failed needs a look at the job, which I cannot do. Please ask Sika Technical Services with photos and the products used.', ['diagnosis'])], { state: null });
    if (/\b(what|which) order\b|\border do i do\b|\bsequence of\b/.test(n0) && !pis.length) return out('process', 'unknown', [C.unknown(q, null, 'The order of work for a full job is in the system data sheets and needs the exact substrate and use. Tell me the tile, the surface and the room and I will give the published system, or ask Technical Services.', ['order of work'])], { state: null });
    if (intent === 'other_brand') return out(intent, 'unknown', [C.unknown(q, null, 'I only answer about Sika Australia products, from their published documentation. I do not compare with other brands or comment on them.', ['a comparison'])]);
    // company and site questions that have a published home (contact, where to buy, warranty portal, training, careers, document libraries)
    if (!pis.length || know.signal(n0)) { const tp = await know.topic(q, n0); if (tp) { trace.push('kb:topic'); return out('info', 'kb', [tp], { state: null }); } }
    if (!pis.length && !/^(i need|i want|looking for)\b/.test(n0)) { const cs = await know.codeSearch(q, n0, { kind: advisor.hasKind(n0) }); if (cs) { trace.push('kb:code'); return out('info', 'kb', [cs], { state: null }); } }
    // general retrieval over Sika Australia's own pages
    { const cl = categoryListCard(q, n0, core); if (cl) { trace.push('catlist'); return out('which', 'catlist', [cl], { state: null, followups: cl.followups }); } }
    if (!pis.length && !(/^(i need|i want|looking for)\b/.test(n0) && /\bcontact (adhesive|adhesives|cement)\b/.test(n0))) { const tm = await know.titleMatch(q, n0, advisor.hasKind(n0), advisor.wants(n0)); if (tm) { trace.push('kb:title'); return out('info', 'kb', [tm], { state: null }); } }
    if (!pis.length && !advisor.wants(n0) && ((know.signal(n0) && !(advisor.hasKind(n0) && know.weakSignal(n0))) || (know.definitional(n0) && tokens(n0).some((t) => (core.post[spell(t)] || []).some((v) => (v & 7) <= 2)) && !facets.tile_type.length && !facets.environment.length && !/\b(best|better|good|recommend|suitable|right|ideal|should i)\b/.test(n0)))) { const kr = await know.retrieve(q, n0); if (kr) { trace.push('kb:retrieve'); return out('info', 'kb', [kr], { state: null }); } }
    // a product fact that sits under a label on the product page (shelf life, temperature limits, mixing ratio, thickness, steps, ...)
    if (pis.length === 1 && !ambiguous && ['which', 'time', 'safety', 'compat'].includes(intent)) {
      const nA = n; const at = detectAttr(nA); const yn = /^(can|could|is|will|does|would|do|are)\b/.test(n);
      const okId = at && (intent === 'which' || (['time', 'safety'].includes(intent) ? ['shelf', 'storage', 'service_temp', 'hardness'].includes(at.id) : !(yn && ['property', 'standards'].includes(at.id))));
      if (okId) { const sh0 = await shard(pis[0]); if (sh0) { let ac = attrCard(sh0, nA, q, at.soft); if (ac && ac.type === 'unknown') { const nc = await numAttrCard(sh0, at.id); if (nc) ac = nc; } if (ac) { trace.push('attr:' + at.id); return out('attr', stage, [ac], { state: st(pis[0]) }); } } }
    }
    if (intent === 'price') {
      const sh = pis.length ? await shard(pis[0]) : null;
      return out(intent, stage, [C.unknown(q, sh, 'Prices, stock, delivery and warranty terms are not in the documentation I work from, and I will not guess them. Please ask Sika Australia or a stockist.', ['price, stock or warranty'])], { state: pis.length ? st(pis[0]) : null });
    }
    if (intent === 'compare') {
      if (pis.length >= 2) { const [a, b] = await Promise.all([shard(pis[0]), shard(pis[1])]); return out(intent, stage, [C.compareCard(a, b)], { state: { ...st(pis[0]), productIds: pis.slice(0, 4).map((x) => core.P[x].id) } }); }
      intent = 'which';
    }
    let needsProduct = ['calc', 'time', 'rate', 'safety', 'document', 'spec', 'compat'].includes(intent);
    const explicitAsk = /^(how long|how much|how many|what is the (coverage|consumption|cure|curing|open|pot|recoat)|coverage|consumption|sds|msds|pds|data ?sheet|safety data|datasheet|can i use|is it suitable)/.test(n);
    if (needsProduct && !pis.length && !explicitAsk && !(intent === 'calc' && facets.area != null)) { intent = 'which'; needsProduct = false; }
    if (intent === 'calc' && !pis.length && facets.area != null) { // "how much adhesive for 15 m2 of 600x600 tiles": the documented products for the job (advisor.recommendForJob), each with its worked quantity (numq.js)
      const rel3 = (() => { let m = null; return (id) => { if (!m) m = new Map(search(n, []).items.map((it) => [core.P[it.pi].id, it.score])); return m.get(id) || 0; }; })();
      const nq = await quantityByKind({ q, n, area: facets.area, thickness: thicknessOf(n), advisor, load, rel: rel3 });
      if (nq) { trace.push('calc:advisor'); return out('calc', 'advisor', nq.cards, { state: nq.state }); }
      const ad3 = await advisor.advise(q, n, rel3, true);
      if (ad3 && ad3.items.length) { ad3.summary.lines = []; ad3.summary.handoff = null; ad3.summary.followups = []; ad3.summary.headline = 'No product was named, so these are the products whose own published text documents a fit. I could not work out a quantity from their published rates, so I am not giving one.'; trace.push('calc:advisor'); return out('calc', 'advisor', [ad3.summary], { state: { advice: { n, ids: ad3.items.map((x) => x.e.id) } } }); }
    }
    if (intent === 'calc' && !pis.length && !explicitAsk) { intent = 'which'; needsProduct = false; } // a quantity by kind that numq could not serve goes on as an ordinary "which" question
    if (needsProduct && !pis.length && explicitAsk) {
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
      if (intent === 'calc' && C.isDoseProduct(sh)) return out(intent, stage, [facets.dose ? C.doseCard(sh, facets.dose, q) : C.doseNeedCard(sh)], { state: s });
      if (intent === 'calc') { if (facets.area == null) return out(intent, stage, [C.chooseCard(`How much ${sh.n}?`, 'How many square metres is the area?', [10, 20, 50].map((a) => `How much ${sh.n} for ${a} m2`))], { state: s }); return out(intent, stage, [C.calcCard(sh, facets.area, q, thicknessOf(n))], { state: s }); }
      if (intent === 'rate') return out(intent, stage, [C.rateCard(sh, q)], { state: s });
      if (intent === 'time' && /overcoat|re-?coat|recoat|wait.*(before|until).*(coat|paint)/.test(n) && !(sh.tm && sh.tm.recoat_times && sh.tm.recoat_times.length)) { const oc = attrCard(sh, n, q, true) || await numAttrCard(sh, 'overcoat'); if (oc) { trace.push('attr:overcoat'); return out(intent, stage, [oc], { state: s }); } }
      if (intent === 'time') { let kinds = TIME_KIND.filter(([, rx]) => rx.test(n)).map(([k]) => k); if (kinds.some((k) => k !== 'cure_times')) kinds = kinds.filter((k) => k !== 'cure_times'); const ks = kinds.length ? kinds : ['open_time', 'cure_times', 'pot_life', 'recoat_times']; let card = C.timeCard(sh, ks, q); if (card.type === 'unknown' && kinds.length) { const all = C.timeCard(sh, Object.keys(sh.tm || {}), q); if (all.type !== 'unknown') { all.headline = 'The documentation gives no time of exactly that kind. These are the published times it does give, quoted as written.'; card = all; } } return out(intent, stage, [card], { state: s }); }
      if (intent === 'safety') return out(intent, stage, [C.safetyCard(sh, n, q)], { state: s });
      if (intent === 'document') { const want = DOC_TYPES.filter(([, rx]) => rx.test(n)); const types = want.length ? want : [DOC_TYPES[1], DOC_TYPES[0]]; const cards = []; for (const [ty, , label] of types) { const docs = (sh.dc || []).filter((d) => d.ok && (d.ty === ty)); if (docs.length) cards.push(C.documentCard(sh, docs, label)); } if (!cards.length) cards.push(C.unknown(q, sh, `No ${types.map((t) => t[2].toLowerCase()).join(' or ')} is published for this product.`, types.map((t) => t[2]))); return out(intent, stage, cards, { state: s }); }
      if (intent === 'spec') {
        let clauses = []; let ds = null;
        if (/\b(clause|clauses|specification|spec)\b/.test(n)) { const sp = await load.spec(sh.id).catch(() => null); if (sp) { ds = sp.ds; const qt = new Set(tokens(n).filter((t) => !['specification', 'spec', 'clause', 'clauses'].includes(t))); const all = sp.sections.flatMap((x) => x.cl); const sc = all.map((c) => ({ c, s: tokens(c.t + ' ' + (c.c || '')).filter((t) => qt.has(t)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s); clauses = sc.slice(0, 3).map((x) => x.c); } }
        return out(intent, stage, [C.specCard(sh, clauses, ds || (sh.sp && sh.sp.ds), q)], { state: s });
      }
      if (intent === 'compat') {
        const conds = conditionsOf(facets);
        // any other content word of the question ("sauna", "garage") must itself appear in the sentence that answers it
        const known = new Set(facets.hits.flatMap((h) => tokens(h.term))); const nameToks = new Set(tokens(sh.n));
        for (const w of [...new Set(tokens(n))]) if (!known.has(w) && !nameToks.has(w) && !GENERIC.has(w) && !INTENT_WORDS.has(w) && w.length > 2 && !/\d/.test(w)) conds.push({ id: w, dim: 'word', label: w, hard: true, toks: [[w]] });
        const v = verdictFor(sh, conds);
        if (v.rule) v.rule = { ...v.rule, text: clampText(v.rule.text, new Set(conds.flatMap((c) => c.toks.flat()))) };
        const cards = [C.compatCard(sh, v.verdict, v.rule, q, conds.map((c) => c.label), v.uncovered)];
        if (v.verdict === 'no') { // a No is followed by what the data sheets do say suits that job
          const cat = await load.category(sh.c.split('/').slice(0, 2).join('/')); const seen = new Set([sh.id]); let shown = 0;
          const tagKeys = conds.filter((c) => c.dim !== 'word').map((c) => `${c.dim === 'tile_type' ? 'tile_type' : c.dim}:${c.id}`);
          for (const tag of tagKeys) for (const r of (cat && cat.tags[tag] && cat.tags[tag].yes) || []) {
            if (shown >= 2 || seen.has(r.p) || r.c || !mentionsTag(r.t, tag)) continue; seen.add(r.p);
            const alt = await load.product(r.p); if (!alt) continue;
            const rt = clampText(r.t, new Set(tag.split(':')[1].split('_').map((x) => stem(x)))); const c = C.productCard(alt, rt, 'Its own data sheet says it suits this');
            c.facts = [{ source_url: r.u, page: r.pg, sentence: rt, status: 'PUBLISHED', doc_type: 'PDS', doc_version: r.v }]; c.source = c.facts[0]; c.chip = CHIPS.DATASHEET; c.lines = [{ label: 'The data sheet says', text: rt }]; c.headline = '';
            cards.push(c); shown++;
          }
        }
        return out(intent, stage, cards, { state: s });
      }
      // a named product with nothing else asked: its product card with the useful next steps
      const sentence = await bestSentence(sh, new Set(tokens(n)));
      return out('product', stage, [C.productCard(sh, sentence, null, true)], { state: s });
    }
    if (ambiguous && !needsProduct) {
      const shs = await Promise.all(pis.map(shard)); return out('product', stage, shs.map((sh) => C.productCard(sh, sh.d.t)), { followups: [] });
    }

    // ---- which product / system / tree
    const hasTile = facets.tile_type.length, hasSub = facets.substrate.length, loc = systemLocation(facets.environment);
    if ((intent === 'system' || (hasTile && hasSub && loc && !/\b(adhesive|glue|grout|primer|membrane|waterproof)\b/.test(n))) && hasSub) {
      const sysMap = { porcelain: 'porcelain', ceramic: 'ceramic', mosaic: 'mosaic', glass_tile: 'glass', natural_stone: 'natural-stone', engineered_stone: 'engineered-stone', large_format: 'large-format', terracotta: 'quarry-terracotta' };
      const subMap = { concrete: 'concrete', cement_screed: 'screed-render', cement_render: 'screed-render', brick_block: 'masonry', fibre_cement: 'cement-board', plasterboard: 'plasterboard', existing_tiles: 'existing-tiles', aac: 'aac', timber: 'timber-floor' };
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
      if (t && t.choose) {
        trace.push('tree:ask'); const cards = [];
        for (const f of t.best || []) { const sh = await load.product(f.p); if (!sh) continue; const ev = f.ev.map((id) => t.rulesTable[id]).filter(Boolean).sort((a, b) => (/suit|designed|intended|recommend/i.test(b.text) - /suit|designed|intended|recommend/i.test(a.text)) || b.text.length - a.text.length); const c = C.productCard(sh, ev[0] ? ev[0].text : sh.d.t, 'Supported by its data sheet for what you have said so far'); if (ev[0]) { c.facts = [{ source_url: ev[0].url, page: ev[0].page, sentence: ev[0].text, status: 'PUBLISHED', doc_type: 'PDS', doc_version: ev[0].doc_version }].concat(c.facts.slice(1)); c.source = c.facts[0]; c.chip = CHIPS.DATASHEET; c.lines = [{ label: 'The data sheet says', text: ev[0].text }]; } cards.push(c); }
        return out('tree', 'tree', cards.concat([t.choose]), { followups: [] });
      }
      if (t && t.leaf) {
        trace.push('tree:leaf:' + t.key.join('|'));
        const cards = [];
        for (const f of t.leaf.fit.slice(0, 3)) {
          const sh = await load.product(f.p); if (!sh) continue;
          const ev = f.ev.map((id) => t.rulesTable[id]).filter(Boolean).sort((a, b) => (/suit|designed|intended|recommend/i.test(b.text) - /suit|designed|intended|recommend/i.test(a.text)) || b.text.length - a.text.length);
          const c = C.productCard(sh, ev[0] ? ev[0].text : sh.d.t, `The data sheet says it suits this job`);
          if (ev[0]) { c.facts = ev.slice(0, 2).map((r) => ({ source_url: r.url, page: r.page, sentence: r.text, status: 'PUBLISHED', doc_type: 'PDS', doc_version: r.doc_version })).concat(c.facts.slice(1)); c.source = c.facts[0]; c.chip = CHIPS.DATASHEET; c.lines = [{ label: 'The data sheet says', text: ev[0].text }]; }
          if (f.pr && f.pr.length) { const pn = f.pr.map((id) => (core.P[pIndex.get(id)] || {}).n).filter(Boolean); if (pn.length) c.lines.push({ label: 'Primer it names', text: pn.join(', ') }); }
          cards.push(c);
        }
        if (cards.length) return out('tree', 'tree', cards, { followups: [] });
      }
      if (t && t.none) trace.push('tree:none');
    }
    // best X for Y / what X do you make: products whose own published text documents the fit, never a superlative
    const srch = !pis.length ? search(n, []) : null; // a descriptive question that the index matches almost word for word ("I need <product description>") keeps the index answer
    const confident = !!srch && srch.items.length > 0 && srch.items[0].cov >= 0.8 && [...srch.qm.values()].filter((w) => w >= 1).length >= 4 && srch.items[0].score >= 7 && /^(i need|looking for)\b/.test(n) && !/\b(best|better|recommend\w*|which|list|range|all the|what .* (do|does) .*(make|sell|have|offer))\b/.test(n);
    if (!pis.length && !confident) {
      const rel = (() => { let m = null; return (id) => { if (!m) { m = new Map(search(n, []).items.map((it) => [core.P[it.pi].id, it.score])); } return m.get(id) || 0; }; })();
      const ad = (await advisor.rank(q, n, null)) || (await advisor.advise(q, n, rel));
      if (ad) {
        trace.push('advisor');
        return out(ad.items.length ? 'which' : 'advice', 'advisor', adviceCards(ad, q, n0, slang.notes), { state: { advice: { n: n, ids: ad.items.map((x) => x.e.id) } } });
      }
    }
    // stage 3 and 4: index, then facet constraints from the compatibility tags
    const { items, qm } = search(n, []);
    trace.push('index:' + items.length);
    const howto = /^(how (do|can|should|would|to) (i|we|you)?|how to)\b/.test(n) && !/\b(sika|davco|lanko|sikatile)\b/.test(n);
    const domain = tokens(n).some((t) => (core.post[spell(t)] || []).some((v) => (v & 7) <= 2));
    if (!pis.length && domain && items.length) { const tk = thinAsk(n0); if (tk) { trace.push('vague:thin'); return out('vague', 'clarify', [tk], { followups: tk.followups }); } }
    if (!items.length || !domain || items[0].score < 3 || items[0].cov < (qm.size <= 3 ? 0.99 : 0.6)) { const kr = await know.retrieve(q, n0, { strict: false }); if (kr) { trace.push('kb:fallback'); return out('info', 'kb', [kr], { state: null }); } }
    if (!items.length || items[0].score < 3 || items[0].cov < (qm.size <= 3 ? 0.99 : 0.6)) { const ad = await advisor.advise(q, n, null, true); if (ad) { trace.push('advisor:fallback'); return out(ad.items.length ? 'which' : 'advice', 'advisor', adviceCards(ad, q, n0, slang.notes), { state: { advice: { n: n, ids: ad.items.map((x) => x.e.id) } } }); } }
    if (howto && !items.length || howto && !/\b(adhesive|glue|sealant|silicone|grout|waterproof\w*|membrane|tile|tiles|tiling|screed|level\w*|concrete|primer|epoxy|crack\w*|fill|seal|bond|stick)\b/.test(n)) return out(intent, 'unknown', [C.unknown(q, null, 'I do not have step by step trade instructions for that. I answer about Sika Australia products and business from the published documentation. Please ask Sika Technical Services.', ['instructions'])]);
    if (!items.length || !domain || items[0].score < 3 || items[0].cov < (qm.size <= 3 ? 0.99 : 0.6)) { const gv = !pis.length && !advisor.hasKind(n0) ? (genericVague(n0) || (shortAsk(n0) ? intentClarifier(n0, likelyKinds(n0)) : null)) : null; if (gv) { trace.push('vague:generic'); return out('vague', 'clarify', [gv], { followups: gv.followups }); } }
    if (!items.length || !domain || items[0].score < 3 || items[0].cov < (qm.size <= 3 ? 0.99 : 0.6)) { const ic = !pis.length && shortAsk(n0) ? intentClarifier(n0, likelyKinds(n0)) : null; if (ic) { trace.push('vague:intents'); return out('vague', 'clarify', [ic], { followups: ic.followups }); } return out(intent, 'unknown', [C.unknown(q, null, 'Nothing in the published documentation I work from matches that clearly enough to name a product.', [])]); }
    { const tk = !pis.length ? thinAsk(n0) : null; if (tk) { trace.push('vague:thin'); return out('vague', 'clarify', [tk], { followups: tk.followups }); } }
    let list = items.slice(0, 30); const ruled = [];
    const condWords = [...new Set(tokens(n))].filter((w) => CONDITION_WORDS.has(w));
    if (condWords.length) { // a named condition (sauna, freezer room, chemical): only products whose own text mentions it, never a keyword guess
      const has = (pi, w) => (core.post[w] || []).some((v) => (v >> 3) === pi);
      list = items.filter((x) => condWords.every((w) => has(x.pi, w))).slice(0, 30); trace.push('condition:' + condWords.join(','));
      if (!list.length) return out('which', 'unknown', [C.unknown(q, null, `No product in the published documentation mentions ${condWords.join(' or ')} in its own text, so I cannot name one. I will not guess.`, condWords)]);
    }
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
    // wave 3: a descriptive ask with no product named shows one kind of product: the category that holds most of the matching weight, never a mix of unrelated groups
    // wave 3 priors (published categories): fixing an existing crack is not an admixture job; sealing or priming a board before tiling is a primer or membrane job, never an adhesive
    if (!pis.length) { const pri = []; if (/\b(crack\w*|hairline)\b/.test(n0) && !/\b(mix|admix\w*|new pour|batch|plant|fresh)\b/.test(n0)) pri.push((x) => !/^construction\/concrete\//.test(core.P[x.pi].c)); if (/\b(seal\w*|prim\w*|prepare|prep)\b.*\bbefore\b.*\btil/.test(n0)) pri.push((x) => /waterproofing|primers/.test(core.P[x.pi].c)); for (const f of pri) { const l2 = list.filter(f); if (l2.length) { list = l2; trace.push('prior'); } } }
    if (!pis.length && list.length > 1 && !(items[0].cov >= 0.8 && /^(i need|looking for)\b/.test(n0)) && list[0].score < list[1].score * 1.4) { const w = new Map(); for (const x of list.slice(0, 12)) { const k = core.P[x.pi].c.split('/').slice(0, 2).join('/'); w.set(k, (w.get(k) || 0) + x.score); } for (const k of [...w.keys()]) { if (/\banchor\w*/.test(n0) && /grouts-anchoring/.test(k)) w.set(k, w.get(k) * 4); if (/\b(crack\w*|hairline)\b/.test(n0) && !/\b(structural|strengthen\w*|carbon|beam|plate|frp)\b/.test(n0) && /structural-strengthening/.test(k)) w.set(k, w.get(k) * 0.2); }
 const win = [...w].sort((a, b) => b[1] - a[1])[0][0]; const same = list.filter((x) => core.P[x.pi].c.split('/').slice(0, 2).join('/') === win); if (same.length && same[0] !== list[0]) trace.push('category:' + win); if (same.length) list = same; }
    const top = list.filter((x, i) => i < 3 && x.score >= list[0].score * (items[0].cov >= 0.8 && /^(i need|looking for)\b/.test(n0) ? 0.5 : 0.75));
    const qset = new Set([...qm.keys()].filter((k) => qm.get(k) >= 1));
    const cards = [];
    for (const it of top) { const sh = await shard(it.pi); if (sh) cards.push(C.productCard(sh, await bestSentence(sh, qset))); }
    if (ruled.length) { const r = ruled[0]; const sh = await shard(r.it.pi); if (sh) { const c = C.compatCard(sh, 'no', { id: r.rule.r, text: r.rule.t, s: { u: r.rule.u, p: r.rule.pg, v: r.rule.v, t: 'PDS' } }, q, [], []); c.title = `Ruled out: ${sh.n}`; c.headline = 'No. This product matches your words but its own data sheet rules it out for this job.'; cards.push(c); } }
    return out(cards.length ? 'which' : intent, 'index', cards, { state: top.length === 1 ? { productId: core.P[top[0].pi].id, intent: 'which' } : null });
  }
  const session = createSession({ ask: askInner, advisor, boot, productName: (id) => (pIndex.has(id) ? core.P[pIndex.get(id)].n : ''), productCategory: (id) => (pIndex.has(id) ? core.P[pIndex.get(id)].c : '') });
  const ask = (question, state = null) => session.ask(question, state);
  return { ask, askInner, boot, search: (n) => search(normalise(n), []), core: () => core };
}
export { NOT_KNOWN };
