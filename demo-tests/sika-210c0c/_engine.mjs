// Loads the engine that SHIPS (PORTAL/assets/assistant) with the portal's own data, for node tests.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PORTAL } from './_env.mjs';
export const rd = (f) => JSON.parse(fs.readFileSync(path.join(PORTAL, 'data', f + '.json'), 'utf8'));
const imp = (rel) => import(pathToFileURL(path.join(PORTAL, rel)).href);
export async function loadEngine() {
  const { createAssistant } = await imp('assets/assistant/engine.js');
  const SYN = await imp('assets/assistant/synonyms.js');
  const data = { products: rd('products'), documents: rd('documents'), categories: rd('categories'), pages: rd('pages'), config: rd('config') };
  return { data, assistant: createAssistant(data), SYN };
}
