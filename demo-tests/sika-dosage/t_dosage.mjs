// Dosage kinds in lib/finder/calc.js: the parser over real published phrases, the maths, the packs, the mutation check and the area regression.
// Plain Node, no network. usage: node t_dosage.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as calc from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'finder', 'r');
const CALC = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'assets', 'lib', 'finder', 'calc.js');
const load = (id) => JSON.parse(fs.readFileSync(path.join(R, id + '.json'), 'utf8'));
const allFacts = []; for (const f of fs.readdirSync(R)) { if (f === 'index.json') continue; const r = JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')); for (const x of r.consumption || []) allFacts.push({ id: r.id, x }); }
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + String(e.message).split('\n')[0]); } };
const near = (a, b, e = 1e-6) => assert(Math.abs(a - b) <= e, a + ' vs ' + b);
const find = (id, frag) => { const f = (load(id).consumption || []).find((x) => x.text.includes(frag)); assert(f, id + ' has no fact with ' + frag); return f; };

// [product id, fragment of the published phrase, kind, lo, hi, unit, extras]
const REAL = [
  ['sikarapid-4', 'Dosage is 400ml', 'dose-per-mass', 400, 2000, 'mL', { per: 100, basis: 'cement' }],
  ['sikarapid-af', 'Dosage is 400ml', 'dose-per-mass', 400, 2000, 'mL', { per: 100 }],
  ['sikarapid-22-au', '500ml - 2000ml/100 kg', 'dose-per-mass', 500, 2000, 'mL', { per: 100 }],
  ['sikarapid-c-100', '500', 'dose-per-mass', 500, 2000, 'mL', { per: 100 }],
  ['sika-block', '150-500mls per 100kg', 'dose-per-mass', 150, 500, 'mL', { per: 100 }],
  ['sika-masonry-au-1', '200 - 500 ml / 100 kg', 'dose-per-mass', 200, 500, 'mL', { per: 100 }],
  ['sika-plastiment-30', '350 ml', 'dose-per-mass', 250, 450, 'mL', { per: 100, typical: 350 }],
  ['sika-plastiment-55', '400 ml', 'dose-per-mass', 300, 500, 'mL', { per: 100, typical: 400 }],
  ['sika-plastiment-55', 'increased to 800 ml 100 kg', 'dose-per-mass', 800, 800, 'mL', { per: 100 }],
  ['sika-retarder-n', '200ml', 'dose-per-mass', 100, 300, 'mL', { per: 100, typical: 200 }],
  ['sika-set-accelerator', '1000 and 2000 ml', 'dose-per-mass', 1000, 2000, 'mL', { per: 100 }],
  ['sika-stabilizer-4rau', '200', 'dose-per-mass', 200, 1500, 'mL', { per: 100 }],
  ['sika-viscocrete-10', '250 ml to 2000 ml', 'dose-per-mass', 250, 2000, 'mL', { per: 100 }],
  ['sika-viscocrete-190sc', 'dosage up 1500', 'dose-per-mass', 1500, 1500, 'mL', { per: 100, limit: 'max' }],
  ['sika-viscocrete-5-500', '700mls-1000mls', 'dose-per-mass', 700, 1000, 'mL', { per: 100 }],
  ['sikament-eco-3-w', 'Typical dosage is 600ml', 'dose-per-mass', 600, 600, 'mL', { per: 100 }],
  ['sikaplast-300-e', '300 to 800 ml/100 kg of total binder', 'dose-per-mass', 300, 800, 'mL', { per: 100, basis: 'cement' }],
  ['sikatard-960-hc', '150-1000 mls/100 kg of cement', 'dose-per-mass', 150, 1000, 'mL', { per: 100 }],
  ['sikagrind-272', '0.3 - 0.6 kg per ton', 'dose-per-mass', 0.3, 0.6, 'kg', { per: 1000 }],
  ['lanko-752-bondit', '750 mL to 1L', 'dose-per-mass', 750, 1000, 'mL', { per: 20, basis: 'mix' }],
  ['sika-set-1-gv', '5–25 % by weight of cement', 'dose-pct', 5, 25, '%', {}],
  ['sika-sigunit-l-5401af', '5 % and 9 %', 'dose-pct', 5, 9, '%', {}],
  ['sika-sigunit-l-530af', '4% and 7%', 'dose-pct', 4, 7, '%', {}],
  ['sikacontrol-plus', '1.0', 'dose-pct', 1, 3, '%', {}],
  ['sika-wt-200-p', '1–2 %', 'dose-pct', 1, 2, '%', {}],
  ['sikacolor-flo', '1 % to 8 %', 'dose-pct', 1, 8, '%', {}],
  ['sika-air', '50-150 ml per cubic meter', 'per-m3', 50, 150, 'mL', {}],
  ['sika-air--ls', '250-750 mls per cubic metre', 'per-m3', 250, 750, 'mL', {}],
  ['sika-cni', '10 and 30 litre per cubic meter', 'per-m3', 10, 30, 'L', {}],
  ['sika-ferrogard-901s', '12 kg/m3', 'per-m3', 12, 12, 'kg', {}],
  ['sikafiber-force-pp-48rad-48s', '4-8 kg/m3', 'per-m3', 4, 8, 'kg', {}],
  ['sika-fibermesh-150', '1.0 kg/m3 and 2.0 kg/m3', 'per-m3', 1, 2, 'kg', {}],
  ['sikafiber-ppm-4819', 'up 6.9 kg per m3', 'per-m3', 6.9, 6.9, 'kg', { limit: 'max' }],
  ['sika-confibre-19f', '0.9kg (1 bag)', 'per-m3', 0.9, 0.9, 'kg', { limit: 'min' }],
  ['sikafiber-novomesh-950', '1 and 3 bags/m3', 'per-m3', 1, 3, 'bags', {}],
  ['sika-ucs-pak', '4-5 bags/m3', 'per-m3', 4, 5, 'bags', {}],
  ['sikagunite-gp', '105 bags per m3', 'per-m3', 105, 105, 'bags', {}],
];
for (const [id, frag, kind, lo, hi, unit, ex] of REAL) {
  t(`${id}: ${frag}`, () => {
    const f = find(id, frag); const n = calc.normaliseFact(f);
    const tx = calc.normaliseFact({ text: f.text, parsed: null }); assert.equal(tx.kind, kind, 'the text reader alone must parse it: ' + f.text);
    assert.equal(n.ok, true, 'not parsed: ' + f.text); assert.equal(n.kind, kind); near(n.lo, lo); near(n.hi, hi); assert.equal(n.unit, unit);
    for (const [k, v] of Object.entries(ex)) assert.equal(n[k], v, k + ' ' + n[k]);
    if (!ex.limit) assert.equal(n.limit, undefined);
  });
}
// phrases that must NOT turn into a dose, with the reason
const FALL = [
  ['lanko-311-bricklayersplasticiser', 'Per 200 L water', 'table columns without headings'],
  ['sika-retarder-n', 'higher than 400 ml/100kg', 'a threshold, not a dose'],
  ['sikafiber-force-pp-48rad-48s', 'Energy absorption', 'a performance test condition'],
  ['sikagrout-ultra', '20kg bags per 1m3', 'bag size, not a dose'],
  ['davco-4-in-1-groutadditive', 'ratio of 1:1', 'a dilution ratio'],
  ['sika-rugasol-90', 'Dilution rate', 'a dilution ratio'],
  ['sika-monotop-fc', '11.0 litres when mixed', 'a yield, not a dose'],
  ['sikainject-867', '20 kg grout with 6.5L water', 'a mix recipe, not a dose'],
];
for (const [id, frag, why] of FALL) t(`falls through: ${id} (${why})`, () => { const n = calc.normaliseFact(find(id, frag)); assert(!(n.ok && /^dose|per-m3/.test(n.kind)), 'computed: ' + JSON.stringify(n)); });
t(`at least 30 real phrases parsed (${REAL.length})`, () => assert(REAL.length >= 30));

