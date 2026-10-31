// _env.mjs: shared helpers for the wave 2b tests (brain in node, data read straight from disk so the tests do not trust the code under test).
import fs from 'node:fs';
import path from 'node:path';
import { makeBrain, PORTAL } from '../sika-brain/harness.mjs';
export { PORTAL };
export const brain = makeBrain();
await brain.boot();
export const P = brain.core().P;
export const byName = new Map(P.map((p) => [p.n, p.id]));
export const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
export const numIndex = rd('data/brain/num/index.json');
export const numShard = (id) => { const f = path.join(PORTAL, 'data/brain/num', encodeURIComponent(id) + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
export const prodShard = (id) => rd('data/brain/p/' + encodeURIComponent(id) + '.json');
export function makeT(name) {
  let pass = 0, fail = 0;
  return { t: (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('FAIL ' + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); } }, done: () => { console.log(`${name}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }, counts: () => ({ pass, fail }) };
}
export const idOf = (name) => byName.get(String(name).replace(/ \(fit to your job not documented in its text\)$/, ''));
