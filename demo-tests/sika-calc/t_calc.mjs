// The calculator kinds in lib/finder/gencalc.js (plus the product kinds in calc.js): 40+ real inputs read from plain words and worked, and a mutation per kind.
// Plain Node, no network. usage: node t_calc.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as G from '../../public/demo/sika-210c0c/assets/lib/finder/gencalc.js';
import * as C from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'assets', 'lib', 'finder', 'gencalc.js');
let pass = 0, fail = 0; const kindsSeen = new Set(); let real = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + String(e.message).split('\n')[0]); } };
const near = (a, b, e = 1e-6) => assert(Math.abs(a - b) <= e, a + ' vs ' + b);
// run one typed question through the reader and the matching worker; returns the worked result
function work(q) {
  const u = G.understand(q); assert(u, 'not understood: ' + q); kindsSeen.add(u.kind); real++;
  const f = u.f;
  switch (u.kind) {
    case 'arithmetic': return { u, r: G.evalArithmetic(f.expr) };
    case 'convert': return { u, r: G.convert(f.value, f.from, f.to) };
    case 'perimeter': return { u, r: G.perimeter(f) };
    case 'tiles': return { u, r: G.tiles(f) };
    case 'grout': return { u, r: G.groutVolume(f) };
    case 'sealant': return { u, r: G.sealantVolume(f) };
    case 'bed': return { u, r: G.bedVolume(f) };
    default: return { u, r: null };
  }
}
const CASES = [
  // arithmetic
  ['2.4 x 1.8', 'arithmetic', (r) => near(r.value, 4.32)], ['40 / 1.2', 'arithmetic', (r) => near(r.value, 33.333333, 1e-5)], ['what is 12 + 3 * 2', 'arithmetic', (r) => near(r.value, 18)],
  ['(12 + 3) * 2', 'arithmetic', (r) => near(r.value, 30)], ['calculate 1,200 / 4', 'arithmetic', (r) => near(r.value, 300)], ['3.6 x 2.4 x 0.04', 'arithmetic', (r) => near(r.value, 0.3456, 1e-9)], ['100 - 12.5', 'arithmetic', (r) => near(r.value, 87.5)],
  // conversion
  ['convert 2400 mm to m', 'convert', (r) => near(r.value, 2.4)], ['how many litres in 3 m3', 'convert', (r) => near(r.value, 3000)], ['5 m2 in cm2', 'convert', (r) => near(r.value, 50000)], ['1500 ml to l', 'convert', (r) => near(r.value, 1.5)],
  ['25 kg in g', 'convert', (r) => near(r.value, 25000)], ['2.5 t to kg', 'convert', (r) => near(r.value, 2500)], ['60 cm to mm', 'convert', (r) => near(r.value, 600)], ['how many mm in 1.2 m', 'convert', (r) => near(r.value, 1200)],
  // perimeter
  ['perimeter of a 3.2 x 2.4 room', 'perimeter', (r) => { near(r.value, 11.2); near(r.area, 7.68); }], ['perimeter of a 5 x 4 m room', 'perimeter', (r) => near(r.value, 18)], ['skirting for a 3.6 x 2.4 m bathroom', 'perimeter', (r) => near(r.value, 12)],
  ['perimeter of a 3 x 3 m room minus 0.9 m', 'perimeter', (r) => near(r.value, 11.1)],
  // tiles
  ['how many tiles for 20 m2 of 600x600 tiles', 'tiles', (r) => assert.equal(r.count, 56)], ['how many tiles for a 3.6 x 2.4 m bathroom with 300x600 tiles and 10% cuts', 'tiles', (r) => { assert.equal(r.countBeforeCuts, 48); assert.equal(r.count, 53); }],
  ['how many 300x300 tiles for 10 m2', 'tiles', (r) => assert.equal(r.count, 112)], ['how many tiles do I need for 12 m2 with 600 x 300 tiles and 3 mm joints', 'tiles', (r) => assert.equal(r.count, ceilTiles(12, 603, 303))],
  ['number of tiles for 7.5 m2 of 450x450 tiles', 'tiles', (r) => assert.equal(r.count, 38)],
  // grout
  ['how much grout for 20 m2 of 600x600 tiles with 3 mm joints, 10 mm thick tiles', 'grout', (r) => near(r.litres, 2)], ['how much grout for 10 m2 of 300x300 tiles with 3 mm joints and 8 mm thick tiles', 'grout', (r) => near(r.litres, 1.6)],
  ['grout volume for 25 m2 of 600x300 tiles 2 mm joints 10 mm thick', 'grout', (r) => near(r.litres, 25 * (900 / 180000) * 2 * 10, 1e-3)], ['how much grout for 5 m2 of 100x100 tiles with 5 mm joints and 6 mm thick tiles', 'grout', (r) => near(r.litres, 5 * (200 / 10000) * 5 * 6, 1e-3)],
  ['how much grout for 20 m2 of 600x600 tiles with 3 mm joints, 10 mm thick tiles and 10% waste', 'grout', (r) => near(r.litres, 2.2)],
  // sealant
  ['how much sealant for 12 m of 10 x 5 mm joint', 'sealant', (r) => near(r.ml, 600)], ['how many cartridges of sealant for 12 m of 10 x 5 mm joint with 300 ml cartridges', 'sealant', (r) => assert.equal(r.packs.count, 2)],
  ['how much silicone for 20 m of 6 x 6 mm joint', 'sealant', (r) => near(r.ml, 720)], ['movement joint sealant, how much for 8 m of 20 x 10 mm joint with 600 ml sausages', 'sealant', (r) => { near(r.ml, 1600); assert.equal(r.packs.count, 3); }],
  ['how much sealant for the perimeter of a 3 x 3 m room with a 6 x 6 mm joint', 'sealant', (r) => near(r.ml, 12 * 36, 1e-6)],
  ['how much sealant for 15 m of 8 x 8 mm joint', 'sealant', (r) => near(r.ml, 960)], ['how many tiles for 30 m2 of 800x800 tiles', 'tiles', (r) => assert.equal(r.count, 47)], ['convert 3 cm to mm', 'convert', (r) => near(r.value, 30)],
  // bed
  ['how much screed for 12 m2 at 40 mm thick', 'bed', (r) => { near(r.m3, 0.48); near(r.litres, 480); }], ['how much leveller for 30 m2 at 5 mm thick', 'bed', (r) => near(r.m3, 0.15)],
  ['mortar bed volume for 8 m2 at 20 mm thick', 'bed', (r) => near(r.m3, 0.16)], ['how many litres of screed for 15 m2 at 50 mm thick', 'bed', (r) => near(r.litres, 750)],
];
function ceilTiles(a, l, w) { return Math.ceil(a / (l * w / 1e6) - 1e-9); }
for (const [q, kind, chk] of CASES) t(q, () => { const { u, r } = work(q); assert.equal(u.kind, kind, 'kind ' + u.kind); assert(r.ok, 'refused: ' + r.reason); chk(r); assert(r.estimate && r.estimate.includes('Estimate only, not an offer'), 'estimate sentence'); assert(r.citation, 'citation'); });
t(`40+ real inputs (${CASES.length})`, () => assert(CASES.length >= 40, String(CASES.length)));
t('tile 600x600 20 m2 is exactly 55.56 -> 56', () => near(G.tiles({ area: 20, tileL: 600, tileW: 600 }).exact, 55.556, 1e-3));
t('cuts allowance only when given', () => { assert.equal(G.tiles({ area: 20, tileL: 600, tileW: 600 }).cutsPct, 0); assert.equal(G.tiles({ area: 20, tileL: 600, tileW: 600, cutsPct: 10 }).count, 62); });
t('boxes only when tiles per box given', () => { assert.equal(G.tiles({ area: 20, tileL: 600, tileW: 600 }).box, null); assert.equal(G.tiles({ area: 20, tileL: 600, tileW: 600, perBox: 4 }).box.boxes, 14); });

