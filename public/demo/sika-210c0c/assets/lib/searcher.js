import { derived } from './data.js';
let p;
/** One shared finder index (built once from index.json + categories.json). */
// the alias table (old names, nicknames) is small and optional: a missing file just means plain name matching
const aliases = () => fetch(new URL('../../data/brain/alias.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// search.js and the shared matcher it uses are loaded on first use, so they are not part of the first screen
export function getSearcher() { return (p ||= Promise.all([derived(), aliases(), import('./search.js')]).then(([dv, al, { buildSearch }]) => buildSearch(dv.index, dv.catById, { aliases: al }))); }
