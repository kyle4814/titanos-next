// unit_brain.mjs: the cases the owner called out, plus schema, loader fallback and determinism.
import { makeBrain, rd } from './harness.mjs';
import { createBrain } from '../../public/demo/sika-210c0c/assets/brain/brain.js';
import { createLoader } from '../../public/demo/sika-210c0c/assets/brain/loader.js';
import { checkAnswer as propsCheck } from './props.mjs';
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
// wave 3 answer quality (audit R2 finding 4): a sentence is shown once, and a quoted table row carries its table's header row and caption
{ const { repeats, rowStats } = await import('./sweep_dupes.mjs'); const { rowLines, NO_HEADER } = await import('../../public/demo/sika-210c0c/assets/brain/cards.js');
  a = await b.ask('What is the coverage of Davco Easy Grout?'); const eg = cardText(a.cards[0]);
  t('Easy Grout coverage: the published table is quoted, nothing is turned into a quantity', a.cards[0].type === 'rate' && !/litre|pail[s]? needed/i.test(a.cards[0].headline), eg);
  t('Easy Grout coverage: no sentence is shown twice', repeats(a).length === 0 && eg.split('300x100x10mm | 14m2 | 7m2 | 4m2').length === 2, eg);
  t('Easy Grout coverage: the table header row and the 2 Litre pail basis come with the rows', /TILE SIZE \| 1\.5mm Joint \| 3mm Joint \| 5mm Joint/.test(eg) && /Grout coverage based on 2 Litre pail/.test(eg) && rowStats(a).headerless === 0, eg);
  a = await b.ask('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint'); { const cg = cardText(a.cards[0]); // the 20 m2 calculation question itself: no repeated sentence, the header row and pail basis travel with the quoted row, and the row is counted
    t('Easy Grout 20 m2 calculation: no sentence is shown twice', repeats(a).length === 0 && cg.split('300x100x10mm | 14m2 | 7m2 | 4m2').length === 2, cg);
    t('Easy Grout 20 m2 calculation: the table header row and the 2 Litre pail basis come with the row, and the row is counted', /TILE SIZE \| 1\.5mm Joint \| 3mm Joint \| 5mm Joint/.test(cg) && /Grout coverage based on 2 Litre pail/.test(cg) && rowStats(a).rows >= 1 && rowStats(a).headerless === 0, cg + JSON.stringify(rowStats(a)));
    t('Easy Grout 20 m2 calculation: pack colour qualifier travels with the 4 L pail', /2 x 4 L pail \(Bright white only\)/.test(cg) && !/3 x 2 L pail \(/.test(cg), cg); }
  a = await b.ask('How much Davco Easy Grout for 20 m2'); t('Easy Grout 20 m2 (no tile size): one question with chips, no quantity invented (grid lane: unit_grid.mjs)', a.cards[0].type === 'choose' && !/rounded up/.test(cardText(a.cards[0])), cardText(a.cards[0]));
  t('Easy Grout 20 m2: every number on the card is still inside a quoted fact', checkAnswerClean('How much Davco Easy Grout for 20 m2', a));
  a = await b.ask('What is the coverage of Davco Easy Grout?'); t('Easy Grout coverage: three cells of one row are one line', a.cards[0].lines.filter((l) => l.text === '300x100x10mm | 14m2 | 7m2 | 4m2').length === 1);
  a = await b.ask('how long before I can recoat Sikagard-550 W Elastic'); t('time table rows carry their header too', a.cards[0].type === 'time' && /Previous coating \| Waiting time \| Next coating/.test(cardText(a.cards[0])) && rowStats(a).headerless === 0);
  // a row of 3+ cells with no header in the data says so; nothing is invented (unit test on the builder)
  const f0 = { id: 'x:1', text: '6 mm | 8 mm | 10 mm', s: { t: 'PDS', u: 'https://example.invalid/x.pdf', p: 1 } };
  const r0 = rowLines([{ f: f0, label: 'Consumption (data sheet, page 1)' }], 4);
  t('no header in the data: the card admits it and invents no column names', r0.lines[0].text === NO_HEADER && r0.lines.length === 2 && r0.facts.length === 1);
  const r1 = rowLines([{ f: { ...f0, h: { c: 'A | B | C', k: 'basis here' } }, label: 'L' }, { f: { ...f0, id: 'x:2' }, label: 'L' }], 4); t('identical rows collapse to one line; header and caption come first', r1.lines.map((l) => l.label).join() === 'Table basis,Table columns,L');
  // mutation: the checks must fail on the base behaviour (a repeated line, a headerless row)
  const bad = { cards: [{ type: 'rate', headline: 'x', lines: [{ label: 'Consumption', text: '300x100x10mm | 14m2 | 7m2 | 4m2' }, { label: 'Consumption', text: '300x100x10mm | 14m2 | 7m2 | 4m2' }] }] };
  t('mutation: a repeated row and a headerless row are both caught', repeats(bad).length === 1 && rowStats(bad).headerless === 2); }
function checkAnswerClean(q, ans) { return propsCheck(q, ans).length === 0; }
// wave 3 WRONG review (WRONG_REVIEW_2026-11-02.md): price, rrp, specials and sales-ranking asks are declined; a "quick one" filler is not a fast-setting requirement
for (const q of ['how much is a pail of skalastic 1k', 'ok so what is the rrp of sikaflex pro plus thx', 'any spceials on tile adhesive', 'how much is a 20kg bag of davco ultraflex', 'is sikaflex pro plus on special this week', 'which products are the fast movers for tilers']) {
  a = await b.ask(q); t('declined, no product card as an answer: ' + q, a.cards.length === 1 && a.cards[0].type === 'unknown' && !!a.cards[0].handoff && /Prices, stock/.test(a.cards[0].handoff.reason), txt(a));
}
a = await b.ask('how much Davco Grey One Pot adhesive for 20 m2'); t('a quantity ask is not mistaken for a price ask (how much ... m2 still calculates)', a.cards[0].type === 'calculation');
a = await b.ask('how much is the coverage of sikaflex pro plus'); t('"how much is the coverage" is not a price ask', a.cards[0].type !== 'unknown' || !/Prices, stock/.test(a.cards[0].handoff ? a.cards[0].handoff.reason : ''));
a = await b.ask('quick one teak decking with sika mate'); t('"quick one" is not a fast-setting criterion; teak decking finds the teak decking sealant', !/fast setting or drying/i.test(txt(a)) && /teak/i.test(txt(a)), txt(a));
a = await b.ask('fast setting tile adhesive'); t('a real "fast setting" ask still uses the fast-setting criterion', /fast setting or drying/i.test(txt(a)));
console.log(`unit_brain: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
