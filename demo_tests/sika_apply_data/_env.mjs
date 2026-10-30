// Shared test setup: loads the portal data and the engine from this worktree. Plain Node, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistant } from '../../public/demo/sika-210c0c/assets/assistant/engine.js';
import { applyAsk } from '../../public/demo/sika-210c0c/assets/assistant/apply.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORTAL = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
export const DATA = path.join(PORTAL, 'data');
export const rd = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f + '.json'), 'utf8'));
export const exists = (f) => fs.existsSync(path.join(DATA, f + '.json'));
export const FIXTURE = JSON.parse(fs.readFileSync(path.join(HERE, 'qa_fixture.json'), 'utf8'));

export function setup() {
  const products = rd('products'); const documents = rd('documents'); // link verdicts are already merged into documents.json (d.http)
  const engine = createAssistant({ products, documents, categories: rd('categories'), pages: rd('pages'), config: rd('config') });
  const idx = rd('k/_index');
  const deps = { tax: idx.taxonomy, products: new Map(products.map((p) => [p.id, p])), mismatch: new Set(idx.rate_mismatch || []), load: async (id) => (exists('k/' + id) ? rd('k/' + id) : null) };
  return { engine, products, documents, deps, idx, ask: (q, st) => applyAsk(engine, q, st, deps) };
}

let passes = 0, failures = 0;
export function check(name, ok, detail = '') { if (ok) passes++; else { failures++; console.log(`  FAIL: ${name}${detail ? ' :: ' + String(detail).slice(0, 300) : ''}`); } return ok; }
export function summary(label) { console.log(`${label}: ${passes} passed, ${failures} failed`); process.exit(failures ? 1 : 0); }
export const textOf = (ans) => ans.blocks.map((b) => [b.text, b.question, b.title, ...(b.rows || []).map((r) => r.label + ' ' + r.value), ...(b.lines || []).map((l) => l.basis + ' ' + l.quantity), b.chip, ...(b.evidence || []).map((e) => (e.quote || '') + ' ' + e.label)].filter(Boolean).join(' ')).join('\n');
