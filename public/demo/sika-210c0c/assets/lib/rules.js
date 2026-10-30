// Rule ledger view (T14), route #/rules. Every rule the advisor works from, one row each, with the verbatim source sentence, the page it came
// from, and blank signed columns for Sika to fill. Filter by product and type, download the filtered rows as CSV. Nothing is sent anywhere.
import { h, icon, nf, norm } from './util.js';
import { data } from './data.js';
import { breadcrumb } from './components.js';
import { plain } from '../assistant/answer.js';
import { toCsv } from './csv.js';

const PAGE = 100;

async function loadRules() {
  const m = await data.manifest();
  if (!m.files.includes('rules.json')) return null;
  const r = await fetch(new URL('../../data/rules.json', import.meta.url)).catch(() => null);
  return r && r.ok ? r.json() : null;
}

export async function rulesView(ctx) {
  const head = [breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Rule ledger' }]), h('div', { class: 'page-head' }, h('h1', null, 'Rule ledger'))];
  const L = await loadRules();
  if (!L || !Array.isArray(L.rules)) return { el: h('div', { class: 'container' }, ...head, h('p', null, 'The rule ledger is not available in this demo.')), title: 'Rule ledger', nav: null };
  const rules = L.rules;
  const products = [...new Map(rules.filter((r) => r.product_id).map((r) => [r.product_id, r.product])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const types = [...new Set(rules.map((r) => r.type))].sort();
  const pSel = h('select', { class: 'input', id: 'rl-product', 'aria-label': 'Filter by product' }, h('option', { value: '' }, 'All products'), products.map(([id, n]) => h('option', { value: id }, plain(n))));
  const tSel = h('select', { class: 'input', id: 'rl-type', 'aria-label': 'Filter by rule type' }, h('option', { value: '' }, 'All types'), types.map((t) => h('option', { value: t }, t)));
  const count = h('p', { id: 'rl-count', role: 'status', 'aria-live': 'polite' });
  const tbody = h('tbody', { id: 'rl-body' });
  const more = h('button', { class: 'btn btn--text', type: 'button', id: 'rl-more' }, 'Show more');
  const dl = h('button', { class: 'btn', type: 'button', id: 'rl-download' }, icon('file', 'i--sm'), ' Download CSV for Technical Services');
  let filtered = [], shown = 0;
  const rowEl = (r) => h('tr', { 'data-rule': r.id },
    h('td', null, r.product ? h('a', { href: '#/product/' + encodeURIComponent(r.product_id) }, plain(r.product)) : 'Rep correction'),
    h('td', null, r.type), h('td', null, plain(r.rule)), h('td', null, h('q', null, plain(r.quote))),
    h('td', null, r.source_url ? h('a', { class: 'link', href: r.source_url, target: '_blank', rel: 'noopener noreferrer' }, 'Page', r.source_page ? ' ' + r.source_page : '', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')) : '', ' ', h('span', { class: 'count' }, r.read_date || '')),
    h('td', null, r.status === 'PUBLISHED' ? 'Published' : r.status));
  const draw = () => {
    tbody.replaceChildren(...filtered.slice(0, shown).map(rowEl));
    count.textContent = `${nf.format(filtered.length)} rule${filtered.length === 1 ? '' : 's'}${filtered.length > shown ? `, showing ${nf.format(shown)}` : ''}`;
    more.hidden = filtered.length <= shown;
  };
  const apply = () => { const p = pSel.value, t = tSel.value; filtered = rules.filter((r) => (!p || r.product_id === p) && (!t || r.type === t)); shown = Math.min(PAGE, filtered.length); draw(); };
  pSel.addEventListener('change', apply); tSel.addEventListener('change', apply);
  more.addEventListener('click', () => { shown = Math.min(filtered.length, shown + PAGE); draw(); });
  dl.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: 'sika-demo-rules.csv' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const el = h('div', { class: 'container' }, ...head,
    h('div', { class: 'prose', style: 'max-width:60rem' },
      h('p', { class: 'lead' }, 'Every rule the advisor works from, each with the sentence it was taken from and the page it was read on.'),
      h('div', { class: 'notice' }, icon('info'), h('span', null, 'PUBLISHED means taken from a published Sika page. It does not mean Sika has approved the rule. The signed by, signed on and comment columns in the download are blank for Sika to fill.'))),
    h('div', { class: 'filters', style: 'display:grid;gap:.5rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));margin:1rem 0' }, pSel, tSel),
    count,
    h('div', { class: 'table-wrap' }, h('table', { class: 'table', id: 'rl-table' }, h('thead', null, h('tr', null, ['Product', 'Type', 'Rule', 'Source sentence', 'Source', 'Status'].map((x) => h('th', { scope: 'col' }, x)))), tbody)),
    h('div', { class: 'opts' }, more, dl, h('a', { class: 'btn btn--text', href: 'data/rules.csv', download: '' }, 'Whole ledger (CSV)')));
  apply();
  return { el, title: 'Rule ledger', nav: null };
}
