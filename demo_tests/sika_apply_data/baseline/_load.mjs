// _load.mjs: test helper that reads the injected data files (tests may use fs; src/ never does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistant } from '../../../public/demo/sika-210c0c/assets/assistant/engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.SIKA_DATA || path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c', 'data');
export const rd = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f + '.json'), 'utf8'));

export function load() {
  const data = { products: rd('products'), documents: rd('documents'), categories: rd('categories'), pages: rd('pages'), config: rd('config') };
  return data;
}
export function make(data = load()) { return { data, assistant: createAssistant(data) }; }

let failures = 0, passes = 0;
export function check(name, ok, detail = '') { if (ok) passes++; else { failures++; console.log(`  FAIL: ${name}${detail ? ' :: ' + detail : ''}`); } return ok; }
export function summary(label) { console.log(`${label}: ${passes} passed, ${failures} failed`); process.exit(failures ? 1 : 0); }
export const counts = () => ({ passes, failures });
