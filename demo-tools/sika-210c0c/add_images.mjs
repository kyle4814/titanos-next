// add_images.mjs: merges the product packshots into the data. Idempotent. Run by rebuild.sh before the split/speed build.
//   source of truth: demo-tools/sika-210c0c/images_source.json (written by fetch_images.py) + the files in assets/img/p/
//   products.json and data/p/<id>.json get  image: { src (480), src2x (960), width, height, alt, source (Sika URL) }
//   data/index.json entries get  im: 1  so a card knows to draw the picture without fetching the product file
// Stock photos (illustrative, Wikimedia Commons; fetch_stock.py writes stock_source.json and assets/img/s/):
//   categories.json entries get  image: { src, src2x, width, height, alt, credit: { author, license, licenseUrl, page, title } }  (an inheriting category points at its ancestor's files)
//   a product with NO packshot gets the same record of its own category plus  illustrative: true  and alt "Illustrative photo of <category>, not the product";
//   data/index.json marks it  im: 2  (im: 1 stays the real packshot). Products with a Sika packshot are never touched by the stock step.
// A product is only given an image when BOTH files exist on disk. usage: node add_images.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const D = path.join(PORTAL, 'data');
const src = JSON.parse(fs.readFileSync(path.join(HERE, 'images_source.json'), 'utf8'));
const has = (id) => fs.existsSync(path.join(PORTAL, 'assets/img/p', id + '-480.webp')) && fs.existsSync(path.join(PORTAL, 'assets/img/p', id + '-960.webp'));
const imageFor = (p) => {
  const s = src[p.id];
  if (!s || !s.source || !has(p.id)) return null;
  return { src: `assets/img/p/${p.id}-480.webp`, src2x: `assets/img/p/${p.id}-960.webp`, width: 480, height: 480, alt: p.name, source: s.source };
};
const stock = fs.existsSync(path.join(HERE, 'stock_source.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'stock_source.json'), 'utf8')) : {};
const slug = (id) => id.replace(/\//g, '--');
const hasStock = (id) => ['480', '960'].every((w) => fs.existsSync(path.join(PORTAL, 'assets/img/s', slug(id) + '-' + w + '.webp')));
const ownerOf = (id) => { let e = stock[id], hop = 0; while (e && e.inherit && hop++ < 8) { id = e.inherit; e = stock[id]; } return e && e.page && hasStock(id) ? id : null; };
const stockFor = (c) => {
  const o = ownerOf(c.id); if (!o) return null; const e = stock[o];
  return { src: `assets/img/s/${slug(o)}-480.webp`, src2x: `assets/img/s/${slug(o)}-960.webp`, width: 480, height: 320, alt: `Illustrative photo for ${c.name}`,
    credit: { author: e.author, license: e.license, licenseUrl: e.licenseUrl, page: e.page, title: e.title } };
};
const wr = (f, o) => fs.writeFileSync(f, JSON.stringify(o));
const cats = JSON.parse(fs.readFileSync(path.join(D, 'categories.json'), 'utf8'));
let nc = 0; for (const c of cats) { const im = stockFor(c); if (im) { c.image = im; nc++; } else delete c.image; }
wr(path.join(D, 'categories.json'), cats);
const catBy = new Map(cats.map((c) => [c.id, c]));
const products = JSON.parse(fs.readFileSync(path.join(D, 'products.json'), 'utf8'));
const ok = new Set(), ill = new Set(); let n = 0;
for (const p of products) {
  const im = imageFor(p); if (im) { p.image = im; ok.add(p.id); n++; continue; }
  const c = catBy.get(p.category);
  if (c && c.image) { p.image = { ...c.image, alt: `Illustrative photo of ${c.name}, not the product`, illustrative: true }; ill.add(p.id); } else delete p.image;
}
wr(path.join(D, 'products.json'), products);
for (const p of products) {
  const f = path.join(D, 'p', p.id + '.json'); if (!fs.existsSync(f)) continue;
  const o = JSON.parse(fs.readFileSync(f, 'utf8')); if (p.image) o.image = p.image; else delete o.image; wr(f, o);
}
const idx = JSON.parse(fs.readFileSync(path.join(D, 'index.json'), 'utf8'));
for (const e of idx) { if (ok.has(e.id)) e.im = 1; else if (ill.has(e.id)) e.im = 2; else delete e.im; }
wr(path.join(D, 'index.json'), idx);
// the About page quotes these two counts: they ride in stats.json so that page does not have to download the 600 KB products file just to count
const stf = path.join(D, 'stats.json'); const st = JSON.parse(fs.readFileSync(stf, 'utf8').replace(/^\uFEFF/, '')); st.packshots = n; st.illustrated = ill.size; wr(stf, st);
console.log('images added to', n, 'of', products.length, 'products;', ill.size, 'illustrative stock photos;', nc, 'of', cats.length, 'categories');
