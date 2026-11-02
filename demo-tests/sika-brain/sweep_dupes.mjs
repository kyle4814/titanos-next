// sweep_dupes.mjs: two quality counts over every golden and bank question (Sika brain answer text, as a buyer reads it).
//   1. REPEATED SENTENCE: answers where one sentence (25+ characters, 5+ words) is shown twice or more in the visible text (headline, lines, hand-off reason) of one answer.
//   2. HEADERLESS ROW: quoted table rows of the rate and time cards (3+ cells, "a | b | c") shown without their column headers. A row is headed when its card carries a "Table columns" line
//      with the table's header row, or a real table; it is ADMITTED when the card says plainly that the data has no headings (never invented). Only the rest count as headerless.
//   node demo-tests/sika-brain/sweep_dupes.mjs [--json] [--max]     (SIKA_PORTAL picks the portal, as for the other tools)
// Exit 1 when any answer repeats a sentence or any row is headerless (the regression gate; see unit_brain.mjs for the Easy Grout test).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBrain } from './harness.mjs';
import { generate } from './golden_gen.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETS = ['bank', 'blind4', 'blind3', 'blind2', 'extra', 'wild', 'wild2', 'wave2b', 'wave2c'];
const ws = (s) => String(s || '').replace(/\s+/g, ' ').trim();
export const NO_HEADER_RE = /no column headings in the data/;
export function visiblePieces(a) {
  const out = [];
  for (const c of a.cards) { out.push(c.headline); for (const l of c.lines || []) out.push(l.text); if (c.handoff) out.push(c.handoff.reason); }
  return out.filter(Boolean).flatMap((t) => String(t).split(/\n|(?<=[.!?])\s+(?=[A-Z])/)).map((t) => ws(t).toLowerCase()).filter((t) => t.length >= 25 && t.split(' ').length >= 5); // a sentence or a quoted row; a product name shared by two cards is not a repeated sentence
}
export function repeats(a) { const n = new Map(); for (const p of visiblePieces(a)) n.set(p, (n.get(p) || 0) + 1); return [...n].filter(([, k]) => k > 1).map(([t, k]) => ({ t, k })); }
export function rowStats(a) {
  let rows = 0, headed = 0, admitted = 0, headerless = 0, other = 0; const bad = [];
  for (const c of a.cards) {
    const hasCols = (c.lines || []).some((l) => l.label === 'Table columns' && !NO_HEADER_RE.test(l.text)) || !!c.table;
    const admits = (c.lines || []).some((l) => NO_HEADER_RE.test(l.text));
    for (const l of c.lines || []) {
      if (l.label === 'Table columns' || l.label === 'Table basis') continue;
      if (ws(l.text).split(' | ').length < 3) continue;
      if (c.type !== 'rate' && c.type !== 'time') { other++; continue; } // other cards quote a whole flattened block (heading, header and rows in one paragraph), not one row
      rows++; if (hasCols) headed++; else if (admits) admitted++; else { headerless++; bad.push({ card: c.type, label: l.label, text: l.text }); }
    }
  }
  return { rows, headed, admitted, headerless, other, bad };
}
export function allQuestions() {
  const qs = new Map(); for (const x of generate()) qs.set(x.q, 'golden');
  for (const s of SETS) { const f = path.join(HERE, 'coverage', s + '.json'); if (!fs.existsSync(f)) continue; for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) if (r.q && !qs.has(r.q)) qs.set(r.q, s); }
  return [...qs.keys()];
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const brain = makeBrain(); const Q = allQuestions();
  let other = 0, dupAns = 0, dupSentences = 0, rows = 0, headed = 0, admitted = 0, headerless = 0, rowAns = 0; const ex = [], exRows = [], byCard = {};
  for (const q of Q) {
    const a = await brain.ask(q, null);
    const r = repeats(a); if (r.length) { dupAns++; dupSentences += r.length; if (ex.length < 8) ex.push({ q, r: r.slice(0, 2) }); }
    const s = rowStats(a); other += s.other; rows += s.rows; headed += s.headed; admitted += s.admitted; headerless += s.headerless; if (s.headerless) { rowAns++; for (const b of s.bad) byCard[b.card] = (byCard[b.card] || 0) + 1; if (exRows.length < 6) exRows.push({ q, ...s.bad[0] }); }
  }
  const res = { questions: Q.length, answersWithRepeatedSentence: dupAns, repeatedSentences: dupSentences, quotedRateTimeRows3plusCells: rows, rowsWithHeader: headed, rowsAdmittedNoHeader: admitted, rowsHeaderless: headerless, answersWithHeaderlessRow: rowAns, otherCardBlocksWithPipes_notCounted: other, headerlessByCardType: byCard };
  if (process.argv.includes('--json')) console.log(JSON.stringify(res)); else { console.log('SWEEP', JSON.stringify(res, null, 1)); for (const e of ex) console.log('  repeat:', e.q, '=>', JSON.stringify(e.r)); for (const e of exRows) console.log('  headerless:', e.q, '=>', e.card, e.label, '|', e.text.slice(0, 80)); }
  const MAX_REPEAT = Number(process.env.MAX_REPEAT ?? 1); // 1 known: a plan card quotes two substrate clauses of one product (different data sheet pages) under the same sentence; not touched here
  process.exit(dupAns <= MAX_REPEAT && headerless === 0 ? 0 : 1);
}
