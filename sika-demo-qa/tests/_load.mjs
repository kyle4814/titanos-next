// _load.mjs: test helper that reads the injected data files (tests may use fs; src/ never does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistant } from '../src/engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.SIKA_DATA || path.join(HERE, '..', 'data');
export const rd = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f + '.json'), 'utf8'));

export function load() {
  const data = { products: rd('products'), documents: rd('documents'), categories: rd('categories'), pages: rd('pages'), config: rd('config') };
  // optional knowledge files (a missing file means the feature is off, as in the portal)
  const knowledge = {};
  for (const k of ['problems', 'rates', 'compatibility', 'safety', 'decision_trees']) { const f = path.join(DATA, 'knowledge', k + '.json'); if (fs.existsSync(f)) knowledge[k] = JSON.parse(fs.readFileSync(f, 'utf8')); }
  if (Object.keys(knowledge).length) data.knowledge = knowledge;
  return data;
}
export function make(data = load()) { return { data, assistant: createAssistant(data) }; }

let failures = 0, passes = 0;
export function check(name, ok, detail = '') { if (ok) passes++; else { failures++; console.log(`  FAIL: ${name}${detail ? ' :: ' + detail : ''}`); } return ok; }
export function summary(label) { console.log(`${label}: ${passes} passed, ${failures} failed`); process.exit(failures ? 1 : 0); }
export const counts = () => ({ passes, failures });
