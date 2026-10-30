// T13: "Add to project" with the worked quantity, and the bill of materials on the projects page (table, print, CSV).
import { h, icon, announce } from '../util.js';
import { projects } from '../projects.js';
import { fmtQty, fmt, packText, ESTIMATE_LINE, NO_RATE_TEXT } from './calc.js';
import { chipFor } from './model.js';

const plain = (s) => String(s || '').replace(/[–—]/g, '-');

/** Store a worked quantity on the project item (one item per product; the latest calculation replaces the last). */
export function addCalcToProject(p, snap) {
  if (!projects.has(p.id)) projects.add(p.id, { name: p.name, from: 'finder' });
  const first = snap.packs && snap.packs[0];
  projects.set(p.id, { qty: first ? first.count : 1, unit: 'pack', calc: snap });
  announce(`${p.name} added to my projects with its quantity`);
}

/** Rows for the bill of materials, in display order: [product, quantity, packs, basis, source, status]. Table and CSV are built from the same rows. */
export function bomRows(list, byId) {
  return list.map((it) => {
    const p = byId.get(it.id); const name = p ? p.n : it.id;
    const c = it.calc;
    if (!c && (it.need || it.packs)) return [plain(name), it.need || 'Quantity from the advisor', it.packs || it.qty + ' x ' + (it.unit || 'pack'), (it.basis ? it.basis + '. ' : '') + 'Worked out by the advisor from the published rate.', it.url || '', chipFor(it.url)];
    if (!c) return [plain(name), 'No quantity worked out', it.qty + ' x ' + (it.unit || 'pack'), 'Entered by hand', '', ''];
    const qty = c.low === c.high ? fmtQty(c.low, c.unit) : fmtQty(c.low, c.unit) + ' to ' + fmtQty(c.high, c.unit);
    const packs = (c.packs || []).map(packText).join('; ') || (c.packNote || 'No pack size in the same unit');
    const basis = (c.area ? `${fmt(c.area)} m2` : c.length ? `${fmt(c.length)} m` : c.volume ? `${fmt(c.volume)} m3` : '') + (c.thickness ? `, ${fmt(c.thickness)} mm` : '') + (c.allowancePct ? `, allowance ${fmt(c.allowancePct)}%` : ', no allowance') + '. ' + plain(c.basis || '');
    return [plain(name), qty, packs, basis.trim(), c.sourceUrl || '', chipFor(c.sourceUrl)];
  });
}
const HEAD = ['Product', 'Quantity', 'Packs, rounded up', 'Basis', 'Source', 'Status'];
export const csvText = (rows) => {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  return [HEAD, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n' + q(ESTIMATE_LINE) + '\r\n';
};

export function bomSection(list, dv) {
  const rows = bomRows(list, dv.byId);
  const table = h('table', { class: 'table bom-table', id: 'bom-table' }, h('caption', { class: 'visually-hidden' }, 'Bill of materials'),
    h('thead', null, h('tr', null, HEAD.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', null, i === 4 && c ? h('a', { class: 'link', href: c, target: '_blank', rel: 'noopener noreferrer' }, 'source') : c))))));
  const csv = h('button', { class: 'btn btn--hollow', type: 'button', id: 'bom-csv', onclick: () => {
    const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: 'bill-of-materials.csv' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    announce('Bill of materials downloaded as CSV');
  } }, icon('download', 'i--sm'), 'Download CSV');
  const print = h('button', { class: 'btn', type: 'button', id: 'bom-print', onclick: () => window.print() }, icon('file', 'i--sm'), 'Print or save as PDF');
  return h('section', { class: 'section bom', id: 'bom', 'aria-labelledby': 'bom-h' },
    h('h2', { id: 'bom-h' }, 'Bill of materials'),
    h('p', { class: 'lead', style: 'max-width:50rem' }, 'Quantities worked out from the published consumption figures, with whole packs rounded up. Each row shows its basis and source.'),
    h('div', { class: 'table-wrap' }, table),
    h('p', { class: 'estimate-line' }, ESTIMATE_LINE),
    h('div', { class: 'btn-row no-print' }, print, csv, h('a', { class: 'btn btn--text', href: '#/system' }, 'Find a system and make a sheet')));
}
