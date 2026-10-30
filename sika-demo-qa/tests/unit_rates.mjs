// unit_rates.mjs: unit tests for the rate parser, pack parser and quote arithmetic, plus a sweep over every real Consumption text.
import { parseRates, parsePacks, productRates, canonUnit } from '../src/rates.js';
import { quoteProduct } from '../src/quote.js';
import { check, summary, load } from './_load.mjs';

const near = (a, b) => Math.abs(a - b) < 1e-6;
const one = (t) => parseRates(t);
let r;

r = one('10 Litres of Davco® Grey One Pot adhesive cover approximately 7.5m2 (based on a 6mm notched trowel)');
check('coverage per volume', r.length === 1 && r[0].kind === 'per_area' && r[0].unit === 'L' && near(r[0].low, 10 / 7.5) && near(r[0].high, 10 / 7.5), JSON.stringify(r));
check('coverage basis keeps trowel', /6mm notched trowel/.test(r[0].basis), r[0].basis);

r = one('Approximately 6-7m2 per bag with a 10mm notched trowel.');
check('area per bag range', r.length === 1 && r[0].kind === 'area_per_pack' && r[0].low === 6 && r[0].high === 7 && r[0].pack === 'bag', JSON.stringify(r));
check('area per bag basis', /10mm notched trowel/.test(r[0].basis));

r = one('The consumption of Sikadur®-31 CF Normal is ~ 1.9 kg/m2 per mm of thickness.');
check('kg/m2 per mm', r.length === 1 && r[0].unit === 'kg' && r[0].perMm && near(r[0].low, 1.9), JSON.stringify(r));

r = one('~0.25 - 0.35 kg/m2');
check('range kg/m2', r.length === 1 && near(r[0].low, 0.25) && near(r[0].high, 0.35) && !r[0].perMm, JSON.stringify(r));

r = one('This depends on the substrate roughness; as a guide: ~1,2 kg/m2/mm');
check('decimal comma and slash mm', r.length === 1 && near(r[0].low, 1.2) && r[0].perMm, JSON.stringify(r));

r = one('As a guide, ~ 15.6 kg of powder per cm thick per m2');
check('per cm thick converts to per mm', r.length === 1 && near(r[0].low, 1.56) && r[0].perMm, JSON.stringify(r));

r = one('As a guide, ~ 1.7 kg of powder per m² per mm thick');
check('powder per m2 per mm', r.length === 1 && near(r[0].low, 1.7) && r[0].perMm, JSON.stringify(r));

r = one('4 \u2013 5 m²/litre/coat');
check('m2 per litre per coat inverts and is a range', r.length === 1 && r[0].unit === 'L' && near(r[0].low, 0.2) && near(r[0].high, 0.25) && r[0].perLayer, JSON.stringify(r));

r = one('12L - 4m2 @ 3mm thickness');
check('yield at thickness', r.length === 1 && r[0].perMm && near(r[0].low, 1) && r[0].yieldPerPack && r[0].yieldPerPack.amount === 12, JSON.stringify(r));

r = one('A 4 Litre pail will cover approximately 3m2 with a 6mm notch trowel. A 15 Pail will cover approximately 11m2 with a 6mm notch trowel.');
check('pack covers area (first)', r.length >= 1 && near(r[0].low, 4 / 3), JSON.stringify(r));

r = one('1.0mm DFT- (Dry Film thickness): 7.5m2 per 15L pail\n2m2 per 4L pail');
check('area per stated pack', r.length === 2 && near(r[0].low, 2) && near(r[1].low, 2), JSON.stringify(r));

r = one('Typical dosage for soft concrete production is 350 ml - 1500 ml per 100 kg of total cementitious material.');
check('dosage range per 100 kg', r.length === 1 && r[0].kind === 'per_100kg' && r[0].unit === 'ml' && r[0].low === 350 && r[0].high === 1500, JSON.stringify(r));

r = one('The recommended dosage rate will vary between 10 and 30 litre per cubic meter of concrete.');
check('dosage per m3', r.length === 1 && r[0].kind === 'per_m3' && r[0].unit === 'L' && r[0].low === 10 && r[0].high === 30, JSON.stringify(r));

r = one('coverage is 1 litre/4m2 of surface (undiluted)');
check('litre per 4 m2', r.length === 1 && near(r[0].low, 0.25), JSON.stringify(r));

r = one('Consumption depends on the roughness and is about 500\u20131 000 g/m².');
check('thousands separator and range', r.length === 1 && r[0].unit === 'g' && r[0].low === 500 && r[0].high === 1000, JSON.stringify(r));

