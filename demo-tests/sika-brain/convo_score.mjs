// convo_score.mjs: runs convo_bank.json through the brain with session context (state threaded turn to turn), scores the FINAL turn of each row against its class checks + row props.
// Usage: node convo_score.mjs [--bank file.json] [--gate] [--json out.json] [--md]     Report-only: exit 0 always. --gate: exit 1 only if a social row hits the not-found card.
// No network, no model: the brain is the local rule engine (harness.mjs).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const GATE = args.includes('--gate'); const MD = args.includes('--md'); const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const bankFile = args.includes('--bank') ? args[args.indexOf('--bank') + 1] : 'convo_bank.json';
const bank = JSON.parse(fs.readFileSync(path.resolve(HERE, bankFile), 'utf8'));
const NOTDOC = /not in the published documentation|I do not know this/i;
const UNITS = /\d[\d.,]*\s*(m2|m²|sqm|m\b|metres?|litres?|l\b|pails?|cartridges?|bags?|kg|coats?|tubes?|units?|mm)/i;
const chipsOf = (a) => { const c = a.cards[0] || {}; return Math.max((c.choices || []).length, (c.followups || []).length, (a.followups || []).length); };
const txtOf = (a) => a.cards.map(cardText).join('\n');
const brain = makeBrain();
const results = [];
for (const row of bank.rows) {
  let state = null, a = null; const transcript = [];
  for (const q of row.turns) { a = await brain.ask(q, state); state = a.state; const c = a.cards[0] || {}; transcript.push({ q, type: c.type || '(none)', title: c.title || '', head: (c.headline || '').replace(/\s+/g, ' ').slice(0, 170), chips: chipsOf(a) }); }
  const c = a.cards[0] || {}; const t = txtOf(a); const p = row.props || {}; const cls = row.class; const fails = [];
  const notfound = c.type === 'unknown' || NOTDOC.test((c.title || '') + ' ' + (c.headline || '')); // first card only: a comparison card legitimately says 'not in the published documentation' for a silent column
  if (cls !== 'honest-no' && notfound) fails.push('not-found-card');
  if (cls === 'social') { if (!notfound && c.type !== 'choose') fails.push('social-not-a-warm-reply'); else if (!notfound && chipsOf(a) < 3) fails.push('social-no-starter-chips'); if (p.short && (c.headline || '').length + (c.title || '').length >= 330) fails.push('social-too-long'); }
  if (cls === 'clarify') { if (!notfound && c.type !== 'choose') fails.push('vague-answered-instead-of-clarified'); else if (!notfound && (chipsOf(a) < 3 || chipsOf(a) > 5)) fails.push('clarify-chip-count-off'); }
  if (cls === 'pick') { if (!notfound && c.type === 'choose') fails.push('pick-asked-clarifier-instead'); else if (!notfound && !/^My pick/.test(c.headline || '') && !(a.trace || []).includes('chat:tie')) fails.push(c.type === 'advice' && /whose published text|match your words/.test(c.title) ? 'pick-got-unranked-list' : 'pick-no-My-pick-lead'); else if (!notfound && !a.cards.some((x) => x.source && x.source.sentence)) fails.push('pick-no-quoted-sentence'); }
  if (cls === 'answer' && !notfound && c.type === 'choose') fails.push('answer-got-clarifier-loop');
  if (p.strict) { if (!notfound) fails.push('honest-no-not-stated-as-unpublished'); if (a.cards.some((x) => x.product)) fails.push('honest-no-named-a-product'); }
  if (cls === 'honest-no') { if (!(c.type === 'unknown' || /Technical Services|not.*stock|price|published/i.test(t))) fails.push('honest-no-missing-handoff'); }
  if (cls === 'compare' && !notfound) { const prods = a.cards.filter((x) => x.product).length; if (a.intent !== 'compare' && prods < 2) fails.push('compare-not-side-by-side'); }
  if (cls === 'quantity' && !notfound) { if (c.type === 'choose') fails.push('quantity-clarifier-no-number'); else if (!['rate', 'calc'].includes(a.intent) && !['rate', 'calc'].includes(c.type) && !UNITS.test(t)) fails.push('quantity-no-number'); }
  if (p.room && !notfound && !new RegExp(p.room, 'i').test(t)) fails.push('lost-the-room-from-turn-1');
  if (p.has && !notfound && !new RegExp(p.has, 'i').test(t)) fails.push('followup-missing-expected-content');
  if (p.not && new RegExp(p.not, 'i').test(t)) fails.push('forbidden-content');
  results.push({ id: row.id, cat: row.cat, class: cls, turns: row.turns, pass: fails.length === 0, fails, transcript, finalType: c.type || '(none)' });
}
// per-class and per-category pass rates
const agg = (key) => { const m = {}; for (const r of results) { const k = r[key]; m[k] = m[k] || { n: 0, pass: 0 }; m[k].n++; if (r.pass) m[k].pass++; } return m; };
const pct = (x) => (100 * x.pass / x.n).toFixed(1) + '%';
const byClass = agg('class'), byCat = agg('cat');
const pat = {}; for (const r of results) for (const f of r.fails) { (pat[f] = pat[f] || []).push(r); }
const ranked = Object.entries(pat).sort((x, y) => y[1].length - x[1].length);
const total = { n: results.length, pass: results.filter((r) => r.pass).length };
const fmtT = (r) => r.transcript.map((s) => `    U: ${s.q}\n    B: [${s.type}] ${s.title}${s.head && s.head !== s.title ? ' :: ' + s.head : ''}${s.chips ? ' (chips ' + s.chips + ')' : ''}`).join('\n');
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ total, byClass, byCat, patterns: ranked.map(([k, v]) => ({ pattern: k, count: v.length, ids: v.map((r) => r.id) })), results }, null, 1));
console.log(`CONVO SCORE: ${total.pass}/${total.n} rows pass (${(100 * total.pass / total.n).toFixed(1)}%), report-only`);
console.log('By class: ' + Object.entries(byClass).map(([k, v]) => `${k} ${v.pass}/${v.n} ${pct(v)}`).join(' | '));
console.log('By category: ' + Object.entries(byCat).map(([k, v]) => `${k} ${v.pass}/${v.n} ${pct(v)}`).join(' | '));
console.log('Top failure patterns:');
for (const [k, v] of ranked.slice(0, 15)) { console.log(`  ${String(v.length).padStart(3)}  ${k}`); const ex = v.slice(0, MD ? 3 : 2); for (const r of ex) console.log(`       e.g. ${r.id}\n${fmtT(r)}`); }
if (GATE) {
  const bad = results.filter((r) => r.class === 'social' && r.fails.includes('not-found-card'));
  if (bad.length) { console.log(`GATE FAIL: ${bad.length} social row(s) hit the not-found card: ${bad.map((r) => r.id).join(', ')}`); process.exit(1); }
  console.log('GATE OK: no social row hits the not-found card');
}
process.exit(0);
