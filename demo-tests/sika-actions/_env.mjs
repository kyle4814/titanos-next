// Shared test setup for the actions: a file store over the portal data folder, plain Node, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createData } from '../../public/demo/sika-210c0c/assets/actions/core.js';
import { createActions, newSession } from '../../public/demo/sika-210c0c/assets/actions/flow.js';
import { createMemory } from '../../public/demo/sika-210c0c/assets/actions/memory.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORTAL = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
export const DATA = path.join(PORTAL, 'data');
const cache = new Map();
export const fileStore = {
  get(p) {
    if (!cache.has(p)) { const f = path.join(DATA, p); cache.set(p, Promise.resolve(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null)); }
    return cache.get(p);
  },
};
export const data = createData(fileStore);
export const config = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
export function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; }
export function makeAssistant({ storage = memStorage(), now } = {}) {
  const memory = createMemory(storage, () => new Date('2026-10-30T10:00:00Z'));
  const a = createActions({ data, memory, config, now: now || (() => new Date('2026-10-30T10:00:00Z')) });
  return { ...a, memory, storage, session: newSession() };
}
let passes = 0, failures = 0; const failed = [];
export function check(name, ok, detail = '') { if (ok) passes++; else { failures++; failed.push(name); console.log(`  FAIL: ${name}${detail ? ' :: ' + String(detail).slice(0, 400) : ''}`); } return ok; }
export function summary(label) { console.log(`${label}: ${passes} passed, ${failures} failed`); process.exit(failures ? 1 : 0); }
export const ask = async (A, text) => { const r = await A.run(text, A.session); A.session = r.session; return r; };
