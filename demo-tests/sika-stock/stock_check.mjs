// stock_check.mjs: illustrative stock photos (Wikimedia Commons). Node checks, no browser. usage: node stock_check.mjs [portalDir]
//  1. every category has both WebP files (RIFF/WEBP) and a credit (author, accepted licence, Commons file page) that equals what stock_source.json saved from the API
//  2. every product has a Sika packshot (source URL) OR an illustrative stock record (illustrative: true, "Illustrative photo of <category>, not the product", credit)
//  3. products that had a packshot in the base commit are byte-identical to the base (stock step changed nothing of theirs)
//  4. index.json flags: 1 packshot, 2 illustrative; total bytes of assets/img/s under 30 MB; sw.js lists no stock file; no stray files
//  5. MUTATION: in a temp copy, delete one file and corrupt one record: each must make the check fail
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PORTAL = path.resolve(process.argv[2] || path.join(REPO, 'public', 'demo', 'sika-210c0c'));
const BASE = '4671ae26e'; // integrate/2026-10-31 tip this branch was cut from
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
const rj = (root, f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const isWebp = (f) => { try { const b = fs.readFileSync(f); return b.length > 200 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'; } catch { return false; } };
const OK_LIC = /^(CC0( 1\.0)?|Public domain|CC BY (2|3|4)\.0|CC BY-SA (2|3|4)\.0)$/i;
const slugOf = (src) => (/assets\/img\/s\/(.+)-480\.webp$/.exec(src) || [])[1];
const srcJson = rj(path.join(REPO, 'demo-tools', 'sika-210c0c'), 'stock_source.json');
let baseProducts = null;
try { baseProducts = JSON.parse(execFileSync('git', ['-C', REPO, 'show', `${BASE}:public/demo/sika-210c0c/data/products.json`], { maxBuffer: 1 << 28 }).toString()); } catch (e) { baseProducts = null; }
const owner = (id) => { let e = srcJson[id], hop = 0; while (e && e.inherit && hop++ < 8) { id = e.inherit; e = srcJson[id]; } return e && e.page ? e : null; };
export function check(root) {
  const errs = []; const cats = rj(root, 'data/categories.json'); const prods = rj(root, 'data/products.json'); const idx = new Map(rj(root, 'data/index.json').map((e) => [e.id, e]));
  const catBy = new Map(cats.map((c) => [c.id, c])); const used = new Set();
  for (const c of cats) {
    const im = c.image; if (!im) { errs.push(c.id + ': category has no image'); continue; }
    for (const k of ['src', 'src2x']) { used.add(im[k]); if (!isWebp(path.join(root, im[k] || 'missing'))) errs.push(`${c.id}: ${k} missing or not WebP (${im[k]})`); }
    if (!(im.width > 0 && im.height > 0 && im.alt)) errs.push(c.id + ': width/height/alt missing');
    const cr = im.credit || {}; const own = owner(c.id);
    if (!cr.author || !OK_LIC.test(cr.license || '') || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(cr.page || '')) errs.push(c.id + ': credit incomplete or licence not accepted (' + cr.license + ')');
    else if (!own || own.author !== cr.author || own.license !== cr.license || own.page !== cr.page) errs.push(c.id + ': credit differs from stock_source.json');
  }
  let packs = 0, ill = 0; const baseBy = new Map((baseProducts || []).map((p) => [p.id, p]));
  for (const p of prods) {
    const e = idx.get(p.id) || {}; const im = p.image;
    if (!im) { errs.push(p.id + ': no packshot and no illustrative photo'); continue; }
    if (!im.illustrative) { packs++; if (!im.source) errs.push(p.id + ': packshot has no source'); if (e.im !== 1) errs.push(p.id + ': index flag not 1'); continue; }
    ill++;
    const c = catBy.get(p.category);
    for (const k of ['src', 'src2x']) { used.add(im[k]); if (!isWebp(path.join(root, im[k]))) errs.push(`${p.id}: stock ${k} missing`); }
    if (!c || im.alt !== `Illustrative photo of ${c.name}, not the product`) errs.push(p.id + ': illustrative alt wrong');
    if (!c || !c.image || im.src !== c.image.src || JSON.stringify(im.credit) !== JSON.stringify(c.image.credit)) errs.push(p.id + ': not its category photo');
    if (!(im.credit && im.credit.author && OK_LIC.test(im.credit.license || ''))) errs.push(p.id + ': illustrative credit missing');
    if (e.im !== 2) errs.push(p.id + ': index flag not 2');
    const f = path.join(root, 'data/p', p.id + '.json'); if (fs.existsSync(f) && JSON.stringify(rj(root, 'data/p/' + p.id + '.json').image) !== JSON.stringify(im)) errs.push(p.id + ': data/p disagrees');
  }
  if (baseProducts) for (const b of baseProducts) if (b.image) { const now = prods.find((p) => p.id === b.id); if (!now || JSON.stringify(now) !== JSON.stringify(b)) errs.push(b.id + ': packshot product changed from the base'); }
  const dir = path.join(root, 'assets/img/s'); let bytes = 0; const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const f of files) { bytes += fs.statSync(path.join(dir, f)).size; if (!used.has('assets/img/s/' + f)) errs.push('stray stock file ' + f); }
  if (bytes >= 30 * 1048576) errs.push('stock files total ' + bytes + ' bytes (30 MB cap)');
  return { errs, cats: cats.length, packs, ill, bytes, files: files.length, total: prods.length };
}
const r = check(PORTAL);
t(`${r.total} products and ${r.cats} categories read`, r.total === 512 && r.cats === 165, `${r.total} ${r.cats}`);
t('whole check: no errors (products, packshots untouched, flags, bytes, strays)', r.errs.length === 0, r.errs.slice(0, 4).join(' | '));
t('every product has a packshot or an illustrative photo (291 + 221 = 512)', r.packs === 291 && r.ill === 221 && r.packs + r.ill === r.total, `${r.packs} + ${r.ill}`);
t('stock files total under 30 MB', r.bytes < 30 * 1048576, `${r.bytes} bytes in ${r.files} files`);
const sw = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8'); t('service worker precaches no stock file', !/assets\/img|\.webp/.test(sw));
const lic = Object.values(srcJson).filter((v) => v.page); t('stock_source.json: every own photo has author, accepted licence, file page, title, query', lic.length > 0 && lic.every((v) => v.author && OK_LIC.test(v.license) && v.page && v.title && v.query), lic.length);
t('base commit readable (packshot-untouched check ran)', baseProducts && baseProducts.filter((p) => p.image).length === 291, baseProducts ? baseProducts.filter((p) => p.image).length : 'git show failed');
// mutation
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stockmut-')); if (!tmp || !tmp.startsWith(os.tmpdir())) { console.log('FAIL mktemp'); process.exit(2); }
try {
  fs.mkdirSync(path.join(tmp, 'data/p'), { recursive: true });
  for (const f of ['data/categories.json', 'data/products.json', 'data/index.json']) fs.copyFileSync(path.join(PORTAL, f), path.join(tmp, f));
  for (const f of fs.readdirSync(path.join(PORTAL, 'data/p'))) fs.copyFileSync(path.join(PORTAL, 'data/p', f), path.join(tmp, 'data/p', f));
  fs.cpSync(path.join(PORTAL, 'assets/img/s'), path.join(tmp, 'assets/img/s'), { recursive: true });
  t('mutation baseline: the untouched copy passes', check(tmp).errs.length === 0, check(tmp).errs.slice(0, 2).join(' | '));
  const cats = rj(tmp, 'data/categories.json'); const v = cats[40];
  fs.rmSync(path.join(tmp, v.image.src2x));
  t('mutation: deleting one file makes the check fail', check(tmp).errs.some((e) => e.startsWith(v.id)));
  fs.copyFileSync(path.join(PORTAL, v.image.src2x), path.join(tmp, v.image.src2x));
  const w = cats[7]; w.image.credit.license = 'CC BY-NC 4.0'; fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(cats));
  t('mutation: a corrupt credit (non-accepted licence) makes the check fail', check(tmp).errs.some((e) => e.startsWith(w.id)));
  w.image.credit.license = rj(PORTAL, 'data/categories.json')[7].image.credit.license; fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(cats));
  const pr = rj(tmp, 'data/products.json'); const pk = pr.find((p) => p.image && !p.image.illustrative); pk.image.alt = 'changed'; fs.writeFileSync(path.join(tmp, 'data/products.json'), JSON.stringify(pr));
  t('mutation: changing a packshot product makes the check fail', check(tmp).errs.some((e) => e.startsWith(pk.id)));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `STOCK CHECK ${fails} failed` : 'STOCK CHECK GREEN'); process.exit(fails ? 1 : 0);
