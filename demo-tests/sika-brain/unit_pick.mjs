// unit_pick.mjs: pick quality (2026-11-02). The "My pick" reason is the published SENTENCE that matches the user's own words, never a category label;
// a product with only a label as evidence ranks below one with a real sentence; removal and panel asks are not answered by a word collision; a reply that
// narrows a clarifying question ends in a pick. Each block fails on base 1f36f8c67.
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 260) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n');
const pickOf = (a) => { const m = /My pick from the data sheets: (.*?), because its (?:data sheet|product page) says: "(.*)" \(a documented/.exec(a.cards[0].headline || ''); return m ? { name: m[1], reason: m[2] } : null; };
const words = (s) => s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;

// 1. the quoted reason is a sentence, not a label
for (const q of ['Best sealant for a bathroom', 'Recommend a sealant for a shower leak', 'My roof is leaking, what should I use', 'What should I use to repair a leaking metal roof', 'What should I use to repair concrete spalling', 'Recommend a flexible adhesive for a shower screen']) {
  const a = await b.ask(q, null); const p = pickOf(a);
  t(`reason is a full sentence (6+ words): "${q}"`, !!p && words(p.reason) >= 6 && !/^(Kitchens & Bathrooms|Bathrooms|Sealing of tree wounds|Concrete elements)$/.test(p.reason), p ? `${p.name} | ${p.reason}` : txt(a));
}
// 2. primary use fits the job
{ const p = pickOf(await b.ask('My roof is leaking, what should I use', null)); t('leaking roof does not pick a pipe flashing', !!p && !/flashing|pipe/i.test(p.name), p && p.name); }
{ const p = pickOf(await b.ask('What should I use to repair a leaking metal roof', null)); t('leaking metal roof does not pick a tree-wound dressing', !!p && !/Bitkote/i.test(p.name) && !/tree/i.test(p.reason), p && `${p.name} | ${p.reason}`); }
{ const p = pickOf(await b.ask('Best sealant for a bathroom', null)); t('bathroom sealant is not a pool or label-only product', !!p && !/pool/i.test(p.name) && !/190/.test(p.name), p && p.name); }
{ const p = pickOf(await b.ask('Recommend a sealant for an exterior window', null)); t('exterior window sealant is not a fire rated sealant', !!p && !/fire/i.test(p.name), p && p.name); }
// 3. the three ranking WRONGs
for (const q of ['yeah so smartcut windscreen removal', 'ok so removing a windscreen completely thanks', 'removing a windscreen']) {
  const a = await b.ask(q, null); const c = a.cards[0];
  t(`windscreen removal "${q}": the published removal procedures, no cleaner or sealant offered`, c.type === 'info' && /removing a windscreen/i.test(c.title) && /do not hold a Sika product that removes/i.test(txt(a)) && !a.cards.some((x) => x.type === 'product') && /smartcut|cut out|removal/i.test(txt(a)), `${c.type} ${c.title}`);
}
{ const a = await b.ask('honeycomb panel bonding', null); const c = a.cards[0]; t('honeycomb panel bonding: the honeycomb panels page, not concrete repair mortars', c.type === 'info' && /honeycomb panels/i.test(c.title) && !/MonoTop|mortar/i.test(txt(a)), `${c.type} ${c.title}`); }
{ const a = await b.ask('repair honeycombed concrete', null); t('honeycombed concrete still gets the repair mortars', /mortar/i.test(a.cards[0].title) || a.cards.some((x) => x.type === 'product' && /MonoTop/i.test(x.product.name)), a.cards[0].title); }
{ const a = await b.ask('how do I clean a windscreen', null); t('cleaning a windscreen is not hijacked by the removal answer', !/removing a windscreen/i.test(a.cards[0].title || ''), a.cards[0].title); }
// 4. follow-ups and phrasing that mean "recommend" end in a pick
{ const a = await b.ask('What sealant should I use around a bath', null); t('"what sealant should I use around a bath" leads with My pick', !!pickOf(a), a.cards[0].headline); }
{ let a = await b.ask('can you recommend a sealant', null); a = await b.ask('around the bath', a.state); t('recommend then "around the bath" ends in My pick', !!pickOf(a), a.cards[0].headline); }
{ let a = await b.ask('I need a sealant', null); a = await b.ask('around the bath', a.state); t('"I need a sealant" then "around the bath" ends in My pick', !!pickOf(a), a.cards[0].headline); }
console.log(`unit_pick: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
