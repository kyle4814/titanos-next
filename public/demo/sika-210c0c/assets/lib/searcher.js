import { derived } from './data.js';
import { buildSearch } from './search.js';
let p;
/** One shared finder index (built once from index.json + categories.json). */
export function getSearcher() { return (p ||= derived().then((dv) => buildSearch(dv.index, dv.catById))); }
