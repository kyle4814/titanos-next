// stock_check.mjs: illustrative stock photos (Wikimedia Commons). Node checks, no browser. usage: node stock_check.mjs [portalDir]
//  1. every category has both WebP files (RIFF/WEBP) and a credit (author, accepted licence, Commons file page) that equals what stock_source.json saved from the API
//  2. every product has a Sika packshot (source URL) OR an illustrative stock record (illustrative: true, "Illustrative photo of <category>, not the product", credit)
//  3. products that had a packshot in the base commit are byte-identical to the base (stock step changed nothing of theirs)
//  3b. round 2 (2026-11-01): every category has its OWN photo (no two categories, and no two tiles on the home feature section, the mosaic or any "Browse by type" row, share one), HD: a 1600 file per category,
//      chosen source width >= 1600 or a logged hdFallback, sharpness above the floor, licence allowlist unchanged
//  4. index.json flags: 1 packshot, 2 illustrative; total bytes of assets/img/s under 45 MB; sw.js lists no stock file; no stray files
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
const OK_LIC_SOURCE = '^(CC0( 1\\.0)?|Public domain|CC BY (2|3|4)\\.0|CC BY-SA (2|3|4)\\.0)$'; // the allowlist as the stock lane set it; a change must be deliberate
export const SHARP_FLOOR = 150; // variance of the Laplacian at 960 px wide, set from the measured distribution of the chosen photos (see PHOTOS2 receipt)
export const REL_FLOOR = 2; // each chosen photo's Commons title + description + categories hold at least this many words of the category's domain list (fetch_stock.py recorded the score)
export const relFails = (src) => Object.entries(src).filter(([, v]) => v.page && !(v.relevance >= REL_FLOOR)).map(([k]) => k);
export const BYTE_CAP = 45 * 1048576;
const slugOf = (src) => (/assets\/img\/s\/(.+)-480\.webp$/.exec(src) || [])[1];
const srcJson = rj(path.join(REPO, 'demo-tools', 'sika-210c0c'), 'stock_source.json');
let baseProducts = null;
try { baseProducts = JSON.parse(execFileSync('git', ['-C', REPO, 'show', `${BASE}:public/demo/sika-210c0c/data/products.json`], { maxBuffer: 1 << 28 }).toString()); } catch (e) { baseProducts = null; }
/** Pure: categories that share a photo src (empty list = every category has its own). */
export const dupes = (cats) => { const by = new Map(); for (const c of cats) { const s = c.image && c.image.src; if (!s) continue; by.set(s, [...(by.get(s) || []), c.id]); } return [...by.values()].filter((v) => v.length > 1).map((v) => v.join(' + ')); };
const owner = (id) => { let e = srcJson[id], hop = 0; while (e && e.inherit && hop++ < 8) { id = e.inherit; e = srcJson[id]; } return e && e.page ? e : null; };
export function check(root) {
  const errs = []; const cats = rj(root, 'data/categories.json'); const prods = rj(root, 'data/products.json'); const idx = new Map(rj(root, 'data/index.json').map((e) => [e.id, e]));
  const catBy = new Map(cats.map((c) => [c.id, c])); const used = new Set();
  for (const c of cats) {
    const im = c.image; if (!im) { errs.push(c.id + ': category has no image'); continue; }
    for (const k of ['src', 'src2x', 'src3x']) { used.add(im[k]); if (!isWebp(path.join(root, im[k] || 'missing'))) errs.push(`${c.id}: ${k} missing or not WebP (${im[k]})`); }
    if (im.src3x && !/-1600\.webp$/.test(im.src3x)) errs.push(c.id + ': src3x is not the 1600 file');
    if (!(im.width > 0 && im.height > 0 && im.alt)) errs.push(c.id + ': width/height/alt missing');
    const cr = im.credit || {}; const own = owner(c.id);
    if (!cr.author || !OK_LIC.test(cr.license || '') || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(cr.page || '')) errs.push(c.id + ': credit incomplete or licence not accepted (' + cr.license + ')');
    else if (!own || own.author !== cr.author || own.license !== cr.license || own.page !== cr.page) errs.push(c.id + ': credit differs from stock_source.json');
  }
  for (const d of dupes(cats)) errs.push('shared photo: ' + d);
  for (const c of cats) { const kids = (c.children || []).map((id) => catBy.get(id)).filter((k) => k && k.image); const s = kids.map((k) => k.image.src); if (new Set(s).size !== s.length) errs.push(c.id + ': two tiles in its Browse by type share a photo'); }
  { const cfg = rj(root, 'data/config.json'); const feat = catBy.get(cfg.home.featureCategory); const s = ((feat && feat.children) || []).map((id) => (catBy.get(id) || { image: {} }).image.src); if (!s.length || new Set(s).size !== s.length) errs.push('home feature section: tiles share a photo'); }
  { const m = cats.filter((c) => c.level <= 2).map((c) => c.image && c.image.src); if (new Set(m).size !== m.length) errs.push('home mosaic: tiles share a photo'); }
  let packs = 0, ill = 0; const baseBy = new Map((baseProducts || []).map((p) => [p.id, p]));
  for (const p of prods) {
    const e = idx.get(p.id) || {}; const im = p.image;
    if (!im) { errs.push(p.id + ': no packshot and no illustrative photo'); continue; }
    if (!im.illustrative) { packs++; if (!im.source) errs.push(p.id + ': packshot has no source'); if (e.im !== 1) errs.push(p.id + ': index flag not 1'); continue; }
    ill++;
    const c = catBy.get(p.category);
    for (const k of ['src', 'src2x', 'src3x']) { used.add(im[k]); if (!isWebp(path.join(root, im[k] || 'missing'))) errs.push(`${p.id}: stock ${k} missing`); }
    if (!c || im.alt !== `Illustrative photo of ${c.name}, not the product`) errs.push(p.id + ': illustrative alt wrong');
    if (!c || !c.image || im.src !== c.image.src || im.src3x !== c.image.src3x || JSON.stringify(im.credit) !== JSON.stringify(c.image.credit)) errs.push(p.id + ': not its category photo');
    if (!(im.credit && im.credit.author && OK_LIC.test(im.credit.license || ''))) errs.push(p.id + ': illustrative credit missing');
    if (e.im !== 2) errs.push(p.id + ': index flag not 2');
    const f = path.join(root, 'data/p', p.id + '.json'); if (fs.existsSync(f) && JSON.stringify(rj(root, 'data/p/' + p.id + '.json').image) !== JSON.stringify(im)) errs.push(p.id + ': data/p disagrees');
  }
  if (baseProducts) for (const b of baseProducts) if (b.image) { const now = prods.find((p) => p.id === b.id); if (!now || JSON.stringify(now) !== JSON.stringify(b)) errs.push(b.id + ': packshot product changed from the base'); }
  const dir = path.join(root, 'assets/img/s'); let bytes = 0; const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const f of files) { bytes += fs.statSync(path.join(dir, f)).size; if (!used.has('assets/img/s/' + f)) errs.push('stray stock file ' + f); }
  if (bytes >= BYTE_CAP) errs.push('stock files total ' + bytes + ' bytes (45 MB cap)');
  return { errs, cats: cats.length, packs, ill, bytes, files: files.length, total: prods.length };
}
const r = check(PORTAL);
t(`${r.total} products and ${r.cats} categories read`, r.total === 512 && r.cats === 165, `${r.total} ${r.cats}`);
t('whole check: no errors (products, packshots untouched, flags, bytes, strays)', r.errs.length === 0, r.errs.slice(0, 4).join(' | '));
t('every product has a packshot or an illustrative photo (291 + 221 = 512)', r.packs === 291 && r.ill === 221 && r.packs + r.ill === r.total, `${r.packs} + ${r.ill}`);
t('stock files total under 45 MB', r.bytes < BYTE_CAP, `${r.bytes} bytes in ${r.files} files`);
const sw = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8'); t('service worker precaches no stock file', !/assets\/img|\.webp/.test(sw));
t('licence allowlist unchanged (CC0, Public domain, CC BY 2-4, CC BY-SA 2-4 only)', OK_LIC.source === OK_LIC_SOURCE && !OK_LIC.test('CC BY-NC 4.0') && !OK_LIC.test('CC BY-ND 2.0') && OK_LIC.test('CC BY-SA 3.0'));
{ const cats = rj(PORTAL, 'data/categories.json'); const ph = new Set(cats.map((c) => c.image.src));
  t(`uniqueness: ${cats.length} categories, ${ph.size} distinct photos, max reuse 1`, cats.length === 165 && ph.size === cats.length && dupes(cats).length === 0, dupes(cats).slice(0, 3).join(' | '));
  t('every category has a credit (author, licence, Commons file page) and a 1600 file', cats.every((c) => c.image.credit && c.image.credit.author && OK_LIC.test(c.image.credit.license) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.image.credit.page) && isWebp(path.join(PORTAL, c.image.src3x || 'x'))));
  const pages = new Set(cats.map((c) => c.image.credit.page)); t('uniqueness holds on the credit too: 165 distinct Commons file pages', pages.size === cats.length, pages.size);
  const comp = fs.readFileSync(path.join(PORTAL, 'assets/lib/components.js'), 'utf8'); const mos = fs.readFileSync(path.join(PORTAL, 'assets/lib/mosaic.js'), 'utf8');
  t('product page header srcset carries the 1600 variant; mosaic tiles carry it too', /src2x \+ ' 960w, ' \+ img\.src3x \+ ' 1600w'/.test(comp) && /\$\{i\.src3x\} 1600w/.test(comp) && /-1600\.webp/.test(mos)); }
