// build_brain.mjs: compile the knowledge graph into typed, lazily loadable shards. Read only on the lanes; writes data/brain/.
//   node scripts/sika-brain/build_brain.mjs            (portal dir = public/demo/sika-210c0c in this repo)
// Inputs: portal data (products, documents, categories, k/<id>.json = the knowledge + specs lanes compiled per product),
//         lanes/knowledge/{decision_trees,compatibility}.json, lanes/corrections/rules.json, systems/out/systems.full.json.
// Output: data/brain/manifest.json, core.json, p/<id>.json, cat/<slug>.json, tree.json, rules.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalise, tokens, stem, STOP, compact } from '../../public/demo/sika-210c0c/assets/brain/text.js';
import { buildKnow } from './build_know.mjs';
import { buildNum } from './build_num.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
const LANES = process.env.SIKA_LANES || '/home/tech2/klinge-kernel/state/sika/lanes';
const SYSTEMS = process.env.SIKA_SYSTEMS || '/home/tech2/klinge-kernel/state/sika/systems/out/systems.full.json';
const OUT = path.join(PORTAL, 'data', 'brain');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); return fs.statSync(f).size; };
const exists = (f) => fs.existsSync(f);

const products = rd(path.join(PORTAL, 'data/products.json'));
const documents = rd(path.join(PORTAL, 'data/documents.json'));
const categories = rd(path.join(PORTAL, 'data/categories.json'));
const catName = new Map(categories.map((c) => [c.id, c.name]));
const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
const docsByProduct = new Map();
for (const d of documents) for (const id of d.products || []) { if (!docsByProduct.has(id)) docsByProduct.set(id, []); docsByProduct.get(id).push(d); }
const docOk = (d) => !d.http || d.http.status === 200;

fs.rmSync(OUT, { recursive: true, force: true });
const sizes = { p: 0, cat: 0 };
const FIELD = { name: 1, category: 2, application: 3, substrate: 4, text: 5 };
const post = new Map();
const addTok = (tok, pi, f) => { let s = post.get(tok); if (!s) post.set(tok, s = new Set()); s.add(pi * 8 + f); };
const P = [], alias = {};
const GENERIC_NAME = new Set(['adhesive', 'grout', 'primer', 'sealant', 'mastic', 'membrane', 'mortar', 'pack', 'kit', 'compound', 'coating', 'waterproofing', 'tile', 'screed', 'epoxy', 'concrete', 'additive']);
const aliasTmp = new Map();
const prefixTmp = new Set();
const ownerTmp = new Map(); // alias text -> products whose real name (with or without the brand) it is
function addAlias(a, pi) { if (!a || a.length < 3) return; const s = aliasTmp.get(a) || new Set(); s.add(pi); aliasTmp.set(a, s); }

