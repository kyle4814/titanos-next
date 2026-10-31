// build_gift.mjs: builds data/gift/data_quality.json for the data quality page (#/about/data-quality) and its PDF.
// Every figure is computed from files in this repo: products.json (no photo), images_source.json (why), source_issues.md (the spec issues and the 404 links
// we already reported on 2026-10-30), documents.json + link_check.json (the polite re-check), data/k/*.json (consumption status). Nothing is typed in by hand.
// usage: node build_gift.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const rj = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const fix = (s) => String(s || '').replace(/Â(?=[®™°º²³])/g, '').replace(/[–—]/g, '-').trim();
const D = path.join(PORTAL, 'data');
const products = rj(path.join(D, 'products.json'));
const byId = new Map(products.map((p) => [p.id, p]));

// ---- 1. no product photo
const src = rj(path.join(HERE, 'images_source.json'));
const noPhoto = products.filter((p) => !p.image).map((p) => {
  const s = src[p.id] || {}; const why = s.why || '';
  const reason = /only diagrams|no packshot/i.test(why) ? 'only-diagrams' : /no product image/i.test(why) ? 'no-image-on-page' : 'unknown';
  return { id: p.id, name: fix(p.name), group: (p.categoryPath || []).slice(0, 2).join(' / '), reason };
}).sort((a, b) => a.name.localeCompare(b.name));
const reasons = { 'no-image-on-page': 'The product page publishes no product image (only the site logo and icons were found).', 'only-diagrams': 'The page has only diagrams, application or system pictures, and no packshot of the product.', unknown: 'No reason recorded.' };

// ---- 2. spec issues and 404 links we already reported (parsed from the report text)
const md = fs.readFileSync(path.join(HERE, 'source_issues.md'), 'utf8');
const sect = (n) => { const m = md.split(/^## /m).find((x) => x.startsWith(n + '.')); return m || ''; };
const rows = (s) => s.split('\n').filter((l) => l.startsWith('|') && !/^\|\s*(Product|---)/.test(l)).map((l) => l.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim()));
const link = (c) => { const m = /\[([^\]]*)\]\(([^)]*)\)/.exec(c); return m ? { text: m[1], url: m[2] } : { text: c, url: '' }; };
const specIssues = rows(sect('1')).map(([product, edition, where, printed, why]) => { const l = link(where); return { product: fix(product), edition: fix(edition), where: fix(l.text === where ? where : where.replace(/\[([^\]]*)\]\([^)]*\)/, '$1')), url: l.url, printed: fix(printed), why: fix(why) }; });
const reported404 = rows(sect('2')).map(([page, title, type]) => { const l = link(page); return { product: fix(l.text), pageUrl: l.url, title: fix(title), type: fix(type) }; });

// ---- 3. document links: the 30 October status in documents.json, and the polite re-check if link_check.json exists
const docs = rj(path.join(D, 'documents.json'));
const lcPath = path.join(HERE, 'link_check.json'); const lc = fs.existsSync(lcPath) ? rj(lcPath) : {};
const dead = [], redirected = [];
let checked = 0, lastChecked = '';
for (const d of docs) {
  const r = lc[d.id]; if (!r) continue; checked++; if (r.checked > lastChecked) lastChecked = r.checked;
  const pn = (d.products || []).map((id) => byId.get(id)).filter(Boolean).map((p) => fix(p.name));
  const rec = { id: d.id, title: fix(d.title), type: d.typeLabel || d.type, products: pn.slice(0, 3), url: d.url, status: r.status };
  const failed = typeof r.status !== 'number' || r.status >= 400;
  if (failed && r.alt && r.alt.ok) redirected.push({ ...rec, final: r.alt.ok, onlyOtherForm: true });   // the listed address fails, another address form of the same file opens
  else if (failed) dead.push(rec); else if (r.redirected) redirected.push({ ...rec, final: r.final });
}
const known404 = docs.filter((d) => d.http && d.http.status === 404).length;

// ---- 4. consumption rate not published (data/k status)
const noRate = [], needsReader = [], methodStatement = [];
let kTotal = 0;
for (const p of products) {
  const f = path.join(D, 'k', p.id + '.json'); if (!fs.existsSync(f)) continue; kTotal++;
  const st = ((rj(f).rates || {}).status) || '';
  const rec = { id: p.id, name: fix(p.name), group: (p.categoryPath || []).slice(0, 2).join(' / ') };
  if (st === 'published') continue;
  if (st === 'not published') noRate.push({ ...rec, why: 'datasheet' });
  else if (/no data sheet PDF found/.test(st)) noRate.push({ ...rec, why: 'no-datasheet' });
  else if (/^see data sheet/.test(st)) needsReader.push(rec);
  else methodStatement.push(rec);
}
noRate.sort((a, b) => a.name.localeCompare(b.name));

const out = {
  generated: new Date().toISOString().slice(0, 10), readOn: '2026-10-30',
  counts: { products: products.length, noPhoto: noPhoto.length, specIssuePlaces: specIssues.length, specIssueProducts: new Set(specIssues.map((x) => x.product)).size,
    reported404: reported404.length, known404InDocuments: known404, documentsInRecheck: checked, documentsTotal: docs.length, deadNow: dead.length, redirectedNow: redirected.length,
    noRate: noRate.length, noRateDatasheet: noRate.filter((x) => x.why === 'datasheet').length, noRateNoDatasheet: noRate.filter((x) => x.why === 'no-datasheet').length, methodStatement: methodStatement.length, needsReader: needsReader.length, rateProductsTotal: kTotal },
  noPhoto: { reasons, items: noPhoto }, specIssues, reported404, linkCheck: { checked, lastChecked, dateAU: lastChecked ? new Date(lastChecked).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }) : '', dead, redirected }, noRate, methodStatement,
};
fs.mkdirSync(path.join(D, 'gift'), { recursive: true });
fs.writeFileSync(path.join(D, 'gift', 'data_quality.json'), JSON.stringify(out));
console.log('gift data', JSON.stringify(out.counts));