r = one('1\u20132 × 0.35\u20130.55 kg/m²');
check('coat multiplier prefix does not corrupt range', r.length === 1 && near(r[0].low, 0.35) && near(r[0].high, 0.55) && /1 to 2 coats/.test(r[0].basis), JSON.stringify(r));

r = one('Joint length [m] per 600 ml foil pack | Joint width [mm] | Joint depth [mm]\n6 | 10 | 10\n4 | 15 | 10\n1.3 | 30 | 15');
check('joint table', r.length === 1 && r[0].kind === 'joint_table' && r[0].rows.length === 3 && r[0].rows[0].width === 10 && r[0].rows[0].depth === 10 && r[0].rows[0].lengths[0] === 6, JSON.stringify(r));

r = one('Use the table below:\nGrout coverage based on 2 Litre pail\nTILE SIZE | 1.5mm Joint | 3mm Joint | 5mm Joint\n300x100x10mm | 14m2 | 7m2 | 4m2');
check('grout area table', r.length === 1 && r[0].kind === 'grout_table' && r[0].mode === 'area_per_pack' && r[0].rows[0].values.join() === '14,7,4' && r[0].rows[0].complete, JSON.stringify(r));

check('no rate in a prose sentence', one('This depends on the substrate roughness and thickness of layer applied.').length === 0);
check('no rate in empty text', one('').length === 0);
check('no invented rate from unrelated numbers', one('Mix 20 kg of powder with 4.1 litres of water. Pot life 30 minutes.').length === 0);
check('canonUnit', canonUnit('Ltr') === 'L' && canonUnit('mls') === 'ml' && canonUnit('gr') === 'g' && canonUnit('KG') === 'kg');

// packs
let k = parsePacks('Available in 1Ltr, 4Ltr or 10Ltr Pail');
check('packs list 1/4/10 L pail', k.map(x => x.size).join() === '1,4,10' && k.every(x => x.unit === 'L' && x.word === 'pail'), JSON.stringify(k));
k = parsePacks('20kg bags - 64 bags per pallet');
check('pack 20 kg bag', k.length === 1 && k[0].size === 20 && k[0].unit === 'kg' && k[0].word === 'bag', JSON.stringify(k));
k = parsePacks('4Ltr & 15Ltr pails');
check('packs 4 and 15 L', k.map(x => x.size).join() === '4,15', JSON.stringify(k));
k = parsePacks('Part A | 13.09 kg containers Part B | 4.0 kg containers Part A+B | 17.09 kg ready to mix units');
check('kit uses A+B size only', k.length === 1 && k[0].size === 17.09, JSON.stringify(k));
k = parsePacks('300 ml cartridge | 12 cartridges per box');
check('cartridge 300 ml', k.length === 1 && k[0].size === 300 && k[0].unit === 'ml' && k[0].word === 'cartridge', JSON.stringify(k));
k = parsePacks('Bulk deliveries 1000 litre IBC 205 litre drum 10 litre container');
check('bulk flagged, small pack not', k.find(x => x.size === 1000).bulk && k.find(x => x.size === 205).bulk && !k.find(x => x.size === 10).bulk, JSON.stringify(k));
check('empty packaging', parsePacks('').length === 0);

