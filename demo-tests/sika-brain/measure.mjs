// measure.mjs: the wave 2 measurement run. Golden (per intent, diff against the previous last_run.json), every bank set (per intent, per type, ANSWERED / HONEST / WRONG / MISSING, p50 and p95), triage of every WRONG, diff against the previous coverage run.
//   node demo-tests/sika-brain/measure.mjs [--save] [--md <file>] [--gate] [--no-golden]
//   --gate      exit 1 on: unsupported bank expectations, an UNTRIAGED WRONG, bank under 1,000, blind4 under 150, messy under 35 percent
//   --save      write coverage/last_coverage.json (the baseline for the next diff); never touches last_run.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeBrain } from './harness.mjs';
import { judge, makeSelectors } from './coverage/judge.mjs';
import { triage } from './coverage/triage_w2a.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const COV = path.join(HERE, 'coverage');
const arg = (f) => process.argv.includes(f); const argv = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%'; const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const md = []; const say = (s = '') => { md.push(s); console.log(s); };
const SETS = [['bank', 'bank.json'], ['blind4', 'blind4.json'], ['blind3', 'blind3.json'], ['blind2', 'blind2.json'], ['extra', 'extra.json'], ['wild', 'wild.json'], ['wild2', 'wild2.json'], ['wave2b', 'wave2b.json'], ['wave2c', 'wave2c.json']].filter(([, f]) => fs.existsSync(path.join(COV, f)));
const failures = [];
// ---- validate the bank against the data
const v = spawnSync('node', [path.join(COV, 'validate_bank.mjs')], { encoding: 'utf8' });
say(`# Sika brain measurement ${new Date().toLocaleDateString('en-CA')}`); say();
say('## 0. Bank validation (every expectation backed by the published data)'); say('```'); say(v.stdout.trim().split('\n').slice(0, 12).join('\n')); say('```');
if (v.status !== 0) failures.push('bank validation failed');
// ---- golden, diffed against the committed last_run.json
let prev = null; const lastRun = path.join(HERE, 'last_run.json'); if (fs.existsSync(lastRun)) prev = JSON.parse(fs.readFileSync(lastRun, 'utf8'));
let golden = null;
if (!arg('--no-golden')) {
  const out = path.join(process.env.TMPDIR || '/tmp', 'golden_measure_' + process.pid + '.json');
  const g = spawnSync('node', [path.join(HERE, 'run_golden.mjs')], { encoding: 'utf8', env: Object.assign({}, process.env, { GOLDEN_OUT: out }) });
  const lines = g.stdout.split('\n'); const head = lines.find((l) => l.startsWith('GOLDEN ')) || 'GOLDEN (no output)'; const lat = lines.find((l) => /latency in node/.test(l)) || ''; const prop = lines.find((l) => /^PROPERTY TEST/.test(l)) || '';
  if (fs.existsSync(out)) { golden = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); }
  say('## 1. Golden (generated from the data, every product x every intent)'); say('```'); say(head); say(lat.trim()); say(prop); say('```');
  if (golden) {
    say('| intent | now | previous (last_run.json) | change |'); say('|---|---|---|---|');
    for (const [k, vv] of Object.entries(golden.per)) { const pv = prev && prev.per && prev.per[k]; const nowP = 100 * vv.ok / vv.n; const pP = pv ? 100 * pv.ok / pv.n : null; say(`| ${k} | ${vv.ok}/${vv.n} ${nowP.toFixed(1)}% | ${pv ? `${pv.ok}/${pv.n} ${pP.toFixed(1)}%` : 'n/a'} | ${pv ? (nowP - pP >= 0 ? '+' : '') + (nowP - pP).toFixed(2) + ' pts' : ''} |`); }
    say(`| TOTAL | ${golden.ok}/${golden.n} ${pct(golden.ok, golden.n)} | ${prev ? `${prev.ok}/${prev.n} ${pct(prev.ok, prev.n)}` : 'n/a'} | |`);
    const pf = new Set(((prev && prev.fails) || []).map((f) => f.q)); const nf = golden.fails.filter((f) => !pf.has(f.q)); const fixed = ((prev && prev.fails) || []).filter((f) => !golden.fails.some((g) => g.q === f.q));
    say(); say(`Golden failures: ${golden.fails.length} now, ${(prev && prev.fails ? prev.fails.length : 'n/a')} previous. Newly failing: ${nf.length}. Fixed since: ${fixed.length}.`);
    for (const f of nf.slice(0, 10)) say(`- NEW FAIL [${f.kind}] ${f.q}`);
  }
  if (g.status !== 0) failures.push('golden run failed its bar or property test (rc ' + g.status + ')');
}
// ---- the bank sets
const brain = makeBrain(); await brain.boot(); const sel = makeSelectors(brain.core().P);
const prevCov = fs.existsSync(path.join(COV, 'last_coverage.json')) ? JSON.parse(fs.readFileSync(path.join(COV, 'last_coverage.json'), 'utf8')) : null;
const nowCov = {}; const summary = {}; globalThis.__items = {};
for (const [name, file] of SETS) {
  const bank = JSON.parse(fs.readFileSync(path.join(COV, file), 'utf8')); globalThis.__items[name] = Object.fromEntries(bank.map((x) => [x.id, x])); const res = []; const wall = []; const own = [];
  for (const it of bank) {
    const t0 = performance.now(); const a = await brain.ask(it.q, null); wall.push(performance.now() - t0); own.push(a.ms || 0);
    const j = judge(it, a, sel); const row = { id: it.id, q: it.q, type: it.type, persona: it.persona, messy: it.messy || '', split: it.split, cls: j.cls, why: j.why, intent: a.intent || 'none', first: a.cards[0] ? a.cards[0].type + ':' + (a.cards[0].product ? a.cards[0].product.id : a.cards[0].title) : '', text: a.cards.map(cardText).join(' | ').slice(0, 900) };
    row.tri = triage(row); res.push(row);
  }
  const cnt = (rs) => { const m = { ANSWERED: 0, HONEST: 0, BRAIN_WRONG: 0, MISSING: 0, UNTRIAGED: 0 }; for (const r of rs) { if (r.cls === 'ANSWERED') m.ANSWERED++; else if (r.cls === 'HONEST-NO-DATA') m.HONEST++; else if (r.cls === 'UNHANDLED') m.MISSING++; else if (r.tri && r.tri.c === 'BANK-FIX') m.ANSWERED++; else if (r.tri && r.tri.c === 'BRAIN-WRONG') m.BRAIN_WRONG++; else if (r.tri && r.tri.c === 'MISSING') m.MISSING++; else m.UNTRIAGED++; } return m; };
  const line = (m, n, judged = null) => `ANSWERED ${m.ANSWERED} (${pct(m.ANSWERED, n)}), HONEST-NO-DATA ${m.HONEST} (${pct(m.HONEST, n)}), WRONG ${m.BRAIN_WRONG + m.UNTRIAGED} (${pct(m.BRAIN_WRONG + m.UNTRIAGED, n)}${judged == null ? '' : ', judge flagged ' + judged + ' before triage'}), MISSING ${m.MISSING} (${pct(m.MISSING, n)}); pass (ANSWERED + HONEST) ${pct(m.ANSWERED + m.HONEST, n)}`;
  const m = cnt(res); summary[name] = { n: res.length, m, messy: res.filter((r) => r.messy).length };
  const judgedWrong = res.filter((r) => r.cls === 'WRONG').length;
  say(); say(`## ${name} (${file}): n=${res.length}, messy ${res.filter((r) => r.messy).length} (${pct(res.filter((r) => r.messy).length, res.length)})`);
  say(line(m, res.length, judgedWrong)); say(`Judge WRONG before triage: ${judgedWrong}. After triage: BRAIN-WRONG ${m.BRAIN_WRONG}, reclassified MISSING ${res.filter((r) => r.cls === 'WRONG' && r.tri && r.tri.c === 'MISSING').length}, UNTRIAGED ${m.UNTRIAGED}.`);
  say(`Answer time: brain p50 ${q(own, 0.5).toFixed(2)} ms, p95 ${q(own, 0.95).toFixed(2)} ms, max ${Math.max(...own).toFixed(1)} ms; wall p50 ${q(wall, 0.5).toFixed(2)} ms, p95 ${q(wall, 0.95).toFixed(2)} ms (node, no network)`);
  const tab = (key, label) => { const g = {}; for (const r of res) (g[r[key]] = g[r[key]] || []).push(r); say(); say(`| ${label} | n | ANSWERED | HONEST | WRONG | MISSING | pass |`); say('|---|---|---|---|---|---|---|'); for (const [k, rs] of Object.entries(g).sort((a, b) => b[1].length - a[1].length)) { const mm = cnt(rs); say(`| ${k} | ${rs.length} | ${mm.ANSWERED} | ${mm.HONEST} | ${mm.BRAIN_WRONG + mm.UNTRIAGED} | ${mm.MISSING} | ${pct(mm.ANSWERED + mm.HONEST, rs.length)} |`); } };
  if (name === 'bank' || name === 'blind4') { tab('intent', 'brain intent'); tab('type', 'expected type'); if (name === 'bank') tab('persona', 'persona'); }
  const msy = res.filter((r) => r.messy); if (msy.length) say(`\nMessy only: ${line(cnt(msy), msy.length)}`);
  const untri = res.filter((r) => r.cls === 'WRONG' && !r.tri); if (untri.length) failures.push(`${name}: ${untri.length} untriaged WRONG`);
  if (prevCov && prevCov[name]) { const was = prevCov[name]; const reg = res.filter((r) => was[r.id] && (was[r.id] === 'ANSWERED' || was[r.id] === 'HONEST-NO-DATA') && r.cls !== 'ANSWERED' && r.cls !== 'HONEST-NO-DATA'); const imp = res.filter((r) => was[r.id] && !(was[r.id] === 'ANSWERED' || was[r.id] === 'HONEST-NO-DATA') && (r.cls === 'ANSWERED' || r.cls === 'HONEST-NO-DATA')); say(`Diff vs previous run: ${reg.length} regressed, ${imp.length} improved.`); for (const r of reg.slice(0, 15)) say(`- REGRESSED ${r.id} ${r.q} (${r.cls}: ${r.why})`); } else say('Diff vs previous run: no previous coverage baseline (this is the first saved run).');
  nowCov[name] = Object.fromEntries(res.map((r) => [r.id, r.cls]));
  globalThis.__rows = globalThis.__rows || {}; globalThis.__rows[name] = res;
}
// ---- the WRONG register
say(); say('## WRONG register (judge WRONG after triage)');
for (const [name, rows] of Object.entries(globalThis.__rows || {})) for (const r of rows.filter((x) => x.cls === 'WRONG')) say(`- [${name}] ${r.id} ${r.tri ? r.tri.c + ' lane ' + r.tri.lane : 'UNTRIAGED'} | "${r.q}" | ${r.why.slice(0, 110)} | shown ${r.first.slice(0, 50)}${r.tri ? ' | ' + r.tri.note.slice(0, 150) : ''}`);
// ---- the MISSING register: the right answer exists in the data and the brain did not find it; each is a request to a lane (file, question, expected, actual)
const laneOf = (r) => (r.tri && r.tri.lane) || (/typo|slang|sms|voice|units|hand|mutated|wild/.test(r.messy || '') || ['vague', 'business', 'system'].includes(r.type) ? 'C' : 'B');
const expOf = (r) => { const it = (globalThis.__items[r.name] || {})[r.id] || {}; const e = it.exp || {}; return r.type + ': ' + (e.product || (e.products || []).join('+') || e.slug || e.url || (e.allowed ? 'one of ' + e.allowed.slice(0, 2).join(' ') : '') || 'honest decline or one clarifying question') + (e.contains ? ' (value "' + String(e.contains).slice(0, 30) + '")' : ''); };
say(); say('## MISSING register (requests to Lane B / Lane C: question, expected, actual)');
const missBy = { B: [], C: [] };
for (const [name, rows] of Object.entries(globalThis.__rows || {})) for (const r of rows) { const miss = r.cls === 'UNHANDLED' || (r.cls === 'WRONG' && r.tri && r.tri.c === 'MISSING'); if (miss) missBy[laneOf(r)].push(Object.assign({ name }, r)); }
for (const lane of ['B', 'C']) { say(); say(`### Lane ${lane}: ${missBy[lane].length} requests`); for (const r of missBy[lane]) say(`- [${r.name} ${r.id}] "${r.q}" | expected ${expOf(r)} | got ${r.first.slice(0, 60)} (${r.why.slice(0, 70)})`); }
const dumpFile = argv('--dump-wrong'); // every judge WRONG with its bank expectation, for the by-hand review (WRONG_REVIEW_*.md)
if (dumpFile) fs.writeFileSync(dumpFile, JSON.stringify(Object.entries(globalThis.__rows || {}).flatMap(([name, rows]) => rows.filter((x) => x.cls === 'WRONG').map((r) => ({ set: name, ...r, exp: ((globalThis.__items[name] || {})[r.id] || {}).exp || null }))), null, 1));
const bank = summary.bank, b4 = summary.blind4;
if (arg('--gate')) { if (!bank || bank.n < 1000) failures.push('bank under 1,000 questions'); if (!b4 || b4.n < 150) failures.push('blind4 under 150 questions'); if (bank && bank.messy / bank.n < 0.35) failures.push('bank messy share under 35 percent'); if (b4 && b4.messy / b4.n < 0.35) failures.push('blind4 messy share under 35 percent'); }
say(); say(failures.length ? 'MEASURE GATE FAILURES: ' + failures.join('; ') : 'MEASURE GATE OK');
if (arg('--save')) fs.writeFileSync(path.join(COV, 'last_coverage.json'), JSON.stringify(nowCov));
const mdFile = argv('--md'); if (mdFile) fs.writeFileSync(mdFile, md.join('\n') + '\n');
process.exit(arg('--gate') && failures.length ? 1 : 0);
