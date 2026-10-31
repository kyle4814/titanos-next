// Golden job gate: hundreds of room sentences through the actions layer. Every answer is either a job card whose every line is cited (or says ask Technical Services)
// and equals the system finder's own numbers, or an honest "ask Technical Services" / one clarifying question. Never an uncited quantity. Bar: 100% property, 0 violations.
import { makeAssistant, ask, data, check, summary } from './_env.mjs';
import { ESTIMATE_LINE, cardCsv } from '../../public/demo/sika-210c0c/assets/actions/core.js';
import { sheetModel } from '../../public/demo/sika-210c0c/assets/lib/finder/model.js';
import { ASK_TS } from '../../public/demo/sika-210c0c/assets/actions/job.js';

const S = await data.systems();
const ROOMS = [['2.4 x 1.8', 2.4, 1.8], ['2400 x 1800 mm', 2.4, 1.8], ['3 by 2.5 m', 3, 2.5], ['1.5m x 1.5m', 1.5, 1.5], ['3,2 x 2,7 m', 3.2, 2.7], ['900 x 900 mm', 0.9, 0.9], ['4 x 3 m', 4, 3], ['2.1m by 1.5m', 2.1, 1.5]];
const SUBS = ['concrete', 'cement screed', 'plasterboard', 'fibre cement sheet', 'timber', 'existing tiles', 'brick', 'AAC'];
const TILES = ['', ', porcelain', ', mosaic', ', natural stone', ', large format', ', glass'];
const PLACES = ['bathroom', 'laundry', 'balcony', 'kitchen', 'ensuite', 'pool'];
const HEIGHTS = ['', ', walls to 1.2 m', ', walls to 1.8 m', ', walls to 2.1 m', ', floor only'];
let seed = 31102026; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const questions = [];
for (const room of ROOMS) for (const sub of SUBS) questions.push(`${pick(PLACES)} ${room[0]}${pick(HEIGHTS)}, over ${sub}${pick(TILES)}`);
for (let i = 0; i < 400; i++) { const r = pick(ROOMS); questions.push(`${pick(PLACES)} ${r[0]}${pick(HEIGHTS)}, on ${pick(SUBS)}${pick(TILES)}`); }
let jobs = 0, asks = 0, unknown = 0, bad = 0, lines = 0; const kinds = {};
const note = (q, why) => { bad++; if (bad <= 6) console.log('  BAD', q, '::', why); };
for (const q of questions) {
  const A = makeAssistant(); let c = (await ask(A, q)).card;
  if (c.kind === 'clarify') { asks++; c = (await ask(A, 'walls to 1.8 m, floor only')).card; }
  kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  if (c.kind !== 'job') { if (c.status === 'unknown' || c.kind === 'clarify') { unknown++; continue; } note(q, 'kind ' + c.kind); continue; }
  jobs++;
  if (!c.estimate || !cardCsv(c).trim().endsWith('"' + ESTIMATE_LINE + '"')) note(q, 'estimate sentence missing');
  for (const sy of c.job.systems) {
    const m = sheetModel(S, sy.sel, { area: sy.area, length: sy.length || undefined, allowancePct: 0 });
    if (!m.ok) { note(q, 'system does not resolve'); continue; }
    for (const l of sy.lines) {
      lines++;
      const row = m.rows.find((x) => x.role === l.role);
      if (l.status === 'worked') {
        if (!(l.rate && l.rate.url && l.rate.text)) note(q, `worked line uncited: ${l.name}`);
        if (!(row.calc.ok && Math.abs(l.low - row.calc.low) < 0.005 && Math.abs(l.high - row.calc.high) < 0.005)) note(q, `quantity differs from the sheet: ${l.name}`);
        if (/\$\s?\d|[—–]/.test(JSON.stringify(l))) note(q, 'price or dash');
      } else if (l.status !== 'ask') note(q, 'line neither worked nor ask');
    }
  }
  for (const s of c.sections) for (const r of s.rows) if (!((r.source && r.source.url && r.source.sentence) || new RegExp(ASK_TS).test(r.value))) note(q, `row uncited: ${r.label}`);
}
console.log(`questions ${questions.length}: job cards ${jobs}, honest unknown/clarify ${unknown}, one-question rounds ${asks}, lines checked ${lines}, kinds ${JSON.stringify(kinds)}`);
check('golden job: 0 violations (every line cited or ask Technical Services, equal to the sheet, estimate sentence present)', bad === 0, String(bad));
check('golden job: at least 60% of the sentences produced a job list', jobs / questions.length >= 0.6, `${jobs}/${questions.length}`);
summary('t_golden_job');
