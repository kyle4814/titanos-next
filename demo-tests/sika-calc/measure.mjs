// Before/after: how many calculator questions the advisor can work out, base commit ca1528765 against now. A question counts as computed when the final card is a
// quantity; "after one question" means it asked once and the recommended chip (or its default) completed it. usage: node measure.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const Q = JSON.parse(fs.readFileSync(path.join(HERE, 'questions.json'), 'utf8'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-base-')); if (!dir.startsWith(os.tmpdir())) process.exit(2);
execFileSync('bash', ['-c', `git -C "${HERE}/../.." archive ca1528765 public/demo/sika-210c0c | tar -x -C "${dir}"`]);
async function runner(portal) {
  const core = await import(pathToFileURL(path.join(portal, 'assets/actions/core.js')).href), flow = await import(pathToFileURL(path.join(portal, 'assets/actions/flow.js')).href), mem = await import(pathToFileURL(path.join(portal, 'assets/actions/memory.js')).href);
  const cache = new Map(); const DATA = path.join(portal, 'data');
  const store = { get(p) { if (!cache.has(p)) { const f = path.join(DATA, p); cache.set(p, Promise.resolve(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null)); } return cache.get(p); } };
  const data = core.createData(store); const config = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
  return async (q) => {
    const m = new Map(); const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
    const a = flow.createActions({ data, memory: mem.createMemory(st, () => new Date('2026-11-01T10:00:00Z')), config, now: () => new Date('2026-11-01T10:00:00Z') }); let session = flow.newSession();
    let r = await a.run(q, session); session = r.session; if (r.handled && r.card && r.card.kind === 'quantity') return 'direct';
    if (r.handled && r.card && r.card.kind === 'clarify') { const o = r.card.clarify.options && r.card.clarify.options[0]; if (o) { r = await a.run(o.value, session); if (r.handled && r.card && r.card.kind === 'quantity') return 'after one question'; } }
    return 'no';
  };
}
const tally = async (portal) => { const run = await runner(portal); const t = { direct: 0, 'after one question': 0, no: 0 }; const per = []; for (const q of Q) { let k = 'no'; try { k = await run(q); } catch { k = 'no'; } t[k]++; per.push([q, k]); } return { t, per }; };
const before = await tally(path.join(dir, 'public/demo/sika-210c0c'));
const after = await tally(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
fs.rmSync(dir, { recursive: true, force: true });
const n = Q.length; const c = (x) => x.direct + x['after one question'];
console.log(`QUESTIONS ${n}`); console.log('BEFORE', JSON.stringify(before.t), 'computed', c(before.t)); console.log('AFTER ', JSON.stringify(after.t), 'computed', c(after.t));
const still = after.per.filter((x) => x[1] === 'no').map((x) => x[0]); console.log('STILL NOT COMPUTED', JSON.stringify(still));
if (process.argv.includes('--json')) console.log(JSON.stringify({ n, before: before.t, after: after.t, still }));
process.exit(c(after.t) > c(before.t) ? 0 : 1);
