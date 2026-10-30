// answer.js: shared helpers for building Answer objects (sanitising, citations, document selection, reasons).
import { normalise, sentences } from './tokenize.js';

/** Plain-text sanitiser: no em or en dashes, no registered marks, no emoji; URLs untouched. */
export function plain(s) {
  if (typeof s !== 'string') return s;
  if (/^https?:\/\//.test(s)) return s;
  return s.replace(/[®™]/g, '').replace(/\s*[\u2014]\s*/g, ' - ').replace(/[\u2013\u2212]/g, '-').replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, '').replace(/[ \t]{2,}/g, ' ');
}

/** Deep-sanitise every string in an Answer (urls left alone). */
export function sanitise(o) {
  if (typeof o === 'string') return plain(o);
  if (Array.isArray(o)) return o.map(sanitise);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = (k === 'url' ? o[k] : sanitise(o[k])); return r; }
  return o;
}

export const shortName = (p) => plain(p.name);

/** Is a document safe to offer as a link? (a checked status other than 200 is never offered) */
export const docOk = (d) => !d.http || d.http.status === 200 || d.http.status === undefined;

export const DOC_ORDER = ['product_data_sheet', 'safety_data_sheet', 'MSDS', 'system_data_sheet', 'additional_technical_information', 'brochure', 'leaflet', 'guide', 'certificate', 'environmental_product_declaration', 'colour_chart', 'reference', 'document', ''];

/** Short label for a document. */
export function docLabel(d) {
  const t = plain(d.typeLabel || (d.type ? d.type.replace(/_/g, ' ') : 'Document'));
  const title = plain(d.title || d.file || '');
  return `${t}: ${title}${d.version ? ' (' + d.version + ')' : ''}${d.format && d.format !== 'PDF' ? ' [' + d.format + ']' : ''}`.trim();
}

/** Trim a quoted line to a readable length. */
export function clip(s, n = 230) { s = plain(String(s || '')).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s; }

/** Best line from a product's own text for a query (token overlap), skipping exclusion lines; returns {text, label} or null. */
export function bestLine(product, qStems, facetIds, tokenize, preferFacets = true) {
  const src = [].concat((product.usage || []).map(t => ['usage', t]), (product.attributes || []).map(t => ['attribute', t]), (product.advantages || []).map(t => ['advantage', t]), [['summary', product.summary || '']], [['tagline', product.tagline || '']]);
  let best = null, bs = 0;
  for (const [kind, block] of src) for (const sent of sentences(block)) {
    if (!sent || /not suitable|unsuitable|not recommended|do not use/i.test(sent)) continue;
    const st = new Set(tokenize(sent)); let s = 0;
    for (const [t, w] of qStems) if (st.has(t)) s += w;
    if (preferFacets && facetIds && facetIds.size) { const f = normalise(sent); for (const id of facetIds) if (f.includes(id.replace(/-/g, ' '))) s += 0.5; }
    s += kind === 'usage' ? 0.15 : 0;
    if (sent.length < 28) s *= 0.3;
    if (s > bs) { bs = s; best = { text: sent, kind }; }
  }
  return best;
}
