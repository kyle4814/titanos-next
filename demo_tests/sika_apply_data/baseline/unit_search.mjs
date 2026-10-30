// unit_search.mjs: stemming, synonyms, tolerant name matching, intents, and build / query time budgets.
import { stem, tokenize, normalise, compact } from '../../../public/demo/sika-210c0c/assets/assistant/tokenize.js';
import { classify, parseRequest } from '../../../public/demo/sika-210c0c/assets/assistant/intents.js';
import { check, summary, make } from './_load.mjs';
import { createAssistant } from '../../../public/demo/sika-210c0c/assets/assistant/engine.js';

// stemming
const same = (a, b) => stem(a) === stem(b);
check('stem tile/tiles/tiling', same('tile', 'tiles') && same('tiles', 'tiling'));
check('stem level/levelling/leveller/leveling', same('levelling', 'leveller') && same('levelling', 'leveling') && same('level', 'levelling'));
check('stem waterproof/waterproofing', same('waterproof', 'waterproofing'));
check('stem adhesive/adhesives', same('adhesive', 'adhesives'));
check('stem grout/grouting/grouts', same('grout', 'grouting') && same('grout', 'grouts'));
check('stem seal/sealant differ (no over-stemming)', !same('seal', 'sealant'));
check('digits untouched', stem('1250') === '1250' && stem('11fc') === '11fc');
check('tokenize drops stop words and registered marks', tokenize('What is the Sikaflex®-11 FC+ for?').join(' ') === 'sikaflex 11 fc', tokenize('What is the Sikaflex®-11 FC+ for?').join(' '));
check('normalise square metre variants', normalise('40 sqm, 40 sq m, 40 square metres, 40 m²') === '40 m2, 40 m2, 40 m2, 40 m2');
check('compact ignores spacing hyphens marks case', compact('Sikaflex®-11 FC+') === 'sikaflex11fc' && compact('SIKAFLEX 11 fc') === 'sikaflex11fc');

const { data, assistant } = make();
const I = assistant._internals;
const pById = new Map(data.products.map(p => [p.id, p]));

// synonyms
const has = (q, term) => I.expand(q).has(stem(term));
check('glue expands to adhesive', has('glue for tiles', 'adhesive'));
check('MSDS expands to safety data sheet', has('MSDS for it', 'safety') && has('MSDS for it', 'data'));
check('datasheet expands to product data sheet', has('datasheet', 'sheet') && has('datasheet', 'technical'));
check('tanking expands to waterproof/membrane', has('tanking', 'waterproof') && has('tanking', 'membrane'));
check('caulk expands to sealant', has('caulk', 'sealant'));
check('screed expands to levelling', has('floor screed', 'levelling'));
check('porcelain expands to ceramic/tile', has('porcelain', 'ceramic') && has('porcelain', 'tile'));
check('synonym weight is lower than literal', I.expand('glue').get(stem('adhesive')) < I.expand('glue').get(stem('glue')));
check('swappable synonyms (opts.synonyms)', (() => { const a2 = createAssistant(data, { synonyms: { SYNONYM_GROUPS: [['frobnicate', 'adhesive']] } }); const e = a2._internals.expand('frobnicate'); return e.has(stem('adhesive')) && !a2._internals.expand('glue').has(stem('adhesive')); })());

