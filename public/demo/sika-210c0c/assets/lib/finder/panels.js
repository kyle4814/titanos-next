// Panels added to the product page: "How much do I need?" (T13) and, once T09 lands, the "Can I use this on or over...?" panel.
import { h, icon, announce } from '../util.js';
import { rateFor } from './load.js';
import { normaliseFact, quantity, packOptions, packRange, packRangeText, doseBasisText, inputFor, DOSE_KINDS, fmtQty, fmt, fmtK, packText, ESTIMATE_LINE, NO_RATE_TEXT } from './calc.js';
import { chipFor } from './model.js';
import { addCalcToProject } from './bom.js';
import { CHIPS, canUse } from './canuse.js';
import { data } from '../data.js';

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
  const okFacts = facts.filter((x) => x.n.ok);
  const kinds = new Set(okFacts.map((x) => x.n.kind));
  const needs = new Set(okFacts.map((x) => inputFor(x.n)));
  const needThick = facts.some((x) => x.n.ok && x.n.perMm), needCoats = facts.some((x) => x.n.ok && x.n.perCoat);
  const field = (id, label, hint, attrs = {}) => { const i = h('input', { id, class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', ...attrs }); return [h('div', { class: 'field' }, h('label', { for: id }, label, hint ? h('span', { class: 'hint' }, ' ' + hint) : null), i), i]; };
  // only the inputs the published figures need: an admixture is dosed by the mass of cement, never by an area
  const lead = [], extras = [];
  const inputs = {};
  if (needs.has('area')) { const [f, i] = field('calc-area', 'Area (m2)', '', {}); lead.push(f); inputs.area = i; }
  if (needs.has('cement')) { const [f, i] = field('calc-cement', 'Cement or binder (kg)', 'the dose is per kg of it; 1 tonne is 1000 kg'); lead.push(f); inputs.cement = i; }
  if (needs.has('mix')) { const [f, i] = field('calc-mix', 'Mix (kg)', 'the dose is per kg of the mix'); lead.push(f); inputs.mix = i; }
  if (needs.has('water')) { const [f, i] = field('calc-water', 'Water (L)', 'the dose is per litre of water'); lead.push(f); inputs.water = i; }
  if (okFacts.length) { const [f, i] = field('calc-allow', 'Add allowance %', 'optional, your own figure', { placeholder: '0', max: '100' }); inputs.allow = i; lead.push(f); }
  if (needThick) { const [f, i] = field('calc-thick', 'Thickness (mm)', 'the published rate is per mm'); extras.push(f); inputs.thick = i; }
  if (needCoats) { const [f, i] = field('calc-coats', 'Coats', 'only where the rate is per coat'); extras.push(f); inputs.coats = i; }
  if (kinds.has('per-m')) { const [f, i] = field('calc-len', 'Length (m)', 'for rates per metre'); extras.push(f); inputs.len = i; }
  if (kinds.has('per-m3')) { const [f, i] = field('calc-vol', 'Volume (m3)', 'for rates per m3 of concrete or mix'); extras.push(f); inputs.vol = i; }
  const out = h('div', { class: 'calc-out', id: 'calc-out', 'aria-live': 'polite' });
  const num = (el) => { const v = parseFloat(el && el.value); return Number.isFinite(v) && v > 0 ? v : null; };
  const packsOf = r.packs.map((x) => ({ amount: x.amount, unit: x.unit }));
  const state = { snaps: {} };
  const paint = () => {
    const job = { area: num(inputs.area), allowancePct: num(inputs.allow) || 0, thickness: num(inputs.thick), coats: num(inputs.coats), length: num(inputs.len), volume: num(inputs.vol), cementKg: num(inputs.cement), mixKg: num(inputs.mix), waterL: num(inputs.water) };
    out.replaceChildren();
    facts.forEach(({ f, n }, i) => {
      const li = h('div', { class: 'calc-row' });
      li.append(h('p', { class: 'calc-phrase' }, h('q', null, plain(f.text)), ' ', h('a', { class: 'link link--ext', href: f.source.url, target: '_blank', rel: 'noopener noreferrer' }, 'source' + (f.source.page ? ', page ' + f.source.page : '')), ' ', h('span', { class: 'chip-status' }, f.source.docType === 'PDS' ? 'From a published data sheet' : 'From the published product page')));
      if (!n.ok) { li.append(h('p', { class: 'calc-note' }, n.reason + ' ', h('a', { class: 'link', href: sheetUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Data sheet'))); out.append(li); return; }
      const q = quantity(n, job);
      if (!q.ok) { li.append(h('p', { class: 'calc-note' }, q.reason)); out.append(li); return; }
      const dose = DOSE_KINDS.includes(n.kind);
      const one = q.limit === 'max' ? 'up to ' + fmtQty(q.high, q.unit) : q.limit === 'min' ? 'at least ' + fmtQty(q.low, q.unit) : null;
      const qtext = one || (q.low === q.high ? fmtQty(q.low, q.unit) : fmtQty(q.low, q.unit) + ' to ' + fmtQty(q.high, q.unit));
      if (dose) li.append(h('p', { class: 'calc-basis' }, 'Published as ' + doseBasisText(n) + '.'));
      const forWhat = n.kind === 'per-m3' ? ` for ${fmtK(job.volume)} m3` : n.kind === 'dose-per-water' ? ` for ${fmtK(job.waterL)} L of water` : n.kind === 'dose-per-mass' || n.kind === 'dose-pct' ? ` for ${fmtK(n.basis === 'mix' ? job.mixKg : job.cementKg)} kg of ${n.basis === 'mix' ? 'mix' : 'cement or binder'}` : '';
      li.append(h('p', { class: 'calc-qty' }, h('strong', null, qtext), forWhat, q.allowancePct ? ` (includes an allowance of ${fmt(q.allowancePct)}%)` : ' (no allowance added)'));
      if (q.typical != null) li.append(h('p', { class: 'calc-typical' }, 'Typical dose in the same statement: ', h('strong', null, fmtQty(q.typical, q.unit)), forWhat, ' (the centre of the published statement).'));
      let packs = null;
      if (q.unit === 'bags') li.append(h('p', { class: 'calc-note' }, 'The published figure is already a number of bags.'));
      else if (q.unit !== 'm') {
        packs = packOptions(packsOf, { amount: q.high, unit: q.unit });
        if (dose) {
          const pr = packRange(packsOf, q);
          if (pr.options.length) li.append(h('p', { class: 'calc-packs' }, 'Whole packs, rounded up' + (q.range ? ', lowest to highest figure' : '') + ': ', pr.options.map((o, k) => [k ? '; ' : '', packRangeText(o, q.limit)])));
          else li.append(h('p', { class: 'calc-note' }, pr.note));
        } else if (packs.options.length) li.append(h('p', { class: 'calc-packs' }, 'Whole packs, rounded up' + (q.range ? ' (to cover the higher figure)' : '') + ': ', packs.options.map((o, k) => [k ? '; ' : '', packText(o)])));
        else li.append(h('p', { class: 'calc-note' }, packs.note));
      }
      const snap = { factId: f.id, low: q.low, high: q.high, unit: q.unit, area: job.area, length: job.length, volume: job.volume, cementKg: n.kind === 'dose-per-mass' && n.basis !== 'mix' || n.kind === 'dose-pct' ? job.cementKg : null, mixKg: n.basis === 'mix' ? job.mixKg : null, waterL: n.kind === 'dose-per-water' ? job.waterL : null, thickness: n.perMm ? job.thickness : null, allowancePct: q.allowancePct, basis: f.text, sourceUrl: f.source.url, packs: packs ? packs.options : [], packNote: packs && packs.note };
      li.append(h('button', { class: 'btn btn--hollow', type: 'button', onclick: () => addCalcToProject(p, snap) }, icon('plus', 'i--sm'), 'Add to project with this quantity'));
      out.append(li);
    });
    if (okFacts.length && !job.area && !job.length && !job.volume && !job.cementKg && !job.mixKg && !job.waterL) out.prepend(h('p', { class: 'calc-note' }, 'Enter a size to see quantities. Nothing is worked out until you do.'));
  };
  Object.values(inputs).forEach((i) => i.addEventListener('input', paint));
  const allDose = kinds.size > 0 && [...kinds].every((k) => DOSE_KINDS.includes(k));
  sec.append(
    h('p', null, allDose ? ['From the published dosage for ', p.name, '. The range stays a range, no midpoint is picked, and no allowance is added unless you type one.']
      : ['From the published consumption figure for ', p.name, '. Rounded up to whole packs. Sika\'s own grout calculator page suggests adding 10 to 15% for wastage; no allowance is added unless you type one.']),
    ...(okFacts.length ? [h('form', { class: 'calc-form', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Quantity calculator' }, lead, extras)] : []),
    out, h('p', { class: 'estimate-line' }, ESTIMATE_LINE));
  paint();
  return sec;
}

const VERDICT = { yes: ['check', 'YES'], no: ['close', 'NO'], unstated: ['info', 'NOT STATED'] };

/** T09: "Can I use this on or over...?" Verdicts come from the product's own published text; no inference beyond the sentence. */
export async function canIPanel(p) {
  if (!(p.categoryPath || []).includes('tile-stone-installationsystems')) return null;
  const cfg = await data.config();
  const contact = (cfg.links && cfg.links.contact) || 'https://aus.sika.com/en/Contact.html';
  const V = canUse(p);
  const out = h('div', { class: 'cani-out', id: 'cani-out', role: 'status', 'aria-live': 'polite' }, h('p', { class: 'calc-note' }, 'Pick a surface or condition to see what this product\'s published text says.'));
  const btns = [];
  const show = (id, label) => {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    const v = V[id]; const [ic, word] = VERDICT[v.verdict];
    const body = [h('p', { class: 'cani-verdict cani-' + v.verdict }, icon(ic, 'i--sm'), h('strong', null, word), ' ', label)];
    if (v.quote) body.push(h('p', { class: 'finder-quote' }, h('q', null, plain(v.quote)), ' ', h('a', { class: 'link link--ext', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, 'source'), ' ', h('span', { class: 'chip-status' }, chipFor(v.url)), v.field ? h('span', { class: 'count' }, ' (' + v.field + ')') : null));
    else body.push(h('p', { class: 'calc-note' }, 'Not stated in the published text for this product. Ask Technical Services: ', h('a', { class: 'link link--ext', href: contact, target: '_blank', rel: 'noopener noreferrer' }, 'contact Sika Australia'), '.'));
    out.replaceChildren(...body);
    announce(`${label}: ${word}.` + (v.quote ? ' ' + plain(v.quote) : ' Not stated in the published text.'));
  };
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Surface or condition', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:.75rem 0' },
    CHIPS.map(([id, label]) => { const b = h('button', { type: 'button', class: 'chip chip--line', 'aria-pressed': 'false', dataset: { id }, onclick: () => show(id, label) }, label); btns.push(b); return b; }));
  return h('section', { class: 'finder-panel finder-cani', 'aria-labelledby': 'cani-h' },
    h('h2', { id: 'cani-h' }, 'Can I use this on or over...?'),
    h('p', null, 'Each answer is the product\'s own published sentence, quoted. Where the text is silent it says so.'), chips, out);
}

/** All finder panels for a product page, in order. */
export async function finderPanels(p) {
  const [cani, calc] = await Promise.all([canIPanel(p), calcPanel(p)]);
  return h('div', { class: 'container finder-panels' }, cani, calc);
}
