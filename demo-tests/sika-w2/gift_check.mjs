// gift_check.mjs: the data quality gift pack. Recomputes every count from the raw sources, independently of build_gift.mjs, and compares it with the
// data file the page reads and with the PDF text. Includes tone checks (calm, helpful, no dashes) and mutation checks (a doctored count must be caught).
// usage: node gift_check.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const TOOLS = path.join(HERE, '..', '..', 'demo-tools', 'sika-210c0c');
const rj = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
const gift = rj(path.join(PORTAL, 'data', 'gift', 'data_quality.json'));
const products = rj(path.join(PORTAL, 'data', 'products.json')); const docs = rj(path.join(PORTAL, 'data', 'documents.json'));
const src = rj(path.join(TOOLS, 'images_source.json')); const md = fs.readFileSync(path.join(TOOLS, 'source_issues.md'), 'utf8');

/** Pure: independent recount of the headline figures from the raw files. */
export function recount() {
  const noImg = products.filter((p) => !p.image);
  const none = Object.values(src).filter((v) => v.none).length;
  const sec = (n) => md.split(/^## /m).find((x) => x.startsWith(n + '.')) || '';
  const body = (s) => s.split('\n').filter((l) => /^\| /.test(l) && !/^\| (Product|---)/.test(l));
  const spec = body(sec('1')); const l404 = body(sec('2'));
  let notPub = 0, noDs = 0, published = 0, other = 0;
  for (const p of products) { const st = (rj(path.join(PORTAL, 'data', 'k', p.id + '.json')).rates || {}).status || ''; if (st === 'published') published++; else if (st === 'not published') notPub++; else if (/no data sheet PDF found/.test(st)) noDs++; else other++; }
  return { noPhoto: noImg.length, noneInSource: none, specPlaces: spec.length, specProducts: new Set(spec.map((l) => l.split('|')[1].trim())).size, reported404: l404.length, docs404: docs.filter((d) => d.http && d.http.status === 404).length, noRate: notPub + noDs, notPub, noDs, published, other };
}
const r = recount(); const c = gift.counts;
t('no photo: products.json, images_source.json and the data file agree (221)', r.noPhoto === c.noPhoto && r.noneInSource === c.noPhoto && gift.noPhoto.items.length === c.noPhoto, JSON.stringify([r.noPhoto, r.noneInSource, c.noPhoto]));
t('no photo: every product with no picture has a recorded reason', gift.noPhoto.items.every((x) => x.reason !== 'unknown') && gift.noPhoto.items.every((x) => !products.find((p) => p.id === x.id).image));
t('spec issues: 12 places in 9 products, as in the report sent on 2026-10-30', r.specPlaces === c.specIssuePlaces && r.specProducts === c.specIssueProducts && c.specIssuePlaces === 12 && c.specIssueProducts === 9, JSON.stringify([r.specPlaces, r.specProducts]));
t('spec issues: each row carries a link to the data sheet page', gift.specIssues.every((x) => /^https:\/\/aus\.sika\.com\//.test(x.url)));
t('dead links: the 26 in the report equal the 26 documents recorded as HTTP 404', r.reported404 === c.reported404 && r.docs404 === c.reported404 && c.reported404 === 26, JSON.stringify([r.reported404, r.docs404]));
const t404 = new Set(docs.filter((d) => d.http && d.http.status === 404).map((d) => d.title.replace(/Â(?=[®™°º²³])/g, '').trim()));
t('dead links: every reported document title is one of the 404 documents', gift.reported404.every((x) => t404.has(x.title) || [...t404].some((y) => y.includes(x.title) || x.title.includes(y))), gift.reported404.filter((x) => ![...t404].some((y) => y.includes(x.title) || x.title.includes(y))).map((x) => x.title).join(' | '));
t('consumption rate: 213 products have none published (153 data sheet silent, 60 no data sheet)', r.noRate === c.noRate && r.notPub === c.noRateDatasheet && r.noDs === c.noRateNoDatasheet && c.noRate === 213, JSON.stringify(r));
t('consumption rate: published + unpublished + other = every product', r.published + r.noRate + r.other === c.products && c.products === 512, JSON.stringify([r.published, r.noRate, r.other]));
const lcFile = path.join(TOOLS, 'link_check.json');
if (fs.existsSync(lcFile)) {
  const lc = rj(lcFile); const ids = new Set(docs.map((d) => d.id)); const n = Object.keys(lc).length;
  t(`link re-check: ${n} of ${docs.length} documents checked, every id is a real document`, Object.keys(lc).every((k) => ids.has(k)) && c.documentsInRecheck === n, JSON.stringify([n, c.documentsInRecheck]));
  const failed = Object.values(lc).filter((x) => typeof x.status !== 'number' || x.status >= 400); const alt = failed.filter((x) => x.alt && x.alt.ok);
  t('link re-check: the data file lists the failed ones that stay failed, and separately those that open at another address form', c.deadNow === failed.length - alt.length && c.redirectedNow === Object.values(lc).filter((x) => typeof x.status === 'number' && x.status < 400 && x.redirected).length + alt.length, JSON.stringify([c.deadNow, c.redirectedNow, failed.length, alt.length]));
  t('link re-check: on the re-check date the same 26 links are still not found (nothing new went missing, nothing was fixed)', c.deadNow === c.reported404 && c.deadNow === 26, c.deadNow);
  t('link re-check: every check was made on 2026-10-30 or later and carries a UTC time', Object.values(lc).every((x) => /^2026-10-(30|31)T|^2026-1[12]/.test(x.checked)));
}
// politeness evidence: the re-check log lines for this run (one request a second, HEAD first) come from the shared limiter, so check the log gaps
try {
  const log = fs.readFileSync('/home/tech2/klinge-kernel/state/sika/crawl/crawl.log', 'utf8').trim().split('\n').slice(-400).map((l) => l.split('\t'));
  const ts = log.filter((x) => x[1] === 'HEAD').map((x) => Date.parse(x[0])); let worst = 1e9; for (let i = 0; i + 10 < ts.length; i++) worst = Math.min(worst, (ts[i + 10] - ts[i]) / 10);
  // the log stamps whole seconds and the time a request finished, so a single gap is not reliable; any 10 requests in a row must average one a second or slower
  t('politeness: any 10 requests in a row in the log average no faster than one a second', ts.length < 11 || worst >= 1000 * 0.95, 'fastest stretch averaged ' + Math.round(worst) + ' ms per request');
  t('politeness: the re-check asked with HEAD first (no document downloads)', log.filter((x) => x[1] === 'GET' && /\.pdf/.test(x[4] || '') && Date.parse(x[0]) > Date.now() - 36e5).length === 0);
} catch { t('politeness log readable', false); }
// tone and hygiene
const view = fs.readFileSync(path.join(PORTAL, 'assets', 'lib', 'data-quality.js'), 'utf8');
const copy = [...view.matchAll(/'([^'\n]{12,})'|`([^`\n]{12,})`/g)].map((m) => m[1] || m[2]).join('\n');
t('tone: no criticism words in the page copy', !/\b(wrong|error|mistake|failure|broken|sloppy|negligen\w*|incompeten\w*|shame|embarrass\w*|careless|bad|poor)\b/i.test(copy), (copy.match(/\b(wrong|error|mistake|failure|broken|sloppy|careless|bad|poor)\b/i) || [])[0]);
t('tone: the page says these are things we noticed that you may want to look at', /things we noticed that you may want to look at/.test(copy));
t('hygiene: no em or en dashes in the page copy or the data file', !/[–—]/.test(copy) && !/[–—]/.test(JSON.stringify(gift)));
t('hygiene: no mojibake (the stray A-circumflex from the source titles) in the data file', !/Â/.test(JSON.stringify(gift)));
t('hygiene: no logo files named in the page code', !/logo\.(png|svg|jpg)/i.test(view));
// mutation: a doctored count in the data file must be caught
const bad = JSON.parse(JSON.stringify(gift)); bad.counts.noPhoto = 220;
t('mutation: a data file saying 220 instead of 221 is caught by the recount', !(r.noPhoto === bad.counts.noPhoto && r.noneInSource === bad.counts.noPhoto));
const bad2 = JSON.parse(JSON.stringify(gift)); bad2.counts.reported404 = 25;
t('mutation: a data file saying 25 dead links instead of 26 is caught', !(r.docs404 === bad2.counts.reported404));
// the PDF
const pdf = path.join(PORTAL, 'downloads', 'sika-data-quality-notes.pdf');
if (!fs.existsSync(pdf)) t('PDF exists', false, pdf); else {
  const buf = fs.readFileSync(pdf); t('PDF exists, is a real PDF and is a sensible size', buf.slice(0, 5).toString() === '%PDF-' && buf.length > 20000 && buf.length < 5e6, buf.length + ' bytes');
  const py = spawnSync('python3', ['-c', 'import sys,json,pymupdf;d=pymupdf.open(sys.argv[1]);print(json.dumps({"pages":len(d),"text":"".join(p.get_text() for p in d)}))', pdf], { encoding: 'utf8', maxBuffer: 1e8 });
  const o = py.status === 0 ? JSON.parse(py.stdout) : { pages: 0, text: '' };
  t('PDF: between 3 and 30 pages', o.pages >= 3 && o.pages <= 30, o.pages);
  t('PDF: carries the four headline counts', [c.noPhoto, c.specIssuePlaces, c.reported404, c.noRate].every((n) => o.text.includes(String(n))), [c.noPhoto, c.specIssuePlaces, c.reported404, c.noRate].join(','));
  t('PDF: lists every no-photo and no-rate product name (all lists open)', [...gift.noPhoto.items, ...gift.noRate].every((x) => o.text.replace(/\s+/g, ' ').includes(x.name.replace(/\s+/g, ' ').slice(0, 24))), '');
  t('PDF: no em or en dashes, no portal buttons or navigation text', !/[–—]/.test(o.text) && !/Print this page|Download as a PDF|Skip to main content/.test(o.text));
  t('PDF: names Sika Australia and says public pages only', /Sika Australia/.test(o.text) && /public pages and public PDFs only/i.test(o.text));
}
console.log(fails ? `GIFT CHECK ${fails} failed` : 'GIFT CHECK GREEN'); process.exit(fails ? 1 : 0);