// name matching (ids verified in data)
const top = (q) => (I.index.nameMatch(q)[0] || {}).id;
const ensure = (id) => { if (!pById.has(id)) { check('fixture product exists ' + id, false); return false; } return true; };
for (const [q, id] of [['sikaflex 11fc', '1671'], ['Sikaflex-11 FC+', '1671'], ['SIKAFLEX® 11 FC', '1671'], ['sikaflex 11 fc plus', '1671'], ['grey one pot', 'davco-grey-one-potadhesive'], ['Davco Grey One Pot adhesive', 'davco-grey-one-potadhesive'],
  ['viscocrete 1250', 'sika-viscocrete-1250'], ['Sika® ViscoCrete®-1250', 'sika-viscocrete-1250'], ['SIKA VISCOCRETE-1250', 'sika-viscocrete-1250'], ['sikafloor level ultra', 'sikafloor-level-ultra'], ['trojan mastic', 'davco-trojan-mastic'], ['sika monotop 412 nfg', 'sika-monotop-412nfg'], ['Sika Rugasol C', 'sika-rugasol-c']]) {
  if (ensure(id)) check(`name "${q}" -> ${id}`, top(q) === id, `got ${top(q)}`);
}
for (const q of ['what adhesive for porcelain tiles on concrete', 'waterproofing a balcony', 'sealant for a shower', 'repair mortar for concrete', 'who won the footy']) check(`no false product name in "${q}"`, I.index.nameMatch(q).filter(m => m.score >= 0.65).length === 0, JSON.stringify(I.index.nameMatch(q).slice(0, 2)));

// documents are searchable by type words
const docHit = (q, type) => { const r = I.index.search(I.expand(q), { kinds: ['document'], limit: 5 }); return r.some(x => (data.documents.find(d => d.id === x.id) || {}).type === type); };
check('index finds SDS documents for "MSDS"', docHit('MSDS', 'safety_data_sheet'));
check('index finds PDS documents for "datasheet"', docHit('datasheet', 'product_data_sheet'));
const catHit = I.index.search(I.expand('tile adhesives'), { kinds: ['category'], limit: 3 });
check('categories are indexed ("tile adhesives")', catHit.length > 0 && /tile-adhesives/.test(catHit[0].id), JSON.stringify(catHit[0]));

// intents
const ci = (q, s) => classify(q, s || {}).intent;
const cases = [
  ['hello', 'greeting'], ['what can you do', 'help'], ['where can I buy it', 'where_to_buy'], ['who do I contact for technical support', 'contact'],
  ['what is the coverage of Sika Rugasol C', 'consumption'], ['SDS for Sikaflex 11 FC+', 'documents'], ['what primer for Sikafloor Level Pro', 'compatibility'],
  ['how much adhesive for 40 m2', 'quote'], ['how many pails for a 25 m2 balcony', 'quote'], ['what do I need for 40 m2 of porcelain tiles', 'quote'], ['which product for a leaking basement', 'find_product'],
  ['EPD for Sika ViscoCrete 1250', 'documents'], ['yield of sika monotop 723', 'consumption'], ['can I use Sikaflex 11 FC+ with Sikasil Pool', 'compatibility'], ['is it compatible with epoxy', 'compatibility'], ['brochure for Sikaflex 11FC', 'documents']];
for (const [q, want] of cases) check(`intent "${q}" -> ${want}`, ci(q) === want, ci(q));
const req = parseRequest('how much for 40 m2 at 3 mm thick, 2 coats, add 10% waste, 20kg bags');
check('request parse', req.area === 40 && req.thickness === 3 && req.coats === 2 && req.allowancePct === 10 && req.pack && req.pack.size === 20 && req.pack.unit === 'kg', JSON.stringify(req));
const req2 = parseRequest('20 m of 10 x 10 mm joint');
check('joint request parse', req2.length === 20 && req2.width === 10 && req2.depth === 10 && req2.thickness == null, JSON.stringify(req2));

// documents that failed the link check are never offered
{
  const d2 = JSON.parse(JSON.stringify(data));
  const pid = 'sika-viscocrete-1250';
  const sds = d2.documents.filter(d => d.products.includes(pid) && d.type === 'safety_data_sheet');
  if (check('fixture: product has 2+ SDS', sds.length >= 2)) {
    sds[0].http = { status: 404, checked: '2026-10-30' }; sds[1].http = { status: 200, checked: '2026-10-30' };
    const a2 = createAssistant(d2); const ans = a2.ask('SDS for viscocrete 1250');
    const offered = ans.blocks.filter(b => b.type === 'docs').flatMap(b => b.items.map(i => i.id));
    check('404 document not offered', !offered.includes(sds[0].id) && offered.includes(sds[1].id), offered.join());
    check('404 document not cited', !ans.citations.some(c => c.url === sds[0].url) || sds.slice(1).some(s => s.url === sds[0].url));
    for (const d of sds) d.http = { status: 404, checked: 'x' };
    const ans2 = a2.ask('SDS for viscocrete 1250');
    check('all-404 documents: none offered, honest message', !ans2.blocks.some(b => b.type === 'docs' && b.items.some(i => sds.some(s => s.id === i.id))) && /is listed for|No safety data sheet/.test(JSON.stringify(ans2.blocks)));
  }
}

