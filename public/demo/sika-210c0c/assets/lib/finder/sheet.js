// T10: the keepable system sheet. One printable page, its own URL (#/sheet?...), rebuilt from the link alone.
import { h, icon, hashHref, announce, debounce } from '../util.js';
import { breadcrumb } from '../components.js';
import { systems } from './load.js';
import { sheetModel, parseParams, toParams, chipFor } from './model.js';
import { fmtQty, fmt, packText, ESTIMATE_LINE, DEMO_LINE, NO_RATE_TEXT } from './calc.js';

const plain = (s) => String(s || '').replace(/[–—]/g, '-');
const clip = (s, n = 150) => { const t = plain(s); return t.length > n ? t.slice(0, n - 3).trimEnd() + '...' : t; };
const READ = '2026-10-30';

function qtyCell(row, job) {
  const c = row.calc;
  if (!c) return h('span', null, '');
  if (!c.ok) {
    return h('div', null, h('strong', null, c.need ? 'Needs ' + (c.need === 'length' ? 'a joint length' : c.need === 'area' ? 'an area' : c.need) : NO_RATE_TEXT),
      c.need ? null : h('div', { class: 'sheet-small' }, c.reason && c.reason !== NO_RATE_TEXT ? c.reason : 'The published pages for this product give no usable consumption figure.'));
  }
  const q = c.low === c.high ? fmtQty(c.low, c.unit) : fmtQty(c.low, c.unit) + ' to ' + fmtQty(c.high, c.unit);
  const opts = c.packs && c.packs.options || [];
  return h('div', null,
    h('strong', null, q),
    c.allowancePct ? h('div', { class: 'sheet-small' }, 'includes an allowance of ' + fmt(c.allowancePct) + '%') : null,
    opts.length ? h('div', { class: 'sheet-packs' }, 'Packs, rounded up' + (c.range ? ' (to cover the higher figure)' : '') + ': ', opts.map((o, i) => [i ? '; ' : '', packText(o)])) : null,
    c.packs && c.packs.note ? h('div', { class: 'sheet-small' }, c.packs.note) : null,
    row.rate ? h('div', { class: 'sheet-small' }, 'Basis: ', h('q', null, clip(row.rate.text)), ' ', h('a', { class: 'link', href: row.rate.url, target: '_blank', rel: 'noopener noreferrer' }, 'source'), ' ', h('span', { class: 'chip-status' }, chipFor(row.rate.url))) : null);
}

