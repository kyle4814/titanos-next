// images_check.mjs: product packshots. Node checks (no browser). usage: node images_check.mjs [portalDir]
//  1. every product with image.src has both WebP files on disk (RIFF/WEBP magic, non-empty), alt = product name, width/height set
//  2. data/p/<id>.json agrees with products.json; index.json 'im' flag agrees; images_source.json agrees
//  3. nothing about the images is in the service worker precache; no Sika logo file is shipped under assets/img
//  4. MUTATION: in a temp copy, delete one file, the check must fail; truncate one, it must fail
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 200) : '')); };
const rj = (root, f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const isWebp = (f) => { try { const b = fs.readFileSync(f); return b.length > 200 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'; } catch { return false; } };
export function check(root) {
  const errs = []; const prods = rj(root, 'data/products.json'); const idx = new Map(rj(root, 'data/index.json').map((e) => [e.id, e]));
  let withImg = 0;
  for (const p of prods) {
    const e = idx.get(p.id);
    if (!p.image) { if (e && e.im) errs.push(p.id + ': index says im but no image'); continue; }
    withImg++;
    for (const k of ['src', 'src2x']) if (!isWebp(path.join(root, p.image[k]))) errs.push(`${p.id}: ${k} file missing or not WebP (${p.image[k]})`);
    if (p.image.alt !== p.name) errs.push(p.id + ': alt is not the product name');
    if (!(p.image.width > 0 && p.image.height > 0)) errs.push(p.id + ': width/height missing');
    if (!/^https:\/\/(dynamicmedia|sika)\.sika\.com\/|^https:\/\/sika\.scene7\.com\//.test(p.image.source || '')) errs.push(p.id + ': source URL missing');
    if (!(e && e.im === 1)) errs.push(p.id + ': index entry lacks im');
    const f = path.join(root, 'data/p', p.id + '.json'); if (fs.existsSync(f) && JSON.stringify(rj(root, 'data/p/' + p.id + '.json').image) !== JSON.stringify(p.image)) errs.push(p.id + ': data/p disagrees');
  }
  return { errs, withImg, total: prods.length };
}
const r = check(PORTAL);
t(`${r.total} products read`, r.total === 512, r.total);
t('every product with an image has both WebP files, alt, size, source, index flag', r.errs.length === 0, r.errs.slice(0, 4).join(' | '));
t('most products have an image (at least 200)', r.withImg >= 200, r.withImg);
const src = rj(HERE, '../../demo-tools/sika-210c0c/images_source.json');
const srcWith = Object.values(src).filter((v) => v.source).length;
t('images_source.json agrees with the data on the count', srcWith === r.withImg, `${srcWith} vs ${r.withImg}`);
t('every product without an image has a recorded reason', Object.entries(src).every(([id, v]) => v.source || v.why) && Object.keys(src).length === r.total);
const files = fs.readdirSync(path.join(PORTAL, 'assets/img/p')); t('no stray files in assets/img/p', files.every((f) => /-(480|960)\.webp$/.test(f)) && files.length === r.withImg * 2, `${files.length} files`);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
t('no logo file under assets/img', walk(path.join(PORTAL, 'assets/img')).every((f) => !/logo/i.test(path.basename(f))));
const sw = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8'); t('service worker does not precache the images', !/assets\/img|\.webp/.test(sw));
// mutation: temp copy of the data and a few files
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imgmut-')); if (!tmp || !tmp.startsWith(os.tmpdir())) { console.log('FAIL mktemp'); process.exit(2); }
try {
  fs.mkdirSync(path.join(tmp, 'data/p'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'assets/img/p'), { recursive: true });
  for (const f of ['data/products.json', 'data/index.json']) fs.copyFileSync(path.join(PORTAL, f), path.join(tmp, f));
  const withImg = rj(PORTAL, 'data/products.json').filter((p) => p.image);
  for (const p of withImg) { fs.copyFileSync(path.join(PORTAL, 'data/p', p.id + '.json'), path.join(tmp, 'data/p', p.id + '.json')); for (const k of ['src', 'src2x']) fs.copyFileSync(path.join(PORTAL, p.image[k]), path.join(tmp, p.image[k])); }
  t('mutation baseline: the untouched copy passes', check(tmp).errs.length === 0);
  const v = withImg[0]; fs.rmSync(path.join(tmp, v.image.src2x));
  t('mutation: deleting one file makes the check fail', check(tmp).errs.some((e) => e.startsWith(v.id)));
  fs.copyFileSync(path.join(PORTAL, v.image.src2x), path.join(tmp, v.image.src2x)); fs.writeFileSync(path.join(tmp, v.image.src), 'not an image');
  t('mutation: a corrupt file makes the check fail', check(tmp).errs.some((e) => e.startsWith(v.id)));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `IMAGES CHECK ${fails} failed` : 'IMAGES CHECK GREEN'); process.exit(fails ? 1 : 0);