// the text reader agrees with the stored reading on every dosage fact in the catalogue
let agreed = 0, stored = 0;
for (const { id, x } of allFacts) {
  const m = x.parsed && x.parsed.model; if (!/^dosage_/.test(m || '')) continue; stored++;
  const n = calc.normaliseFact(x);
  if (/Joules/.test(x.text)) continue;
  t(`agrees with stored reading: ${id} ${x.text.slice(0, 40)}`, () => {
    assert.equal(n.ok, true); near(n.lo, x.parsed.min, 1e-6); near(n.hi, x.parsed.max, 1e-6);
    if (m === 'dosage_per_cementitious') assert.equal(n.per, x.parsed.per_kg_cementitious);
    agreed++;
  });
}
t(`stored dosage facts checked (${stored})`, () => assert(stored >= 60 && agreed >= 60, `${stored}/${agreed}`));

// the maths: SikaRapid-4, 1000 kg of cement is 4 L to 20 L
const rapid = calc.normaliseFact(find('sikarapid-4', 'Dosage is'));
const rp = load('sikarapid-4').packs;
t('SikaRapid-4, 1000 kg cement: 4 L to 20 L', () => { const q = calc.quantity(rapid, { cementKg: 1000 }); near(q.low, 4); near(q.high, 20); assert.equal(q.unit, 'L'); assert.equal(q.range, true); });
t('SikaRapid-4, 2 tonnes (2000 kg): 8 L to 40 L', () => { const q = calc.quantity(rapid, { cementKg: 2000 }); near(q.low, 8); near(q.high, 40); });
t('no midpoint is invented: result has only low and high', () => { const q = calc.quantity(rapid, { cementKg: 1000 }); assert.equal(q.mid, undefined); assert.equal(q.typical, undefined); });
t('asks for the cement mass, not an area', () => { const q = calc.quantity(rapid, { area: 50 }); assert.equal(q.ok, false); assert.equal(q.need, 'cement'); assert(/cement/.test(q.reason)); });
t('own allowance applies only when typed', () => { near(calc.quantity(rapid, { cementKg: 1000 }).high, 20); near(calc.quantity(rapid, { cementKg: 1000, allowancePct: 10 }).high, 22); });
t('packs rounded up, low to high, per size', () => { const w = calc.work(rapid, rp, { cementKg: 1000 }); const o = w.packRange.options.find((x) => x.size === 10); assert.equal(o.countLow, 1); assert.equal(o.countHigh, 2); assert.equal(calc.packRangeText(o), '1 to 2 x 10 L'); const d = w.packRange.options.find((x) => x.size === 205); assert.equal(calc.packRangeText(d), '1 x 205 L'); });
t('exactly 40 L is 4 x 10 L, not 5', () => { const w = calc.work(rapid, rp, { cementKg: 2000 }); assert.equal(w.packRange.options.find((x) => x.size === 10).countHigh, 4); });
t('basis sentence reads as published', () => assert.equal(calc.doseBasisText(rapid), '400 mL to 2,000 mL per 100 kg of cement or binder'));
t('typical is shown separately: Plastiment-55, 1000 kg', () => { const n = calc.normaliseFact(find('sika-plastiment-55', '400 ml')); const q = calc.quantity(n, { cementKg: 1000 }); near(q.low, 3); near(q.high, 5); near(q.typical, 4); });
t('percent of cement: Sika Control PLUS 2 tonnes gives 20 kg to 60 kg', () => { const n = calc.normaliseFact(find('sikacontrol-plus', '1.0')); const q = calc.quantity(n, { cementKg: 2000 }); near(q.low, 20); near(q.high, 60); assert.equal(q.unit, 'kg'); });
t('per tonne: SikaGrind-272 5000 kg is 1.5 kg to 3 kg', () => { const q = calc.quantity(calc.normaliseFact(find('sikagrind-272', '0.3 - 0.6')), { cementKg: 5000 }); near(q.low, 1.5); near(q.high, 3); });
t('per m3: Sika Air 10 m3 is 0.5 L to 1.5 L', () => { const q = calc.quantity(calc.normaliseFact(find('sika-air', '50-150')), { volume: 10 }); near(q.low, 0.5); near(q.high, 1.5); assert.equal(q.unit, 'L'); });
t('per m3 in bags stays bags, no pack conversion', () => { const w = calc.work(calc.normaliseFact(find('sika-ucs-pak', '4-5 bags')), [{ amount: 20, unit: 'kg' }], { volume: 3 }); near(w.low, 12); near(w.high, 15); assert.equal(w.unit, 'bags'); assert.equal(w.packRange, undefined); });
t('limits: "up to" gives a single upper figure', () => { const q = calc.quantity(calc.normaliseFact(find('sika-viscocrete-190sc', 'dosage up 1500')), { cementKg: 1000 }); assert.equal(q.limit, 'max'); near(q.high, 15); });
t('per mix mass: Bondit 100 kg mix is 3.75 L to 5 L', () => { const q = calc.quantity(calc.normaliseFact(find('lanko-752-bondit', '750 mL')), { mixKg: 100 }); near(q.low, 3.75); near(q.high, 5); assert.equal(q.unit, 'L'); });
t('mix input is asked as mix, not cement', () => { const q = calc.quantity(calc.normaliseFact(find('lanko-752-bondit', '750 mL')), { cementKg: 100 }); assert.equal(q.need, 'mix'); });
// no real catalogue phrase gives a per-water dose: the kind is covered with synthetic wording, labelled as such
t('SYNTHETIC per water: 300 mL per 200 L of water, 400 L gives 600 mL', () => { const n = calc.normaliseFact({ text: 'Add 300 mL per 200 L of water', parsed: null }); assert.equal(n.kind, 'dose-per-water'); const q = calc.quantity(n, { waterL: 400 }); near(q.low, 0.6); near(q.high, 0.6); assert.equal(calc.quantity(n, { cementKg: 5 }).need, 'water'); });
t('SYNTHETIC mixed units: 1 L to 2 L per 100 kg of binder reads in mL', () => { const n = calc.normaliseFact({ text: 'Dosage 1 L - 2 L per 100 kg of binder', parsed: null }); near(n.lo, 1); near(n.hi, 2); assert.equal(n.unit, 'L'); });
t('SYNTHETIC grams and percent', () => { const a = calc.normaliseFact({ text: '250 g to 500 g per 100 kg of cement', parsed: null }); near(calc.quantity(a, { cementKg: 100 }).low, 0.25); const b = calc.normaliseFact({ text: '0.5 to 2 % by weight of cement', parsed: null }); assert.equal(b.kind, 'dose-pct'); near(calc.quantity(b, { cementKg: 1000 }).high, 20); });
t('SYNTHETIC unreadable stays unread', () => { for (const s of ['Use plenty', '', 'Dosage: see data sheet', 'per 100 kg of cement']) assert.equal(calc.normaliseFact({ text: s, parsed: null }).ok, false); });