// quote arithmetic on synthetic products
const src = { label: 'p', url: 'https://example.test/p' };
const mkp = (packaging, text, label = 'Consumption') => ({ id: 'x', name: 'Test Product', packaging, sections: [{ title: 'Consumption', items: [{ label, text }] }] });
let p = mkp('20kg bags', 'Approximately 6-7m2 per bag');
let q = quoteProduct(p, productRates(p), { area: 40 }, src);
check('area per bag rounds up both ends', q.lines.length === 1 && q.lines[0].packs.startsWith('6 to 7 '), JSON.stringify(q.lines));
q = quoteProduct(p, productRates(p), { area: 42 }, src);
check('exact multiple stays exact (42/7=6, 42/6=7)', q.lines[0].packs.startsWith('6 to 7 '), q.lines[0].packs);
q = quoteProduct(p, productRates(p), { area: 43, allowancePct: 10 }, src);
check('allowance applied and stated', q.lines[0].packs.startsWith('7 to 8 ') && q.assumptions.some(a => /10 percent/.test(a)), JSON.stringify([q.lines[0].packs, q.assumptions]));
q = quoteProduct(p, productRates(p), { area: 40 }, src);
check('default allowance is 0 and shown', q.assumptions.some(a => /0 percent/.test(a)));
p = mkp('Available in 1Ltr, 4Ltr or 10Ltr Pail', '1 litre covers approximately 8-10m2');
q = quoteProduct(p, productRates(p), { area: 30 }, src);
check('range kept as range', /^3 to 3\.75 L/.test(q.lines[0].quantity), q.lines[0].quantity);
check('packs offered for each size, rounded up', /4 to 4 x 1 L|3 to 4 x 1 L/.test(q.lines[0].packs) && /1 x 4 L/.test(q.lines[0].packs) && /1 x 10 L/.test(q.lines[0].packs), q.lines[0].packs);
q = quoteProduct(p, productRates(p), { area: 30, pack: { size: 4, unit: 'L' } }, src);
check('pack choice honoured', /^1 x 4 L pail$/.test(q.lines[0].packs), q.lines[0].packs);
p = mkp('20 kg bag', 'about 1.7 kg of powder per m² per mm thick');
q = quoteProduct(p, productRates(p), { area: 10 }, src);
check('per-mm rate asks for thickness, no guess', q.lines.length === 0 && q.needs.some(n => n.key === 'thickness'));
q = quoteProduct(p, productRates(p), { area: 10, thickness: 10 }, src);
check('per-mm quantity 170 kg and 9 bags', q.lines[0].quantity.startsWith('170 kg') && q.lines[0].packs.startsWith('9 x 20 kg'), JSON.stringify(q.lines[0]));
p = mkp('10 kg pail', 'This depends on the substrate roughness.');
q = quoteProduct(p, productRates(p), { area: 10 }, src);
check('no rate published returns noRate', q.noRate === true && q.lines.length === 0);
p = mkp('Bulk deliveries 1000 litre IBC 10 litre container', 'Typical dosage is 350 ml - 1500 ml per 100 kg of total cementitious material.');
q = quoteProduct(p, productRates(p), { volume: 10 }, src);
check('cementitious dosage asks for cement content', q.lines.length === 0 && q.needs.some(n => n.key === 'cementitious'));
q = quoteProduct(p, productRates(p), { volume: 10, cementitious: 350 }, src);
check('cementitious dosage maths (12.25 to 52.5 L)', /^12\.25 to 52\.5 L/.test(q.lines[0].quantity), q.lines[0].quantity);
p = mkp('600 ml foil pack', 'Joint length [m] per 600 ml foil pack | Joint width [mm] | Joint depth [mm]\n6 | 10 | 10\n4 | 15 | 10');
q = quoteProduct(p, productRates(p), { length: 20, width: 10, depth: 10 }, src);
check('joint table lookup 20 m at 6 m per pack = 4 packs', q.lines.length === 1 && q.lines[0].packs.startsWith('4 x'), JSON.stringify(q.lines));
q = quoteProduct(p, productRates(p), { length: 20, width: 12, depth: 10 }, src);
check('joint size not in table asks, does not interpolate', q.lines.length === 0 && q.needs.length === 1);
q = quoteProduct(p, productRates(p), { area: 5, userRate: { kind: 'per_area', unit: 'kg', low: 1.5, high: 1.5, basis: 'rate supplied by you' } }, src);
check('user supplied rate is used and labelled', q.lines.length === 1 && /rate supplied by you/.test(q.lines[0].basis), JSON.stringify(q.lines));

// sweep over the real data
const data = load();
let withText = 0, parsed = 0, bad = 0, unparsed = [];
for (const prod of data.products) {
  const sec = (prod.sections || []).find(s => s.title === 'Consumption'); if (!sec) continue; withText++;
  const rs = productRates(prod);
  if (rs.length) parsed++; else unparsed.push(prod.id);
  const all = sec.items.map(i => i.text).join('\n');
  for (const x of rs) {
    const vals = [x.low, x.high].filter(v => v != null);
    if (vals.some(v => !Number.isFinite(v) || v < 0) || (x.low != null && x.low > x.high + 1e-9)) { bad++; console.log('  bad numbers', prod.id, JSON.stringify(x)); }
    if (x.kind !== 'joint_table' && x.kind !== 'grout_table' && x.raw) {
      const nums = (s) => (s.replace(/m2|m\u00b2|m3/g, ' ').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d) (\d{3})(?!\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []);
      const src = new Set(nums(all).map(Number)); const miss = nums(x.raw).filter(n => !src.has(Number(n)));
      if (miss.length) { bad++; console.log('  raw numbers not in source', prod.id, x.raw); }
    }
  }
}
check('every parsed rate is finite, non-negative, low <= high and traceable to its text', bad === 0);
console.log(`  real data: ${withText} products with a Consumption section, ${parsed} yield at least one parsed rate, ${unparsed.length} do not (${unparsed.slice(0, 12).join(', ')}${unparsed.length > 12 ? ', ...' : ''})`);
check('parser covers at least 70 percent of real Consumption sections', parsed / Math.max(1, withText) >= 0.7, `${parsed}/${withText}`);
summary('unit_rates');
