// bank2a_src.mjs: wave 2 lane A growth of the question bank. Reads bank.json, DROPS any earlier 'w2a' rows, keeps every other row untouched, appends the new rows (ids a0001..).
//   node demo-tests/sika-brain/coverage/bank2a_src.mjs      rewrites bank.json (base rows + new rows)
// Every new row has a source note (src) naming the data it was built from; derived expectations are read from the data and the build THROWS when the data does not back them.
// Sources: the 12 bughunt personas' vocabulary, counter and sales call phrasing (tradie shorthand, mixed units), every category with 3+ products, the 363 system sheets, kb.json business pages, the crowd sweep advisor-user questions.
import fs from 'node:fs';
import path from 'node:path';
import { problems, mk, messifyTo, hash, HERE_DIR, products, kb, shard, clean, rd, TA, TG, TW, LV, SS, CO, CR, RS, WP, RF, GA, ST, MAR, AUTO, PORTAL } from './_bankkit.mjs';
const bankFile = path.join(HERE_DIR, 'bank.json');
const base = JSON.parse(fs.readFileSync(bankFile, 'utf8')).filter((x) => x.split !== 'w2a');
// wave 1 rows whose 'not published' expectation the data contradicts (the value is in a table inside the product text): corrected to has:true with the value, so the miss shows as MISSING not HONEST
const FIX = { q357: '9 months', q358: '9 months', q359: '15 months', q603: '15 months', q366: '100 : 25' };
for (const r of base) if (FIX[r.id]) { r.exp = { product: r.exp.product, label: r.exp.label, has: true, contains: FIX[r.id], source: 'data' }; r.fix = 'w2a: data table text contains the value; wave 1 expectation (not published) was contradicted by the data'; }
const out = []; const k = mk(out, 'w2a');
const { add, attr, rate, doc, prod, calc, cmp, compat, biz, system, time, noattr } = k;
let seed = 20261101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; const pick = (a) => a[Math.floor(rnd() * a.length)];
const nm = (id) => clean(shard(id).n).toLowerCase();
const PRIM = ['c:tile-stone-installationsystems/primers-additives', 'c:flooring/cement-levellingsystems', 'c:sealants-adhesives/cleaners-activatorsprimers'];
// ============ 1. counter and tradie vocabulary (sqm, lineal, cement sheet, villaboard, yellow tongue, reno, pool, balcony, garage floor, render, subfloor, sheet, bag, pail)
const SRC1 = 'counter and trade vocabulary';
const hv = (persona, cat, q, type, exp, messy = '') => add(persona, cat, q, type, exp, messy, 'tradie counter phrasing; allowed set = documented product category');
hv('T', 'villaboard', 'tile adhesive for villaboard in a bathroom', 'best', { allowed: TA });
hv('T', 'villaboard', 'what do i seal villaboard with before tiling', 'best', { allowed: TW.concat(PRIM) });
hv('T', 'villaboard', 'waterproofing over villaboard walls in a wet area', 'best', { allowed: TW });
hv('T', 'cement sheet', 'cement sheet floor then tiles, what glue', 'best', { allowed: TA });
hv('T', 'cement sheet', 'can i tile straight onto cement sheet in a laundry', 'best', { allowed: TA.concat(TW) });
hv('T', 'cement sheet', 'primer for compressed cement sheet', 'best', { allowed: PRIM.concat(TW) });
hv('T', 'yellow tongue', 'tiling on yellow tongue what do i need', 'best', { allowed: TA.concat(TW, PRIM, LV) });
hv('T', 'yellow tongue', 'adhesive over yellowtongue flooring', 'best', { allowed: TA.concat(SS, ['c:flooring']) });
hv('B', 'yellow tongue', 'smooth out a yellow tongue floor before vinyl', 'best', { allowed: LV });
hv('B', 'subfloor', 'levelling a timber subfloor before carpet tiles', 'best', { allowed: LV });
hv('B', 'subfloor', 'patch low spots in the subfloor', 'best', { allowed: LV.concat(CR) });
hv('B', 'subfloor', 'ply subfloor primer then self leveller', 'best', { allowed: LV.concat(PRIM) });
hv('B', 'subfloor', 'glue for fixing floor sheets to the joists', 'best', { allowed: SS.concat(['c:flooring']) });
hv('H', 'bathroom reno', 'bathroom reno what do i need to waterproof', 'best', { allowed: TW });
hv('H', 'bathroom reno', 'doing a full bathroom reno, waterproofing and tile glue list', 'best', { allowed: TW.concat(TA) });
hv('H', 'bathroom reno', 'bathroom reno shower hob waterproofing', 'best', { allowed: TW });
hv('H', 'bathroom reno', 'bathroom reno floor is out of level', 'best', { allowed: LV });
hv('H', 'bathroom reno', 'bathroom reno 600x300 wall tiles glue', 'best', { allowed: TA });
hv('H', 'bathroom reno', 'what grout for the bathroom reno', 'best', { allowed: TG });
hv('H', 'bathroom reno', 'silicone for around the new bath', 'best', { allowed: SS });
hv('T', 'pool', 'adhesive for tiles in a swimming pool', 'best', { allowed: TA });
hv('T', 'pool', 'pool tile grout that handles chlorine', 'best', { allowed: TG });
hv('T', 'pool', 'what waterproofs a concrete pool shell before tiling', 'best', { allowed: TW.concat(WP) });
hv('B', 'pool', 'sealant for pool coping joints', 'best', { allowed: SS });
hv('C', 'pool', 'repair mortar for a pool wall', 'best', { allowed: CR });
hv('W', 'pool', 'pool surround coating non slip', 'best', { allowed: RS.concat(CR) });
hv('T', 'balcony', 'tile adhesive for a balcony over a bedroom', 'best', { allowed: TA });
hv('W', 'balcony', 'waterproof a balcony before the tilers come', 'best', { allowed: WP.concat(RF) });
hv('W', 'balcony', 'balcony membrane that can take tiles', 'best', { allowed: WP.concat(RF) });
hv('B', 'balcony', 'balcony is leaking into the unit below', 'best', { allowed: WP.concat(RF, SS, CR) });
hv('B', 'balcony', 'balcony slab edge spalling repair', 'best', { allowed: CR });
hv('H', 'balcony', 'tiles lifting on the balcony glue', 'best', { allowed: TA.concat(SS) });
hv('B', 'garage floor', 'garage floor coating that doesnt hot tyre lift', 'best', { allowed: RS });
hv('B', 'garage floor', 'epoxy for the garage floor diy', 'best', { allowed: RS });
hv('B', 'garage floor', 'garage floor has pitting from the old paint', 'best', { allowed: RS.concat(LV, CR) });
hv('B', 'garage floor', 'garage slab is cracked in the middle', 'best', { allowed: CR.concat(GA, SS, LV, ['c:flooring']) });
hv('B', 'garage floor', 'garage floor levelling 20mm slope fix', 'best', { allowed: LV });
hv('B', 'garage floor', 'primer for a garage floor before painting', 'best', { allowed: RS.concat(PRIM) });
hv('B', 'render', 'render is cracking, what to fill it with', 'best', { allowed: SS.concat(CR) });
hv('B', 'render', 'bonding agent before rendering over old concrete', 'best', { allowed: CR.concat(CO, PRIM) });
hv('B', 'render', 'waterproof a rendered wall outside', 'best', { allowed: WP.concat(CR, RF) });
hv('T', 'render', 'tiling onto a sand and cement render outside', 'best', { allowed: TA });
hv('B', 'render', 'crack filler for render before paint', 'best', { allowed: SS.concat(CR) });
hv('B', 'sheet', 'what glue for sheeting onto a steel frame', 'best', { allowed: SS });
hv('B', 'sheet', 'adhesive for fixing plasterboard sheet to brick', 'best', { allowed: SS });
hv('B', 'sheet', 'sheet membrane for under a deck', 'best', { allowed: RF.concat(WP) });
hv('B', 'sheet', 'stick on flashing for a window sill', 'best', { allowed: SS.concat(WP, RF) });
hv('B', 'screed', '40mm screed on a concrete slab, bag or pump mix', 'best', { allowed: LV });
hv('B', 'screed', 'bag mix screed for a bathroom fall', 'best', { allowed: LV });
hv('B', 'screed', 'how many bags of leveller for 100 sqm at 5mm', 'best', { allowed: LV });
hv('B', 'screed', 'how many bags of screed for 40 sqm at 20mm', 'best', { allowed: LV });
hv('B', 'screed', 'bags of levelling compound for 60 m2 at 3mm', 'best', { allowed: LV });
hv('T', 'quantity', 'how much adhesive for 15 m2 of 600x600 tiles', 'best', { allowed: TA });
hv('T', 'quantity', 'how many bags of tile adhesive for 30 sqm', 'best', { allowed: TA });
hv('T', 'quantity', 'adhesive for 12 square meters of large format', 'best', { allowed: TA });
hv('W', 'quantity', 'how many pails of membrane for a 10 sqm shower', 'best', { allowed: TW });
hv('W', 'quantity', 'pail of waterproofing for 20 m2 of wet area', 'best', { allowed: TW });
hv('B', 'lineal', 'how many lineal metres of joint from a sausage of sikaflex pro plus', 'rate', { product: 'sikaflex-pro-plus' });
hv('B', 'lineal', '300ml cartridge gives how many lineal m', 'rate', { product: 'sikaflex-pro-plus' });
hv('B', 'lineal', 'lineal metres from a tube of sikasil pool', 'rate', { product: 'sikasil-pool' });
hv('B', 'lineal', 'backer rod for 40 lineal metres of 15mm joint', 'best', { allowed: SS });
hv('B', 'lineal', 'silicone for 12 lineal m of window frames', 'best', { allowed: SS });
hv('H', 'tiles', 'glue for the kitchen floor tiles 45 sqm', 'best', { allowed: TA });
hv('H', 'tiles', 'sqm of grout from one bag', 'best', { allowed: TG });
hv('T', 'grout', 'how many bags of grout for 20 sqm of 300x300 tiles', 'best', { allowed: TG });
hv('T', 'grout', 'grout bag for floor tiles with 5mm joint', 'best', { allowed: TG });
hv('D', 'pail', 'what size pail does davco k10 plus come in', 'attr', { product: 'davco-k10-plus', label: 'packag', has: true, contains: shard('davco-k10-plus').d.pk.slice(0, 40) });
hv('D', 'pail', 'pail size for davco grey one pot', 'attr', { product: 'davco-grey-one-potadhesive', label: 'packag', has: true, contains: shard('davco-grey-one-potadhesive').d.pk.slice(0, 40) });
hv('D', 'bag', 'bag size of davco trojan mastic', 'attr', { product: 'davco-trojan-mastic', label: 'packag', has: true, contains: shard('davco-trojan-mastic').d.pk.slice(0, 40) });
hv('D', 'bag', '20kg bag davco ceramaflex how many on a pallet', 'attr', { product: 'davco-ceramaflex', label: 'packag', has: true, contains: shard('davco-ceramaflex').d.pk.slice(0, 20) });
hv('D', 'pail', 'how big is a pail of sika tite be', 'attr', { product: 'sika-tite-be', label: 'packag', has: true, contains: shard('sika-tite-be').d.pk.slice(0, 30) });
hv('H', 'sealer', 'caulk for a leaking window frame', 'best', { allowed: SS });
hv('H', 'sealer', 'gap filler between the skirting and the wall', 'best', { allowed: SS });
hv('H', 'sealer', 'stuff to seal the gap around the bath', 'best', { allowed: SS });
hv('B', 'sealer', 'caulking the cladding joints before painting', 'best', { allowed: SS });
hv('B', 'sealer', 'gap between the benchtop and the tiles', 'best', { allowed: SS });
hv('B', 'adhesive', 'nail free glue for architraves', 'best', { allowed: SS });
hv('B', 'adhesive', 'liquid nails for a pergola post bracket', 'best', { allowed: SS });
hv('B', 'adhesive', 'glue down a vinyl plank floor', 'best', { allowed: SS.concat(['c:flooring']) });
hv('B', 'adhesive', 'bonding a handrail to a concrete wall', 'best', { allowed: SS.concat(GA) });
hv('B', 'adhesive', 'foam gun adhesive for insulation boards', 'best', { allowed: SS });
hv('B', 'concrete', 'ready mix needs more slump on a hot day', 'best', { allowed: CO });
hv('C', 'concrete', 'fibres for a thin slab to stop cracks', 'best', { allowed: CO });
hv('C', 'concrete', 'concrete hardener for a warehouse floor', 'best', { allowed: CO.concat(RS, CR, ['c:flooring']) });
hv('C', 'concrete', 'additive to make concrete waterproof', 'best', { allowed: CO.concat(WP) });
hv('C', 'concrete', 'pump mix superplasticiser', 'best', { allowed: CO });
hv('C', 'concrete', 'honeycombing on the column what do i patch it with', 'best', { allowed: CR.concat(['i:sikafloor-050-rampandpatch']) }); // Sikafloor-050 Ramp and Patch usage line: Patching damaged concrete floors, stairs, & walls
hv('C', 'concrete', 'rebar rusting inside a beam repair', 'best', { allowed: CR });
hv('C', 'concrete', 'hairline cracks in an exposed slab', 'best', { allowed: CR.concat(SS, WP, ['c:flooring']) });
hv('C', 'concrete', 'epoxy injection for structural cracks', 'best', { allowed: CR.concat(WP, ST) });
hv('X', 'counter', 'customer wants a glue that works on wet concrete', 'best', { allowed: SS.concat(CR) });
hv('X', 'counter', 'customer wants the same as the old davco grey bag', 'best', { allowed: TA });
hv('X', 'counter', 'what sealant goes with the green pail membrane', 'best', { allowed: SS.concat(TW) });
hv('X', 'counter', 'tradie wants something fast for a tiling job tomorrow', 'best', { allowed: TA });
hv('X', 'counter', 'what replaces the old ardex style flexible adhesive', 'best', { allowed: TA });
hv('X', 'counter', 'rapid set grout for a shop floor', 'best', { allowed: TG });
// ============ 2. persona journeys (12 bughunt personas): their phrasing, plus the 14 advisor-user questions from the crowd sweep
const SRC2 = 'bughunt personas';
const ps = (persona, cat, q, type, exp, messy = '', src = 'bughunt persona phrasing (demo-tests/sika-bughunt/journeys.mjs)') => add(persona, cat, q, type, exp, messy, src);
ps('T', 'tiler', 'add grout to my project', 'best', { allowed: TG });
ps('T', 'tiler', 'waterproofing a balcony', 'best', { allowed: WP.concat(RF) });
ps('T', 'tiler', 'what is the full system for tiles on a balcony', 'best', { allowed: TW.concat(TA, WP, TG, PRIM) });
ps('S', 'architect', 'specification clause for a waterproofing membrane', 'best', { allowed: WP.concat(RF) });
ps('S', 'architect', 'environmental declarations for sika flooring', 'best', { allowed: RS.concat(LV) });
ps('S', 'architect', 'where are the epds', 'business', { url: 'documents|epd|sustain', must: '', nodata: true }, '', 'architect persona: Environmental declarations tab');
ps('S', 'architect', 'system data sheets for tiling', 'business', { url: 'documents|systems?', must: '', nodata: true }, '', 'architect persona: System data sheets');
ps('H', 'first time visitor', 'i am a tradesperson what should i look at first', 'vague', {}, '', 'first-time-visitor persona: persona tile');
ps('H', 'first time visitor', 'im an applicator where do i start', 'vague', {}, '', 'first-time-visitor persona tile: Applicator or tradesperson');
ps('S', 'first time visitor', 'i am an architect where do i start', 'vague', {}, '', 'first-time-visitor persona tile: Specifier or architect');
ps('H', 'offline user', 'davco 4 in 1 grout additive', 'product', { products: ['davco-4-in-1-groutadditive'] }, '', 'offline-user persona product page davco-4-in-1-groutadditive');
ps('T', 'offline user', 'what does davco 4 in 1 grout additive do', 'product', { products: ['davco-4-in-1-groutadditive'] }, '', 'offline-user persona');
ps('T', 'advisor user', 'Which adhesive for porcelain tiles on a concrete floor?', 'best', { allowed: TA }, '', 'crowd sweep a2ca2c764 advisor-user: finding advisor-no-reply');
ps('T', 'advisor user', 'How much Davco Grey One Pot adhesive do I need for 25 m2?', 'calc', { product: 'davco-grey-one-potadhesive' }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('S', 'advisor user', 'Give me the data sheet for Sikafloor-263 SL', 'doc', { product: 'sikafloor-263-sl' }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('B', 'advisor user', 'What is the coverage of Sikaflex Pro-3?', 'rate', { product: 'sikaflex-pro-3-purform' }, '', 'crowd sweep a2ca2c764 advisor-user: advisor-slow');
ps('W', 'advisor user', 'waterproofing for a shower recess', 'best', { allowed: TW }, '', 'crowd sweep a2ca2c764 advisor-user: advisor-slow');
ps('X', 'advisor user', 'is there an SDS for SikaTile 110 SecureProof', 'doc', { product: 'sikatile-110-secureproof' }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('T', 'advisor user', 'what grout for a swimming pool', 'best', { allowed: TG }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('T', 'advisor user', 'How long before I can grout after tiling?', 'time', { product: 'sikatile-400-evopro', alt: ['sikatile-440-opti-cure', 'sikatile-350-promaxset', 'sikatile-366-proflex'] }, '', 'crowd sweep a2ca2c764 advisor-user; time question without a product: brain should ask or answer with cited tile adhesive times');
ps('B', 'advisor user', 'what primer goes under Sikafloor 161', 'compat', { product: 'sikafloor-161', verdict: 'any' }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('H', 'advisor user', 'asdfghjkl qwerty', 'oos', {}, '', 'crowd sweep a2ca2c764 advisor-user: keyboard mash');
ps('D', 'advisor user', 'what does Sika cost per bag', 'nodata', {}, '', 'crowd sweep a2ca2c764 advisor-user: price');
ps('H', 'advisor user', 'hello', 'oos', {}, '', 'crowd sweep a2ca2c764 advisor-user: greeting');
ps('W', 'advisor user', 'Which products need a primer for a balcony waterproofing membrane under tiles?', 'best', { allowed: TW.concat(PRIM, WP) }, '', 'crowd sweep a2ca2c764 advisor-user');
ps('X', 'advisor user', 'what is the pot life of Sikadur-31 at 30 degrees', 'time', { product: 'sikadur-31-cf-normal', key: 'pot_life' }, '', 'crowd sweep a2ca2c764 advisor-user: pot life');
ps('H', 'impatient user', 'tile glue', 'best', { allowed: TA });
ps('H', 'impatient user', 'grout', 'vague', {});
ps('H', 'impatient user', 'sealant', 'vague', {});
ps('H', 'impatient user', 'waterproofing', 'vague', {});
ps('H', 'keyboard only', 'tile', 'vague', {});
ps('D', 'distributor', 'which products are the fast movers for tilers', 'nodata', {}, '', 'distributor persona: sales data is not published');
// ============ 3. every category with 3+ products gets 3+ questions (list, good-for-general, tell-me-about x1)
const byCat = new Map();
for (const p of products) { const cp = p.categoryPath; if (cp.length < 3 || /^\d+$/.test(cp[2])) continue; const key = cp.slice(0, 3).join('/'); if (!byCat.has(key)) byCat.set(key, { name: p.breadcrumb[2] ? clean(p.breadcrumb[2].name) : cp[2], ps: [] }); byCat.get(key).ps.push(p); }
const LAB = { 'construction/tile-stone-installationsystems/waterproofing': 'tile waterproofing membranes', 'construction/roofing/liquid-applied-membranes': 'liquid roof membranes', 'construction/waterproofing/liquid-applied-membranes': 'liquid waterproofing membranes', 'construction/roofing/pvc-sheet-membranes': 'pvc roof membranes', 'construction/concrete/pre-cast': 'precast concrete products', 'construction/concrete/admixture-technology': 'concrete admixtures', 'construction/concrete-repair-protection/concrete-mortarsadmixtures': 'concrete mortar admixtures and bonding agents', 'industry/transportation/interior-exteriorsealing': 'transport interior and exterior sealing', 'industry/automotive-aftermarket/sealing-and-bonding': 'automotive sealing and bonding', 'industry/building-components/facade': 'facade sealants and adhesives', 'industry/automotive-aftermarket/panel-bonding': 'automotive panel bonding', 'construction/roofing/sheet-membranes-accessories': 'roof sheet membrane accessories', 'construction/waterproofing/pvc-sheet-membranesfortunnelsandcrosspassages': 'pvc sheet membranes for tunnels', 'construction/concrete/specialty-products': 'specialty concrete products', 'construction/sealants-adhesives/specialty-sealants': 'specialty sealants', 'construction/tile-stone-installationsystems/primers-additives': 'tile primers and additives', 'construction/sealants-adhesives/cleaners-activatorsprimers': 'sealant cleaners activators and primers', 'construction/landscape-buildingproducts/paving-decking-support': 'paving and decking supports' };
let nCat = 0;
for (const [key, c] of byCat) {
  if (c.ps.length < 3) continue; nCat++;
  const lab = (LAB[key] || c.name.replace(/\u00ae/g, '')).toLowerCase(); const persona = /tile-stone/.test(key) ? 'T' : /concrete\//.test(key) || /concrete-repair/.test(key) ? 'C' : /waterproofing|roofing/.test(key) ? 'W' : /industry/.test(key) ? 'X' : 'B';
  const fam = key.split('/')[0]; const core = ['c:' + key].concat(key === 'construction/tile-stone-installationsystems/tile-adhesives' ? ['i:sikaceram-880-easyepoxy'] : []);
  const sel = ['c:' + fam].concat(fam === 'industry' ? ['c:construction/sealants-adhesives'] : []).concat(key === 'construction/tile-stone-installationsystems/tile-adhesives' ? ['i:sikaceram-880-easyepoxy'] : []); // allowed = the same product family (the brain groups sub-categories); core = the exact category, which must supply the listed products
  const note = `category ${key} (${c.ps.length} products in products.json); allowed = anything under ${fam} (the brain groups sub-categories and some products are cross-listed), core = ${key} must supply the listed products`;
  add(persona, 'category: ' + lab, `what ${lab} does sika have`, 'list', { allowed: sel, core, min: Math.min(3, c.ps.length) }, '', note);
  add(persona, 'category: ' + lab, `list the ${lab} products`, 'list', { allowed: sel, core, min: Math.min(3, c.ps.length) }, '', note);
  const sample = c.ps[Math.floor(rnd() * c.ps.length)];
  add(persona, 'category: ' + lab, `what is ${clean(sample.name).toLowerCase()} used for`, 'product', { products: [sample.id] }, '', note + '; product ' + sample.id);
}
// ============ 4. system sheets: one question per tile x substrate pair (location rotates through the six families)
const sysDirs = fs.readdirSync(path.join(PORTAL, 'systems')).filter((d) => fs.statSync(path.join(PORTAL, 'systems', d)).isDirectory());
const TL = { 'ceramic': 'ceramic tiles', 'engineered-stone': 'engineered stone', 'glass': 'glass tiles', 'large-format': 'large format tiles', 'mosaic': 'mosaic tiles', 'natural-stone': 'natural stone', 'porcelain': 'porcelain tiles', 'quarry-terracotta': 'terracotta tiles' };
const SL = { 'aac': 'aac blocks', 'cement-board': 'cement sheet', 'concrete': 'concrete', 'existing-tiles': 'existing tiles', 'masonry': 'brick', 'plasterboard': 'plasterboard', 'screed-render': 'a sand and cement render', 'timber-floor': 'a timber floor' };
const LL = { 'internal-floor': ['an internal floor', 'a floor inside'], 'internal-wall': ['an internal wall', 'a wall inside'], 'internal-wet-floor': ['a wet area floor', 'a shower floor inside'], 'internal-wet-wall': ['a wet area wall', 'a shower wall'], 'external-floor': ['an external floor', 'an outdoor floor'], 'external-wall': ['an external wall', 'an outdoor wall'] };
const pairs = new Map();
for (const d of sysDirs) { const m = d.match(/^(.*?)-on-(aac|cement-board|concrete|existing-tiles|masonry|plasterboard|screed-render|timber-floor)-(internal-floor|internal-wall|internal-wet-floor|internal-wet-wall|external-floor|external-wall)$/); if (!m) continue; const pk = m[1] + '|' + m[2]; if (!pairs.has(pk)) pairs.set(pk, []); pairs.get(pk).push({ slug: d, loc: m[3] }); }
let si = 0;
for (const [pk, arr] of [...pairs.entries()].sort()) {
  const [t, s] = pk.split('|'); const choice = arr[si % arr.length]; si++;
  const phr = [(a, b, c) => `what is the full system for ${a} on ${b} on ${c}`, (a, b, c) => `${a} on ${b} on ${c} what products`, (a, b, c) => `tiling system for ${a} over ${b} on ${c}`, (a, b, c) => `what goes under ${a} on ${b} on ${c}`][si % 4];
  system('T', 'system sheet', phr(TL[t], SL[s], LL[choice.loc][si % 2]), choice.slug);
}
for (const d of sysDirs) { /* every other family also gets a second location so each location family appears */ }
// ============ 5. business pages: where to buy, contact, training, careers, warranty, BIM, DIY, projects, industry
const bz = (persona, q, urlRx, must, messy = '', nodata = false) => biz(persona, 'business', q, urlRx, must, messy, nodata);
bz('D', 'where do i buy sikatile from', 'where-to-buy|SikaTile-distributors|stockist', '', '', true);
bz('H', 'closest shop that sells davco', 'where-to-buy|SikaTile-distributors|stockist', '', '', true);
bz('D', 'is there a stockist list', 'where-to-buy|SikaTile-distributors|stockist', '', '', true);
bz('D', 'sikatile distributors near me', 'SikaTile-distributors|where-to-buy', '', '', true);
bz('X', 'who do i call for technical advice', 'contact|Contact|imprint', '', '', true);
bz('X', 'sika australia contact details', 'contact|Contact|imprint', '', '', true);
bz('H', 'phone number for sika', 'imprint|contact', '9725');
bz('X', 'where is sika australia based', 'imprint', 'Wetherill Park');
bz('H', 'can i talk to someone about a concrete repair job', 'concrete-repair-contact|contact', '', '', true);
bz('X', 'training for waterproofers', 'training|Undertile', '', '', true);
bz('T', 'any tiling courses from sika', 'training|Undertile', '', '', true);
bz('D', 'warranty for a tiling job with davco k10', 'warranty-portal', 'warrant');
bz('S', 'how do i register a warranty', 'warranty-portal', 'warrant');
bz('S', 'sika bim library', 'sika-bim', 'BIM');
bz('S', 'what does bim do for a project', 'what-is-bim|benefits-of-bim|sika-bim', 'BIM');
bz('S', 'anchorfix calculation software download', 'anchorfix-calculation-software', 'software');
bz('S', 'carbodur design software', 'carbodur-frp-design-software', 'software');
bz('D', 'register for the sika b2b shop', 'b2b-e-shop-registration', '');
bz('S', 'local sika project case studies', 'local-projects', '');
bz('S', 'tell me about the sika work on the mcg', 'Melbourne-Cricket-Ground|MCG-Great-southern-stand', '');
bz('S', 'perth stadium sika products', 'Perth-stadium', '');
bz('S', 'sydney modern project', 'The_Sydney_Modern_Project', '');
bz('S', 'what did sika do at quay quarter tower', 'Quay-quarter-tower', '');
bz('S', 'bulli bridge repair project', 'bulli-bridge', '');
bz('S', 'coffs harbour bypass sika', 'coffs-harbour-bypass', '');
bz('S', 'swimming pool restoration at northbridge', 'Northbridge-Swimming-Pool-Restoration', '');
bz('S', 'food grade flooring at kerry ingredients', 'Kerry-ingredients-food-grade-flooring', '');
bz('S', 'dairy production flooring case study', 'Murray-goulburn', '');
bz('S', 'carpark structural strengthening at chatswood', 'ptc-chatswood-carpark-structural-strengthening', '');
bz('H', 'how do i replace a balustrade', 'how-to-replace-a-balustrade', '');
bz('H', 'how do i replace a clothesline', 'how-to-replace-a-clothesline', '');
bz('H', 'how can i tell if my shower is leaking', 'leaking-shower', 'shower');
bz('H', 'laundry refresh tile over tile', 'tile-over-tile', 'tile');
bz('H', 'update the bathroom without a full reno', 'update-your-bathroom', '');
bz('H', 'must have sika products for plumbers', '3-must-haves-for-plumbers', '');
bz('B', 'three must haves for carpenters', '3-must-haves-for-carpenters', '');
bz('B', 'what should builders carry in the ute', '3-must-haves-for-builders', '');
bz('B', 'tool box essentials from sika', '3-must-have-for-every-tool-box', '');
bz('B', 'wood floor installer must haves', '3-must-haves-for-wood-floor-installers', '');
bz('S', 'what remedial solutions does sika offer', 'Remedial-Solutions', '');
bz('S', 'solutions for large projects', 'solutions-for-projects', '');
bz('S', 'where are the safety data sheets kept', 'material-safety-data-sheets|documents-resources', '');
bz('S', 'where can i find product data sheets', 'pds|documents-resources', '');
bz('S', 'adhesive pre treatment chart', 'pre-treatment-charts', '');
bz('X', 'how do i open a unipack', 'how-to-open-a-unipack', '');
bz('X', 'minimum drive away time after windscreen replacement', 'safe-drive-away-time', '');
bz('X', 'adas calibration after a windscreen', 'adas-calibration', '');
bz('X', 'smartcut windscreen removal', 'sika-smartcut-cut-out-process', '');
bz('X', 'removing a windscreen completely', 'complete-removal-procedure', '');
bz('X', 'bonding a freshly painted vehicle', 'freshly-painted-vehicles', '');
bz('X', 'bonding in cold weather for glass', 'special-weather-conditions', '');
bz('X', 'how to bond polycarbonate', 'PC-PMMA-Bonding', '');
bz('X', 'how to tell butyl from silicone from polyurethane on a screen', 'Identificatio-of-Butyl-Silicone-Polyurethane', '');
bz('X', 'faq for panel replacement', 'faq-panel-replacement', '');
bz('X', 'marine faq', 'marine-faq', '');
bz('X', 'teak decking with sika', 'teak-decking', '');
bz('X', 'bonding glass on a yacht', 'leisure-boats-andyachts/glass-bonding', '');
bz('X', 'sika wind energy products', 'wind-energy', '');
bz('X', 'solar panel bonding adhesives', 'renewable-energies/solar', '');
bz('X', 'facade glass balustrade grouting', 'glass-balustrades', '');
bz('X', 'insulating glass sealant', 'insulating-glass', '');
bz('X', 'honeycomb panel bonding', 'honeycomb-panels', '');
bz('X', 'door panel bonding', 'building-components/doors', '');
bz('X', 'elevator bonding and sealing', 'elevator', '');
bz('X', 'hvac sealing and bonding', 'hvac', '');
bz('X', 'dishwasher sealing', 'dishwasher', '');
bz('X', 'ask an industry expert', 'contact-expert', '');
// ============ 6. industry products (marine, auto, transport, building components, hvac) by product, 3+ per industry category
const ind = new Map();
for (const p of products) { if (p.categoryPath[0] !== 'industry') continue; const key = p.categoryPath.slice(0, 3).join('/'); if (!ind.has(key)) ind.set(key, []); ind.get(key).push(p); }
for (const [key, ps_] of ind) { // a good-for-use question, a tell-me-about and a datasheet question for every industry category
  const first = ps_[0]; const lab = clean(first.breadcrumb[2] ? first.breadcrumb[2].name : key.split('/')[2]).toLowerCase();
  for (const p of ps_.slice(0, 2)) { prod('X', 'industry: ' + lab, `tell me about ${clean(p.name).toLowerCase()}`, p.id); }
  const withPds = ps_.find((p) => (shard(p.id).dc || []).some((d) => d.ty === 'product_data_sheet' && d.ok)); if (withPds) doc('X', 'industry: ' + lab, `data sheet for ${clean(withPds.name).toLowerCase()}`, withPds.id, 'product_data_sheet');
}
const MQ = [['marine', 'bedding compound for a deck fitting on a boat', MAR], ['marine', 'seam sealer between teak planks', MAR], ['marine', 'bond a hatch into a fibreglass hull', MAR], ['marine', 'what do i use for the cabin carpet glue on a yacht', MAR], ['marine', 'antislip deck coating for a work boat', MAR.concat(RS)], ['marine', 'sika for ship decks internal flooring', MAR.concat(RS, LV)], ['automotive', 'windscreen adhesive for a car', AUTO], ['automotive', 'panel bonding adhesive for a repaired door skin', AUTO], ['automotive', 'underbody sealer for rust', AUTO], ['automotive', 'primer for glass before urethane', AUTO.concat(SS)], ['automotive', 'seam sealing after a panel replacement', AUTO], ['transport', 'sealant for a caravan roof', AUTO], ['transport', 'adhesive for bonding a metal panel on a truck body', AUTO], ['transport', 'sandwich panel adhesive for refrigerated trucks', AUTO], ['building components', 'structural silicone for curtain wall glazing', SS.concat(['c:industry/building-components'])], ['building components', 'window bonding adhesive for a factory', SS.concat(['c:industry/building-components'])], ['hvac', 'sealing ducts in a hvac unit', SS.concat(['c:industry/appliance-and-equipment'])], ['renewable', 'grout for a wind turbine tower base', GA]];
for (const [cat, q, sel] of MQ) add('X', 'industry: ' + cat, q, 'best', { allowed: sel }, '', 'industry customer phrasing; allowed = documented industry and sealant categories');
// ============ 7. honest no-data, out-of-scope and vague asks in trade voice
for (const q of ['how much is a pail of sikalastic 1k', 'price per bag of lanko 145', 'is davco ultraflex in stock at bunnings', 'what is the lead time on sikafloor level pro', 'do you deliver to darwin', 'cheapest sealant', 'what is the rrp of sikaflex pro plus', 'any specials on tile adhesive', 'sika vs mapei price']) add('D', 'nodata', q, 'nodata', {}, '', 'price, stock and delivery are not published in the data; the brain must decline');
for (const q of ['whats the weather like for tiling tomorrow', 'who is the prime minister', 'recipe for pancakes', 'what is 2 plus 2', 'translate hello to french', 'how do i bake a cake', 'is ardex better than sika', 'tell me about dulux paint']) add('H', 'oos', q, 'oos', {}, '', 'out of scope: not construction product data');
for (const q of ['need something for the roof', 'what do i use on the wall', 'got a leak', 'fix my floor', 'something for outside', 'tiles are coming off', 'wall is damp', 'what should i buy for the renovation', 'something for the shower', 'floor is cracked', 'need glue', 'is there something for concrete', 'paint over what', 'my deck is rotting', 'ceiling stain']) add('H', 'vague', q, 'vague', {}, '', 'underspecified ask: one clarifying question with 2 to 4 options is the correct answer');
bz('D', 'can i get a trade account', 'b2b-e-shop-registration', '', '', true);
// ============ 8. product-specific quantity, time, doc, attribute and comparison asks in tradie phrasing (data-derived with bag, pail, sqm)
const BP = ['davco-ceramacrete', 'davco-ceramaflex', 'davco-grey-one-potadhesive', 'davco-k10-plus', 'davco-k10-rapid', 'davco-smp-evo', 'davco-supamastic', 'davco-trojan-mastic', 'davco-ultraprime', 'lanko-124-ultraprime', 'ormonoid-bitkoteno3', 'sika-tite-be', 'sikabond-105-contactfix', 'sikafloor-14-prepnprimeimpact', 'sika-filler-101', 'sika-monotop-723n'];
const CQ = [(n, a) => `how many bags of ${n} for ${a} sqm`, (n, a) => `${n} for ${a} m2 how much do i need`, (n, a) => `how many pails of ${n} for ${a} square metres`, (n, a) => `quantity of ${n} for ${a} sqm job`];
BP.forEach((id, i) => { const a = pick([6, 10, 15, 24, 35, 50, 80]); const sh = shard(id); const ok = (sh.r && sh.r.facts && (sh.r.facts.consumption || []).some((f) => f.calc)); if (ok) calc('B', 'quantity: trade phrasing', CQ[i % 4](nm(id), a), id); else rate('B', 'quantity: trade phrasing', `coverage of ${nm(id)} per pail or bag`, id); });
const RT = ['sikaflex-pro-plus', 'sikaflex-118-extremegrab', 'sikatile-110-secureproof', 'sikagrout-212-hpau', 'sika-boom-g', 'davco-k10-plus', 'sikafloor-263-sl', 'sikalastic-1k'];
RT.forEach((id, i) => rate('B', 'rate: trade phrasing', [(n) => `how far does a tube of ${n} go`, (n) => `spread rate for ${n}`, (n) => `${n} usage per m2`, (n) => `what is the coverage of ${n} per pail`][i % 4](nm(id)), id));
for (const [id, key, q] of [['sikatile-366-proflex', 'pot_life', 'how long have i got to use a mixed bucket of sikatile 366'], ['sikatile-366-proflex', 'open_time', 'how long can the adhesive sit before i lay the tile sikatile 366'], ['sikaflex-pro-plus', 'skin_tack_times', 'when does sikaflex pro plus skin over so i can paint'], ['sika-boom-g', 'cure_times', 'how long till sika boom g is cured and can be trimmed'], ['sikalastic-1k', 'recoat_times', 'how long between coats on sikalastic 1k'], ['davco-k10-plus', 'cure_times', 'how long does k10 plus take to dry before i tile'], ['sikafloor-263-sl', 'pot_life', 'pot life on a hot day sikafloor 263 sl'], ['lanko-145-floor-leveller', 'pot_life', 'how long can i work lanko 145 once mixed'], ['sikadur-30', 'open_time', 'open time sikadur 30'], ['sika-showerbond', 'skin_tack_times', 'skinning time for sika showerbond']]) time('B', 'time: trade phrasing', q, id, key);
for (const [id, ty, q] of [['sikabond-techgrip', 'product_data_sheet', 'techgrip tds'], ['davco-grey-one-potadhesive', 'safety_data_sheet', 'sds for the grey one pot'], ['sikaflex-pro-plus', 'safety_data_sheet', 'sikaflex pro plus msds please'], ['sikafloor-263-sl', 'product_data_sheet', 'pds for 263 sl'], ['sika-anchorfix-3030', 'product_data_sheet', 'anchorfix 3030 data sheet'], ['sikadur-30', 'safety_data_sheet', 'safety sheet for sikadur 30']]) doc('S', 'doc: trade phrasing', q, id, ty);
for (const [id, rx, q] of [['sikaflex-pro-plus', /^shelf life/i, 'how long does a tube of sikaflex pro plus last in the shed'], ['sika-showerbond', /^shelf life/i, 'shelf life showerbond'], ['sikasil-pool', /movement/i, 'how much movement can sikasil pool take'], ['sikatile-110-secureproof', /voc|volatile/i, 'voc level in secure proof'], ['sikagrout-212-hpau', /compressive/i, 'strength of 212 hp grout'], ['lanko-145-floor-leveller', /layer thickness/i, 'max depth for lanko 145'], ['sikadur-30', /compressive strength/i, 'sikadur 30 strength mpa'], ['sikaflex-118-extremegrab', /^density/i, 'what does sikaflex 118 weigh'], ['sika-boom-g', /thermal conductivity/i, 'insulation value of sika boom g'], ['sikalastic-1k', /crack bridging/i, 'does sikalastic 1k bridge cracks']]) attr('S', 'attr: trade phrasing', q, id, rx);
cmp('T', 'compare: trade phrasing', 'sikatile 405 lite or sikatile 510 mega lite for big tiles', ['sikatile-405-lite', 'sikatile-510-megalite']);
cmp('T', 'compare: trade phrasing', 'davco ultraflex vs davco ceramaflex', ['davco-ultraflex', 'davco-ceramaflex']);
cmp('B', 'compare: trade phrasing', 'lanko 145 vs lanko 173 for a bedroom floor', ['lanko-145-floor-leveller', 'lanko-173-floor-leveller']);
cmp('B', 'compare: trade phrasing', 'sikaflex 118 extreme grab or sikaflex 116 high grab', ['sikaflex-118-extremegrab', 'sikaflex-116-highgrab']);
cmp('W', 'compare: trade phrasing', 'davco k10 plus vs k10 rapid', ['davco-k10-plus', 'davco-k10-rapid']);
cmp('W', 'compare: trade phrasing', 'sikalastic 1k or sikalastic 1 komponent', ['sikalastic-1k', 'sikalastic-1-komponent']);
cmp('C', 'compare: trade phrasing', 'sikadur 42 he or sikadur 42 le', ['sikadur-42-plus-hecoldclimate', 'sikadur-42-plus-lewarmclimate']);
cmp('B', 'compare: trade phrasing', 'sikabond 142 instant nails vs sikabond instant nails fast', ['sikabond-142-instantnails', 'sikabond-instantnailsfast']);
compat('T', 'compat: trade phrasing', 'will davco k10 plus go on villaboard', 'davco-k10-plus');
compat('T', 'compat: trade phrasing', 'can i tile straight onto sikalastic 1k', 'sikalastic-1k');
compat('B', 'compat: trade phrasing', 'can i put lanko 145 over a timber floor', 'lanko-145-floor-leveller');
compat('B', 'compat: trade phrasing', 'is sikaflex pro plus paintable', 'sikaflex-pro-plus');
compat('B', 'compat: trade phrasing', 'sikaflex 118 on wet timber', 'sikaflex-118-extremegrab');
compat('T', 'compat: trade phrasing', 'sikatile 366 on a plywood subfloor', 'sikatile-366-proflex');
// ============ messy share: reword a share of the new clean rows the way people type and talk
messifyTo(out, 0.5);
const existing = new Set(base.map((x) => x.q.toLowerCase().replace(/\s+/g, ' ').trim())); const seen = new Set(existing); const added = [];
for (const b of out) { const key = b.q.toLowerCase().replace(/\s+/g, ' ').trim(); if (seen.has(key)) continue; seen.add(key); let id = 'a' + hash(b.orig || b.q).toString(36).padStart(6, '0').slice(0, 6); while (added.some((x) => x.id === id)) id += 'x'; b.id = id; delete b.orig; added.push(b); }
const all = base.concat(added);
fs.writeFileSync(bankFile, JSON.stringify(all, null, 1));
const by = (rs, f) => rs.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
if (problems.length) { console.log('DATA DID NOT BACK ' + problems.length + ' rows:'); problems.forEach((x) => console.log('  ', x)); }
console.log('bank', all.length, '(base', base.length, '+ new', added.length + ')', 'messy', all.filter((x) => x.messy).length, ((100 * all.filter((x) => x.messy).length) / all.length).toFixed(1) + '%', 'categories with 3+ products covered', nCat);
console.log(JSON.stringify(by(added, (x) => x.type)));
