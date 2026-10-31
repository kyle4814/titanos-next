// cite_unit.mjs: "Show the source" in data terms. citeModel unit checks, then every citation on every answer card to the 4,659 golden questions:
// the quote is the data's exact sentence, the link is the document record's URL, #page=N appears only where a page is recorded and the document is a PDF,
// and the page resolution rate is measured (the receipt quotes it; under 80% means the quote panel is the deliverable and the page is a bonus).
import path from 'node:path';
import { t, done } from './_lib.mjs';
import { makeBrain, rd } from '../sika-brain/harness.mjs';
import { generate } from '../sika-brain/golden_gen.mjs';
import { PORTAL } from './_env.mjs';
import { pathToFileURL } from 'node:url';
const { citeModel } = await import(pathToFileURL(path.join(PORTAL, 'assets/lib/cite.js')).href);

// ---- unit
const pdf = 'https://aus.sika.com/content/dam/dms/au01/4/davco-grey-one-potadhesive.pdf';
let m = citeModel({ quote: '  Coverage is  7.5 m2 ', url: pdf, docType: 'PDS', page: 3, version: 'Nov 2023' });
t('PDF with a page: #page=3 on the link, base URL untouched', m.href === pdf + '#page=3' && m.baseUrl === pdf && m.page === 3);
t('the quote is the sentence with whitespace folded, nothing else changed', m.quote === 'Coverage is 7.5 m2' && m.hasQuote);
m = citeModel({ quote: 'x', url: pdf, docType: 'PDS', page: null });
t('PDF with no page: no #page, no page', m.href === pdf && m.page === null && !/#/.test(m.href));
for (const bad of [0, -1, 1.5, 'abc', NaN, 100000, undefined]) t(`a bad page (${String(bad)}) is not used`, citeModel({ quote: 'x', url: pdf, docType: 'PDS', page: bad }).page === null);
m = citeModel({ quote: 'x', url: 'https://aus.sika.com/en/construction/davco.html', docType: 'WEB', page: 4 });
t('a web page never gets #page, even if a page number is passed', m.href === 'https://aus.sika.com/en/construction/davco.html' && m.page === null && !m.isPdf);
m = citeModel({ quote: 'x', url: pdf + '#page=7', docType: 'PDS' });
t('a link that already carries #page=7 keeps it once', m.href === pdf + '#page=7' && m.page === 7 && m.baseUrl === pdf);
m = citeModel({ quote: 'Product Data Sheet (PDS): Davco Grey One Pot adhesive', url: pdf, docType: 'product_data_sheet' });
t('a document-listing citation shows no fake sentence and takes its title from the listing', !m.hasQuote && m.title === 'Davco Grey One Pot adhesive' && m.typeLabel === 'Product data sheet', JSON.stringify(m));
t('an empty URL gives an empty link', citeModel({ quote: 'x' }).href === '');

// ---- every citation on every golden answer
const brain = makeBrain(); const docs = rd('data/documents.json'); const recUrls = new Set(); for (const d of docs) { recUrls.add(d.url); if (d.dmsUrl) recUrls.add(d.dmsUrl); }
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const seen = new Set(); const stats = { n: 0, noUrl: 0, quoteBad: 0, hrefBad: 0, pageBad: 0, pdfNoRecord: 0, pdf: 0, paged: 0, quoted: 0, quotedPdf: 0, quotedPdfPaged: 0, listing: 0, web: 0 };
const first = {};
for (const x of generate()) {
  const a = await brain.ask(x.q);
  for (const c of a.cards) for (const f of c.facts || []) {
    if (!f.sentence) continue; const k = [c.type, f.source_url, f.page, f.sentence].join('|'); if (seen.has(k)) continue; seen.add(k);
    const m = citeModel({ quote: f.sentence, url: f.source_url, docType: f.doc_type, version: f.doc_version, page: f.page });
    stats.n++;
    if (!/^https?:\/\//.test(f.source_url)) { stats.noUrl++; first.noUrl ||= k; continue; }
    if (m.hasQuote) { stats.quoted++; if (m.quote !== norm(f.sentence)) { stats.quoteBad++; first.quote ||= k; } } else stats.listing++;
    if (m.baseUrl !== f.source_url.replace(/#page=\d+$/, '') || !m.href.startsWith(m.baseUrl)) { stats.hrefBad++; first.href ||= k; }
    const hasHash = /#/.test(m.href); const expectHash = m.isPdf && Number.isInteger(f.page) && f.page >= 1;
    if (hasHash !== expectHash || (hasHash && m.href !== m.baseUrl + '#page=' + f.page)) { stats.pageBad++; first.page ||= k; }
    if (m.isPdf) { stats.pdf++; if (!recUrls.has(m.baseUrl)) { stats.pdfNoRecord++; first.rec ||= m.baseUrl; } if (m.page) stats.paged++; if (m.hasQuote) { stats.quotedPdf++; if (m.page) stats.quotedPdfPaged++; } } else stats.web++;
  }
}
t(`${stats.n} distinct citations found on golden answers`, stats.n > 1000, stats.n);
t('every citation has a link to open (a source URL)', stats.noUrl === 0, first.noUrl);
t('every quote panel text is the data\'s exact sentence', stats.quoteBad === 0 && stats.quoted > 0, first.quote || `${stats.quoted} quoted`);
t('every link is the cited document\'s own URL (plus #page=N only where recorded)', stats.hrefBad === 0 && stats.pageBad === 0, first.href || first.page);
t(`every PDF link is a URL of a document record in data/documents.json (${stats.pdf} PDF citations)`, stats.pdfNoRecord === 0 && stats.pdf > 0, first.rec);
const rate = stats.paged / stats.n;
console.log(`INFO page resolution: ${stats.paged}/${stats.n} = ${(100 * rate).toFixed(1)}% of all citations; PDF citations ${stats.paged}/${stats.pdf} = ${(100 * stats.paged / stats.pdf).toFixed(1)}%; statements quoted from a PDF ${stats.quotedPdfPaged}/${stats.quotedPdf}; whole-document listings ${stats.listing}; web pages ${stats.web}`);
t('statements quoted from a PDF all carry a page (the data records it)', stats.quotedPdf > 0 && stats.quotedPdfPaged === stats.quotedPdf, `${stats.quotedPdfPaged}/${stats.quotedPdf}`);
console.log(`INFO ${rate < 0.8 ? 'under' : 'at or over'} 80% of all citations carry a page: ${rate < 0.8 ? 'the quote panel is the deliverable and the page link is a bonus' : 'page links are the norm'}`);

// ---- mutation: a cite.js that adds #page to web pages must be caught by the unit checks above (run in a throw-away copy)
import fs from 'node:fs';
import os from 'node:os';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'citematch-cite-'));
if (!tmp || !path.basename(tmp).startsWith('citematch-cite-')) { t('mutation fixture dir', false, 'mktemp failed'); done('CITE UNIT'); }
try {
  fs.copyFileSync(path.join(PORTAL, 'assets/lib/util.js'), path.join(tmp, 'util.js'));
  const src = fs.readFileSync(path.join(PORTAL, 'assets/lib/cite.js'), 'utf8'); const mut = src.replace("const pg = isPdf ? (pageOf(page) || pageFromUrl) : null;", "const pg = (pageOf(page) || pageFromUrl);");
  t('mutation: the page rule line was found and changed', mut !== src);
  fs.writeFileSync(path.join(tmp, 'cite.js'), mut); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const mm = await import(pathToFileURL(path.join(tmp, 'cite.js')).href);
  const r = mm.citeModel({ quote: 'x', url: 'https://aus.sika.com/en/construction/davco.html', docType: 'WEB', page: 4 });
  t('mutation: the web-page check catches a cite.js that adds #page to a web page', r.href.includes('#page=4'), r.href);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
done('CITE UNIT');
