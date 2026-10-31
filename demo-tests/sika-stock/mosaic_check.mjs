// mosaic_check.mjs: the home page photo mosaic ("Explore the range"). Node checks, no browser. usage: node mosaic_check.mjs [portalDir]
//  1. every root and level 2 category has a tile; each tile has an img with alt, width, height, loading=lazy, the "Illustrative photo" label and a credit
//  2. the home first screen (index.html + dist/main.js + data/config.json + data/cats.lite.json, gzip level 6) stays under Kyle's 90,000 B kill test
//  3. the mosaic is below the hero, built from tokens (no raw hex colours in its CSS), phone layout stacked
//  4. MUTATION: strip one tile's alt, then one credit, then one loading attribute: each must make the check fail
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
const rj = (f) => JSON.parse(fs.readFileSync(path.join(PORTAL, f), 'utf8').replace(/^﻿/, ''));
const { mosaicCats, mosaicSpec } = await import(pathToFileURL(path.join(PORTAL, 'assets', 'lib', 'mosaic.js')).href);
const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(PORTAL, rel)), { level: 6 }).length;
export const FIRST_SCREEN_LIMIT = 90000;
export const FIRST = ['index.html', 'dist/main.js', 'data/config.json', 'data/cats.lite.json'];

/** Pure: the problems with a list of tile specs (empty list = fine). */
export function problems(specs, expectIds) {
  const p = [];
  const ids = new Set(specs.map((s) => s.id)); for (const id of expectIds) if (!ids.has(id)) p.push('missing tile ' + id);
  for (const s of specs) {
    const i = s.img || {};
    if (!i.alt) p.push(s.id + ': no alt'); if (!i.width || !i.height) p.push(s.id + ': no width/height'); if (i.loading !== 'lazy') p.push(s.id + ': not lazy');
    if (!i.src || !i.src2x) p.push(s.id + ': no src'); if (!/^Illustrative photo/.test(s.tag || '')) p.push(s.id + ': no illustrative label');
    if (!/^Photo: .+, .+/.test(s.credit || '')) p.push(s.id + ': no credit'); if (!s.title || !s.title.includes(s.credit || '\0')) p.push(s.id + ': credit not in the title');
  }
  return p;
}
const full = rj('data/categories.json'); const lite = rj('data/cats.lite.json').categories;
const cats = mosaicCats(lite); const expect = lite.filter((c) => c.level <= 2).map((c) => c.id);
const crOf = (id) => ((full.find((c) => c.id === id) || {}).image || {}).credit;
const specs = cats.map((c) => mosaicSpec(c, crOf(c.id)));
t(`tiles: every root and level 2 category has one (${expect.length})`, specs.length === expect.length && expect.every((id) => specs.some((s) => s.id === id)), JSON.stringify([specs.length, expect.length]));
const pr = problems(specs, expect); t('tiles: each has an img with alt, width, height, loading=lazy, the illustrative label and a credit', pr.length === 0, pr.slice(0, 4).join(' | '));
t('tiles: every photo file exists on disk (both sizes)', specs.every((s) => fs.existsSync(path.join(PORTAL, s.img.src)) && fs.existsSync(path.join(PORTAL, s.img.src2x))));
t('tiles: before the credit file arrives a tile still says where the credit is (title never blank)', cats.every((c) => mosaicSpec(c).title.length > 20 && /credit/i.test(mosaicSpec(c).title)));
const n = FIRST.reduce((a, r) => a + gz(r), 0);
console.log(`FIRST SCREEN gzip ${n} B (${FIRST.map((r) => r + ' ' + gz(r)).join(', ')})`);
t(`first screen: ${n} B gzip is under ${FIRST_SCREEN_LIMIT} B (Kyle's kill test)`, n < FIRST_SCREEN_LIMIT, n);
const views = fs.readFileSync(path.join(PORTAL, 'assets', 'lib', 'views.js'), 'utf8'); const css = fs.readFileSync(path.join(PORTAL, 'assets', 'portal.css'), 'utf8');
const hero = views.indexOf("class: 'hero'"); const expl = views.indexOf('Explore the range');
t('home: the mosaic sits in the Explore the range section, below the hero', hero >= 0 && expl > hero && /Explore the range[\s\S]{0,400}\bmosaic\)\)/.test(views) && /h\('div', \{ class: 'mosaic' \}/.test(views));
const rules = css.split('\n').filter((l) => /^\.mosaic/.test(l) || /\{\.mosaic|[ ,]\.mosaic/.test(l)).join('\n');
t('css: the mosaic rules exist, use var(--tokens) and no raw hex colours other than #fff / #000', /var\(--/.test(rules) && !(rules.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((x) => !/^#(fff|000|ffffff|000000)$/i.test(x)).length, rules.slice(0, 120));
t('css: phone layout stacks (one column under 40em)', /@media \(max-width:39\.99em\)\{[^@]*\.mosaic[^@]*grid-template-columns:1fr/.test(css.replace(/\n/g, '')));
// mutation: each doctored copy of the specs must be caught
const mut = (f) => { const c = specs.map((s) => ({ ...s, img: { ...s.img } })); f(c[4]); return problems(c, expect); };
t('mutation: stripping one tile alt is caught', mut((s) => { s.img.alt = ''; }).some((x) => /no alt/.test(x)));
t('mutation: stripping one credit is caught', mut((s) => { s.credit = ''; }).some((x) => /no credit/.test(x)));
t('mutation: removing loading=lazy on one tile is caught', mut((s) => { s.img.loading = 'eager'; }).some((x) => /not lazy/.test(x)));
t('mutation: dropping a tile is caught', problems(specs.slice(1), expect).some((x) => /missing tile/.test(x)));
console.log(fails ? `MOSAIC CHECK RED: ${fails} failed` : 'MOSAIC CHECK GREEN'); process.exit(fails ? 1 : 0);
