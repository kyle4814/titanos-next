// harness.mjs: loads the brain in node with shards read from disk (same JSON the browser fetches).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLoader } from '../../public/demo/sika-210c0c/assets/brain/loader.js';
import { createBrain } from '../../public/demo/sika-210c0c/assets/brain/brain.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// lane D: brain.js never imports the plan engine (it is loaded on demand in the browser); the tests preload the same file, unbundled
globalThis.__sikaRules = await import('../../public/demo/sika-210c0c/assets/brain/rules.js').then((m) => globalThis.__sikaRules || m);
export const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
export const fetchJson = async (rel) => { const f = path.join(PORTAL, rel); if (!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f, 'utf8')); };
export const makeBrain = () => createBrain({ load: createLoader({ base: 'data/brain/', fetchJson }) });
export const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
