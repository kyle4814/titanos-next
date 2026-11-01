// Shared setup for the sales-engine tests: re-uses the actions test environment (file store over the portal data folder, plain Node, no network).
export { makeAssistant, ask, check, summary, memStorage, data, config, PORTAL, DATA } from '../sika-actions/_env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { DATA } from '../sika-actions/_env.mjs';
export const NOW = new Date('2026-11-01T12:00:00Z'); // noon UTC: the same calendar day in every Australian time zone and most others
export const routes = () => JSON.parse(fs.readFileSync(path.join(DATA, 'sales', 'contacts.json'), 'utf8'));
export const PORTAL_QUOTE = '../../public/demo/sika-210c0c/assets/actions/quote.js';
import { pathToFileURL } from 'node:url';
import { PORTAL as P0 } from '../sika-actions/_env.mjs';
/** The assets folder the tests import from: the real one, or (QUOTE_ASSETS) a mutated temporary copy made by t_mutation.mjs. */
export const ASSETS = process.env.QUOTE_ASSETS || path.join(P0, 'assets');
export const load = (rel) => import(pathToFileURL(path.join(ASSETS, rel)).href);
