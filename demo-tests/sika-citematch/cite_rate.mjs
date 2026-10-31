// cite_rate.mjs: how many of the citations the advisor shows resolve to a page number, measured over the golden questions (4,659) answered offline.
// A citation = one fact with a sentence on an answer card (each gets a "Show the source" control). Counted once per (card type, url, page, sentence).
// usage: node cite_rate.mjs [--json]
import { makeBrain, rd } from '../sika-brain/harness.mjs';
import { generate } from '../sika-brain/golden_gen.mjs';
import { citeModel } from '../../public/demo/sika-210c0c/assets/lib/cite.js';
const brain = makeBrain(); const docs = rd('data/documents.json');
const byUrl = new Map(); for (const d of docs) { byUrl.set(d.url, d); if (d.dmsUrl) byUrl.set(d.dmsUrl, d); }
const seen = new Map(); let answers = 0, cards = 0;
for (const x of generate()) {
  const a = await brain.ask(x.q || x.question || x.text); answers++;
  for (const c of a.cards) { cards++; for (const f of c.facts || []) if (f.sentence) { const k = [c.type, f.source_url, f.page, f.sentence].join('|'); if (!seen.has(k)) seen.set(k, { type: c.type, f }); } }
}
const rows = [...seen.values()].map(({ type, f }) => { const m = citeModel({ quote: f.sentence, url: f.source_url, docType: f.doc_type, version: f.doc_version, page: f.page }); return { type, m, f, rec: byUrl.get(m.baseUrl) || null }; });
const total = rows.length, pdf = rows.filter((r) => r.m.isPdf), paged = rows.filter((r) => r.m.page), pdfPaged = pdf.filter((r) => r.m.page);
const out = { answers, cards, citations: total, withPage: paged.length, rate: paged.length / total, pdfCitations: pdf.length, pdfWithPage: pdfPaged.length, pdfRate: pdf.length ? pdfPaged.length / pdf.length : 0, webCitations: total - pdf.length, pdfInDocuments: pdf.filter((r) => r.rec).length, noUrl: rows.filter((r) => !r.f.source_url).length };
const sentPdf = rows.filter((r) => r.m.hasQuote && r.m.isPdf); out.sentencePdf = sentPdf.length; out.sentencePdfWithPage = sentPdf.filter((r) => r.m.page).length; out.listingCitations = rows.filter((r) => !r.m.hasQuote).length;
out.byDocType = {}; for (const r of rows) { const k = r.f.doc_type || '(none)'; const o = (out.byDocType[k] ||= { n: 0, page: 0 }); o.n++; if (r.m.page) o.page++; }
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
else console.log(`CITE RATE ${paged.length}/${total} = ${(100 * out.rate).toFixed(1)}% of citations carry a page; PDF citations ${pdfPaged.length}/${pdf.length} = ${(100 * out.pdfRate).toFixed(1)}%; statements quoted from a PDF ${out.sentencePdfWithPage}/${out.sentencePdf}; whole-document listings ${out.listingCitations}; web page citations ${out.webCitations}; PDF citations whose URL is a documents.json record ${out.pdfInDocuments}/${pdf.length}; answers ${answers}, cards ${cards}\n  by doc_type ${JSON.stringify(out.byDocType)}`);
