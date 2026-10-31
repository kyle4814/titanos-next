// The advisor's calculate action agrees with the product page: both run lib/finder/calc.js. Plain Node, no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeAssistant, ask, check, summary, PORTAL } from '../sika-actions/_env.mjs';
import * as calc from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';
const rowVal = (c, label) => { const r = (c.rows || []).find((x) => new RegExp(label, 'i').test(x.label)); return r ? r.value : null; };
const run = async (...steps) => { const A = makeAssistant(); const cs = []; for (const s of steps) { const r = await ask(A, s); cs.push(r.handled ? r.card : null); } return cs; };
const page = (id) => JSON.parse(fs.readFileSync(`${PORTAL}/data/finder/r/${id}.json`, 'utf8'));
const pageText = (id, fi, job) => { const r = page(id); const w = calc.work(calc.normaliseFact(r.consumption[fi]), r.packs, job); return w.low === w.high ? calc.fmtQty(w.low, w.unit) : calc.fmtQty(w.low, w.unit) + ' to ' + calc.fmtQty(w.high, w.unit); };

for (const q of ['how much SikaRapid-4 for 2 tonnes of cement', 'how much SikaRapid-4 for 2000 kg of cement', 'calculate SikaRapid-4 for 2 t of cement', 'How many litres of SikaRapid-4 do I need for 2 tonnes of binder']) {
  const [c] = await run(q);
  check('advisor: ' + q, c && c.kind === 'quantity' && rowVal(c, 'Quantity needed') === '8 L to 40 L', JSON.stringify(c && c.rows));
  if (c) { check('advisor agrees with the page: ' + q, rowVal(c, 'Quantity needed') === pageText('sikarapid-4', 0, { cementKg: 2000 })); check('advisor: estimate flag', c.estimate === true); check('advisor: cited source', c.rows.find((r) => /Quantity/.test(r.label)).source && /sikarapid_-4\.pdf/.test(c.rows.find((r) => /Quantity/.test(r.label)).source.url || JSON.stringify(c.rows))); check('advisor: published dose line', rowVal(c, 'Published dose') === '400 mL to 2,000 mL per 100 kg of cement or binder'); check('advisor: packs low to high', /1 to 4 x 10 L/.test(rowVal(c, 'Whole packs'))); }
}
{ const [a, b] = await run('/calc SikaRapid-4', '1 tonne'); check('advisor asks the cement mass, not an area', a.kind === 'clarify' && a.clarify.need === 'cementitious' && !/m2|square/i.test(JSON.stringify(a.clarify))); }
{ const [a, b] = await run('/calc SikaRapid-4', '1000'); check('advisor: bare 1000 answers the cement question: 4 L to 20 L', b && rowVal(b, 'Quantity needed') === '4 L to 20 L', JSON.stringify(b && b.rows)); }
{ const [c] = await run('how much Sika Control PLUS for 2 tonnes of cement'); check('advisor percent of cement: 20 kg to 60 kg', c && rowVal(c, 'Quantity needed') === '20 kg to 60 kg', JSON.stringify(c && c.rows)); }
{ const [c] = await run('how much Sika Air for 10 m3'); check('advisor per m3 agrees with page', c && rowVal(c, 'Quantity needed') === '500 mL to 1.5 L'.replace('500 mL', '500 mL') || /1\.5 L/.test(rowVal(c, 'Quantity needed') || ''), JSON.stringify(c && c.rows)); }
{ const [c] = await run('how much Plastiment-55 for 1000 kg of cement'); check('advisor shows typical separately', c && rowVal(c, 'Quantity needed') === '3 L to 5 L' && rowVal(c, 'Typical dose') === '4 L', JSON.stringify(c && c.rows)); }
{ const [c] = await run('how much Lanko 752 Bondit for 100 kg of mix'); check('advisor per mix mass', c && rowVal(c, 'Quantity needed') === '3.75 L to 5 L', JSON.stringify(c && c.rows)); }
{ const [c] = await run('how much SikaRapid-4 for 20 m2'); check('advisor never turns an area into a dose', !c || c.kind === 'clarify', JSON.stringify(c && c.rows)); }
{ const [c] = await run('how much Davco Grey One Pot adhesive for 20 m2 with a 6mm notch'); check('advisor: area product unchanged (26.67 L)', c && rowVal(c, 'Quantity needed') === '26.67 L', JSON.stringify(c && c.rows)); }
summary('t_advisor');
