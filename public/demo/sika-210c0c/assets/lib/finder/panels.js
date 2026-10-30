// Panels added to the product page: "How much do I need?" (T13) and, once T09 lands, the "Can I use this on or over...?" panel.
import { h, icon, announce } from '../util.js';
import { rateFor } from './load.js';
import { normaliseFact, quantity, packOptions, fmtQty, fmt, packText, ESTIMATE_LINE, NO_RATE_TEXT } from './calc.js';
import { chipFor } from './model.js';
import { addCalcToProject } from './bom.js';

const plain = (s) => String(s || '').replace(/[–—]/g, '-');

export async function calcPanel(p) {
  let r;
  try { r = await rateFor(p.id); } catch { return null; }
  const sheetUrl = (r.datasheet && r.datasheet.url) || r.productUrl || p.url;
  const head = h('h2', { id: 'calc-h' }, 'How much do I need?');
  const sec = h('section', { class: 'finder-panel finder-calc section--tight', 'aria-labelledby': 'calc-h' }, head);
  const facts = (r.consumption || []).map((f) => ({ f, n: normaliseFact(f) }));
  if (r.status !== 'published' || !facts.length) {
    sec.append(h('p', null, h('strong', null, NO_RATE_TEXT + '.'), ' No consumption, coverage or yield figure is published for this product. See ', h('a', { class: 'link link--ext', href: sheetUrl, target: '_blank', rel: 'noopener noreferrer' }, 'the data sheet'), '.'),
      h('p', { class: 'estimate-line' }, ESTIMATE_LINE));
    return sec;
  }
  const kinds = new Set(facts.filter((x) => x.n.ok).map((x) => x.n.kind));
  const needThick = facts.some((x) => x.n.ok && x.n.perMm), needCoats = facts.some((x) => x.n.ok && x.n.perCoat);
  const field = (id, label, hint, attrs = {}) => { const i = h('input', { id, class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', ...attrs }); return [h('div', { class: 'field' }, h('label', { for: id }, label, hint ? h('span', { class: 'hint' }, ' ' + hint) : null), i), i]; };
  const [fArea, iArea] = field('calc-area', 'Area (m2)', '', {});
  const [fAllow, iAllow] = field('calc-allow', 'Add allowance %', 'optional, your own figure', { placeholder: '0', max: '100' });
  const extras = [];
  const inputs = { area: iArea, allow: iAllow };
  if (needThick) { const [f, i] = field('calc-thick', 'Thickness (mm)', 'the published rate is per mm'); extras.push(f); inputs.thick = i; }
  if (needCoats) { const [f, i] = field('calc-coats', 'Coats', 'only where the rate is per coat'); extras.push(f); inputs.coats = i; }
  if (kinds.has('per-m')) { const [f, i] = field('calc-len', 'Length (m)', 'for rates per metre'); extras.push(f); inputs.len = i; }
  if (kinds.has('per-m3')) { const [f, i] = field('calc-vol', 'Volume (m3)', 'for rates per m3'); extras.push(f); inputs.vol = i; }
  const out = h('div', { class: 'calc-out', id: 'calc-out', 'aria-live': 'polite' });
  const num = (el) => { const v = parseFloat(el && el.value); return Number.isFinite(v) && v > 0 ? v : null; };
  const packsOf = r.packs.map((x) => ({ amount: x.amount, unit: x.unit }));
  const state = { snaps: {} };
  const paint = () => {
    const job = { area: num(inputs.area), allowancePct: num(inputs.allow) || 0, thickness: num(inputs.thick), coats: num(inputs.coats), length: num(inputs.len), volume: num(inputs.vol) };
    out.replaceChildren();
    facts.forEach(({ f, n }, i) => {
      const li = h('div', { class: 'calc-row' });
      li.append(h('p', { class: 'calc-phrase' }, h('q', null, plain(f.text)), ' ', h('a', { class: 'link link--ext', href: f.source.url, target: '_blank', rel: 'noopener noreferrer' }, 'source' + (f.source.page ? ', page ' + f.source.page : '')), ' ', h('span', { class: 'chip-status' }, f.source.docType === 'PDS' ? 'From a published data sheet' : 'From the published product page')));
      if (!n.ok) { li.append(h('p', { class: 'calc-note' }, n.reason + ' ', h('a', { class: 'link', href: sheetUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Data sheet'))); out.append(li); return; }
      const q = quantity(n, job);
      if (!q.ok) { li.append(h('p', { class: 'calc-note' }, q.reason)); out.append(li); return; }
      const qtext = q.low === q.high ? fmtQty(q.low, q.unit) : fmtQty(q.low, q.unit) + ' to ' + fmtQty(q.high, q.unit);
      li.append(h('p', { class: 'calc-qty' }, h('strong', null, qtext), q.allowancePct ? ` (includes an allowance of ${fmt(q.allowancePct)}%)` : ' (no allowance added)'));
      let packs = null;
      if (q.unit !== 'm') {
        packs = packOptions(packsOf, { amount: q.high, unit: q.unit });
        if (packs.options.length) li.append(h('p', { class: 'calc-packs' }, 'Whole packs, rounded up' + (q.range ? ' (to cover the higher figure)' : '') + ': ', packs.options.map((o, k) => [k ? '; ' : '', packText(o)])));
        else li.append(h('p', { class: 'calc-note' }, packs.note));
      }
      const snap = { factId: f.id, low: q.low, high: q.high, unit: q.unit, area: job.area, length: job.length, volume: job.volume, thickness: n.perMm ? job.thickness : null, allowancePct: q.allowancePct, basis: f.text, sourceUrl: f.source.url, packs: packs ? packs.options : [], packNote: packs && packs.note };
      li.append(h('button', { class: 'btn btn--hollow', type: 'button', onclick: () => addCalcToProject(p, snap) }, icon('plus', 'i--sm'), 'Add to project with this quantity'));
      out.append(li);
    });
    if (!job.area && !job.length && !job.volume) out.prepend(h('p', { class: 'calc-note' }, 'Enter a size to see quantities. Nothing is worked out until you do.'));
  };
  Object.values(inputs).forEach((i) => i.addEventListener('input', paint));
  sec.append(
    h('p', null, 'From the published consumption figure for ', p.name, '. Rounded up to whole packs. Sika\'s own grout calculator page suggests adding 10 to 15% for wastage; no allowance is added unless you type one.'),
    h('form', { class: 'calc-form', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Quantity calculator' }, fArea, fAllow, extras),
    out, h('p', { class: 'estimate-line' }, ESTIMATE_LINE));
  paint();
  return sec;
}

/** All finder panels for a product page, in order. */
export async function finderPanels(p) {
  const calc = await calcPanel(p);
  return h('div', { class: 'container finder-panels' }, calc);
}
