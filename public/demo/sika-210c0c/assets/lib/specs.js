// Specification tab: draft specification text per product, assembled from the published product data sheet (specs lane output).
// Every data sheet clause shows its page. Shown as "From a published data sheet", never as approved or signed.
import { h, icon, nf } from './util.js';
import { data } from './data.js';

const plain = (s) => String(s || '').replace(/[–—]/g, '-');
export function specText(spec, product, cfg) {
  const L = [];
  L.push('DRAFT SPECIFICATION FROM A PUBLISHED DATA SHEET. Check against the current data sheet before use.');
  L.push(`Product: ${plain(product.name)}`);
  if (spec.ds && spec.ds.edition) L.push(`Data sheet edition: ${plain(spec.ds.edition)}${spec.ds.pages ? ', ' + spec.ds.pages + ' pages' : ''}`);
  if (spec.ds && spec.ds.url) L.push(`Data sheet: ${spec.ds.url}`);
  L.push(`Product page: ${product.url}`); L.push('');
  for (const s of spec.sections) {
    L.push(`${s.n} ${plain(s.h)}`);
    for (const c of s.cl) {
      L.push(`${c.no} ${plain(c.t)}${c.x ? '. ' + plain(c.x) : ''}`);
      if (c.l) L.push('    ' + plain(c.l));
      for (const x of c.s || []) L.push('    - ' + plain(x));
      for (const x of c.tr || []) L.push('    ' + plain(x));
      for (const [a, b, m] of c.r || []) L.push(`    - ${plain(a)}: ${plain(b)}${m ? ' (' + plain(m) + ')' : ''}`);
      for (const row of c.tb || []) L.push('    ' + row.map(plain).join(' | '));
      if (c.tn) L.push('    ' + plain(c.tn));
      for (const x of c.n || []) L.push('    ' + plain(x));
      if (c.c) L.push(`    [${plain(c.c)}]`);
    }
    L.push('');
  }
  L.push(`From ${cfg.company.publishedDocsPhrase}.`);
  return L.join('\n');
}

function download(name, text) {
  try { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { /* ignore */ }
}

/** Returns a node that fills itself when the spec file has loaded. */
export function specPanel(product, cfg) {
  const host = h('div', { class: 'spec', 'aria-live': 'polite' }, h('div', { class: 'skeleton', style: 'min-height:160px' }));
  data.spec(product.id).then((spec) => {
    const total = spec.sections.reduce((n, s) => n + s.cl.length, 0);
    const pageLink = (c) => (spec.ds && spec.ds.url && c.p ? spec.ds.url + '#page=' + c.p : null);
    host.replaceChildren(
      h('div', { class: 'notice' }, icon('info'), h('span', null, h('strong', null, 'From a published data sheet. '), `Draft specification text assembled from the data sheet${spec.ds && spec.ds.edition ? ' (' + plain(spec.ds.edition) + ')' : ''}. Each data sheet clause shows its page. Check against the current data sheet before use.`)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: (e) => { const t = specText(spec, product, cfg); const b = e.currentTarget; (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.replaceChildren(icon('file', 'i--sm'), 'Copy specification text'); }, 1800); }).catch(() => { download(`${product.id}-draft-specification.txt`, t); }); } }, icon('file', 'i--sm'), 'Copy specification text'),
        h('button', { class: 'btn btn--hollow', type: 'button', onclick: () => download(`${product.id}-draft-specification.txt`, specText(spec, product, cfg)) }, icon('download', 'i--sm'), 'Download as .txt'),
        spec.ds && spec.ds.url ? h('a', { class: 'btn btn--text', href: spec.ds.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the data sheet (PDF)') : null),
      h('p', { class: 'count' }, `${nf.format(total)} clauses, ${spec.verification && spec.verification.verified === spec.verification.clauses ? 'each checked against the data sheet text' : 'checked against the data sheet text'}.`),
      ...spec.sections.map((s) => h('section', { class: 'spec-sec' }, h('h3', null, h('span', { class: 'no' }, s.n), plain(s.h)),
        h('ol', { class: 'spec-clauses' }, s.cl.map((c) => h('li', { class: 'spec-' + c.k },
          h('span', { class: 'no' }, c.no),
          h('div', null, h('strong', null, plain(c.t)), c.x ? h('p', null, plain(c.x)) : null, c.l ? h('p', null, plain(c.l)) : null,
            c.s && c.s.length ? h('ul', { class: 'spec-list' }, c.s.map((x) => h('li', null, plain(x)))) : null,
            ...(c.tr || []).map((x) => h('p', null, plain(x))),
            c.r && c.r.length ? h('dl', { class: 'spec-rows' }, c.r.map(([a, b, m]) => [h('dt', null, plain(a)), h('dd', null, plain(b), m ? h('small', null, ' (' + plain(m) + ')') : null)])) : null,
            c.tb && c.tb.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', null, c.tb.map((row) => h('tr', null, row.map((cell) => h('td', null, plain(cell)))))))) : null,
            c.tn ? h('p', { class: 'cite' }, plain(c.tn)) : null, ...(c.n || []).map((x) => h('p', { class: 'cite' }, plain(x))),
            c.c ? h('p', { class: 'cite' }, pageLink(c) ? h('a', { class: 'link link--ext', href: pageLink(c), target: '_blank', rel: 'noopener noreferrer' }, plain(c.c)) : plain(c.c)) : null)))))));
  }).catch(() => host.replaceChildren(h('p', null, 'The specification text could not be loaded.')));
  return host;
}
