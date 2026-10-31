// Link check. Default (internal, offline, part of the battery): every route target and every relative link in the portal data, the hub and
// the 363 system sheets resolves to something that exists. With --external: polite HEAD requests to aus.sika.com at 1 request per second
// (the 26 documents already recorded as failed, plus a seeded sample), run by hand, never in the battery.
// usage: node linkcheck.mjs <portalDir> [--external] [--sample=60] [--seed=20261031]
import fs from 'node:fs';
import path from 'node:path';
import { rng, sample } from './lib.mjs';

const portal = path.resolve(process.argv[2] || '.');
const args = process.argv.slice(3); const ext = args.includes('--external');
const sampleN = Number((args.find((a) => a.startsWith('--sample=')) || '--sample=60').split('=')[1]);
const seed = Number((args.find((a) => a.startsWith('--seed=')) || '--seed=20261031').split('=')[1]);
const J = (f) => JSON.parse(fs.readFileSync(path.join(portal, f), 'utf8'));
let fails = 0; let checked = 0;
const bad = (what, detail) => { fails++; console.log('BROKEN ' + what + ' :: ' + detail); };

const index = J('data/index.json'); const ids = new Set(index.map((p) => p.id));
const cats = J('data/categories.json'); const catIds = new Set(cats.map((c) => c.id));
const sel = J('data/selector.json'); const slugs = new Set(Object.values(sel.slugs));
const docs = J('data/documents.json');

// 1. every product file exists, and every product id used by relations, documents and sheets exists
for (const p of index) { checked++; if (!fs.existsSync(path.join(portal, 'data/p', p.id + '.json'))) bad('product file', p.id); }
for (const c of cats) { checked++; for (const k of c.children || []) if (!catIds.has(k)) bad('category child', c.id + ' -> ' + k); if (c.parent && !catIds.has(c.parent)) bad('category parent', c.id + ' -> ' + c.parent); }
for (const d of docs) { checked++; for (const pid of d.products || []) if (!ids.has(pid)) bad('document product', d.id + ' -> ' + pid); if (!/^https:\/\/aus\.sika\.com\//.test(d.url || '')) bad('document url', d.id + ' ' + d.url); }
for (const p of index) { const pf = J('data/p/' + p.id + '.json'); checked++; for (const rel of pf.rel || []) { const rid = typeof rel === 'string' ? rel : rel.id; if (rid && !ids.has(rid)) bad('related product', p.id + ' -> ' + rid); } if (p.c && !catIds.has(p.c)) bad('product category', p.id + ' -> ' + p.c); }

// 2. the hub and every sheet: relative links, route links, source anchors, the specification text file
const hubFile = path.join(portal, 'systems/index.html');
const sheetDirs = fs.readdirSync(path.join(portal, 'systems'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
if (sheetDirs.length !== slugs.size) bad('sheet count', `${sheetDirs.length} folders vs ${slugs.size} slugs in selector.json`);
for (const sl of slugs) if (!sheetDirs.includes(sl)) bad('sheet missing', sl);
const hrefs = (html) => [...html.replace(/<style[\s\S]*?<\/style>/g, '').matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const checkRoute = (h, from) => {
  const m = /#\/(product|category|system-data)\/([^?#"]+)/.exec(h); if (!m) return; const id = decodeURIComponent(m[2]);
  if (m[1] === 'product' && !ids.has(id)) bad('route target', `${from}: ${h}`); if (m[1] === 'category' && !catIds.has(id)) bad('route target', `${from}: ${h}`); if (m[1] === 'system-data' && !slugs.has(id)) bad('route target', `${from}: ${h}`);
};
for (const f of [hubFile, ...sheetDirs.map((d) => path.join(portal, 'systems', d, 'index.html'))]) {
  const html = fs.readFileSync(f, 'utf8'); const dir = path.dirname(f); const rel = path.relative(portal, f); checked++;
  const anchors = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const h of hrefs(html)) {
    if (h.startsWith('https://')) { if (!/^https:\/\/aus\.sika\.com\//.test(h)) bad('external host', `${rel}: ${h}`); continue; }
    if (h.startsWith('#') && !h.startsWith('#/')) { if (!anchors.has(h.slice(1)) && h !== '#main') bad('anchor', `${rel}: ${h}`); else if (h === '#main' && !anchors.has('main')) bad('anchor', `${rel}: #main`); continue; }
    const [pth, hash] = h.split('#'); const target = path.resolve(dir, pth || '.');
    const isDir = !path.extname(target); const file = isDir ? path.join(target, 'index.html') : target;
    if (!fs.existsSync(file)) bad('relative link', `${rel}: ${h}`); if (hash && hash.startsWith('/')) checkRoute('#' + hash, rel);
  }
}
// 3. static routes the chrome links to
const idx = fs.readFileSync(path.join(portal, 'index.html'), 'utf8'); checked++;
for (const h of hrefs(idx)) { checkRoute(h, 'index.html'); if (/^#\/(?!$)/.test(h) && !/^#\/(product|category|products|documents|guides|projects|about|selector|help|rules|insights|system)/.test(h)) bad('unknown route', h); }
// 4. skip link: the page must keep a #main target
if (!/id="main"/.test(idx)) bad('skip target', 'index.html has no #main');

// 5. text fidelity: no mojibake (UTF-8 read as Latin-1: A-circumflex, A-tilde, a-circumflex + euro) anywhere in the data the pages show
const walkJ = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkJ(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []);
let moji = 0; for (const f of walkJ(path.join(portal, 'data'))) { checked++; const t = fs.readFileSync(f, 'utf8'); const m = t.match(/.{0,20}(\u00c2|\u00c3[\u0080-\u00bf]|\u00e2\u20ac).{0,12}/); if (m) { moji++; if (moji <= 5) bad('mojibake', path.relative(portal, f) + ': ' + JSON.stringify(m[0])); } }
if (moji > 5) bad('mojibake', `${moji} files in all`);

console.log(`INTERNAL LINKS: ${checked} items checked, ${fails} broken`);

if (ext) {
  const prior = docs.filter((d) => d.http && d.http.ok === false || (d.http && d.http.status >= 400)).map((d) => d.url);
  const r = rng(seed); const rest = sample(r, docs.filter((d) => !prior.includes(d.url)).map((d) => d.url), sampleN);
  const todo = [...new Set([...prior, ...rest])]; let ok = 0, notok = 0; const out = [];
  console.log(`EXTERNAL HEAD: ${todo.length} urls (${prior.length} recorded failures + ${rest.length} sampled), 1 request per second`);
  for (const u of todo) {
    const t0 = Date.now();
    try { const res = await fetch(u, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'titanos-link-check (courtesy HEAD, 1 rps)' } }); if (res.status < 400) ok++; else { notok++; out.push(res.status + ' ' + u); } } catch (e) { notok++; out.push('ERR ' + e.message.slice(0, 40) + ' ' + u); }
    await new Promise((r2) => setTimeout(r2, Math.max(0, 1000 - (Date.now() - t0))));
  }
  console.log(`EXTERNAL RESULT: ${ok} responded, ${notok} did not`); out.forEach((l) => console.log('  ' + l));
}
process.exit(fails ? 1 : 0);