const lic = Object.values(srcJson).filter((v) => v.page); t('stock_source.json: every category has its own record with author, accepted licence, file page, title, query', lic.length === 165 && lic.every((v) => v.author && OK_LIC.test(v.license) && v.page && v.title && v.query), lic.length);
t('stock_source.json: no inheriting or empty record, mode is own or fallback-unique', Object.values(srcJson).every((v) => v.page && (v.mode === 'own' || v.mode === 'fallback-unique') && !v.inherit && !v.none));
t('HD: every chosen source is >= 1600 px wide, or the 1200 px fallback is logged (hdFallback) and >= 1200', lic.every((v) => v.sourceWidth >= 1600 || (v.hdFallback === true && v.sourceWidth >= 1200)), lic.filter((v) => v.sourceWidth < 1600 && !v.hdFallback).length);
t(`relevance score recorded for every category and at or above the floor (${REL_FLOOR} domain words)`, lic.length === 165 && relFails(srcJson).length === 0, relFails(srcJson).slice(0, 3).join(' | '));
{ let veto = null; try { veto = JSON.parse(fs.readFileSync(path.join(REPO, 'demo-tools', 'sika-210c0c', 'stock_veto.json'), 'utf8')); } catch (e) { veto = null; }
  t('stock_veto.json exists, is an object and names only real categories', veto && typeof veto === 'object' && !Array.isArray(veto) && Object.keys(veto).every((id) => id in srcJson), veto ? Object.keys(veto).join(',') : 'unreadable'); }
