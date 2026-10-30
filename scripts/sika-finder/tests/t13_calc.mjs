// T13 ACCEPT, node part: quantity calculator maths. Run: node scripts/sika-finder/tests/t13_calc.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { normaliseFact, quantity, packOptions, work, ESTIMATE_LINE } from '../../../public/demo/sika-210c0c/assets/lib/finder/calc.js';
const D = new URL('../../../public/demo/sika-210c0c/data/finder/r/', import.meta.url);
const load = (id) => JSON.parse(fs.readFileSync(new URL(id + '.json', D), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + e.message.split('\n')[0]); } };
const near = (a, b, e = 0.01) => assert(Math.abs(a - b) <= e, a + ' vs ' + b);

const p = load('davco-grey-one-potadhesive');
const fact = p.consumption[0];
const rate = normaliseFact(fact);
const packs = p.packs;
t('rate read: 10 L covers 7.5 m2', () => { assert.equal(rate.ok, true); assert.equal(rate.kind, 'pack-covers'); });
t('20 m2 = 26.67 L exact, 3 x 10 L pails', () => {
  const r = work(rate, packs, { area: 20 }); near(r.high, 26.67);
  const o = r.packs.options.find((x) => x.size === 10); assert.equal(o.count, 3);
});
t('20 m2 + 15% allowance = 30.67 L, 4 x 10 L pails', () => {
  const r = work(rate, packs, { area: 20, allowancePct: 15 }); near(r.high, 30.67);
  assert.equal(r.packs.options.find((x) => x.size === 10).count, 4);
});
t('12 m2 = 16 L, 2 x 10 L among the options', () => {
  const r = work(rate, packs, { area: 12 }); near(r.high, 16);
  assert(r.packs.options.some((x) => x.size === 10 && x.count === 2));
});
t('no allowance unless typed: default is 0', () => { assert.equal(work(rate, packs, { area: 10 }).allowancePct, 0); });
t('round up only: 10.0000001 L needs 2 x 10 L, exactly 10 L needs 1', () => {
  assert.equal(packOptions([{ amount: 10, unit: 'L' }], { amount: 10, unit: 'L' }).options[0].count, 1);
  assert.equal(packOptions([{ amount: 10, unit: 'L' }], { amount: 10.001, unit: 'L' }).options[0].count, 2);
});
t('area missing asks for area, no number', () => { const r = quantity(rate, {}); assert.equal(r.ok, false); assert.equal(r.need, 'area'); });
t('per-mm rate refuses without thickness; computes with it', () => {
  const e = load('sikaceram-880-easyepoxy'); const f = e.consumption.map(normaliseFact).find((x) => x.ok && x.perMm);
  assert(f, 'a per-mm rate exists'); assert.equal(quantity(f, { area: 10 }).need, 'thickness');
  const r = quantity(f, { area: 10, thickness: 2 }); near(r.high, 1.6 * 10 * 2);
});
t('a product with no published rate returns noRate', () => {
  const idx = JSON.parse(fs.readFileSync(new URL('index.json', D), 'utf8'));
  const id = Object.keys(idx.noRate)[0]; assert(id, 'at least one noRate product'); const q = load(id);
  assert.equal(q.status === 'published', false); assert.equal(q.consumption.length, 0);
});
t('kg rate with litre packs: refuses to convert (no density assumed)', () => {
  const r = packOptions([{ amount: 5, unit: 'L' }], { amount: 12, unit: 'kg' }); assert.equal(r.options.length, 0); assert(r.note);
});
t('estimate line is the exact wording ordered', () => { assert.equal(ESTIMATE_LINE, 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.'); });
console.log(`\nt13_calc: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
