// run_coverage.mjs: runs the question bank through the brain headlessly and prints coverage. Blind items are reported separately.
//   node demo-tests/sika-brain/coverage/run_coverage.mjs [out.json] [--wrongs] [--tuned-detail]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBrain } from '../harness.mjs';
import { judge, makeSelectors } from './judge.mjs';
import { cardText } from '../../../public/demo/sika-210c0c/assets/brain/schema.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(fs.readFileSync(path.join(HERE, process.env.BANK || 'bank.json'), 'utf8'));
const brain = makeBrain(); await brain.boot(); const sel = makeSelectors(brain.core().P);
const outFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const res = [];
for (const it of bank) { const a = await brain.ask(it.q, null); const j = judge(it, a, sel); res.push({ messy: it.messy || '', id: it.id, split: it.split, persona: it.persona, category: it.category, type: it.type, q: it.q, cls: j.cls, why: j.why, intent: a.intent, first: a.cards[0] ? a.cards[0].type + ':' + (a.cards[0].product ? a.cards[0].product.id : a.cards[0].title) : '', head: a.cards[0] ? (a.cards[0].headline || '').slice(0, 140) : '', text: process.argv.includes('--keep-text') ? a.cards.map(cardText).join(' | ').slice(0, 900) : undefined }); }
const CL = ['ANSWERED', 'HONEST-NO-DATA', 'WRONG', 'UNHANDLED'];
const tally = (rs) => { const m = Object.fromEntries(CL.map((c) => [c, 0])); for (const r of rs) m[r.cls]++; return m; };
const fmt = (rs) => { const m = tally(rs), n = rs.length; return `n=${n} ANSWERED ${m.ANSWERED} (${(100 * m.ANSWERED / n).toFixed(1)}%)  HONEST-NO-DATA ${m['HONEST-NO-DATA']} (${(100 * m['HONEST-NO-DATA'] / n).toFixed(1)}%)  WRONG ${m.WRONG}  UNHANDLED ${m.UNHANDLED}  | covered (ANSWERED+HONEST) ${(100 * (m.ANSWERED + m['HONEST-NO-DATA']) / n).toFixed(1)}%`; };
console.log('MESSY ALL  ', fmt(res.filter((r) => r.messy))); console.log('MESSY TUNED', fmt(res.filter((r) => r.messy && r.split === 'tuned'))); console.log('MESSY BLIND', fmt(res.filter((r) => r.messy && r.split === 'blind'))); console.log('CLEAN ALL  ', fmt(res.filter((r) => !r.messy)));
console.log('ALL    ', fmt(res)); console.log('TUNED  ', fmt(res.filter((r) => r.split === 'tuned'))); console.log('BLIND  ', fmt(res.filter((r) => r.split === 'blind')));
const grp = (key) => { const g = {}; for (const r of res) (g[r[key]] = g[r[key]] || []).push(r); return g; };
for (const key of ['persona', 'type']) { console.log('-- by ' + key); for (const [k, rs] of Object.entries(grp(key))) console.log('  ' + k.padEnd(20), fmt(rs)); }
if (process.argv.includes('--wrongs')) for (const r of res.filter((r) => r.cls === 'WRONG' && (r.split === 'tuned' || process.argv.includes('--blind-detail')))) console.log('WRONG', r.id, r.split, r.q, '=>', r.why, '|', r.first);
if (process.argv.includes('--tuned-detail')) for (const r of res.filter((r) => r.cls === 'UNHANDLED' && r.split === 'tuned')) console.log('UNH', r.id, r.type, r.q, '=>', r.why, '|', r.first);
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), all: tally(res), tuned: tally(res.filter((r) => r.split === 'tuned')), messy: tally(res.filter((r) => r.messy)), blind: tally(res.filter((r) => r.split === 'blind')), n: res.length, results: res }, null, 1));
