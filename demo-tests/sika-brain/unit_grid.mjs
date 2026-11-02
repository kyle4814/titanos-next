// unit_grid.mjs: quantity from a published coverage grid (tile size x joint width) whose table says what the figure is per.
// Regressions for: "How much Davco Easy Grout do I need for 20 m2?" refused although the table says "Grout coverage based on 2 Litre pail".
import { makeBrain, rd } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { gridCells, parseTileJoint, selectCells, cellNeed } from '../../public/demo/sika-210c0c/assets/brain/grid.js';
import { checkAnswer } from './props.mjs';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n');
const ask = async (q) => { const a = await b.ask(q); return { a, x: txt(a), c: a.cards[0] }; };
const REFUSAL = /will not turn this into a quantity/;
// parsing
t('parse tile and joint', JSON.stringify(parseTileJoint('20 m2 of 300x100 tiles with 3mm joints')) === JSON.stringify({ tile: [300, 100, null], joint: 3 }));
t('parse tile with thickness, spaced, 1.5 joint', JSON.stringify(parseTileJoint('600 x 600 x 10mm tile, 1.5mm grout line')) === JSON.stringify({ tile: [600, 600, 10], joint: 1.5 }));
t('the tile thickness is never read as a joint', parseTileJoint('300x100x10mm tiles').joint === null);
t('no tile, no joint', parseTileJoint('how much grout for 20 m2').tile === null);
// Easy Grout: exact (the brief's example, 20 / 7 = 2.86 -> 3 x 2 L)
let r = await ask('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint');
t('Easy Grout exact: calculation card, not the refusal', r.c.type === 'calculation' && !REFUSAL.test(r.x), r.x);
t('Easy Grout exact: arithmetic shown 20 / 7 = 2.86 -> 3', /20 m2 \/ 7 m2 per 2 L pail = 2\.86, rounded up to 3/.test(r.x), r.x);
t('Easy Grout exact: 3 x 2 L pail', /3 x 2 L pail/.test(r.x), r.x);
t('Easy Grout exact: the quoted row, basis and columns are shown', /300x100x10mm \| 14m2 \| 7m2 \| 4m2/.test(r.x) && /Grout coverage based on 2 Litre pail/.test(r.x) && /TILE SIZE \| 1\.5mm Joint/.test(r.x));
t('Easy Grout exact: waste said once and Technical Services kept', (r.x.match(/add your own allowance/g) || []).length === 1 && /Technical Services/.test(r.x));
t('Easy Grout exact: properties hold (sourced numbers, schema)', checkAnswer('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint', r.a).length === 0, JSON.stringify(checkAnswer('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint', r.a)));
// mutation: the area drives the answer
r = await ask('How much Davco Easy Grout for 40 m2, 300x100 tiles, 3mm joint'); t('mutation: 40 m2 -> 40/7 = 5.71 -> 6 pails', /40 m2 \/ 7 m2 per 2 L pail = 5\.71, rounded up to 6/.test(r.x) && /6 x 2 L pail/.test(r.x), r.x);
r = await ask('How much Davco Easy Grout for 20 m2, 300x100 tiles, 5mm joint'); t('mutation: 5mm joint reads the 4 m2 cell -> 5 pails', /20 m2 \/ 4 m2 per 2 L pail = 5, rounded up to 5/.test(r.x), r.x);
r = await ask('How much Davco Easy Grout for 20 m2, 300 by 600 tiles, 3mm joint'); t('tile order does not matter (600x300 row, 9 m2 -> 3)', /20 m2 \/ 9 m2/.test(r.x) && /rounded up to 3/.test(r.x), r.x);
// no tile, no joint: ONE question with chips from the table
r = await ask('How much Davco Easy Grout do I need for 20 m2?');
t('Easy Grout bare: one question with tile-size chips, not the refusal', r.c.type === 'choose' && !REFUSAL.test(r.x) && /tile size/i.test(r.x), r.x);
t('Easy Grout bare: the chips are the table rows and carry the area', ['300x100x10mm', '600x300x10mm', '600x600x10mm'].every((s) => JSON.stringify(r.c).includes(s)) && JSON.stringify(r.c).includes('20 m2'));
// tile, no joint: the small result table across joints
r = await ask('How much Davco Easy Grout for 20 m2 with 600x600 tiles');
t('tile only: table across the 3 joints', r.c.table && r.c.table.rows.length === 3 && r.c.table.rows[1][3].includes('20 m2 / 14 m2'), JSON.stringify(r.c.table));
// joint, no tile: table across the tile sizes
r = await ask('How much Davco Easy Grout for 20 m2 with 3mm joints');
t('joint only: table across the 3 tile sizes', r.c.table && r.c.table.rows.length === 3, JSON.stringify(r.c.table));
// honest refusals stay
r = await ask('How much Davco Easy Grout for 20 m2, 123x456 tiles'); t('unlisted tile: no figure invented, published sizes offered', r.c.type === 'choose' && /not in the published table/.test(r.x) && !/rounded up/.test(r.x), r.x);
r = await ask('How much Davco Easy Grout for 20 m2, 600x600 tiles, 2mm joint'); t('unlisted joint: no figure invented', r.c.type === 'choose' && /not in the published table/.test(r.x) && !/rounded up/.test(r.x), r.x);
r = await ask('How much SikaTile-510 Mega Lite for 20 m2'); t('table without a stated pack basis stays the honest refusal', REFUSAL.test(r.x), r.x);
r = await ask('How much Davco Superfine White Grout for 20 m2, 10x50 tiles, 3mm joint'); t('a figure that fails the data check is not computed', r.c.type === 'rate' && /does not pass the data check/.test(r.x), r.x);
// kg per m2 grouts
r = await ask('How much Davco Superfine White Grout for 20 m2, 200x200 tiles, 3mm joint'); t('Superfine: 20 x 0.4 = 8 kg, packs of 5/10/20 kg', /20 m2 x 0\.4 kg per m2 = 8 kg/.test(r.x) && /2 x 5 kg/.test(r.x), r.x);
r = await ask('How much Davco Sanitized Colorgrout for 30 m2 with 100x100 tiles'); t('Colorgrout tile only: 3 joints, 12 / 24 / 48 kg', r.c.table && r.c.table.rows.map((x) => x[1]).join() === '12 kg,24 kg,48 kg', JSON.stringify(r.c.table));
r = await ask('How much SikaCeram-690 Elite for 20 m2 200x200 tiles 6mm joint'); t('SikaCeram-690 Elite: 20 x 1.2 = 24 kg', /20 m2 x 1\.2 kg per m2 = 24 kg/.test(r.x) && /5 x 5 kg/.test(r.x), r.x);
// per-bag trowel tables
r = await ask('How much SikaTile-366 Pro Flex for 20 m2 with a 10mm notched trowel'); t('trowel table: 20 / 8 = 2.5 -> 3 x 20 kg bag', /20 m2 \/ 8 m2 per 20 kg bag = 2\.5, rounded up to 3/.test(r.x), r.x);
r = await ask('How much SikaTile-405 Lite for 20 m2'); t('trowel table, no trowel given: labelled table, both sizes', r.c.table && r.c.table.rows.length === 2 && /6 mm/.test(r.c.table.rows[0][0]), JSON.stringify(r.c.table));
// computability count over the whole data
const cells = (id) => gridCells(rd(`data/brain/p/${id}.json`).r.facts.consumption);
t('Easy Grout has 9 grid cells', cells('davco-easy-grout').length === 9);
t('cellNeed refuses an untrusted kg cell', cellNeed(gridCells(rd('data/brain/p/davco-superfine-whitegrout.json').r.facts.consumption).find((c) => c.tile === '10x50x6mm'), 20) === null);

