// fixture80.mjs: the quality lane's 80 hand-written questions (golden_fixture.json, not written by this lane) run through the brain.
// Loose judging on purpose: expected product among the cards (top N for find_product), unknown questions decline, forbidden products absent.
import fs from 'node:fs';
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const F = JSON.parse(fs.readFileSync(process.env.FIXTURE || '/home/tech2/klinge-kernel/state/sika/qa_root/demo-tests/sika-210c0c/golden_fixture.json', 'utf8'));
const brain = makeBrain(); let ok = 0; const bad = [];
for (const x of F.questions) {
  const a = await brain.ask(x.q, null); const ids = a.cards.filter((c) => c.product).map((c) => c.product.id); const txt = a.cards.map(cardText).join('\n');
  let pass = true, why = '';
  if (x.unknown) { pass = a.cards.length > 0 && a.cards[0].status === 'UNKNOWN' || !a.cards.some((c) => c.type === 'product'); why = 'should decline'; }
  else {
    const top = x.top || 5; const sel = x.intent === 'find_product' ? ids.slice(0, top) : ids;
    if (x.anyOf && !x.anyOf.some((id) => sel.includes(id))) { pass = false; why = 'expected one of ' + x.anyOf.slice(0, 3).join(','); }
    if (x.noneOf && x.noneOf.some((id) => ids.slice(0, top).includes(id) && !a.cards.some((c) => c.title.startsWith('Ruled out') && c.product && c.product.id === id))) { pass = false; why = 'forbidden product shown'; }
  }
  if (pass) ok++; else bad.push(`${x.id} ${x.q} -> ${why} :: got ${ids.slice(0, 4).join(',') || a.cards.map((c) => c.type).join(',')}`);
}
console.log(`FIXTURE80 ${ok}/${F.questions.length} = ${(100 * ok / F.questions.length).toFixed(1)}%`); for (const b of bad) console.log('  miss', b.slice(0, 220));