export function sheetBody(m) {
  const area = m.job.area;
  const head = h('header', { class: 'sheet-head' },
    h('p', { class: 'sheet-kicker' }, 'Tiling system sheet (demo)'),
    h('h1', null, m.title || (m.tileLabel + ' on ' + m.subLabel + ': ' + m.locLabel)),
    h('p', { class: 'sheet-meta' }, m.locLabel + '. ', area ? `Area ${fmt(area)} m2` + (m.job.allowancePct ? `, allowance ${fmt(m.job.allowancePct)}%.` : ', no allowance added.') : 'No area entered, so no quantities are shown.'),
    h('p', { class: 'sheet-demo' }, DEMO_LINE));
  const rows = m.rows.map((r, i) => {
    if (r.empty) return h('tr', null, h('td', { class: 'n' }, String(i + 1)), h('td', null, h('strong', null, r.label)), h('td', { colspan: '3' }, r.text + (r.note ? ' ' + plain(r.note) : '')));
    const p = r.product;
    return h('tr', null,
      h('td', { class: 'n' }, String(i + 1)),
      h('td', null, h('strong', null, r.label), h('div', null, h('a', { class: 'link', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, plain(p.name))),
        r.others.length ? h('div', { class: 'sheet-small' }, 'Other published options: ' + r.others.map(plain).join(', ')) : null),
      h('td', null, h('div', { class: 'sheet-small' }, plain(r.why.reason)),
        r.why.quote ? h('div', null, h('q', null, clip(r.why.quote, 170)), ' ', h('a', { class: 'link', href: r.why.url, target: '_blank', rel: 'noopener noreferrer' }, 'source'), ' ', h('span', { class: 'chip-status' }, chipFor(r.why.url))) : null,
        r.cautions.length ? h('div', { class: 'sheet-small' }, 'Note from the page: ', h('q', null, clip(r.cautions[0].sentence, 140))) : null),
      h('td', null, qtyCell(r, m.job)),
      h('td', null, p.pds ? h('div', null, h('a', { class: 'link', href: p.pds, target: '_blank', rel: 'noopener noreferrer' }, 'Data sheet')) : h('div', { class: 'sheet-small' }, 'No data sheet link'), p.sds ? h('div', null, h('a', { class: 'link', href: p.sds, target: '_blank', rel: 'noopener noreferrer' }, 'Safety data sheet')) : null));
  });
  const table = h('table', { class: 'sheet-table' }, h('caption', { class: 'visually-hidden' }, 'Steps in order'),
    h('thead', null, h('tr', null, ['Step', 'Product', 'Why, in the published words', 'Quantity', 'Documents'].map((x, i) => h('th', { scope: 'col', class: i === 0 ? 'n' : '' }, x)))), h('tbody', null, rows));
  const nc = h('section', { class: 'sheet-box' }, h('h2', null, 'Not covered'), h('ul', null, m.notCovered.map((t) => h('li', null, plain(t)))));
  const src = h('section', { class: 'sheet-box' }, h('h2', null, 'Sources (read ' + READ + ')'), h('ol', { class: 'sheet-sources' }, m.sources.map((s) => h('li', null, plain(s.text), ': ', h('a', { class: 'link', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.url)))));
  const foot = h('footer', { class: 'sheet-foot' }, h('p', null, DEMO_LINE), h('p', { class: 'sheet-estimate' }, ESTIMATE_LINE));
  return h('article', { class: 'sheet', id: 'sheet', 'aria-label': 'Tiling system sheet' }, head, table, h('div', { class: 'sheet-boxes' }, nc, src), foot);
}

export async function sheetView(ctx) {
  const S = await systems();
  const { sel, job, pick } = parseParams(ctx.params);
  const m = sheetModel(S, sel, job, pick);
  const back = hashHref('/system', { tile: sel.tile, sub: sel.sub, loc: sel.loc, m2: job.area, allow: job.allowancePct || '', pick: toParams({ sel, job, pick }).pick });
  if (!m.ok) {
    return { title: 'System sheet', nav: 'construction', el: h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'System finder', href: '#/system' }, { label: 'System sheet' }]),
      h('div', { class: 'page-head' }, h('h1', null, 'System sheet'), h('p', { class: 'lead' }, sel.tile ? m.message : 'Choose a tile type, a surface and a place first.'), h('a', { class: 'btn', href: '#/system' }, 'Open the system finder'))) };
  }
  const set = (patch) => { const next = toParams({ sel, job: { ...job, ...patch }, pick }); ctx.go('/sheet', next, true); };
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const area = h('input', { id: 'sh-m2', class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: job.area || '' });
  const allow = h('input', { id: 'sh-allow', class: 'input', type: 'number', min: '0', max: '100', step: 'any', inputmode: 'decimal', value: job.allowancePct || '' , placeholder: '0' });
  const len = h('input', { id: 'sh-len', class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: job.length || '' });
  area.addEventListener('input', debounce(() => set({ area: num(area.value) }), 350));
  allow.addEventListener('input', debounce(() => set({ allowancePct: num(allow.value) || 0 }), 350));
  len.addEventListener('input', debounce(() => set({ length: num(len.value) }), 350));
  const copyBtn = h('button', { class: 'btn btn--hollow', type: 'button', id: 'sh-copy', onclick: async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); copyBtn.lastChild.textContent = 'Link copied'; announce('Link copied'); }
    catch { const t = h('input', { value: url, 'aria-label': 'Sheet link' }); copyBtn.after(t); t.select(); copyBtn.lastChild.textContent = 'Select and copy the link'; }
  } }, icon('check', 'i--sm'), h('span', null, 'Copy link'));
  const controls = h('form', { class: 'sheet-controls no-print', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Sheet settings' },
    h('div', { class: 'field' }, h('label', { for: 'sh-m2' }, 'Area (m2)'), area),
    h('div', { class: 'field' }, h('label', { for: 'sh-allow' }, 'Allowance %', h('span', { class: 'hint' }, ' optional, your own figure')), allow),
    h('div', { class: 'field' }, h('label', { for: 'sh-len' }, 'Joint length (m)', h('span', { class: 'hint' }, ' optional')), len),
    h('div', { class: 'btn-row' }, copyBtn,
      h('button', { class: 'btn', type: 'button', id: 'sh-print', onclick: () => window.print() }, icon('download', 'i--sm'), 'Print or save as PDF'),
      h('a', { class: 'btn btn--text', href: back }, 'Change the system')));
  const note = h('p', { class: 'sheet-allow-note no-print' }, 'Sika\'s own grout calculator page suggests adding 10 to 15% for wastage. No allowance is added unless you type one.');
  const el = h('div', { class: 'container sheet-page' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'System finder', href: '#/system' }, { label: 'System sheet' }]), controls, note, sheetBody(m));
  return { el, title: 'System sheet: ' + (m.title || ''), nav: 'construction' };
}
