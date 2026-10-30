// add_images.mjs: merges the product packshots into the data. Idempotent. Run by rebuild.sh before the split/speed build.
//   source of truth: demo-tools/sika-210c0c/images_source.json (written by fetch_images.py) + the files in assets/img/p/
//   products.json and data/p/<id>.json get  image: { src (480), src2x (960), width, height, alt, source (Sika URL) }
//   data/index.json entries get  im: 1  so a card knows to draw the picture without fetching the product file
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
const wr = (f, o) => fs.writeFileSync(f, JSON.stringify(o));
const products = JSON.parse(fs.readFileSync(path.join(D, 'products.json'), 'utf8'));
const ok = new Set(); let n = 0;
for (const p of products) { const im = imageFor(p); if (im) { p.image = im; ok.add(p.id); n++; } else delete p.image; }
wr(path.join(D, 'products.json'), products);
for (const p of products) {
  const f = path.join(D, 'p', p.id + '.json'); if (!fs.existsSync(f)) continue;
  const o = JSON.parse(fs.readFileSync(f, 'utf8')); if (p.image) o.image = p.image; else delete o.image; wr(f, o);
}
const idx = JSON.parse(fs.readFileSync(path.join(D, 'index.json'), 'utf8'));
for (const e of idx) { if (ok.has(e.id)) e.im = 1; else delete e.im; }
wr(path.join(D, 'index.json'), idx);
console.log('images added to', n, 'of', products.length, 'products');
