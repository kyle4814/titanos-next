// Data loading: every file is fetched once and cached. Paths are relative to this module, so the portal works under any URL prefix.
const base = new URL('../../data/', import.meta.url);
const cache = new Map();
let manifestP;
/** Optional files are only requested when data/manifest.json lists them, so a missing file never shows up as a 404 in the console. */
function manifest() { return (manifestP ||= fetch(new URL('manifest.json', base)).then((r) => (r.ok ? r.json() : { files: [] })).catch(() => ({ files: [] }))); }
async function opt(name) { if (typeof navigator !== 'undefined' && navigator.onLine === false && !name.startsWith('knowledge/') && !/^(config|index|categories|documents|pages|products|selector|stats|rules)\.json$/.test(name)) return null; const m = await manifest(); return m.files.includes(name) ? getJSON(name) : null; }
function getJSON(name, optional = false) {
  if (optional && name.startsWith('s/') && typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null); // split files are not in the offline cache: go straight to the full file
  if (!cache.has(name)) {
    cache.set(name, fetch(new URL(name, base), { cache: 'default' }).then((r) => {
      if (!r.ok) { if (optional) return null; throw new Error(`${name}: HTTP ${r.status}`); }
      return r.json();
    }).catch((e) => { cache.delete(name); if (optional) return null; throw e; }));
  }
  return cache.get(name);
}
/** The one switch for who the demo is shown as prepared by: config.json demo.variant picks demo.variants[variant] (by, byUrl, ribbon). Used once, in place. */
export function applyVariant(cfg) {
  const d = cfg && cfg.demo; const v = d && d.variants && d.variants[d.variant];
  if (v) Object.assign(d, v);
  return cfg;
}
let cfgP;
export const data = {
  config: () => (cfgP ||= getJSON('config.json').then(applyVariant)),
  index: () => getJSON('index.json'),
  categories: () => getJSON('categories.json'),
  products: () => getJSON('products.json'),
  documents: () => getJSON('documents.json'),
  pages: () => getJSON('pages.json'),
  status: () => opt('doc_status.json'),
  stats: () => opt('stats.json'),
  selector: () => getJSON('selector.json', true), // always shipped; read directly so it never waits for the manifest
  docsLite: () => getJSON('s/docs.json', true), // compact document rows for the library (null: use documents.json)
  guidesLite: () => getJSON('s/guides.json', true), // guide pages with only the fields the Guides page uses (null: use pages.json)
  catsLite: () => (typeof navigator !== 'undefined' && navigator.onLine === false ? Promise.resolve(null) : getJSON('cats.lite.json', true)).then((j) => j || data.categories().then((c) => ({ categories: c, stats: null }))), // speed: slim categories + counts (split build); falls back to the full file
  manifest,
  product: (id) => getJSON(`p/${encodeURIComponent(id)}.json`),
  /** Does this product id / system slug exist? From the small id lists (data/s/ids.json, sys.json); a missing list or offline means "assume yes", so the normal path decides. */
  has: async (kind, id) => { const j = await getJSON(kind === 'sys' ? 's/sys.json' : 's/ids.json', true); return !Array.isArray(j) || j.includes(id); },
  specIndex: () => opt('specs/index.json').catch(() => null), // offline or missing: no Specification tab, no error
  spec: (id) => getJSON(`specs/${encodeURIComponent(id)}.json`),
  knowledge: (name) => opt(`knowledge/${name}.json`),
};

/** The full categories file (descriptions of every level, source URLs): only the category page needs it. */
let _dfull;
export async function derivedFull() {
  if (_dfull) return _dfull;
  _dfull = (async () => { const categories = await data.categories(); const catById = new Map(categories.map((c) => [c.id, c])); return { index: [], categories, catById, byId: new Map(), brands: new Map() }; })(); // speed: categories only; the category page reads its products from a group shard
  return _dfull;
}
let _dl;
/** The categories alone (menu, home, selector): small, no product index. Same shape as derived() minus index/byId/brands. */
export async function derivedLite() {
  if (_dl) return _dl;
  _dl = (async () => {
    const j = await data.catsLite(); const categories = j.categories;
    return { categories, catById: new Map(categories.map((c) => [c.id, c])), stats: j.stats || null, lite: true };
  })();
  return _dl;
}
/** The product index entries of one group (the first two category segments), for related products; falls back to the whole index. */
/** Index entries of one category group (the first two path segments), from data/s/g/; the whole index if the shard is missing. */
export async function groupIndex(category) {
  const g = String(category || '').split('/').slice(0, 2);
  if (g.length === 2 && g[1]) { const j = await getJSON('s/g/' + g.join('--') + '.json', true); if (j) return j; }
  return data.index();
}

let _derived;
/** Lookups used by several views. Built once from the small files. */
export async function derived() {
  if (_derived) return _derived;
  _derived = (async () => {
    const [index, categories] = await Promise.all([data.index(), data.catsLite().then((j) => j.categories)]); // speed: the slim category list (same ids, names, children, counts) instead of the 91 KB full file
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