// no company words in engine logic: re-point at a renamed catalogue
{
  const d3 = JSON.parse(JSON.stringify(data));
  d3.config.company = { name: 'Acme Coatings', short: 'Acme', publishedDocsPhrase: "Acme Coatings' published documentation", site: 'https://example.test' };
  const a3 = createAssistant(d3); const ans = a3.ask('hello');
  check('company name comes from config', /Acme/.test(JSON.stringify(ans.blocks)) && !/Sika/.test(JSON.stringify(ans.blocks.filter(b => b.type === 'text').map(b => b.text))) && ans.blocks.some(b => b.text === "From Acme Coatings' published documentation."));
}

// time budgets
const st = assistant.stats();
console.log('  stats', JSON.stringify(st));
for (const k of ['products', 'documents', 'categories', 'pages', 'terms', 'postings', 'buildMs']) check('stats has ' + k, typeof st[k] === 'number');
check('stats counts match data', st.products === data.products.length && st.documents === data.documents.length && st.categories === data.categories.length);
const BUILD_BUDGET = 400, QUERY_BUDGET = 20;
let builds = [];
for (let i = 0; i < 5; i++) builds.push(make(data).assistant.stats().buildMs);
builds.sort((a, b) => a - b);
console.log('  buildMs over 5 fresh builds (sorted):', builds.join(', '));
check(`build under ${BUILD_BUDGET} ms (median)`, builds[2] < BUILD_BUDGET, String(builds[2]));
const queries = ['what adhesive for porcelain tiles on concrete', 'waterproofing a balcony', 'leaking basement', 'seal a shower', 'bond glass to metal', 'self-levelling for timber floor', 'repair mortar for concrete', 'concrete admixture to reduce water',
  'coverage of Davco Grey One Pot', 'consumption of sikafloor level ultra', 'dosage viscocrete 1250', 'datasheet for sikaflex 11fc', 'SDS for Davco Trojan Mastic', 'brochure sikaflex', 'what primer for sikafloor level pro', 'what is compatible with viscocrete 1250',
  'can I use Davco Grey One Pot over concrete', 'how much Davco Trojan Mastic for 40 m2', 'how many pails for 25 m2', 'what do I need for 40 m2 of porcelain tiles on a balcony', 'where can I buy', 'contact technical support', 'hello', 'help',
  'who won the footy', 'grout for a bathroom', 'tile over existing tiles', 'glue for wood', 'primer for concrete', 'epoxy floor coating', 'roof sealant', 'crack injection', 'expanding foam', 'anchoring adhesive', 'fibre cement sheet adhesive',
  'waterproof membrane for a roof', 'sika film coverage', 'rugasol c per litre', 'monotop 412 nfg', 'sealant for swimming pool'];
const times = [];
for (let round = 0; round < 3; round++) for (const q of queries) { const t = performance.now(); assistant.ask(q); times.push(performance.now() - t); }
times.sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95) - 1], p50 = times[Math.floor(times.length * 0.5)], mx = times[times.length - 1];
console.log(`  query ms over ${times.length} asks: p50 ${p50.toFixed(2)}, p95 ${p95.toFixed(2)}, max ${mx.toFixed(2)}`);
check(`query p95 under ${QUERY_BUDGET} ms`, p95 < QUERY_BUDGET, p95.toFixed(2));
const sTimes = []; for (let i = 0; i < 200; i++) { const t = performance.now(); I.index.search(I.expand('waterproof membrane balcony tile adhesive'), { kinds: ['product'], limit: 20 }); sTimes.push(performance.now() - t); }
sTimes.sort((a, b) => a - b);
console.log(`  raw index search p95 ${sTimes[Math.floor(sTimes.length * 0.95) - 1].toFixed(3)} ms`);
check('raw index search p95 under 20 ms', sTimes[Math.floor(sTimes.length * 0.95) - 1] < 20);