products.forEach((p, pi) => {
  const name = clean(p.name), brand = clean(p.brand);
  const catNames = (p.breadcrumb || []).slice(0, -1).map((b) => clean(b.name));
  P.push({ id: p.id, n: name, b: brand, c: p.category, u: p.url, t: clean(p.tagline || p.summary || '') });
  for (const t of tokens(name)) addTok(t, pi, 1);
  for (const t of tokens(p.id.replace(/-/g, ' '))) addTok(t, pi, 1);
  for (const n of catNames) for (const t of tokens(n)) addTok(t, pi, 2);
  for (const t of tokens(p.category.replace(/[\/-]/g, ' '))) addTok(t, pi, 2);
  for (const t of tokens([p.tagline, p.summary, ...(p.attributes || []), ...(p.advantages || [])].join(' '))) addTok(t, pi, 3);
  for (const t of tokens((p.usage || []).join(' '))) addTok(t, pi, 4);
  const extra = [];
  for (const s of p.sections || []) for (const it of s.items || []) extra.push(it.label, it.text);
  for (const d of docsByProduct.get(p.id) || []) extra.push(d.title, d.typeLabel);
  extra.push(p.packaging, p.metaDescription);
  for (const t of tokens(extra.join(' '))) addTok(t, pi, 5);
  // aliases: full name, without brand, without generic tail words, id, compact forms
  const nn = normalise(name), nb = brand ? normalise(brand) : '';
  const full = nn, noBrand = nb && nn.startsWith(nb + ' ') ? nn.slice(nb.length + 1) : nn;
  const variants = new Set([full, noBrand, normalise(p.id.replace(/-/g, ' '))]);
  for (const v of [full, noBrand]) { const w = v.split(' '); while (w.length > 1 && GENERIC_NAME.has(w[w.length - 1])) { w.pop(); variants.add(w.join(' ')); } }
  for (const v of variants) { addAlias(v, pi); addAlias(compact(v), pi); }
  for (const v of [full, noBrand]) { const s = ownerTmp.get(v) || new Set(); s.add(pi); ownerTmp.set(v, s); }
  // a visitor drops the tail of a long name: "sikaflex 11 fc" for Sikaflex-11 FC+, "sikadur 31" for Sikadur-31 CF Normal. Prefixes that carry a digit and stay unique are kept below.
  // a fused brand word ("Sikafloor Level PRO") is dropped the same way: "level pro"
  { const w = noBrand.split(' '); if (w.length >= 3 && /^(sika\w+|lanko|davco|sarna\w+)$/.test(w[0])) { const suf = w.slice(1).join(' '); if (suf.length >= 7) prefixTmp.add('\u0001' + suf + '\t' + pi); } }
  for (const v of new Set([noBrand, full])) { const w = v.split(' '); for (let k = w.length - 1; k >= (/\d/.test(w[0]) && /[a-z]/.test(w[0]) && w[0].length >= 3 ? 1 : 2); k--) { const pre = w.slice(0, k).join(' '); if (/\d/.test(pre) && !GENERIC_NAME.has(w[k - 1])) { prefixTmp.add(pre + '\t' + pi); } } }
});
{ const byPre = new Map(); for (const e of prefixTmp) { const [pre0, pi] = e.split('\t'); const pre = pre0.replace('\u0001', ''); const s = byPre.get(pre) || new Set(); s.add(Number(pi)); byPre.set(pre, s); } for (const [pre, set] of byPre) if (set.size <= 3 && !aliasTmp.has(pre)) for (const pi of set) { addAlias(pre, pi); addAlias(compact(pre), pi); } }
// old names the Sika pages publish for a product: "(Formerly Index Fidia 4mm)", "Previously known as Sika MaxTack", "also known as Sikadur-33"
const aka = {};
products.forEach((p, pi) => {
  const blob = JSON.stringify([p.tagline, p.summary, p.metaDescription, p.attributes, p.usage, p.sections]).replace(/<[^>]+>/g, ' ').replace(/\\u00ae|\\u2122|[®™]/g, '').replace(/\\n|\\"/g, ' ');
  for (const m of blob.matchAll(/(?:formerly|previously known as|also known as)\s*:?\s*([A-Za-z0-9][A-Za-z0-9 \-+\/.]{2,48}?)\s*(?=[)'",;]|\.\s|$)/gi)) {
    const old = clean(m[1]).replace(/\s+(Part [AB]|Cleaner)$/i, ''); const key = normalise(old); if (key.length < 5 || key.split(' ').length > 6) continue;
    const sentence = clean(m[0]).slice(0, 120); if (!aka[key]) { aka[key] = { pi, s: sentence }; addAlias(key, pi); addAlias(compact(key), pi); }
  }
});
// distinctive single-token aliases are dropped unless the token is unique to one product
const aliasOut = {};
for (const [a, set] of aliasTmp) {
  { const own = ownerTmp.get(a) || ownerTmp.get(Object.keys(aliasOut).length ? a : a); if (own && own.size === 1 && set.size > 1) { const only = [...own][0]; set.clear(); set.add(only); } } // a real product name beats the same words left over from a longer name ("Level Pro" vs "Level Pro Primer")
  const toks = a.split(' ');
  if (toks.length === 1 && !/\d/.test(a) && (a.length < 5 || GENERIC_NAME.has(a) || set.size > 1)) { if (set.size > 1 || a.length < 5 || GENERIC_NAME.has(a)) continue; }
  aliasOut[a] = [...set];
}
const postOut = {}; for (const [t, s] of post) if (t.length >= 2 && !STOP.has(t)) postOut[t] = [...s].sort((a, b) => a - b);
const top2 = (c) => c.split('/').slice(0, 2).join('/');
const cats = categories.map((c) => ({ id: c.id, name: c.name, parent: c.parent, level: c.level }));
const core = { v: 1, generated: new Date().toISOString().slice(0, 10), P, cats, post: postOut, alias: aliasOut, aka };
const coreSize = wr(path.join(OUT, 'core.json'), core);

// per product shards: compiled from the FINAL knowledge lane files (rates, safety, compatibility); k/<id>.json is only a fallback
const kdir = path.join(PORTAL, 'data/k');
const rates = rd(path.join(LANES, 'knowledge/rates.json')), safety = rd(path.join(LANES, 'knowledge/safety.json')), compat = rd(path.join(LANES, 'knowledge/compatibility.json'));
const src = (x) => x ? { t: x.doc_type, u: x.url || x.web_url || '', v: x.doc_version || '', p: x.page == null ? null : x.page, pe: x.page_end == null ? null : x.page_end, sec: x.web_section || x.section || '' } : null;
const nf = (f) => ({ id: f.id, label: f.label || '', text: f.text, s: src(f.source), parsed: f.parsed || null, calc: !!f.calc_ready, at: f.applies_to || null });
function normSource(o) { // recursively turn {source:{...}} into {s:{...}}
  if (Array.isArray(o)) return o.map(normSource);
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) { if (k === 'source' && v && typeof v === 'object') r.s = src(v); else r[k] = normSource(v); } return r; }
  return o;
}
const RATE_KINDS = ['consumption', 'coats', 'layer_thickness', 'mix_ratio'], TIME_KINDS = ['open_time', 'pot_life', 'adjustability_time', 'skin_tack_times', 'cure_times', 'recoat_times'];
let nShard = 0, nNoK = 0, nLane = 0;
for (const p of products) {
  const rp = rates.products[p.id], sp = safety.products[p.id], cp = compat.products[p.id];
  const shard = {
    v: 1, id: p.id, n: clean(p.name), b: clean(p.brand), u: p.url, c: p.category,
    d: { t: clean(p.tagline), s: clean(p.summary), a: (p.attributes || []).map(clean), us: (p.usage || []).map(clean), pk: clean(p.packaging), sec: (p.sections || []).flatMap((s) => (s.items || []).map((it) => ({ l: clean(it.label), t: clean(it.text), g: clean(s.title) }))).filter((x) => x.t).slice(0, 40) },
    dc: (docsByProduct.get(p.id) || []).map((d) => ({ id: d.id, t: clean(d.title), ty: d.type, tl: d.typeLabel, v: d.version || '', u: d.url, ok: docOk(d), f: d.format })),
  };
  if (rp) {
    nLane++;
    shard.r = { status: rp.rate_status, ds: rp.datasheet || null, facts: Object.fromEntries(RATE_KINDS.map((k) => [k, (rp.facts[k] || []).map(nf)])) };
    shard.tm = Object.fromEntries(TIME_KINDS.map((k) => [k, (rp.facts[k] || []).map(nf)]).filter(([, v]) => v.length));
    shard.pk = (rp.facts.pack_sizes || []).map(nf);
  }
  if (cp) shard.cp = (cp.rules || []).map((r) => ({ id: r.id, type: r.type, pol: r.polarity, cond: !!r.conditional, tags: r.tags || {}, text: r.text, heading: r.heading || '', s: src(r.source), pm: r.products_mentioned || [] }));
  if (sp) {
    const sds = (sp.sds || []).filter((x) => x.latest_for_name !== false && x.name_matches_product !== false);
    shard.sf = { status: sp.summary && sp.summary.status || '', sds: sds.map((x) => normSource({ title: x.title, url: x.url, revision_date: x.revision_date, version: x.version, sds_number: x.sds_number, pages: x.pages, classification: x.classification, hazard_statements: x.hazard_statements, precautionary_statements: x.precautionary_statements, storage: x.storage, handling: x.handling, signal_word: x.signal_word, ppe: x.ppe, transport_adg: x.transport_adg })) };
  }
  const kf = path.join(kdir, p.id + '.json');
  if (exists(kf)) { const k = rd(kf); shard.sp = k.spec; if (!rp) { nNoK++; shard.r = k.rates; shard.tm = k.times; shard.cp = k.compat; shard.sf = k.safety; } }
  sizes.p += wr(path.join(OUT, 'p', p.id + '.json'), shard); nShard++;
}

// per top-category shards: compat tag lists (filtered to the category), rule texts for the trees, trees, systems
const trees = rd(path.join(LANES, 'knowledge/decision_trees.json'));
const catOf = new Map(products.map((p) => [p.id, top2(p.category)]));
const slug = (c) => c.replace(/\//g, '__');
const ruleById = new Map(); for (const cp of Object.values(compat.products)) for (const r of cp.rules || []) ruleById.set(r.id, r);
const catIds = [...new Set(products.map((p) => top2(p.category)))];
const treeOut = { v: 1, trees: [] };
for (const t of trees.trees) {
  const q = (t.questions || []).map((x) => ({ id: x.id, text: x.text, options: (x.options || []).map((o) => ({ id: o.id, label: o.label, count: o.count, tags: o.tags })) }));
  const o = { id: t.id, title: t.title, problem: t.problem, scope: t.scope, order: t.order || q.map((x) => x.id), leaf_key: t.leaf_key || null, questions: q };
  if (t.leaves && !Array.isArray(t.leaves) && t.leaf_key) {
    o.leaves = {};
    for (const [k, v] of Object.entries(t.leaves)) o.leaves[k] = { fit: (v.documented_fit || []).map((x) => ({ p: x.product, ev: (x.evidence || []).slice(0, 2), pr: x.primer_products || [] })), part: (v.partly_documented || []).map((x) => ({ p: x.product, ns: x.not_stated || [] })).slice(0, 6), ex: (v.excluded || []).map((x) => ({ p: x.product, r: x.rule || (x.because && x.because[0]) || null })).slice(0, 12) };
  } else if (t.leaves) {
    o.leaves = {}; for (const [k, v] of Object.entries(t.leaves)) o.leaves[k] = v.map((x) => ({ p: x.product, n: x.name, w: x.why }));
  }
  treeOut.trees.push(o);
}
const ruleTexts = trees.rules;
const treeSize = wr(path.join(OUT, 'tree.json'), { v: 1, trees: treeOut.trees, rules: ruleTexts });

for (const cid of catIds) {
  const inCat = new Set(products.filter((p) => top2(p.category) === cid).map((p) => p.id));
  const o = { v: 1, id: cid, name: catName.get(cid) || cid, products: [...inCat], tags: {} };
  for (const [tag, v] of Object.entries(compat.by_tag || {})) {
    const f = (a) => (a || []).filter((x) => inCat.has(x.product)).map((x) => { const r = ruleById.get(x.rule); return { p: x.product, r: x.rule, c: !!x.conditional, t: r ? r.text : '', pg: r && r.source ? r.source.page : null, u: r && r.source ? r.source.url : '', v: r && r.source ? r.source.doc_version : '' }; });
    const e = { yes: f(v.yes), no: f(v.no), conditional: f(v.conditional) };
    if (e.yes.length || e.no.length || e.conditional.length) o.tags[tag] = e;
  }
  if (cid === 'construction/tile-stone-installationsystems' && exists(SYSTEMS)) {
    const sys = rd(SYSTEMS); o.systems = {};
    for (const [key, s] of Object.entries(sys.systems)) {
      o.systems[key] = { slug: s.slug, title: s.title, steps: (s.steps || []).map((st) => ({ role: st.role, label: st.label, status: st.status, opt: (st.options || []).slice(0, 2).map((op) => ({ id: op.productId, n: clean(op.name), r: clean(op.reason), s: op.evidence && op.evidence.sentence || '', u: op.evidence && op.evidence.url || op.sourceUrl || '', rate: op.rate && op.rate.text || '' })) })) };
    }
    o.tileTypes = sys.tileTypes; o.substrates = sys.substrates; o.locations = sys.locations;
  }
  sizes.cat += wr(path.join(OUT, 'cat', slug(cid) + '.json'), o);
}
// corrections: the lane's rules.json (empty today) is copied as is
const rulesSrc = path.join(LANES, 'corrections/rules.json');
const rules = exists(rulesSrc) ? rd(rulesSrc) : { version: 1, rules: [] };
wr(path.join(OUT, 'rules.json'), rules);
const know = buildKnow({ PORTAL, OUT, products });
const numStats = buildNum({ portal: PORTAL, lanes: LANES, log: console.log }); // data/brain/num: cited numeric data sheet facts (wave 2b); loaded on demand, never precached
const manifest = { v: 1, schema: 'sika-brain-manifest@1', generated: new Date().toISOString(), products: P.length, shards: nShard, categories: catIds.map((c) => ({ id: c, file: 'cat/' + slug(c) + '.json' })), files: { core: 'core.json', tree: 'tree.json', rules: 'rules.json', product: 'p/{id}.json', category: 'cat/{slug}.json', kb: 'kb.json', advisor: 'adv/{slug}.json' }, know: { crawl: know.crawl, pages: know.pages, lines: know.lines, prodLines: know.prodLines }, bytes: { kb: know.kb, adv: know.adv, core: coreSize, tree: treeSize, products: sizes.p, categories: sizes.cat }, tokens: Object.keys(postOut).length, aliases: Object.keys(aliasOut).length };
wr(path.join(OUT, 'manifest.json'), manifest);
console.log(JSON.stringify(manifest), 'products from lane:', nLane, 'fallback to k:', nNoK);
