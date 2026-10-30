// Property: no number without a source sentence, on action outputs. Runs the actions over every product and every system combination,
// then checks every card. Also a mutation check: a card with a source removed must fail the property.
import { makeAssistant, ask, data, check, summary } from './_env.mjs';
import { ESTIMATE_LINE, cardCells, cardCsv } from '../../public/demo/sika-210c0c/assets/actions/core.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// a product's own name may carry digits (Sikafloor-264); that is a label, not a figure
let NAMES = [];
const stripNames = (v) => { let o = v; for (const n of NAMES) if (o.includes(n)) o = o.split(n).join(' '); return o; };
/** Problems in one card (empty = clean). */
export function problems(c) {
  const bad = [];
  const cells = cardCells(c);
  for (const r of cells) {
    const v = String(r.value == null ? '' : r.value);
    if (/\d/.test(stripNames(v)) && !(r.input || r.meta || r.name || r.command)) {
      if (!(r.source && r.source.url && r.source.sentence)) bad.push(`number without a source sentence: "${v.slice(0, 80)}" (${r.label})`);
      else if (r.quote && !(norm(v).includes(norm(r.source.sentence)) || norm(r.source.sentence).includes(norm(v)) || norm(v).includes(norm(r.source.sentence).slice(0, 30)))) bad.push(`quoted value does not match its sentence: "${v.slice(0, 60)}"`);
    }
    if (/[—–]/.test(v) || /\$\s?\d|\bprice\b/i.test(v)) bad.push(`dash or price in "${v.slice(0, 60)}"`);
  }
  const quantity = c.action === 'calc' && c.kind === 'quantity' && c.status !== 'unknown' || (c.sections || []).some((s) => /Quantities/.test(s.title)) || cells.some((r) => r.label === 'Quantity' || r.label === 'Quantity needed');
  if (quantity && !c.estimate) bad.push('quantity without the estimate line flag');
  if (c.estimate && !cardCsv(c).trim().endsWith('"' + ESTIMATE_LINE + '"')) bad.push('csv lacks the estimate line');
  // notes and summaries are fixed wording; a digit is allowed only in the reasons the calculator itself gave (they quote the data sheet's condition) or the 3 year SDS rule
  for (const n of [...(c.notes || []), c.summary || '']) { const t = stripNames(n); if (/\d/.test(t) && !/3 years|section 4|I cannot work this out safely|cementitious_kg|notch_mm|thickness_mm|published for|SDS|revision/i.test(t)) bad.push('digit in a note: ' + n.slice(0, 90)); }
  return bad;
}

const idx = await data.index();
NAMES = [...new Set(idx.map((p) => p.n.replace(/[®™]/g, '').replace(/\s+/g, ' ').trim()))].sort((a, b) => b.length - a.length);
let cards = 0; const all = [];
async function one(A, q) { const r = await ask(A, q); if (r.handled) { cards++; all.push([q, r.card]); } return r; }
// every product: spec, safety, time, link, a quantity attempt, a compatibility question
for (const p of idx) {
  const A = makeAssistant();
  for (const q of [`/spec ${p.n}`, `/safety ${p.n}`, `/time ${p.n}`, `/link ${p.n}`, `/calc 10 m2 ${p.n} 6 mm notch 5 mm`, `can I use ${p.n} on concrete`]) await one(A, q);
}
// every tree combination, with an area
const trees = await data.trees();
const sessionless = makeAssistant();
let combos = 0;
for (const env of trees.adhesive.questions[0].options.map((o) => o.id)) for (const tile of trees.adhesive.questions[1].options.map((o) => o.id)) for (const sub of trees.adhesive.questions[2].options.map((o) => o.id)) {
  const words = { internal_wall: 'internal wall', internal_floor: 'internal floor', wet_area: 'bathroom', external_wall: 'external wall', external_floor: 'external floor', pool: 'pool' }[env];
  const tw = { glass_tile: 'glass', natural_stone: 'natural stone', moisture_sensitive_stone: 'moisture sensitive stone', large_format: 'large format', terracotta: 'terracotta', brick_slip: 'brick slip' }[tile] || tile;
  const sw = { cement_screed: 'cement screed', cement_render: 'cement render', brick_block: 'brick', fibre_cement: 'fibre cement sheet', tile_underlay: 'tile underlay', existing_tiles: 'existing tiles', waterproofing_membrane: 'waterproofing membrane', underfloor_heating: 'underfloor heating', self_levelling_underlayment: 'self levelling underlayment' }[sub] || sub;
  const A = makeAssistant();
  await one(A, `/system ${tw} on ${sw}, ${words} 20 m2 6 mm notch`); combos++;
  if (combos % 40 === 0) await one(A, '/pack');
}
let badCards = 0; const samples = [];
for (const [q, c] of all) { const p = problems(c); check(`property: ${q.slice(0, 60)}`, p.length === 0, p.join(' | ')); if (p.length) { badCards++; if (samples.length < 5) samples.push([q, p[0]]); } }
console.log(`cards checked: ${cards} (products ${idx.length} x 6 actions, system combinations ${combos})`);
// mutation: strip one source from a quantity card, the property must fail
const A = makeAssistant(); await ask(A, '/calc 20 m2 Davco Grey One Pot adhesive 6 mm notch'); const r = A.session.last;
check('mutation: clean card passes', problems(r).length === 0, problems(r).join('|'));
const mut = JSON.parse(JSON.stringify(r)); mut.rows.find((x) => x.label === 'Quantity needed').source = null;
check('mutation: removed source is caught', problems(mut).length > 0);
const mut2 = JSON.parse(JSON.stringify(r)); mut2.estimate = false;
check('mutation: missing estimate line is caught', problems(mut2).length > 0);
const mut3 = JSON.parse(JSON.stringify(r)); mut3.rows.find((x) => x.label === 'Published rate').value = '99 Litres cover 1m2';
check('mutation: altered quote is caught', problems(mut3).length > 0);
summary('t_property');