// missing input: refused with the field name so the bot asks ONE question; every question offers a recommended chip
t('grout without thickness asks thickness', () => { const u = G.understand('how much grout for 20 m2 of 600x600 tiles with 3 mm joints'); assert.equal(u.kind, 'grout'); const r = G.groutVolume(u.f); assert.equal(r.ok, false); assert.equal(r.need, 'thickness'); });
t('grout without joint asks joint', () => { const r = G.groutVolume({ area: 10, tileL: 600, tileW: 600, thicknessMm: 10 }); assert.equal(r.need, 'joint'); });
t('sealant without depth asks depth', () => { const r = G.sealantVolume({ lengthM: 12, widthMm: 10 }); assert.equal(r.need, 'depth'); });
t('every ASK has a recommended chip first', () => { for (const [k, a] of Object.entries(G.ASK)) { assert(a.options[0].recommended === true, k); assert(/recommended/.test(a.options[0].label), k); assert(a.options.length >= 2, k); } });
t('a chip value is understood by the reader', () => { const u = G.understand('how much grout for 20 m2 of 600x600 tiles with 3 mm joints ' + G.ASK.thickness.options[0].value); assert.equal(u.f.thicknessMm, 10); });
t('a sum with letters is refused', () => { assert.equal(G.evalArithmetic('2 + abc').ok, false); assert.equal(G.evalArithmetic('process.exit()').ok, false); assert.equal(G.evalArithmetic('5 / 0').ok, false); });
t('conversion across kinds is refused with a reason', () => { const r = G.convert(3, 'm', 'kg'); assert.equal(r.ok, false); assert(/different things/.test(r.reason)); });
t('bags are not a unit (they need a pack size)', () => { const r = G.convert(3, 'bags', 'kg'); assert.equal(r.ok, false); assert(/pack size/.test(r.reason)); });

