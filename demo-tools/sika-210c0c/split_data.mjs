// split_data.mjs (apply/speed): derives the small per-route data files from the full ones. Idempotent: always recomputed from
// categories.json, stats.json, index.json and documents.json; the full files are never changed and stay the fallback for every loader.
//   data/s/cats.json   slim categories (no url; description kept for levels 1 to 3, which the home page and menus show) + the four headline counts
//   data/p/<id>.json   additive fields only: http (document link verdicts, as documents.json holds them) and rel (the four related products the
//                      product page shows), so the product page no longer fetches documents.json (124 KB over the wire) or index.json (71 KB)
import fs from 'node:fs';
import path from 'node:path';

export async function splitData(PORTAL) {
  const D = path.join(PORTAL, 'data'); const rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); const wr = (f, o) => { fs.mkdirSync(path.dirname(path.join(D, f)), { recursive: true }); fs.writeFileSync(path.join(D, f), JSON.stringify(o)); };
  const cats = rd('categories.json'), stats = rd('stats.json'), index = rd('index.json'), docs = rd('documents.json');
  wr('s/cats.json', { categories: cats.map((c) => { const o = { id: c.id, name: c.name, parent: c.parent, level: c.level, children: c.children, productCount: c.productCount }; if (c.level <= 3 && c.description) o.description = c.description; return o; }), stats: { products: stats.products, documents: stats.documents, categories: stats.categories, pages: stats.pages } });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const related = (p) => { // same rule as relatedProducts() in views2.js
    const same = index.filter((x) => x.c === p.category && x.id !== p.id);
    const g = p.category.split('/').slice(0, 2).join('/');
    const pool = same.length >= 4 ? same : [...same, ...index.filter((x) => x.c !== p.category && x.c.split('/').slice(0, 2).join('/') === g)];
    return pool.sort((a, b) => (b.b === p.brand) - (a.b === p.brand) || (b.pds - a.pds) || a.n.localeCompare(b.n)).slice(0, 4);
  };
  let n = 0;
  for (const f of fs.readdirSync(path.join(D, 'p'))) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(fs.readFileSync(path.join(D, 'p', f), 'utf8'));
    for (const d of p.docs || []) { const m = docById.get(d.id); if (m && m.http) d.http = m.http; }
    p.rel = related(p);
    fs.writeFileSync(path.join(D, 'p', f), JSON.stringify(p)); n++;
  }
  console.log('data split: s/cats.json, product files updated', n);
}
