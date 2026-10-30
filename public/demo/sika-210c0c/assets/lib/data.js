// Data loading: every file is fetched once and cached. Paths are relative to this module, so the portal works under any URL prefix.
const base = new URL('../../data/', import.meta.url);
const cache = new Map();
let manifestP;
/** Optional files are only requested when data/manifest.json lists them, so a missing file never shows up as a 404 in the console. */
function manifest() { return (manifestP ||= fetch(new URL('manifest.json', base)).then((r) => (r.ok ? r.json() : { files: [] })).catch(() => ({ files: [] }))); }
async function opt(name) { if (typeof navigator !== 'undefined' && navigator.onLine === false && !name.startsWith('knowledge/') && !/^(config|index|categories|documents|pages|products|selector|stats|rules)\.json$/.test(name)) return null; const m = await manifest(); return m.files.includes(name) ? getJSON(name) : null; }
function getJSON(name, optional = false) {
  if (!cache.has(name)) {
    cache.set(name, fetch(new URL(name, base), { cache: 'default' }).then((r) => {
      if (!r.ok) { if (optional) return null; throw new Error(`${name}: HTTP ${r.status}`); }
      return r.json();
    }).catch((e) => { cache.delete(name); if (optional) return null; throw e; }));
  }
  return cache.get(name);
}
export const data = {
  config: () => getJSON('config.json'),
  index: () => getJSON('index.json'),
  categories: () => getJSON('categories.json'),
  products: () => getJSON('products.json'),
  documents: () => getJSON('documents.json'),
  pages: () => getJSON('pages.json'),
  status: () => opt('doc_status.json'),
  stats: () => opt('stats.json'),
  selector: () => opt('selector.json'),
  manifest,
  product: (id) => getJSON(`p/${encodeURIComponent(id)}.json`),
  specIndex: () => opt('specs/index.json').catch(() => null), // offline or missing: no Specification tab, no error
  spec: (id) => getJSON(`specs/${encodeURIComponent(id)}.json`),
  knowledge: (name) => opt(`knowledge/${name}.json`),
};

let _derived;
/** Lookups used by several views. Built once from the small files. */
export async function derived() {
  if (_derived) return _derived;
  _derived = (async () => {
    const [index, categories] = await Promise.all([data.index(), data.categories()]);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const byId = new Map(index.map((p) => [p.id, p]));
    const brands = new Map();
    for (const p of index) brands.set(p.b, (brands.get(p.b) || 0) + 1);
    return { index, categories, catById, byId, brands };
  })();
  return _derived;
}
let _docs;
/** Documents with link status merged in (status 200 = verified, other = hidden or marked, missing = unchecked). */
export async function documents() {
  if (_docs) return _docs;
  _docs = (async () => {
    const docs = await data.documents();
    // link verdicts are merged into documents.json at build time (d.http = {status, checked, via, url?})
    const byId = new Map(docs.map((d) => [d.id, d]));
    return { docs, byId, checked: docs.some((d) => d.http) };
  })();
  return _docs;
}
export const docOk = (d) => !d.http || d.http.status === 200;
export const docHref = (d) => (d.http && d.http.url) || d.url;
