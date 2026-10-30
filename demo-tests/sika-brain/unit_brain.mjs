// unit_brain.mjs: the cases the owner called out, plus schema, loader fallback and determinism.
import { makeBrain, rd } from './harness.mjs';
import { createBrain } from '../../public/demo/sika-210c0c/assets/brain/brain.js';
import { createLoader } from '../../public/demo/sika-210c0c/assets/brain/loader.js';
import { validateCard, cardText, fact, card } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 200) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n');
let a = await b.ask('Can I use Davco Grey One Pot over my old tiles?');
t('old tiles: No with the data sheet sentence', /^No\./.test(a.cards[0].headline) && /not suitable for tiling over concrete, waterproofing membranes or existing ceramic tiles/.test(txt(a)));
a = await b.ask('Can I tile over a heated floor?', a.state);
t('heated floor after Grey One Pot: does not mention heated, UNKNOWN, hand-off names heated', a.cards[0].status === 'UNKNOWN' && /does not mention heated/i.test(a.cards[0].headline) && a.cards[0].handoff && /heated/.test(a.cards[0].handoff.reason) && /not in the published data/i.test(txt(a)), txt(a));
a = await b.ask('How much Davco Grey One Pot adhesive for 20 m2');
t('20 m2 Grey One Pot: 26.67 L and 3 x 10 L, source sentence beside it, no price', a.cards[0].type === 'calculation' && /26\.67 L/.test(txt(a)) && /3 x 10 L/.test(txt(a)) && /cover approximately 7\.5m2/.test(txt(a)) && !/\$|price of/i.test(txt(a)), txt(a));
a = await b.ask('What is the coverage of Sikafloor Level Pro Primer?');
t('a no-rate answer carries no invented number', a.cards[0].status === 'UNKNOWN' && !/\d/.test(a.cards[0].headline + a.cards[0].handoff.reason), txt(a));
a = await b.ask('price of sikaflex 11 fc'); t('price question is declined with a hand-off', a.cards[0].status === 'UNKNOWN' && !!a.cards[0].handoff);
a = await b.ask('Is Ardex better than Davco?'); t('a competitor is never named in the reply', !/ardex/i.test(txt(a)) && a.cards[0].status === 'UNKNOWN', txt(a));
a = await b.ask('grey one pott coverage'); t('spelling tolerance finds the product', a.cards[0].product && a.cards[0].product.id === 'davco-grey-one-potadhesive' && a.cards[0].type === 'rate');
a = await b.ask('porcelain on plasterboard internal wall system'); t('system card is ordered primer, membrane, adhesive, grout', a.cards[0].type === 'system' && a.cards[0].table.rows.map((r) => r[0]).join('|').startsWith('Prepare and prime|Waterproofing membrane|Tile adhesive|Grout'), a.cards[0].table && a.cards[0].table.rows.map((r) => r[0]));
a = await b.ask('Compare Davco Grey One Pot and Davco Ultraflex'); t('comparison card has two product columns', a.cards[0].type === 'comparison' && a.cards[0].table.cols.length === 3);
a = await b.ask('how long before I can grout Davco Grey One Pot'); t('time card quotes the 24 hours sentence', a.cards[0].type === 'time' && /24 hours \(before grouting\)/.test(txt(a)));
a = await b.ask('ppe for davco trojan mastic'); t('safety card quotes the SDS with revision', a.cards[0].type === 'safety' && /Revision/.test(a.cards[0].headline));
a = await b.ask('specification clause for davco grey one pot'); t('spec card quotes the data sheet citation and never claims compliance', a.cards[0].type === 'spec' && !/complies with/i.test(a.cards[0].headline));
t('every card validates', (await Promise.all(['sds for grey one pot', 'tell me about sikaflex pro plus', 'waterproofing for a bathroom floor under tiles'].map((q) => b.ask(q)))).every((x) => x.cards.every((c) => validateCard(c).length === 0)));
const x1 = JSON.stringify((await b.ask('which tile adhesive for porcelain tiles on concrete in an internal floor')).cards), x2 = JSON.stringify((await makeBrain().ask('which tile adhesive for porcelain tiles on concrete in an internal floor')).cards);
t('deterministic: same question, same cards, across two brains', x1 === x2);
t('SIGNED is rejected by the validator', validateCard(card({ type: 'rate', title: 'x', facts: [fact({ source_url: 'u', sentence: 's', status: 'SIGNED' })], chip: 'c' })).some((p) => /SIGNED/.test(p)));
// loader fallback: a missing core shard must make boot() throw so the UI can fall back to v1
const broken = createBrain({ load: createLoader({ base: 'data/brain/', fetchJson: async () => null }) });
let threw = false; try { await broken.ask('hello'); } catch { threw = true; } t('missing core shard throws (the panel then uses v1)', threw);
// a missing product shard degrades to an honest unknown, not a crash
const noShard = createBrain({ load: { ...createLoader({ base: 'data/brain/', fetchJson: async (u) => (/p\//.test(u) ? null : (await import('./harness.mjs')).fetchJson(u)) }) } });
a = await noShard.ask('coverage of davco grey one pot'); t('missing product shard gives an unknown card, not a crash', a.cards.length === 1 && a.cards[0].status === 'UNKNOWN');
// mutation: the property test must catch an invented number
{ const { checkAnswer } = await import('./props.mjs'); const q = 'What is the coverage of Sikafloor Level Pro Primer?'; const m = await b.ask(q); t('property test: clean answer has no violations', checkAnswer(q, m).length === 0);
  m.cards[0].handoff.reason += ' It is usually about 1.5 kg per m2.'; t('property test: an invented number is caught (mutation)', checkAnswer(q, m).some((x) => x[0] === 'P1')); 
  const c2 = await b.ask('How much Davco Grey One Pot adhesive for 20 m2'); c2.cards[0].lines[1].text = '27.5 L'; t('property test: a wrong calculation is caught (mutation)', checkAnswer('How much Davco Grey One Pot adhesive for 20 m2', c2).some((x) => x[0] === 'P1')); }
console.log(`unit_brain: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