// ---- adversarial review findings (2026-11-02), each fails on 22036a3ee
{ const Q = 'How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint'; const { x, c } = await ask(Q);
  t('F1 a pack size whose pack text carries a colour is labelled with it (4 L pail is Bright white only)', /2 x 4 L pail \(Bright white only\)/.test(x) && /3 x 2 L pail(?! \()/.test(x), x);
  const hits = [['3 x 2 L', '2 x 2 L', 'Packs, rounded up'], ['rounded up to 3', 'rounded up to 4', 'Working'], ['3 x 2 L', '7 x 2 L', 'Packs, rounded up'], ['/ 7 m2', '/ 14 m2', 'Working']];
  for (const [from, to, lab] of hits) { const a = await b.ask(Q); const l = a.cards[0].lines.find((y) => y.label === lab); l.text = l.text.replace(from, to); t(`F7 mutation "${from}" -> "${to}" on the ${lab} line is caught by the property test`, checkAnswer(Q, a).some((y) => /^P1/.test(y[0])), l.text); }
  const a2 = await b.ask('How much Davco Easy Grout for 20 m2, 300x100 tiles'); const tb = a2.cards[0].table; const ip = tb.cols.indexOf('Packs, rounded up'); tb.rows[0][ip] = tb.rows[0][ip].replace(/^\d+/, '9'); t('F7 mutation in a result table pack count is caught', checkAnswer('How much Davco Easy Grout for 20 m2, 300x100 tiles', a2).some((y) => /^P1/.test(y[0])));
  const a3 = await b.ask('How much Davco Easy Grout for 20 m2, 300x100 tiles'); t('F7 the unmutated result table passes the property test', checkAnswer('How much Davco Easy Grout for 20 m2, 300x100 tiles', a3).length === 0, JSON.stringify(checkAnswer('x', a3)));
}
{ const Q = 'How much Davco Sanitized Colorgrout for 20 m2, 50x50 tiles, 6mm joint'; const { x, c } = await ask(Q);
  t('F6 a joint the tile row does not populate asks the joint question with that row\'s own widths, not a data-check refusal', c.type === 'choose' && !REFUSAL.test(x) && !/no column headings/.test(x) && (c.followups || []).length === 2 && (c.followups || []).every((f) => /1\.5 mm|3 mm/.test(f)), x + JSON.stringify(c.followups));
  const r2 = await ask('How much SikaCeram-690 Elite for 20 m2, 20x20 mosaic, 10mm joint'); t('F6 SikaCeram-690 Elite 20x20 10mm: asks the joint question, no data-check refusal', r2.c.type === 'choose' && !REFUSAL.test(r2.x) && !/no column headings/.test(r2.x), r2.x);
  const r3 = await ask('How much Davco Sanitized Colorgrout for 20 m2, 100x100 tiles, 6mm joint'); t('F6 a populated joint still computes', r3.c.type === 'calculation' && /32 kg/.test(r3.x), r3.x);
}
console.log(`unit_grid: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
