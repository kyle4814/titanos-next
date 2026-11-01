// t_rank.mjs: numeric ranking checked against the extracted data read straight from data/brain/num (not through the code under test).
import { brain, numIndex, numShard, idOf, makeT } from './_env.mjs';
const { t, done } = makeT('t_rank');
const ask = async (q) => brain.ask(q, null);
const FIELD_OF = [[/open time/, 'open_time', 'max'], [/pot life/, 'pot_life', 'max'], [/compressive/, 'compressive', 'max'], [/lowest voc/, 'voc', 'min'], [/shelf life/, 'shelf_life', 'max'], [/movement/, 'movement', 'max'], [/thickest/, 'layer', 'max'], [/curing rate|cures fastest|fastest curing sealant/, 'cure_rate', 'max']];
const CASES = [
  ['which tile adhesive has the longest open time', 'open_time', 'max'],
  ['which tile adhesive has the longest pot life', 'pot_life', 'max'],
  ['which repair mortar has the highest compressive strength', 'compressive', 'max'],
  ['which product has the highest compressive strength', 'compressive', 'max', true],
  ['which product has the lowest voc', 'voc', 'min', true],
  ['which waterproofing membrane has the lowest voc', 'voc', 'min'],
  ['which grout has the longest shelf life', 'shelf_life', 'max'],
  ['which sealant has the most movement capability', 'movement', 'max'],
  ['which screed has the thickest layer', 'layer', 'max'],
  ['fastest curing sealant', 'cure_rate', 'max'],
];
for (const [q, field, dir, global] of CASES) {
  const a = await ask(q); const c = a.cards[0];
  t(`"${q}": an ordered advice card`, c.type === 'advice' && /ordered by/.test(c.title), c.title);
  const ids = (c.links || []).map((l) => idOf(l.label));
  t(`"${q}": every product shown is a real product with the field in the extracted data`, ids.length >= 2 && ids.every((id) => id && numIndex.f[field] && numIndex.f[field][id]), JSON.stringify(ids));
  const key = dir === 'max' ? 1 : 0; const vals = ids.map((id) => numIndex.f[field][id][key]);
  t(`"${q}": values are in ${dir === 'max' ? 'descending' : 'ascending'} order`, vals.every((v, i) => i === 0 || (dir === 'max' ? vals[i - 1] >= v : vals[i - 1] <= v)), JSON.stringify(vals));
  if (global) { const all = Object.values(numIndex.f[field]).map((x) => x[key]); const best = dir === 'max' ? Math.max(...all) : Math.min(...all); t(`"${q}": the first product holds the best value of ALL ${all.length} products (${best})`, vals[0] === best, `${vals[0]} vs ${best}`); }
  // each shown value is cited: the quoted sentence is in the card and the extracted record carries a data sheet or page source
  const rec = ids.map((id) => numShard(id).f[field][0]);
  t(`"${q}": each line has a cited sentence with a source url`, c.facts.length === ids.length && c.facts.every((f, i) => f.sentence === rec[i].t && /^https:\/\/aus\.sika\.com/.test(f.source_url)), JSON.stringify(c.facts.map((f) => f.source_url)));
  const left = c.lines.find((l) => l.label === 'Not published, so left out');
  if (left) { const names = left.text.split(': no ')[0].replace(/ and \d+ more$/, '').split(', '); t(`"${q}": every product named as "not published" truly has no ${field} figure`, names.every((nm) => { const id = idOf(nm); return id && !(numIndex.f[field] && numIndex.f[field][id]); }), left.text); }
  if (field === 'compressive') t(`"${q}": says only 28 day figures are compared`, c.lines.some((l) => l.label === 'Same age only'));
  if (field === 'compressive') t(`"${q}": every compared product has a 28 day figure in its own sentence`, rec.every((r) => r.v.items.some((x) => x.age_days === 28)) && c.facts.every((f) => /28/.test(f.sentence)), JSON.stringify(c.facts.map((f) => f.sentence.slice(0, 50))));
}
// the figure shown for a line equals digits that are in the quoted sentence (no converted number appears)
{
  const a = await ask('fastest curing adhesive'); const c = a.cards[0];
  t('shown figures use the unit printed in the sentence (no minutes conversion)', c.lines.filter((l) => /curing or set time/.test(l.text) && l.label !== 'Not published, so left out').every((l) => { const d = (l.text.match(/[\d.]+/g) || []); const f = c.facts.find((x) => true); return d.every((x) => c.facts.some((ff) => ff.sentence.includes(x))); }), JSON.stringify(c.lines.map((l) => l.text)));
}
// price is never ranked
for (const q of ['cheapest tile adhesive', 'which sealant is the cheapest', 'what is the lowest price grout', 'best price screed']) { const a = await ask(q); t(`"${q}" is declined, no ordering`, a.cards.every((c) => c.type === 'unknown'), a.cards.map((c) => c.title).join('|')); }
// a field no product in the group publishes is an honest decline, never a guess
{ const a = await ask('which waterproofing membrane has the highest compressive strength'); const c = a.cards[0]; t('a field nobody in the group publishes does not produce a ranked list with invented numbers', !/ordered by the highest published 28 day compressive/.test(c.title) || (c.links || []).every((l) => numIndex.f.compressive[idOf(l.label)]), c.title); }
done();