// published ratios and windows (real data)
const shard = (id) => JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'brain', 'p', id + '.json'), 'utf8'));
t('mixing water from a published ratio: SikaTile-510 MegaLite, 2 bags = 12 L to 13 L', () => { const f = shard('sikatile-510-megalite').r.facts.mix_ratio[0]; const ratio = G.waterRatio({ text: f.text, parsed: f.parsed }); const r = G.mixWater(ratio, { bags: 2 }); near(r.lowL, 12); near(r.highL, 13); assert.equal(r.range, true); real++; kindsSeen.add('mixwater'); });
t('mixing water from the sentence alone: SikaTile-374 MegaPro 20 kg bag, 1 bag', () => { const f = shard('sikatile-374-megapro').r.facts.mix_ratio[0]; const ratio = G.waterRatio({ text: f.text, parsed: null }); near(ratio.perKg, 20); near(G.mixWater(ratio, { bags: 1 }).highL, 7); real++; });
t('mixing water for a mass: 27 kg is the same as 2 bags of 13.5 kg', () => { const ratio = { lo: 6, hi: 6.5, perKg: 13.5 }; near(G.mixWater(ratio, { powderKg: 27 }).lowL, 12); });
t('no powder asks for it', () => assert.equal(G.mixWater({ lo: 6, hi: 6.5, perKg: 13.5 }, {}).need, 'powder'));
t('timeline sums published windows: recoat 8 to 12 h plus cure 24 h', () => {
  const rec = shard('sikatop-armatec-110epocem').tm.recoat_times.find((r) => r.parsed.at_c === 5); const w1 = G.windowHours(rec.parsed.columns[0]);
  const cure = shard('sikatile-510-megalite').tm.cure_times[0]; const w2 = G.windowHours(cure.parsed.columns[0]);
  const r = G.timeline([{ label: 'recoat', lo: w1.lo, hi: w1.hi }, { label: 'grout wait', lo: w2.lo, hi: w2.hi }]); near(r.lowH, 32); near(r.highH, 36); near(r.highDays, 1.5); assert.equal(r.range, true); real += 2; kindsSeen.add('timeline');
});
t('hoursText: 72 h reads as days, 30 minutes as minutes', () => { assert.equal(G.hoursText(72), '3 days'); assert.equal(G.hoursText(0.5), '30 minutes'); });
t('product kinds still run through calc.js (area and dose)', () => {
  const r = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'finder', 'r', 'sikarapid-4.json'), 'utf8')); const q = C.quantity(C.normaliseFact(r.consumption[0]), { cementKg: 1000 }); near(q.low, 4); near(q.high, 20);
  const d = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'finder', 'r', 'davco-grey-one-potadhesive.json'), 'utf8')); near(C.work(C.normaliseFact(d.consumption[0]), d.packs, { area: 20 }).high, 26.67, 0.01); real += 2; kindsSeen.add('product');
});
t('result text reads each kind', () => { assert.equal(G.resultText('tiles', { count: 56 }), '56 tiles'); assert.equal(G.resultText('mixwater', { low_l: 12, high_l: 13 }), '12 L to 13 L'); assert.equal(G.resultText('grout', { litres: 2 }), '2 L of grout'); assert.equal(G.resultText('arithmetic', { value: 1200 }), '1,200'); });
t('rerun matches the first run for every pure kind', () => {
  const a = G.rerun('grout', { area: 20, tileL: 600, tileW: 600, jointMm: 3, thicknessMm: 10 }); near(a.result.litres, 2);
  const b = G.rerun('grout', { area: 20, tileL: 600, tileW: 600, jointMm: 3, thicknessMm: 12 }); near(b.result.litres, 2.4);
  near(G.rerun('tiles', { area: 20, tileL: 600, tileW: 600 }).result.count, 56); near(G.rerun('perimeter', { length: 3, width: 3 }).result.value, 12); near(G.rerun('bed', { area: 10, thicknessMm: 10 }).result.m3, 0.1);
  near(G.rerun('sealant', { lengthM: 10, widthMm: 10, depthMm: 10 }).result.ml, 1000); near(G.rerun('convert', { value: 1, from: 'm', to: 'mm' }).result.value, 1000); near(G.rerun('arithmetic', { expression: '2 x 3' }).result.value, 6);
  assert.equal(G.rerun('timeline', {}).ok, false);
});
t('every kind of the 9 plus product was exercised', () => { for (const k of [...G.GEN_KINDS, 'product']) assert(kindsSeen.has(k), 'not exercised: ' + k); });

