// gen_wave2b.mjs: writes demo-tests/sika-brain/coverage/wave2b.json, the wave 2b question file (numeric ranking, product-less quantities, recommend -> quantity -> cart chains).
// Deterministic (no randomness). Items use the bank format so the existing judge, run_coverage.mjs and the unit_coverage bank gate read them unchanged:
// type 'list' with an allowed-product selector (a product outside it is WRONG), type 'nodata' for the price asks (must be declined). exp2 holds the strict expectation read by t_bank.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'sika-brain', 'coverage', 'wave2b.json');
const ADH = ['c:tile-stone-installationsystems/tile-adhesives', 'i:sikaceram-880-easyepoxy'];
const SCREED = ['i:sikafloor-4020-fiberlevel,sikafloor-level-pro,sikafloor-level-top,sikafloor-level-ultra,sikafloor-level-eco,lanko-189-bulk-fillscreed,sikafloor-215-rapidscreed,lanko-145-floor-leveller,lanko-173-floor-leveller,sikafloor-050-rampandpatch,sika-level-skimcoat'];
const MORTAR = ['c:concrete-repair-protection/concrete-repair-mortars', 'c:concrete-repair-protection/corrosion', 'c:concrete-repair-protection/concrete-mortarsadmixtures', 'c:flooring', 'c:grouts-anchoring', 'c:waterproofing'];
const GROUT = ['c:tile-stone-installationsystems/tile-grouts', 'c:tile-stone-installationsystems/tile-care-and-cleaners', 'c:grouts-anchoring'];
const SEAL = ['c:sealants-adhesives'];
const WP = ['c:tile-stone-installationsystems/waterproofing', 'c:waterproofing', 'c:roofing', 'c:tile-stone-installationsystems', 'c:concrete-repair-protection', 'c:flooring'];
const ANY = ['c:construction', 'c:industry'];
const items = []; let n = 0;
const add = (o) => { n++; items.push({ persona: o.persona, category: o.category, q: o.q, type: o.type, exp: o.exp, exp2: o.exp2, id: 'w2b' + String(n).padStart(3, '0'), split: 'tuned', ...(o.messy ? { messy: o.messy } : {}), ...(o.turns ? { turns: o.turns } : {}) }); };
// ---- A. numeric ranking: three phrasings per combination (clean, casual, messy)
const RANK = [
  { cat: 'tile adhesive', field: 'open_time', dir: 'max', allowed: ADH, ph: ['which tile adhesive has the longest open time', 'tile adhesive with the longest open time', 'whats the tile adhesive with longest open time'] },
  { cat: 'tile adhesive', field: 'pot_life', dir: 'max', allowed: ADH, ph: ['which tile adhesive has the longest pot life', 'longest pot life tile adhesive', 'tile adhesive longest pot lyfe'] },
  { cat: 'screed', field: 'layer', dir: 'max', allowed: SCREED, ph: ['which screed has the thickest layer', 'which levelling compound can go thickest', 'thickest layer screed'] },
  { cat: 'screed', field: 'cure_time', dir: 'min', allowed: SCREED, ph: ['which screed is the fastest setting', 'fastest curing levelling compound', 'quickest set screed'] },
  { cat: 'repair mortar', field: 'compressive', dir: 'max', allowed: MORTAR, ph: ['which repair mortar has the highest compressive strength', 'highest compressive strength concrete repair mortar', 'strongest repair mortar'] },
  { cat: 'repair mortar', field: 'cure_time', dir: 'min', allowed: MORTAR, ph: ['which repair mortar sets fastest', 'fastest curing patching mortar', 'quickest setting concrete repair mortar'] },
  { cat: 'grout', field: 'shelf_life', dir: 'max', allowed: GROUT, ph: ['which grout has the longest shelf life', 'grout with the longest shelf life', 'longest shelf life tile grout'] },
  { cat: 'sealant', field: 'movement', dir: 'max', allowed: SEAL, ph: ['which sealant has the most movement capability', 'sealant with the highest movement capability', 'most flexible sealant movement capability'] },
  { cat: 'sealant', field: 'cure_rate', dir: 'max', allowed: SEAL, ph: ['fastest curing sealant', 'which sealant cures fastest', 'quickest curing silicone sealant'] },
  { cat: 'waterproofing', field: 'voc', dir: 'min', allowed: WP, ph: ['which waterproofing membrane has the lowest voc', 'lowest voc waterproofing', 'waterproofing with lowest voc content'] },
  { cat: 'primer', field: 'voc', dir: 'min', allowed: ['c:tile-stone-installationsystems', 'c:flooring', 'c:sealants-adhesives', 'c:concrete'], ph: ['which primer has the lowest voc', 'lowest voc primer', 'primer with the lowest voc'] },
  { cat: 'any', field: 'compressive', dir: 'max', allowed: ANY, ph: ['which product has the highest compressive strength', 'highest compressive strength of all your products', 'strongest product compressive strength'] },
  { cat: 'any', field: 'voc', dir: 'min', allowed: ANY, ph: ['which product has the lowest voc', 'what has the lowest voc content', 'lowest voc in the range'] },
];
for (const r of RANK) r.ph.forEach((q, i) => add({ persona: 'specifier', category: 'numeric ranking: ' + r.cat, q, type: 'list', exp: { allowed: r.allowed, min: 2 }, exp2: { shape: 'rank', field: r.field, dir: r.dir }, messy: i === 2 ? 'typo' : '' }));
// ---- B. price is never ranked
for (const q of ['cheapest tile adhesive', 'which sealant is the cheapest', 'what is the lowest price grout', 'best price screed', 'cheapest waterproofing membrane']) add({ persona: 'diyer', category: 'price declined', q, type: 'nodata', exp: {}, exp2: { shape: 'decline' } });
// ---- C. product-less quantities
const ADHQ = [['how much adhesive for 15 m2 of 600x600 tiles', 15], ['how much tile adhesive do i need for 20 m2', 20], ['how much adhesive for 8 m2 of floor tiles', 8], ['how many bags of tile adhesive for 30 m2', 30], ['quantity of adhesive for 50 square metres of large format porcelain', 50], ['how much adhesive for a 12 m2 bathroom floor', 12], ['adhesive needed for 25 m2 of tiles', 25], ['how much glue for 40 m2 of tiles', 40], ['how much tile adhesive for 100 m2 of porcelain tiles', 100], ['hw much adhesive for 18 m2 tiles', 18]];
for (const [q, a] of ADHQ) add({ persona: 'tiler', category: 'quantity without a product: tile adhesive', q, type: 'list', exp: { allowed: ADH, min: 2 }, exp2: { shape: 'qty', area: a, thickness: null } });
const SCQ = [['how many bags of leveller for 100 m2 at 5 mm', 100, 5], ['how much screed do i need for 40 m2 at 10 mm', 40, 10], ['how many bags of levelling compound for 25 m2 at 3 mm', 25, 3], ['how much self levelling compound for 60 m2 at 4 mm', 60, 4], ['floor leveller for 30 m2 at 6 mm how many bags', 30, 6], ['how many bags of leveller for 80 m2 at 8 mm', 80, 8], ['how much floor leveller for 15 m2 at 2 mm', 15, 2], ['bags of screed for 200 m2 at 5 mm', 200, 5]];
for (const [q, a, t] of SCQ) add({ persona: 'builder', category: 'quantity without a product: thickness-aware screed', q, type: 'list', exp: { allowed: SCREED, min: 2 }, exp2: { shape: 'qty', area: a, thickness: t } });
// ---- D. chains: describe the job, ask for a recommendation, ask for a quantity, add to the project
const CH = [
  ['best adhesive for large format tiles', 40, ADH], ['what adhesive for porcelain tiles on a concrete floor inside', 25, ADH], ['best tile adhesive for a bathroom floor', 12, ADH], ['adhesive for natural stone tiles', 30, ADH], ['what adhesive do i use for outdoor tiles on a balcony', 18, ADH],
  ['best adhesive for floor tiles', 60, ADH], ['tile adhesive for mosaic tiles', 6, ADH], ['best adhesive for large format porcelain outside', 35, ADH], ['what adhesive for wall tiles in a kitchen splashback', 4, ADH], ['best tile glue for a heated floor', 22, ADH],
  ['best screed for a big job', 150, SCREED], ['what do i pour on an uneven concrete floor', 45, SCREED], ['best levelling compound for thick layers', 70, SCREED], ['what screed for a large floor', 120, SCREED], ['best floor leveller for a pump job', 90, SCREED],
  ['best levelling compound for timber floors', 35, SCREED], ['what do i pour to level a slab before vinyl', 50, SCREED], ['best screed for a warehouse floor', 300, SCREED], ['what leveller for a bathroom floor before tiling', 10, SCREED], ['best screed for heated floors', 28, SCREED],
];
CH.forEach(([q, a, al], i) => add({ persona: i < 10 ? 'tiler' : 'builder', category: 'chain: recommend then quantity then cart', q, type: 'list', exp: { allowed: al, min: 1 }, exp2: { shape: 'chain', area: a, thickness: i >= 10 ? 5 : null, kind: i < 10 ? 'tile_adhesive' : 'screed' }, turns: ['recommend me one', `how much for ${a} m2${i >= 10 ? ' at 5 mm' : ''}`, 'add it to my project'] }));
const text = JSON.stringify(items, null, 1) + '\n';
if (process.argv.includes('--check')) { const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text; console.log(same ? 'PASS wave2b.json is current' : 'FAIL wave2b.json differs from its generator'); process.exit(same ? 0 : 1); }
fs.writeFileSync(OUT, text);
console.log('wave2b.json', items.length, 'questions:', Object.entries(items.reduce((m, x) => ((m[x.exp2.shape] = (m[x.exp2.shape] || 0) + 1), m), {})).map(([k, v]) => k + ' ' + v).join(', '));
