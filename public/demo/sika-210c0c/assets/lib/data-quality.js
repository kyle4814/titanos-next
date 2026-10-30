// Data quality notes for Sika (wave 2 gift pack): #/about/data-quality. Things noticed in Sika's own public data while building the preview, offered
// as help. Every number is read from data/gift/data_quality.json, which build_gift.mjs computes from the repo sources; nothing is typed in here.
// Print: the same page prints as the PDF (all lists open). ?print=1 opens every list for the headless PDF run.
import { h } from './util.js';
import { breadcrumb } from './components.js';

const nf = new Intl.NumberFormat('en-AU');
const ext = (href, label) => h('a', { class: 'link link--ext', href, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
const table = (head, rows, cls = '') => h('div', { class: 'table-wrap' }, h('table', { class: 'table dq-table ' + cls }, h('thead', null, h('tr', null, head.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows)));
const td = (...k) => h('td', null, ...k);
const list = (title, open, ...body) => h('details', { class: 'dq-list', open: open || null }, h('summary', null, title), ...body);
const REASON_ORDER = ['no-image-on-page', 'only-diagrams', 'unknown'];

export function summaryNumbers(d) {
  const c = d.counts;
  return [
    { n: c.noPhoto, label: 'products with no product photo published' },
    { n: c.specIssuePlaces, label: `printed values that may be typing slips (${c.specIssueProducts} products)` },
    { n: c.reported404, label: 'document links that return "not found"' },
    { n: c.noRate, label: 'products with no published consumption rate' },
  ];
}

let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../dq.css', import.meta.url).href; document.head.append(l); }

export async function dataQualityView(ctx) {
  css();
  const r = await fetch(new URL('../../data/gift/data_quality.json', import.meta.url));
  if (!r.ok) throw new Error('data quality notes: HTTP ' + r.status);
  const d = await r.json(); const c = d.counts;
  const openAll = ctx.params.get('print') === '1';
  const pageLink = (id, name) => h('a', { class: 'link', href: '#/product/' + id }, name);

  const photoSections = REASON_ORDER.map((k) => ({ k, items: d.noPhoto.items.filter((x) => x.reason === k) })).filter((s) => s.items.length)
    .map((s) => list(`${nf.format(s.items.length)} products: ${d.noPhoto.reasons[s.k]}`, openAll, h('ul', { class: 'dq-cols' }, s.items.map((x) => h('li', null, pageLink(x.id, x.name), x.group ? h('span', { class: 'dq-sub' }, ' ' + x.group) : null)))));

  const specRows = d.specIssues.map((x) => h('tr', null, td(x.product), td(x.edition), td(x.url ? ext(x.url, x.where) : x.where), td(x.printed), td(x.why)));
  const reportedRows = d.reported404.map((x) => h('tr', null, td(x.pageUrl ? ext(x.pageUrl, x.product) : x.product), td(x.title), td(x.type)));
  const lc = d.linkCheck;
  const rateRows = (why) => d.noRate.filter((x) => x.why === why).map((x) => h('li', null, pageLink(x.id, x.name), x.group ? h('span', { class: 'dq-sub' }, ' ' + x.group) : null));

  const lcBlock = lc.checked ? h('div', null,
    h('p', null, `We also re-checked ${nf.format(lc.checked)} of the ${nf.format(c.documentsTotal)} document links on ${lc.dateAU}, one request every second or so, asking only for the headers (no downloads), and respecting robots.txt. `,
      lc.dead.length === c.reported404 ? `The ${nf.format(lc.dead.length)} that did not open are the same ${nf.format(c.reported404)} listed above. ` : lc.dead.length ? `${nf.format(lc.dead.length)} did not open. ` : 'All of them opened. ', lc.redirected.length ? `${nf.format(lc.redirected.length)} open at a different address from the one the page links to.` : 'None needed a different address.'),
    lc.dead.length && lc.dead.length !== c.reported404 ? list(`${nf.format(lc.dead.length)} links that did not open on the re-check`, true, table(['Document', 'Type', 'Product', 'Result'], lc.dead.map((x) => h('tr', null, td(ext(x.url, x.title)), td(x.type), td(x.products.join(', ')), td(String(x.status)))))) : null,
    lc.redirected.length ? list(`${nf.format(lc.redirected.length)} links that open at a different address`, openAll, table(['Document', 'Type', 'Product', 'Opens at'], lc.redirected.map((x) => h('tr', null, td(ext(x.url, x.title)), td(x.type), td(x.products.join(', ')), td(ext(x.final, x.final.replace(/^https?:\/\//, '').slice(0, 60))))))) : null) : null;

  const el = h('div', { class: 'container dq-page' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'About this demo', href: '#/about' }, { label: 'Data quality notes' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Data quality notes for Sika Australia')),
    h('div', { class: 'prose', style: 'max-width:52rem' },
      h('p', { class: 'lead' }, 'While we built this preview we read your public product pages and data sheets closely. These are the things we noticed that you may want to look at. We are sharing them because they might save your team time, and they cost you nothing.'),
      h('p', null, `Everything here comes from public pages and public PDFs only, read on ${d.readOn}. Nothing behind a login was touched. We show each value as printed and never correct anything ourselves.`),
      h('div', { class: 'btn-row no-print' }, h('a', { class: 'btn', href: 'downloads/sika-data-quality-notes.pdf', download: '' }, 'Download as a PDF'), ' ', h('button', { class: 'btn btn--hollow', type: 'button', onclick: () => window.print() }, 'Print this page')),
      h('ul', { class: 'dq-sum', 'aria-label': 'Summary' }, summaryNumbers(d).map((s) => h('li', null, h('strong', null, nf.format(s.n)), ' ', s.label))),

      h('h2', { class: 'h4' }, `1. Printed values that may be typing slips (${c.specIssuePlaces} places in ${c.specIssueProducts} products)`),
      h('p', null, 'These look like small typing slips on the data sheet. The two humidity limits on Sikafloor-264 and the swapped maximum and minimum on Sika Primer-3 N are the ones we would look at first, because someone on site could act on them.'),
      table(['Product', 'Data sheet edition', 'Where', 'As printed', 'Why it looks odd'], specRows),

      h('h2', { class: 'h4' }, `2. Document links that returned "not found" (${c.reported404})`),
      h('p', null, `Each link sits on one of your product pages and returned HTTP 404 on ${d.readOn}, on every address form we tried. Two of them are data sheets (Davco Powder Mastic and Davco PrimeX).`),
      list(`${c.reported404} links with the product page they sit on`, true, table(['Product page', 'Document', 'Type'], reportedRows)),
      lcBlock,

      h('h2', { class: 'h4' }, `3. Products with no product photo (${c.noPhoto} of ${nf.format(c.products)})`),
      h('p', null, 'In this preview these products show a neutral placeholder. We checked each product page for a packshot and found none. If a photo exists somewhere, linking it from the page would let a customer recognise the tin or pail on site.'),
      photoSections,

      h('h2', { class: 'h4' }, `4. Products with no published consumption rate (${c.noRate})`),
      h('p', null, `${nf.format(c.noRateDatasheet)} products have a data sheet that states no consumption or coverage figure, and ${nf.format(c.noRateNoDatasheet)} have no data sheet linked from the product page at all. Some products, such as accessories, genuinely have no rate, so treat this as a list to glance down. ${c.methodStatement} more point to a method statement instead of a figure.`),
      list(`${nf.format(c.noRateDatasheet)} products where the data sheet states no consumption figure`, openAll, h('ul', { class: 'dq-cols' }, rateRows('datasheet'))),
      list(`${nf.format(c.noRateNoDatasheet)} products with no data sheet linked`, openAll, h('ul', { class: 'dq-cols' }, rateRows('no-datasheet'))),

      h('h2', { class: 'h4' }, 'A note on safety data sheet versions'),
      h('p', null, 'Some products have more than one safety data sheet revision published. For example the Davco Ceramacrete SDS dated 04.03.2025 lists H350 and the one dated 31.10.2025 does not. The preview always quotes the latest revision for the product name and shows its revision date and version on every safety answer.'),
      h('p', { class: 'dq-sub' }, 'Prepared by TITANOS. Public pages and public PDFs only. Demo only, not an official Sika Australia page.'),
      h('p', { class: 'no-print' }, h('a', { class: 'btn', href: '#/about' }, 'Back to About this demo'))));
  // print: open every list for the paper copy, then put them back
  const toggle = (on) => el.querySelectorAll('details.dq-list').forEach((x) => { if (on) { x.dataset.was = x.open ? '1' : '0'; x.open = true; } else if (x.dataset.was === '0') x.open = false; });
  window.addEventListener('beforeprint', () => toggle(true)); window.addEventListener('afterprint', () => toggle(false));
  return { el, title: 'Data quality notes', nav: null };
}