// mutation: break one line per kind in a temp copy and the matching test must fail
async function mutant(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-mut-')); assert(dir.startsWith(os.tmpdir()));
  const s = fs.readFileSync(SRC, 'utf8'); assert(s.includes(from), 'mutation target missing: ' + from);
  fs.copyFileSync(path.join(path.dirname(SRC), 'qty.js'), path.join(dir, 'qty.js')); fs.writeFileSync(path.join(dir, 'g.mjs'), s.replace(from, to));
  const m = await import(pathToFileURL(path.join(dir, 'g.mjs')).href); fs.rmSync(dir, { recursive: true, force: true }); return m;
}
const MUT = [
  ['arithmetic: * becomes +', "v = o === '*' ? v * r : v / r;", "v = o === '*' ? v + r : v / r;", (m) => m.evalArithmetic('2.4 x 1.8').value === 4.32],
  ['convert: factor off', "const v = value * d.u[f] / d.u[t];", "const v = value * d.u[t] / d.u[f];", (m) => m.convert(2400, 'mm', 'm').value === 2.4],
  ['perimeter: forgot to double', "const p = 2 * (length + width) - d;", "const p = (length + width) - d;", (m) => m.perimeter({ length: 3.2, width: 2.4 }).value === 11.2],
  ['tiles: round down', "const raw = a / pitchA; const base = ceil(raw);", "const raw = a / pitchA; const base = Math.floor(raw);", (m) => m.tiles({ area: 20, tileL: 600, tileW: 600 }).count === 56],
  ['grout: depth ignored', "* jointMm * thicknessMm;", "* jointMm;", (m) => m.groutVolume({ area: 20, tileL: 600, tileW: 600, jointMm: 3, thicknessMm: 10 }).litres === 2],
  ['sealant: depth ignored', "const ml = lengthM * widthMm * depthMm * k;", "const ml = lengthM * widthMm * k;", (m) => m.sealantVolume({ lengthM: 12, widthMm: 10, depthMm: 5 }).ml === 600],
  ['bed: mm read as m', "const m3 = area * thicknessMm / 1000 * k;", "const m3 = area * thicknessMm * k;", (m) => m.bedVolume({ area: 12, thicknessMm: 40 }).m3 === 0.48],
  ['mixwater: per-bag scaling dropped', "const lo = ratio.lo * kg / ratio.perKg, hi = ratio.hi * kg / ratio.perKg;", "const lo = ratio.lo * kg, hi = ratio.hi * kg;", (m) => m.mixWater({ lo: 6, hi: 6.5, perKg: 13.5 }, { bags: 2 }).lowL === 12],
  ['timeline: sums only the first step', "const lo = steps.reduce((s, x) => s + x.lo, 0), hi = steps.reduce((s, x) => s + x.hi, 0);", "const lo = steps[0].lo, hi = steps[0].hi;", (m) => m.timeline([{ label: 'a', lo: 8, hi: 12 }, { label: 'b', lo: 24, hi: 24 }]).lowH === 32],
  ['reader: tile size no longer read', "if (l >= 50 && w >= 50 && l <= 3000", "if (l >= 5000 && w >= 50 && l <= 3000", (m) => !!m.understand('how many tiles for 20 m2 of 600x600 tiles')],
];
for (const [name, from, to, ok] of MUT) { try { const m = await mutant(from, to); t('mutation caught: ' + name, () => assert.equal(!!ok(m), false, 'mutant still passes')); const real0 = ok(G); t('unmutated passes the same check: ' + name, () => assert.equal(!!real0, true)); } catch (e) { fail++; console.log('FAIL mutation ' + name + ' :: ' + e.message.split('\n')[0]); } }
console.log(`INFO real inputs worked: ${real}, kinds: ${[...kindsSeen].sort().join(',')}`);
console.log(`CALC UNIT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