t(`sharpness metric recorded for every chosen photo and above the floor (${SHARP_FLOOR})`, lic.every((v) => v.sharpness >= SHARP_FLOOR), lic.filter((v) => !(v.sharpness >= SHARP_FLOOR)).length);
t('base commit readable (packshot-untouched check ran)', baseProducts && baseProducts.filter((p) => p.image).length === 291, baseProducts ? baseProducts.filter((p) => p.image).length : 'git show failed');
// mutation
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stockmut-')); if (!tmp || !tmp.startsWith(os.tmpdir())) { console.log('FAIL mktemp'); process.exit(2); }
try {
  fs.mkdirSync(path.join(tmp, 'data/p'), { recursive: true });
  for (const f of ['data/categories.json', 'data/products.json', 'data/index.json', 'data/config.json']) fs.copyFileSync(path.join(PORTAL, f), path.join(tmp, f));
  for (const f of fs.readdirSync(path.join(PORTAL, 'data/p'))) fs.copyFileSync(path.join(PORTAL, 'data/p', f), path.join(tmp, 'data/p', f));
  fs.cpSync(path.join(PORTAL, 'assets/img/s'), path.join(tmp, 'assets/img/s'), { recursive: true });
  t('mutation baseline: the untouched copy passes', check(tmp).errs.length === 0, check(tmp).errs.slice(0, 2).join(' | '));
  const cats = rj(tmp, 'data/categories.json'); const v = cats[40];
  fs.rmSync(path.join(tmp, v.image.src2x));
  t('mutation: deleting one file makes the check fail', check(tmp).errs.some((e) => e.startsWith(v.id)));
  fs.copyFileSync(path.join(PORTAL, v.image.src2x), path.join(tmp, v.image.src2x));
  { const m2 = rj(tmp, 'data/categories.json'); m2[30].image.src = m2[31].image.src; fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(m2));
    t('mutation: duplicating one photo src in a temp copy makes the uniqueness check fail', check(tmp).errs.some((e) => e.startsWith('shared photo')) && dupes(m2).length === 1);
    fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(cats)); }
  { fs.rmSync(path.join(tmp, v.image.src3x)); t('mutation: deleting a 1600 file makes the check fail', check(tmp).errs.some((e) => e.startsWith(v.id))); fs.copyFileSync(path.join(PORTAL, v.image.src3x), path.join(tmp, v.image.src3x)); }
  { const sj = JSON.parse(JSON.stringify(srcJson)); const k = Object.keys(sj).find((x) => sj[x].page); sj[k].relevance = 1; const f = path.join(tmp, 'stock_source.json'); fs.writeFileSync(f, JSON.stringify(sj));
    t('mutation: lowering one relevance score in a temp copy makes the relevance check fail', relFails(JSON.parse(fs.readFileSync(f, 'utf8'))).join() === k && relFails(srcJson).length === 0); }
  const w = cats[7]; w.image.credit.license = 'CC BY-NC 4.0'; fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(cats));
  t('mutation: a corrupt credit (non-accepted licence) makes the check fail', check(tmp).errs.some((e) => e.startsWith(w.id)));
  w.image.credit.license = rj(PORTAL, 'data/categories.json')[7].image.credit.license; fs.writeFileSync(path.join(tmp, 'data/categories.json'), JSON.stringify(cats));
  const pr = rj(tmp, 'data/products.json'); const pk = pr.find((p) => p.image && !p.image.illustrative); pk.image.alt = 'changed'; fs.writeFileSync(path.join(tmp, 'data/products.json'), JSON.stringify(pr));
  t('mutation: changing a packshot product makes the check fail', check(tmp).errs.some((e) => e.startsWith(pk.id)));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `STOCK CHECK ${fails} failed` : 'STOCK CHECK GREEN'); process.exit(fails ? 1 : 0);
