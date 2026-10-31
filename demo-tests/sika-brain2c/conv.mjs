// conv.mjs: runs the scripted conversations (conversations.json) against the brain with the session state passed turn to turn.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBrain } from '../sika-brain/harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const convs = JSON.parse(fs.readFileSync(path.join(HERE, 'conversations.json'), 'utf8'));
const brain = makeBrain(); await brain.boot();
let pass = 0, fail = 0, turns = 0, recTurns = 0, recOk = 0; const bad = [];
for (const cv of convs) {
  let st = null; let ok = true; const why = [];
  for (const [i, t] of cv.turns.entries()) {
    const r = await (process.env.BEFORE ? brain.askInner : brain.ask)(t.q, st); st = r.state; turns++;
    const cards = r.cards; const e = t.expect || {}; const ids = cards.map((c) => c.product && c.product.id).filter(Boolean);
    const txt = (cards.map(cardText).join(' ') + ' ' + cards.map((c) => c.headline).join(' ')).toLowerCase();
    const f = [];
    if (e.type && !cards.some((c) => c.type === e.type)) f.push('type ' + e.type + ' got ' + cards.map((c) => c.type).join('+'));
    if (e.prod && !ids.includes(e.prod)) f.push('prod ' + e.prod + ' got ' + ids.join(','));
    if (e.rec && !cards.some((c) => (c.lines || []).some((l) => l.label === 'My pick' || l.label === 'Before I pick'))) f.push('no recommendation line');
    if (e.qty && !cards.some((c) => c.calc || /coverage|quantity|how much/i.test(c.title + ' ' + c.headline))) f.push('no quantity card');
    if (e.noUnknown && cards.some((c) => c.type === 'unknown')) f.push('unknown card');
    if (e.noProductCard && cards.some((c) => c.type === 'product' || (c.product && c.type !== 'unknown'))) f.push('guessed a product: ' + ids.join(','));
    if (e.has && !txt.includes(String(e.has).toLowerCase())) f.push('missing text ' + e.has);
    if (e.chip && !(r.followups || []).includes(e.chip)) f.push('missing chip ' + e.chip);
    if (cards.some((c) => c._invalid)) f.push('invalid card ' + JSON.stringify(cards.find((c) => c._invalid)._invalid));
    // every product card in a recommendation carries a cited source (zero uncited recommendations)
    if (e.rec || (cv.group === 'recommend' && i > 0)) { recTurns++; if (!cards.filter((c) => c.type === 'product').every((c) => c.source && c.source.sentence && c.source.source_url)) f.push('uncited product card'); else if (!f.length) recOk++; }
    if (f.length) { ok = false; why.push(`turn ${i + 1} "${t.q}": ${f.join('; ')}`); }
  }
  if (ok) pass++; else { fail++; bad.push(cv.id + ' :: ' + why.join(' | ')); }
}
console.log(`CONVERSATIONS ${pass}/${convs.length} passed (${turns} turns, ${recTurns} recommend turns, ${recOk} recommend turns fully correct)`);
for (const b of bad.slice(0, 40)) console.log('  FAIL', b);
process.exit(fail ? 1 : 0);
