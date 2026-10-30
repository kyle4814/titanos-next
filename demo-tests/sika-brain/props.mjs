// props.mjs: property checks run over EVERY generated answer.
// P1 no number in any answer without a source: every number a visitor can read is in a fact sentence or version, a product name, the question, or a recomputed calculation.
// P2 a PUBLISHED fact carries a sentence and a URL. P3 a PUBLISHED card carries a source line. P4 cards validate against the schema.
// P5 no competitor name, no "signed", no dash characters, no compliance claim and no price outside a quoted sentence.
import fs from 'node:fs';
import { cardText, validateCard } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { numbersIn } from '../../public/demo/sika-210c0c/assets/brain/text.js';
const LANES = process.env.SIKA_LANES || '/home/tech2/klinge-kernel/state/sika/lanes';
let LR = null;
const laneFacts = () => { if (LR) return LR; const r = JSON.parse(fs.readFileSync(`${LANES}/knowledge/rates.json`, 'utf8')).products; LR = new Map(); for (const p of Object.values(r)) for (const fs_ of Object.values(p.facts)) for (const f of fs_) LR.set(f.id, f); return LR; };
let PK = null;
const packsOf = (pid) => { if (!PK) { PK = JSON.parse(fs.readFileSync(`${LANES}/knowledge/rates.json`, 'utf8')).products; } return ((PK[pid] && PK[pid].facts.pack_sizes) || []).flatMap((f) => (f.parsed && f.parsed.sizes) || []); };
const r2 = (x) => String(Math.round((x + 1e-9) * 100) / 100);
/** independent re-implementation of the quantity maths (does not import cards.js) */
export function expectedQuantity(parsed, calcReady, area) {
  if (!calcReady || !parsed || !parsed.basis_stated) return null;
  const m = parsed.model;
  if (m === 'pack_covers_area' && parsed.area_min > 0) return { unit: parsed.unit, lo: area * parsed.amount / parsed.area_max, hi: area * parsed.amount / parsed.area_min };
  if (m === 'area_per_unit' && parsed.min > 0 && /^(L|kg)$/.test(parsed.unit || '')) return { unit: parsed.unit, lo: area / parsed.max, hi: area / parsed.min };
  if (m === 'per_area' && /^(kg|L)$/.test(parsed.unit || '') && parsed.area_unit === 'm2' && !(parsed.coats_max > 1)) return { unit: parsed.unit, lo: area * parsed.min, hi: area * parsed.max };
  return null;
}
const COMPETITORS = /\b(mapei|ardex|laticrete|bostik|fosroc|dunlop|parchem|sikkens|bmcc|sealer?s? plus|ardit)\b/i;
export function checkAnswer(question, ans) {
  const bad = []; const qn = new Set(numbersIn(question));
  for (const c of ans.cards) {
    const v = validateCard(c); if (v.length) bad.push(['P4', v.join(',')]);
    for (const f of c.facts) if (f.status === 'PUBLISHED' && (!f.sentence || !f.source_url)) bad.push(['P2', f.sentence.slice(0, 40)]);
    if (c.type !== 'choose' && c.status === 'PUBLISHED' && !(c.source && c.source.sentence)) bad.push(['P3', c.title]);
    const text = cardText(c);
    const allowed = new Set(qn);
    for (const f of c.facts) { for (const n of numbersIn(f.sentence)) allowed.add(n); for (const n of numbersIn(f.doc_version)) allowed.add(n); if (f.page != null) allowed.add(String(f.page)); }
    if (c.product) for (const n of numbersIn(c.product.name)) allowed.add(n);
    for (const l of c.links || []) for (const n of numbersIn(l.label)) allowed.add(n);
    if (c.table) for (const col of c.table.cols) for (const n of numbersIn(col)) allowed.add(n);
    if (c.type === 'system') { for (const n of numbersIn(c.title)) allowed.add(n); for (const r of c.table.rows) for (const n of numbersIn(r[1])) allowed.add(n); } // product names in a system table are identifiers, like a card's product name
    for (const l of c.lines || []) if (l.label === 'Primer it names') for (const n of numbersIn(l.text)) allowed.add(n); // names of catalogue products
    if (c.calc) { // recompute from the lane's own parsed facts
      const area = c.calc.inputs.area_m2; allowed.add(r2(area));
      for (const id of c.calc.inputs.facts) {
        const lf = laneFacts().get(id); if (!lf) { bad.push(['P1-calc', 'fact not in lane ' + id]); continue; }
        const q = expectedQuantity(lf.parsed, lf.calc_ready, area); if (!q) { bad.push(['P1-calc', 'calc from a fact that is not calc-ready ' + id]); continue; }
        allowed.add(r2(q.lo)); allowed.add(r2(q.hi));
        for (const s of packsOf(id.split(':')[0])) { allowed.add(String(Number(s.amount))); if (s.unit === q.unit) allowed.add(String(Math.ceil(q.hi / s.amount - 1e-9))); }
      }
    }
    for (const n of numbersIn(text)) if (!allowed.has(n)) bad.push(['P1', `${n} in "${text.replace(/\s+/g, ' ').slice(0, 120)}"`]);
    // P5 over the words that are ours (everything except the quoted sentences)
    let ours = [c.title, c.headline, c.handoff && c.handoff.reason, ...(c.lines || []).filter((l) => !l.fact).map((l) => l.label + ' ' + l.text)].filter(Boolean).join(' ');
    for (const f of c.facts) if (f.sentence) ours = ours.split(f.sentence).join(' ');
    if (c.product) ours = ours.split(c.product.name).join(' ');
    if (COMPETITORS.test(ours)) bad.push(['P5', 'competitor ' + ours.match(COMPETITORS)[0]]);
    if (/\bsigned\b/i.test(text)) bad.push(['P5', 'signed']);
    if (/[–—]/.test(ours)) bad.push(['P5', 'dash']);
    if (/\b(complies|compliant|conforms|certified|approved by)\b/i.test(ours)) bad.push(['P5', 'compliance claim in our words']);
    if (/[$]|\baud\b|\bdollars?\b/i.test(ours)) bad.push(['P5', 'price']);
  }
  return bad;
}
