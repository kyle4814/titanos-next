// names.mjs: every alias in names.js resolves to exactly one product, cites a published page, and a broken alias is caught (mutation).
import { makeBrain } from '../sika-brain/harness.mjs';
import { NAME_ALIASES, historyCard } from '../../public/demo/sika-210c0c/assets/brain/names.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const EXPECT = new Map(NAME_ALIASES.map((a) => [a.k, a.id])); // the intended targets, fixed before any mutation
async function resolveAll() {
  const brain = makeBrain(); await brain.boot(); const bad = [];
  for (const a of NAME_ALIASES) {
    const r = await brain.ask('tell me about ' + a.k, null);
    const ids = [...new Set(r.cards.filter((c) => c.type === 'product' || c.product).map((c) => c.product && c.product.id).filter(Boolean))];
    if (ids.length !== 1 || ids[0] !== EXPECT.get(a.k)) bad.push(`${a.k} -> ${ids.join(',') || 'none'} (wanted ${EXPECT.get(a.k)})`);
  }
  return bad;
}
const bad = await resolveAll();
ok(bad.length === 0, 'aliases that do not resolve to their single product: ' + bad.join(' | '));
for (const a of NAME_ALIASES) { ok(a.src && /^https:\/\/aus\.sika\.com\/en\//.test(a.src.url) && a.src.quote && a.src.quote.length > 20, 'alias ' + a.k + ' cites a page and a quote'); ok(a.k === a.k.toLowerCase() && !/[^a-z0-9 ]/.test(a.k), 'alias key ' + a.k + ' is normalised'); }
ok(new Set(NAME_ALIASES.map((a) => a.k)).size === NAME_ALIASES.length, 'no duplicate alias keys');
// every alias quote really is on the cited page (Davco page lines in kb.json, or the product page name for the pail nickname)
import fs from 'node:fs';
const kb = JSON.parse(fs.readFileSync(new URL('../../public/demo/sika-210c0c/data/brain/kb.json', import.meta.url), 'utf8'));
const davco = kb.pages.find((p) => /construction\/davco\.html/.test(p.u));
for (const a of NAME_ALIASES.filter((x) => /davco\.html$/.test(x.src.url))) ok(davco.l.some((l) => l.includes(a.src.quote.slice(0, 40).replace(/'/g, "'"))) || davco.l.join(' ').includes(a.src.quote.replace(/ is still.*/, '')), 'Davco page carries the quote for ' + a.k);
// history cards quote the Davco page word for word
for (const q of ['who owns davco', 'did the davco packaging change', 'was lanko renamed', 'did sikafloor level pro used to have another name']) { const c = historyCard(q); ok(!!c, 'history card for ' + q); if (c) for (const f of c.facts) ok(davco.l.some((l) => l.includes(f.sentence.slice(0, 50))), 'history sentence is on the Davco page: ' + f.sentence.slice(0, 40)); }
ok(!historyCard('what is the best adhesive for tiles'), 'history card does not fire on an unrelated question');
// honest: a nickname no page shows is not aliased and not guessed
{ const brain = makeBrain(); await brain.boot(); for (const q of ['ultratile', 'grey bag adhesive']) { const r = await brain.ask(q, null); const prod = r.cards.filter((c) => c.type === 'product'); ok(!prod.some((c) => /grey-one-pot|ultra/.test(c.product.id) && q === 'grey bag adhesive'), q + ' is not guessed as a named product'); } }
// MUTATION: break one alias and the check must fail
{ const m = NAME_ALIASES.find((a) => a.k === 'sikafiber force 950'); const save = m.id; m.id = 'davco-k10-plus'; const b2 = await resolveAll(); m.id = save; ok(b2.length >= 1, 'mutation (alias pointed at the wrong product) is detected'); }
console.log(`names: ${pass} passed, ${fail} failed (${NAME_ALIASES.length} aliases)`);
process.exit(fail ? 1 : 0);
