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

// ---- adversarial review findings (2026-11-02), each fails on 22036a3ee
{ const a = await b.ask('best epoxy floor coating for a garage', null); const p = pickOf(a); t('F2 "best epoxy floor coating for a garage" does not pick a polyurethane product', !!p && !/Sikafloor-376/.test(p.name) && /MultiDur|epoxy|ES-/i.test(p.name), p ? p.name : txt(a)); 
  const a2 = await b.ask('best polyurethane floor coating for a garage', null); t('F2 a named polyurethane keeps polyurethane products', /Sikafloor-376|PU|polyurethane/i.test(txt(a2)), txt(a2));
  const a3 = await b.ask('best silicone sealant for a bathroom', null); const p3 = pickOf(a3); t('F2 a named silicone still picks a silicone', !!p3 && /silicone|sikaseal|sikasil/i.test(p3.name + p3.reason), p3 ? p3.name : txt(a3)); }
for (const q of ['what water ratio do I use for a floor leveller', 'what thickness should we use for a floor leveller', 'what temperature can I use a floor leveller at', 'what mixing ratio do I use for a floor leveller']) { const a = await b.ask(q, null); t(`F3 how-to ask is not a pick: "${q}"`, !pickOf(a) && !/^My pick/.test(a.cards[0].headline || ''), a.cards[0].headline); }
{ const a = await b.ask('what should I use for a floor leveller', null); t('F3 a real "what should I use" ask is still a pick', !!pickOf(a), a.cards[0].headline); }
for (const q of ['recommend a crack filler for concrete', 'what is the best crack filler for concrete', 'recommend a filler for cracks in a concrete wall']) { const a = await b.ask(q, null); const p = pickOf(a); t(`F5 pick reason is never a warning sentence: "${q}"`, !p || !/(crazing|aligatoring|may present|may cause|cracking, )/i.test(p.reason), p ? p.reason : txt(a)); }
{ const a = await b.ask('recommend a crack filler for concrete', null); const p = pickOf(a); t('F5 the crack filler pick states a use', !!p && /seal|fill|repair|suitable|used|for /i.test(p.reason), p ? p.reason : txt(a)); }
for (const q of ['removing a rear view mirror from the windscreen', 'which primer do I use after removing the old windscreen', 'how do I fix honeycombed panels on my precast building', 'how do I fix honeycomb in a tilt-up wall panel']) { const a = await b.ask(q, null); const c = a.cards[0]; t(`F4 not hijacked by the windscreen or honeycomb panel page: "${q}"`, !/removing a windscreen|^honeycomb panels$/i.test(c.title || ''), c.title); }
for (const q of ['how do I remove a windscreen', 'how do I take the windscreen out', 'cutting out a rear windscreen']) { const a = await b.ask(q, null); t(`F4 a real windscreen removal ask still routes: "${q}"`, /removing a windscreen/i.test(a.cards[0].title || ''), a.cards[0].title); }
{ const a = await b.ask('bonding honeycomb sandwich panels', null); t('F4 honeycomb sandwich panel bonding still routes, the lines are picked by content', /^honeycomb panels$/i.test(a.cards[0].title || '') && a.cards[0].lines.length === 3 && /two component PUR/i.test(a.cards[0].lines[1].text) && /hot melt/i.test(a.cards[0].lines[2].text), cardText(a.cards[0])); }
// I1 (integration 2026-11-02, blind3 c046): a drainage board ("SikaRoof VersiDrain") is a roof accessory, not the first answer to a general roof waterproofing ask; it still answers when the asker names drainage or the green roof
{ const a = await b.ask('waterproofing for a concrete roof slab', null); const ids = a.cards.filter((x) => x.product).map((x) => x.product.id || ''); t('I1 roof slab waterproofing does not offer a VersiDrain drainage board', ids.length > 0 && !ids.some((i) => /versidrain/.test(i)), ids.join(',')); }
{ const a = await b.ask('drainage board for a green roof', null); const ids = a.cards.filter((x) => x.product).map((x) => x.product.id || ''); t('I1 a drainage board ask still offers a VersiDrain', ids.some((i) => /versidrain/.test(i)), ids.join(',')); }
console.log(`unit_pick: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