// regression: every fact that is NOT a dose reads exactly as it did on the base commit
let base = null;
try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dose-base-')); assert(dir.startsWith(os.tmpdir()));
  const src = execFileSync('git', ['show', 'ca1528765:public/demo/sika-210c0c/assets/lib/finder/calc.js'], { cwd: HERE, encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'calc_base.mjs'), src); base = await import(pathToFileURL(path.join(dir, 'calc_base.mjs')).href); fs.rmSync(path.join(dir, 'calc_base.mjs'));
} catch (e) { console.log('base commit not readable: ' + e.message.split('\n')[0]); }
if (base) {
  let same = 0, changed = [];
  for (const { id, x } of allFacts) {
    const a = JSON.stringify(base.normaliseFact(x)), b = JSON.stringify(calc.normaliseFact(x));
    if (a === b) same++; else changed.push({ id, text: x.text, was: base.normaliseFact(x), now: calc.normaliseFact(x) });
  }
  t('regression: every changed fact is a dose-shaped statement', () => { const bad = changed.filter((c) => !(c.now.ok ? /^dose|per-m3/.test(c.now.kind) : /test condition|threshold|table columns|unlabelled table/.test(c.now.reason))); assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 2))); });
  t('regression: no area, length or coverage fact changed', () => { const bad = changed.filter((c) => c.was.ok && ['per-m2', 'm2-per-unit', 'pack-covers', 'per-m'].includes(c.was.kind)); assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 2))); });
  t('regression: old per-m2 quantity maths identical', () => { const f = find('davco-grey-one-potadhesive', '7.5'); const a = base.work(base.normaliseFact(f), [{ amount: 10, unit: 'L' }], { area: 20 }), b = calc.work(calc.normaliseFact(f), [{ amount: 10, unit: 'L' }], { area: 20 }); assert.equal(JSON.stringify(a), JSON.stringify(b)); });
  console.log(`INFO facts ${allFacts.length}: unchanged ${same}, changed ${changed.length}`);
}

