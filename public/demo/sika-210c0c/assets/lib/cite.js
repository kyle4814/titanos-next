// cite.js: "Show the source". Every citation on an answer card becomes a button that opens a quote panel: the cited sentence exactly as the
// data holds it (highlighted), the document title and type, and a link to the original on aus.sika.com in a new tab. When the data records the
// page, a PDF link carries #page=N so the viewer opens there; with no page the link opens the document and the panel says the page is not recorded.
// citeModel is pure (tests import it); sourceControl builds the DOM. No network, no model.
import { h } from './util.js';

const TYPE = { PDS: 'Product data sheet', SDS: 'Safety data sheet', WEB: 'Published page', RULE: 'Corrected rule', product_data_sheet: 'Product data sheet', safety_data_sheet: 'Safety data sheet', brochure: 'Brochure', system_data_sheet: 'System data sheet', environmental_product_declaration: 'Environmental product declaration', certificate: 'Certificate' };
// a document card's "sentence" is the document's listing line ("Product Data Sheet (PDS): <title>"): the whole document is the citation, there is no sentence inside it to show
const isListing = (t) => /^[a-z]+(_[a-z]+)+$/.test(t);
const isPdfUrl = (u) => /\.pdf(?:$|[?#])/i.test(u) || /\/dms\/getdocument\.get\//i.test(u);
const pageOf = (v) => { const n = typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : v; return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null; };

/**
 * citeModel({ quote, url, docType, version, page, title, productName }) -> { quote, baseUrl, href, page, isPdf, type, typeLabel, version, title, hasQuote }
 * baseUrl = the document's own URL (what the document record holds); href = baseUrl plus #page=N, only for a PDF with a recorded page.
 */
export function citeModel({ quote = '', url = '', docType = '', version = '', page = null, title = '', productName = '' } = {}) {
  let baseUrl = String(url || ''), pageFromUrl = null;
  const m = /#page=(\d{1,4})$/.exec(baseUrl); if (m) { pageFromUrl = Number(m[1]); baseUrl = baseUrl.slice(0, m.index); }
  const isPdf = docType === 'PDS' || docType === 'SDS' || isPdfUrl(baseUrl);
  const pg = isPdf ? (pageOf(page) || pageFromUrl) : null;
  const typeLabel = (docType !== 'WEB' && TYPE[docType]) || (isPdf ? 'Document' : 'Published page');
  let q = String(quote == null ? '' : quote).replace(/\s+/g, ' ').trim();
  if (isListing(docType)) { if (!title) title = q.replace(/^[^:]+:\s*/, ''); q = ''; }
  return { quote: q, hasQuote: q.length > 0, baseUrl, href: baseUrl ? baseUrl + (pg ? '#page=' + pg : '') : '', page: pg, isPdf, type: docType || '', typeLabel, version: version || '', title: title || (productName ? typeLabel + ' for ' + productName : typeLabel) };
}

let seq = 0, cssDone = false;
function css() { if (cssDone || typeof document === 'undefined') return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../cite.css', import.meta.url).href; document.head.append(l); }
/**
 * sourceControl(model, { lazyTitle }) -> [button, panel]. The panel is hidden until the button is pressed. lazyTitle() may resolve to the
 * document's own title (read from data already in the page); until then, and when it resolves to nothing, the model's title is shown.
 */
export function sourceControl(model, { lazyTitle } = {}) {
  css();
  const id = 'src-' + (++seq);
  const titleEl = h('strong', { class: 'src-title' }, model.title);
  const meta = [model.typeLabel, model.version, model.page ? 'page ' + model.page : ''].filter(Boolean).join(', ');
  const link = model.href && /^https?:/.test(model.href)
    ? h('a', { class: 'link src-open', href: model.href, target: '_blank', rel: 'noopener noreferrer' }, model.isPdf ? (model.page ? `Open the original PDF at page ${model.page}` : 'Open the original PDF') : 'Open the original page', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'))
    : null;
  const panel = h('div', { class: 'src-panel', id, role: 'region', 'aria-label': 'The source of this statement', hidden: true },
    h('p', { class: 'src-doc' }, titleEl, ' ', h('span', { class: 'src-type' }, meta)),
    model.hasQuote
      ? h('blockquote', { class: 'src-quote' }, h('mark', null, model.quote))
      : h('p', { class: 'src-none' }, 'This links to the whole document, so there is no single sentence to show.'),
    model.isPdf && !model.page ? h('p', { class: 'src-note' }, 'The page is not recorded for this sentence, so the link opens the document at the start.') : null,
    link);
  const btn = h('button', { class: 'src-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, 'Show the source');
  let titled = false;
  const set = (open) => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Hide the source' : 'Show the source'; };
  btn.addEventListener('click', async () => {
    set(panel.hidden);
    if (!panel.hidden && !titled && lazyTitle) { titled = true; try { const t = await lazyTitle(); if (t) titleEl.textContent = t; } catch { /* the model title stays */ } }
  });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); set(false); btn.focus(); } }); // Escape closes this panel only, not the chat around it
  return [btn, panel];
}

/** The button's first press (brain-ui.js cite()): builds the source control for one fact of a card and swaps it in. fetchJson is the page's memoised shard fetch. */
export function openSource(slot, c, f, fetchJson) {
  // the document's own title, read from the product shard the answer was built from (already in the page memo, so no new request); null when it is not there
  const docTitle = async () => {
    const sh = c.product && c.product.id && await fetchJson('data/brain/p/' + encodeURIComponent(c.product.id) + '.json'); if (!sh) return null;
    const base = String(f.source_url || '').replace(/#page=\d+$/, ''), d = (sh.dc || []).find((x) => x.u === base);
    if (d && d.t) return d.t;
    return sh.sp && sh.sp.ds && sh.sp.ds.url === base && sh.sp.ds.title ? sh.sp.ds.title : null;
  };
  const [btn, panel] = sourceControl(citeModel({ quote: f.sentence, url: f.source_url, docType: f.doc_type, version: f.doc_version, page: f.page, productName: c.product ? c.product.name : '' }), { lazyTitle: docTitle });
  slot.replaceChildren(btn, panel); btn.click(); btn.focus();
}
