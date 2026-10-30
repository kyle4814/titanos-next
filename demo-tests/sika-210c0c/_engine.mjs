// Loads the engine that SHIPS (PORTAL/assets/assistant) with the portal's own data, for node tests.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PORTAL } from './_env.mjs';
export const rd = (f) => JSON.parse(fs.readFileSync(path.join(PORTAL, 'data', f + '.json'), 'utf8'));
const imp = (rel) => import(pathToFileURL(path.join(PORTAL, rel)).href);
export async function loadEngine({ layered = false } = {}) {
  const { createAssistant } = await imp('assets/assistant/engine.js');
  const SYN = await imp('assets/assistant/synonyms.js');
  const data = { products: rd('products'), documents: rd('documents'), categories: rd('categories'), pages: rd('pages'), config: rd('config') };
  const base = createAssistant(data);
  if (!layered) return { data, assistant: base, SYN };
  // what the portal ships: base engine + the data lane's applyAsk layer (T04 verdicts, T15 rates, T16 SDS, T21 times) + the assistant lane's hand-off (inside the engine)
  const { applyAsk } = await imp('assets/assistant/apply.js');
  const idx = rd('k/_index'); const exists = (f) => fs.existsSync(path.join(PORTAL, 'data', f + '.json'));
  const deps = { tax: idx.taxonomy, products: new Map(data.products.map((p) => [p.id, p])), mismatch: new Set(idx.rate_mismatch || []), load: async (id) => (exists('k/' + id) ? rd('k/' + id) : null) };
  return { data, assistant: { ...base, ask: (q, st) => applyAsk(base, q, st, deps) }, SYN };
}
