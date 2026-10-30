// T09 ACCEPT, node part: verdicts for davco-grey-one-potadhesive, and the guard against inference.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { canUse, CHIPS } from '../../../public/demo/sika-210c0c/assets/lib/finder/canuse.js';
const P = new URL('../../../public/demo/sika-210c0c/data/p/', import.meta.url);
const load = (id) => JSON.parse(fs.readFileSync(new URL(id + '.json', P), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + e.message.split('\n')[0]); } };
const V = canUse(load('davco-grey-one-potadhesive'));
const want = (id, verdict, rx) => t(`davco-grey-one-potadhesive ${id}: ${verdict.toUpperCase()}${rx ? ' quoting ' + rx : ''}`, () => { assert.equal(V[id].verdict, verdict, JSON.stringify(V[id])); if (rx) assert(rx.test(V[id].quote), V[id].quote); else assert.equal(V[id].quote, null); });
want('concrete', 'no', /not suitable for tiling over concrete/);
want('existing-tiles', 'no', /existing ceramic tiles/);
want('membrane', 'no', /waterproofing membranes/);
want('plasterboard', 'yes', /plasterboard/);
want('fibre-cement', 'yes', /fibre cement sheet/);
want('render-brick', 'yes', /rendered brickwork and blockwork/);
want('external', 'no', /suitable for use on internal applications only/);
want('internal', 'yes', /internal/);
want('heated-floor', 'unstated');
want('timber', 'unstated');
want('screed', 'unstated');
want('natural-stone', 'unstated');
t('twelve chips are defined', () => assert.equal(CHIPS.length, 12));
t('a quote is always a sentence from the product text (never generated)', () => {
  const p = load('davco-grey-one-potadhesive'); const all = JSON.stringify(p).replace(/\\n/g, ' ');
  for (const [id] of CHIPS) if (V[id].quote) assert(all.includes(V[id].quote.replace(/\.\.\.$/, '')), id);
});
t('across 512 products every verdict is YES, NO or NOT STATED; quoted ones carry a quote and a source, NOT STATED carries neither', () => {
  const idx = JSON.parse(fs.readFileSync(new URL('../index.json', P), 'utf8'));
  let n = 0;
  for (const e of idx) { const v = canUse(load(e.id)); for (const [id] of CHIPS) { const x = v[id]; assert(['yes', 'no', 'unstated'].includes(x.verdict)); if (x.verdict === 'unstated') assert.equal(x.quote, null); else { assert(x.quote && x.url, e.id + ' ' + id); n++; } } }
  console.log('   ' + n + ' quoted verdicts over ' + idx.length + ' products');
});
t('"X only" excludes the opposite: an "external only" statement makes internal a NO', () => {
  const v = canUse({ url: 'u', usage: ['Suitable for external use only.'], attributes: [], advantages: [], sections: [] });
  assert.equal(v.internal.verdict, 'no'); assert.equal(v.external.verdict, 'yes'); assert(/external use only/.test(v.internal.quote));
});
t('a NO beats a YES for the same facet (the safer reading is shown)', () => {
  const v = canUse({ url: 'u', usage: ['Suitable for timber floors.', 'Not suitable for timber floors in wet areas.'], attributes: [], advantages: [], sections: [] });
  assert.equal(v.timber.verdict, 'no');
});
t('moisture sensitive stone exclusion does not leak into natural stone', () => {
  const v = canUse({ url: 'u', usage: ['Not suitable for moisture sensitive stone.'], attributes: [], advantages: [], sections: [] });
  assert.equal(v['natural-stone'].verdict, 'unstated');
});
t('a list under a "not suitable" heading is excluded item by item', () => {
  const v = canUse({ url: 'u', usage: ['Not suitable substrates include;', 'Timber', 'Plasterboard', 'Suitable for use on concrete.'], attributes: [], advantages: [], sections: [] });
  assert.equal(v.timber.verdict, 'no'); assert.equal(v.plasterboard.verdict, 'no'); assert.equal(v.concrete.verdict, 'yes');
});
console.log(`\nt09_canuse: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
