// split_data.mjs (apply/speed): derives the small per-route data files from the full ones. Idempotent: always recomputed from
// categories.json, stats.json, index.json and documents.json; the full files are never changed and stay the fallback for every loader.
//   data/cats.lite.json   slim categories (no url; description kept for levels 1 to 3, which the home page and menus show) + the four headline counts
//   data/p/<id>.json   additive fields only: http (document link verdicts, as documents.json holds them) and rel (the four related products the
//                      product page shows) and kk (a data/k file exists, so the page can start it without reading k/_index.json first), so the product page no longer fetches documents.json (124 KB over the wire) or index.json (71 KB)
import fs from 'node:fs';
import path from 'node:path';

export async function splitData(PORTAL) {
  const D = path.join(PORTAL, 'data'); const rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); const wr = (f, o) => { fs.mkdirSync(path.dirname(path.join(D, f)), { recursive: true }); fs.writeFileSync(path.join(D, f), JSON.stringify(o)); };
  const cats = rd('categories.json'), stats = rd('stats.json'), index = rd('index.json'), docs = rd('documents.json');
  // descriptions: only the cards the home page draws (the children of the top category and of the feature category); the category page reads the full file
  const cfg = rd('config.json'); const catBy = new Map(cats.map((c) => [c.id, c]));
  const wantDesc = new Set(); for (const root of ['construction', cfg.home.featureCategory]) { const r = catBy.get(root); if (r) { wantDesc.add(r.id); for (const k of r.children || []) wantDesc.add(k); } }
  wr('cats.lite.json', { categories: cats.map((c) => { const o = { id: c.id, name: c.name, parent: c.parent, level: c.level, children: c.children, productCount: c.productCount }; if (wantDesc.has(c.id) && c.description) o.description = c.description; const m = c.image && /assets\/img\/s\/(.+)-480\.webp$/.exec(c.image.src); if (m) o.im = m[1]; return o; }), stats: { products: stats.products, documents: stats.documents, categories: stats.categories, pages: stats.pages } });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const related = (p) => { // same rule as relatedProducts() in views2.js
    const same = index.filter((x) => x.c === p.category && x.id !== p.id);
    const g = p.category.split('/').slice(0, 2).join('/');
    const pool = same.length >= 4 ? same : [...same, ...index.filter((x) => x.c !== p.category && x.c.split('/').slice(0, 2).join('/') === g)];
    return pool.sort((a, b) => (b.b === p.brand) - (a.b === p.brand) || (b.pds - a.pds) || a.n.localeCompare(b.n)).slice(0, 4);
  };
  // category group shards: the index entries of every category under one two-segment group (construction/waterproofing -> s/g/construction--waterproofing.json)
  const groups = new Map(); for (const e of index) { const g = e.c.split('/').slice(0, 2); if (g.length === 2) { const k = g.join('--'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); } }
  fs.rmSync(path.join(D, 's', 'g'), { recursive: true, force: true }); for (const [k, v] of groups) wr('s/g/' + k + '.json', v);
  // documents library: compact rows [title, file, type, format, bytes, version, url, firstProductId, httpStatus, httpUrl] + the names of the products they point at
  const pn = {}; const nameOf = new Map(index.map((x) => [x.id, x.n]));
  const rows = docs.map((d) => { const pid = d.products && d.products[0] || 0; if (pid && nameOf.has(pid)) pn[pid] = nameOf.get(pid); return [d.title, d.file, d.type, d.format, d.bytes, d.version, d.url, pid && nameOf.has(pid) ? pid : 0, d.http ? d.http.status : null, d.http && d.http.url ? d.http.url : 0]; });
  wr('s/docs.json', { rows, pn });
  // guides: only the pages the Guides page lists, only the fields it reads
  wr('s/guides.json', rd('pages.json').filter((p) => p.kind === 'guide' || p.kind === undefined).map((p) => ({ url: p.url, title: p.title, metaDescription: p.metaDescription, excerpt: p.excerpt, headings: p.headings, section: p.section })));
  let n = 0;
  for (const f of fs.readdirSync(path.join(D, 'p'))) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(fs.readFileSync(path.join(D, 'p', f), 'utf8'));
    for (const d of p.docs || []) { const m = docById.get(d.id); if (m && m.http) d.http = m.http; }
    p.rel = related(p);
    p.kk = fs.existsSync(path.join(D, 'k', f)); // a rates, times and safety file exists for this product (apply/data)
    fs.writeFileSync(path.join(D, 'p', f), JSON.stringify(p)); n++;
  }
  console.log('data split: cats.lite.json, product files updated', n);
}