// tree
const tr = assistant.tree();
check('tree has root question and options', tr.id === 'root' && tr.question && tr.options.length > 3 && tr.nodes);
const bad = []; for (const n of Object.values(tr.nodes)) for (const o of n.options) { if (o.next && !tr.nodes[o.next]) bad.push(o.next); for (const id of o.productIds || []) if (!pById.has(id)) bad.push(id); }
check('every tree next and productId resolves', bad.length === 0, bad.slice(0, 3).join());
check('tree is derived from categories (every root option label is a category name)', tr.options.filter(o => o.next && o.next.startsWith('cat:')).every(o => data.categories.some(c => c.name === o.label)));
// guided tile path and exclusions on the tree
{
  const leaf = tr.nodes['tile:location:porcelain:concrete'];
  check('tile path leaf exists for porcelain on concrete', !!leaf && leaf.options.length >= 3);
  if (leaf) {
    const ids = leaf.options.flatMap(o => o.productIds || []);
    const grey = 'davco-grey-one-potadhesive';
    if (pById.has(grey)) check('tree leaf drops the adhesive whose text says not suitable for concrete', !ids.includes(grey), ids.join());
    check('tree leaf still offers tile adhesives', ids.length > 0 && ids.every(id => /tile-adhesives/.test(pById.get(id).category)));
  }
  const g = assistant.guide({ tileType: ['porcelain'], substrate: ['concrete'], location: ['wet-area'] });
  const slotTitles = g.blocks.filter(b => b.type === 'products').map(b => b.title);
  check('guide returns adhesive, grout and waterproofing slots', ['Tile adhesive', 'Grout'].every(t => slotTitles.includes(t)) && slotTitles.some(t => /Waterproofing/.test(t)), slotTitles.join('|'));
  const gAll = g.blocks.filter(b => b.type === 'products').flatMap(b => b.items.map(i => i.id));
  if (pById.has('davco-grey-one-potadhesive')) check('guide excludes not-suitable adhesive', !gAll.includes('davco-grey-one-potadhesive') && !gAll.includes('davco-supamastic'));
  check('guide reasons quote product text', g.blocks.filter(b => b.type === 'products').every(b => b.items.every(i => /"/.test(i.reason))));
  const viaAsk = assistant.ask('tileType=porcelain; substrate=concrete; location=wet-area');
  check('ask() understands tree selections', viaAsk.blocks.some(b => b.type === 'products' && b.title === 'Tile adhesive'));
  const viaCat = assistant.ask('category:' + data.categories.find(c => c.level === 3).id);
  check('ask() understands category ids', viaCat.blocks.some(b => b.type === 'products'));
}

// purity: same input, same output; input state is not mutated; answers are plain JSON
{
  const s0 = JSON.stringify({ intent: 'quote', productId: 'davco-trojan-mastic', req: { area: 10 } });
  const st = JSON.parse(s0);
  const a1 = assistant.ask('40 m2', st), a2 = assistant.ask('40 m2', JSON.parse(s0));
  const strip = (a) => JSON.stringify({ ...a, debug: { ...a.debug, ms: 0 } });
  check('ask is deterministic', strip(a1) === strip(a2));
  check('ask does not mutate the state passed in', JSON.stringify(st) === s0);
  check('answer survives a JSON round trip', JSON.stringify(JSON.parse(JSON.stringify(a1))) === JSON.stringify(a1));
  check('state returned is plain JSON', JSON.stringify(JSON.parse(JSON.stringify(a1.state))) === JSON.stringify(a1.state));
}
check('suggestions are strings', assistant.suggestions().length >= 4 && assistant.suggestions().every(s => typeof s === 'string'));
summary('unit_search');
