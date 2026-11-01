// Actions v2, the sales engine's screens: the extras on a quote card in the advisor panel (step counter, the one-page sheet, print, copy, the email link),
// and the "Request a quote" section of the My projects page (the requests log, the anonymous export). Loaded on demand. Demo only; nothing is sent from here.
import { h, icon, announce } from '../lib/util.js';
import { ESTIMATE_LINE } from './core.js';
import * as Q from './quote.js';

let cssDone = false;
export function quoteCss() { if (cssDone || typeof document === 'undefined') return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../quote.css', import.meta.url).href; document.head.append(l); }
const extLink = (href, label, cls = 'link') => h('a', { href, class: cls, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));

/** The one-page Quote Request. Logo-free, the Sika look (tokens only), the estimate sentence, every quantity beside its coverage line, the documents with their links. */
export function sheetNode(m) {
  const kv = (rows) => h('dl', { class: 'qr-kv' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
  return h('div', { class: `qr-sheet qr-d-${m.density}`, 'data-ref': m.ref },
    h('div', { class: 'qr-head' }, h('h1', { class: 'qr-title' }, m.title), h('p', { class: 'qr-meta' }, h('strong', null, m.ref), ` | ${m.project} | prepared ${m.prepared}`)),
    h('p', { class: 'qr-banner' }, m.banner),
    h('h2', { class: 'qr-h' }, 'Products and quantities'),
    h('table', { class: 'qr-table' }, h('thead', null, h('tr', null, ['Product', 'Quantity', 'Published coverage line'].map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', null, m.lines.map((l) => h('tr', null, h('th', { scope: 'row' }, l.name), h('td', null, l.qty, l.need ? h('div', { class: 'qr-sub' }, 'Need ' + l.need) : null, l.basis ? h('div', { class: 'qr-sub' }, l.basis) : null),
        h('td', null, l.cite ? [h('q', null, l.cite.text), l.cite.url ? h('div', { class: 'qr-url' }, l.cite.url) : null] : h('span', { class: 'qr-sub' }, 'No published line used: set by the sender')))))),
    h('div', { class: 'qr-two' }, h('div', null, h('h2', { class: 'qr-h' }, 'The job'), kv(m.job)), h('div', null, h('h2', { class: 'qr-h' }, 'Contact'), kv(m.contact))),
    m.calcs && m.calcs.length ? [h('h2', { class: 'qr-h' }, 'Calculations behind the quantities'), h('ul', { class: 'qr-docs' }, m.calcs.map((k) => h('li', null, `${k.title}: ${k.answer}`, k.formula ? h('div', { class: 'qr-sub' }, 'Working: ' + k.formula) : null, k.source ? h('div', { class: 'qr-sub' }, 'Source: ' + k.source) : null)))] : null,
    m.notes ? [h('h2', { class: 'qr-h' }, 'Notes'), h('p', { class: 'qr-notes' }, m.notes)] : null,
    m.docs.length ? [h('h2', { class: 'qr-h' }, 'Data sheets and safety data sheets'), h('ul', { class: 'qr-docs' }, m.docs.map((d) => h('li', null, `${d.product} | ${d.kind}: `, h('span', { class: 'qr-url' }, d.url)))), m.docsMore > 0 ? h('p', { class: 'qr-sub' }, `and ${m.docsMore} more links in the copied request text`) : null] : (m.docsMore > 0 ? h('p', { class: 'qr-sub' }, `${m.docsMore} data sheet and safety data sheet links are in the copied request text`) : null),
    h('p', { class: 'qr-est' }, m.estimate),
    h('p', { class: 'qr-foot' }, "Built from Sika Australia's public data sheets. Not an official Sika document. Quantities only: no prices were requested or shown. Technical Services decides suitability."));
}

/** Print only the sheet: a temporary block the print stylesheet shows alone (same approach as the advisor's card print). */
export function printSheet(model) {
  quoteCss();
  const old = document.getElementById('qr-print'); if (old) old.remove();
  const box = h('div', { id: 'qr-print' }, sheetNode(model));
  document.body.append(box); document.body.classList.add('printing-quote');
  const done = () => { document.body.classList.remove('printing-quote'); box.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (document.getElementById('qr-print') && !window.__sikaKeepPrint) done(); }, 4000);
}

async function copyText(text, area) {
  area.value = text; area.hidden = false; area.select();
  try { await navigator.clipboard.writeText(text); announce('Request copied'); } catch { try { document.execCommand('copy'); } catch { /* the text is shown to copy by hand */ } }
}

/** Called by the advisor's card renderer for every card that carries a quoteView. `root` already holds the title, notes, rows and the notice. */
export function quoteExtras(root, c) {
  quoteCss();
  const v = c.quoteView || {}; root.classList.add('quote-card');
  if (v.type === 'step') { const t = root.querySelector('.m-title'); if (t) t.after(h('p', { class: 'qr-step' }, c.stepNo || '')); }
  if (v.type === 'done') {
    const m = v.mail || {}; const acts = [];
    acts.push(h('button', { class: 'chip qr-print', type: 'button', onclick: () => printSheet(v.sheet) }, icon('file', 'i--sm'), 'Download (print to PDF)'));
    const area = root.querySelector('textarea');
    acts.push(h('button', { class: 'chip qr-copy', type: 'button', onclick: () => copyText(c.copyText, area || h('textarea')) }, 'Copy the request'));
    if (m.kind === 'mailto' && !v.stale) acts.push(h('a', { class: 'chip qr-mail', href: m.href }, 'Email it to Sika', h('span', { class: 'visually-hidden' }, ' (opens your email program, addressed to ' + m.to + ')')));
    else if (m.kind === 'form' && !v.stale) acts.push(extLink(m.url, 'Open the Sika contact form', 'chip qr-form'));
    const box = h('div', { class: 'opts qr-actions', role: 'group', 'aria-label': 'Your quote request' }, acts);
    const hint = m.kind === 'mailto' ? h('p', { class: 'cite qr-route' }, `The email link opens your own email program with the request written out, addressed to ${m.to} (${m.label}). ${m.note || ''} You press send yourself; nothing is sent from this page.${m.truncated ? ' The request was long, so the email holds the short form: use Copy the request for the full text.' : ''}`) : h('p', { class: 'cite qr-route' }, m.reason || '');
    const prev = h('details', { class: 'qr-preview' }, h('summary', null, 'Preview the one-page request'), sheetNode(v.sheet));
    const anchor = root.querySelector('textarea'); (anchor || root.lastElementChild).before(prev); prev.before(box, hint);
  }
  if (v.type === 'stockist') { const box = h('div', { class: 'opts' }, (v.links || []).map((l) => extLink(l.url, l.label, 'chip'))); root.append(box); }
  if (v.type === 'log' && v.signal) root.append(h('div', { class: 'opts' }, h('button', { class: 'chip', type: 'button', onclick: () => saveJson(v.signal) }, icon('download', 'i--sm'), 'Download the anonymous demand signal (JSON)')));
}

function saveJson(sig) {
  try { const url = URL.createObjectURL(new Blob([JSON.stringify(sig, null, 1)], { type: 'application/json' })); const a = h('a', { href: url, download: 'sika-demo-quote-demand-signal.json' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); announce('Demand signal downloaded'); } catch { /* ignore */ }
}

/** The "Request a quote" section of the My projects page. store = the portal's project store; ctx.openAssistant opens the advisor on the intake. */
export function quotesPanel(ctx, store, estimateText, onChange) {
  quoteCss();
  const wrap = h('section', { class: 'section qr-section', 'aria-labelledby': 'quote-h', id: 'quote-section' });
  const render = () => {
    const quotes = store.quotes(); const items = store.items();
    const go = h('button', { class: 'btn', type: 'button', id: 'quote-open', onclick: (e) => { const off = (() => { try { return /[?&]actions=off/.test(location.href) || localStorage.getItem('sika-demo-210c0c-actions') === 'off' || navigator.onLine === false; } catch { return false; } })(); if (off) { note.textContent = 'The quote request runs in the advisor, which is switched off in this view (or you are offline). Open the advisor with actions on and try again.'; return; } ctx.openAssistant('/quote', e.currentTarget); } }, icon('chat', 'i--sm'), 'Request a quote');
    const note = h('p', { class: 'cite', role: 'status', 'aria-live': 'polite' });
    const head = [h('h2', { id: 'quote-h', class: 'h3' }, 'Request a quote'),
      h('p', { class: 'lead', style: 'max-width:50rem' }, items.length ? 'The advisor asks a few short questions, one at a time, then prepares a one-page quote request from the products and quantities above. You can print it, copy it, or open an email to Sika that you send yourself.' : 'Add products above first. Then the advisor can prepare a quote request from them in a few short questions.'),
      h('p', { class: 'notice' }, icon('info'), h('span', null, h('span', { class: 'demo-only' }, 'Demo only'), ' ', Q.DEMO_BANNER, ' Quantities only: no prices are shown and nothing is ordered.')),
      h('p', { class: 'estimate-note' }, estimateText), h('div', { class: 'btn-row' }, go), note];
    const logNodes = [];
    if (quotes.length) {
      logNodes.push(h('h3', { class: 'h4', id: 'quote-log-h' }, 'My quote requests'),
        h('p', { class: 'count' }, 'Kept in this browser with this project; clearing the project clears them. The list and the export below hold no names or contact details.'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table', id: 'quote-log', 'aria-labelledby': 'quote-log-h' }, h('thead', null, h('tr', null, ['Reference', 'Date', 'Products', 'Postcode', 'Status', 'Open'].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', null, quotes.map((q) => { const stale = Q.isStale(q, items); return h('tr', { 'data-ref': q.ref }, h('th', { scope: 'row' }, q.ref), h('td', null, (q.created || '').slice(0, 10)), h('td', null, q.lines.map((l) => `${l.name} (${l.qty})`).join('; ')), h('td', null, q.site.postcode || 'Not given'), h('td', null, stale ? 'Out of date (the project changed)' : 'Prepared in this demo, not sent'),
            h('td', null, h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Print ${q.ref}`, onclick: () => printSheet(Q.sheetModel(q)) }, 'Print'), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Show ${q.ref} in the advisor`, onclick: (e) => ctx.openAssistant('/quote show ' + q.ref, e.currentTarget) }, 'Show'))); })))),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--hollow', type: 'button', id: 'quote-export', onclick: () => saveJson(Q.demandSignal(store.quotes())) }, icon('download', 'i--sm'), 'Download the anonymous demand signal (JSON)')));
    }
    wrap.replaceChildren(...head, ...logNodes);
  };
  render();
  const off = onChange ? onChange(() => { if (!wrap.isConnected) { off(); return; } render(); }) : null;
  return wrap;
}
export { ESTIMATE_LINE };