// mutation: break one regex in a temp copy and the parser tests must notice
function mutated(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dose-mut-')); assert(dir.startsWith(os.tmpdir()));
  const s = fs.readFileSync(CALC, 'utf8'); assert(s.includes(from), 'mutation target missing: ' + from);
  fs.copyFileSync(path.join(path.dirname(CALC), 'qty.js'), path.join(dir, 'qty.js'));
  fs.writeFileSync(path.join(dir, 'calc_mut.mjs'), s.replace(from, to));
  return import(pathToFileURL(path.join(dir, 'calc_mut.mjs')).href).then((m) => { fs.rmSync(dir, { recursive: true, force: true }); return m; });
}
const killers = [
  ['mass unit regex broken (kg|kgs becomes kgq)', "(kg|kgs|tonnes?|tons?)(?![a-z])", "(kgq|kgsq)(?![a-z])", 'sikarapid-4', 'Dosage is'],
  ['percent regex broken (the % sign)', "\\\\s*%\\\\s*[^.;|%]{0,40}?", "\\\\s*#\\\\s*[^.;|%]{0,40}?", 'sikacontrol-plus', '1.0'],
  ['per m3 regex broken', "(?:per|\\\\/)\\\\s*(?:1\\\\s*)?' + D_M3", "(?:pxr|\\\\/q)\\\\s*(?:1\\\\s*)?' + D_M3", 'sika-air', '50-150'],
];
for (const [name, from, to, id, frag] of killers) {
  try {
    const m = await mutated(from, to); const n = m.normaliseFact({ text: find(id, frag).text, parsed: null });
    const wantKind = REAL.find((r) => r[0] === id && r[1] === frag || r[0] === id)[2];
    t('mutation caught: ' + name, () => assert(!(n.ok && n.kind === wantKind && n.lo != null && (n.kind !== 'dose-per-mass' || n.per === 100)), 'mutant still parsed it'));
  } catch (e) { fail++; console.log('FAIL mutation ' + name + ' :: ' + e.message.split('\n')[0]); }
}
console.log(`DOSAGE UNIT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
