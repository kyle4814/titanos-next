// T17 ACCEPT, node part: the system finder model over the real data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolve, NO_MATCH } from '../../../public/demo/sika-210c0c/assets/lib/finder/model.js';
const P = new URL('../../../public/demo/sika-210c0c/', import.meta.url);
const S = JSON.parse(fs.readFileSync(new URL('data/finder/systems.json', P), 'utf8'));
const textOf = (() => { const c = new Map(); return (id) => { if (!c.has(id)) { const j = JSON.parse(fs.readFileSync(new URL('data/p/' + id + '.json', P), 'utf8')); c.set(id, JSON.stringify(j).replace(/\\n/g, ' ').replace(/\s+/g, ' ')); } return c.get(id); }; })();
const idOf = (u) => u.split('/').pop().replace(/\.html$/, '');
const inPage = (url, sentence) => { const tx = textOf(idOf(url)).replace(/\\"/g, '"'); return String(sentence).split(' | ').every((seg) => tx.includes(norm(seg))); };
const norm = (s) => String(s).replace(/\s+/g, ' ').replace(/\.\.\.$/, '').trim();
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + e.message.split('\n')[0]); } };
const sel = { tile: 'porcelain', sub: 'concrete', loc: 'internal-floor' };
const r = resolve(S, sel);
t('porcelain / concrete / internal floor returns at least three slots', () => { assert.equal(r.ok, true); assert(r.steps.length >= 3, 'steps ' + r.steps.length); });
t('every product in a slot carries a quoted sentence that appears verbatim in its page text', () => {
  let n = 0;
  for (const st of r.steps) for (const o of st.options) { assert(o.evidence.length, o.productId + ' has no evidence'); const q = norm(o.evidence[0].sentence); const tx = textOf(o.productId).replace(/\\"/g, '"'); assert(inPage(o.evidence[0].url, o.evidence[0].sentence), o.productId + ': ' + q.slice(0, 60)); n++; }
  assert(n >= 3);
});
t('Davco Grey One Pot is ruled out for the adhesive slot with its own quote', () => {
  const x = r.ruledOut.find((o) => o.productId === 'davco-grey-one-potadhesive');
  assert(x, 'missing'); assert.equal(x.role, 'adhesive'); assert(/not suitable for tiling over concrete/.test(x.quote), x.quote);
});
t('the membrane slot for a dry floor says no matching product, never a guess', () => {
  const m = r.steps.find((s) => s.role === 'membrane'); assert(m); assert.equal(m.options.length, 0); assert.equal(m.status, 'not-stated'); assert(NO_MATCH.startsWith('I do not have a matching product'));
});
t('all 363 combinations: slots with no product have no options; every option has a quote verbatim in its page', () => {
  let combos = 0, opts = 0;
  for (const key of Object.keys(S.systems)) {
    const [tile, sub, loc] = key.split('|'); const x = resolve(S, { tile, sub, loc }); combos++;
    assert(x.ok, key);
    for (const st of x.steps) { if (st.status === 'not-stated') assert.equal(st.options.length, 0, key); for (const o of st.options) { opts++; const q = norm(o.evidence[0].sentence); assert(inPage(o.evidence[0].url, o.evidence[0].sentence), key + ' ' + o.productId + ' ' + q.slice(0, 50)); } }
    for (const ro of x.ruledOut) assert(inPage(ro.url, ro.quote), key + ' ruled ' + ro.productId);
  }
  assert.equal(combos, 363); console.log('   ' + combos + ' combinations, ' + opts + ' options checked');
});
t('a combination with no system says the documentation does not support it', () => {
  const x = resolve(S, { tile: 'moisture-sensitive-stone', sub: 'concrete', loc: 'internal-floor' }); assert.equal(x.ok, false); assert(/does not support a complete system/.test(x.message));
});
t('no prices anywhere in the finder data', () => { const raw = fs.readFileSync(new URL('data/finder/systems.json', P), 'utf8'); assert(!/\$\s?\d/.test(raw.replace(/\\u0024/g, '$'))); });
console.log(`\nt17_model: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
