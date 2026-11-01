// The "Calculations" section of the project page, loaded only when the project page opens (kept out of the first-screen bundle).
import { h, announce } from './util.js';
import { projectStore } from './projects.js';

/** The "Calculations" section of the project page: every stored calculation with its answer, working, source, and re-run, edit, add to cart and delete. */
const NUM_LABEL = { area: 'Area (m2)', length: 'Length (m)', width: 'Width (m)', tileL: 'Tile length (mm)', tileW: 'Tile width (mm)', jointMm: 'Joint width (mm)', thicknessMm: 'Thickness (mm)', widthMm: 'Joint width (mm)', depthMm: 'Joint depth (mm)', lengthM: 'Length of joint (m)', packMl: 'Pack size (mL)', allowancePct: 'Your allowance (%)', cutsPct: 'Your cuts (%)', value: 'Value', deduct: 'Openings to take off (m)', perBox: 'Tiles per box' };
const KIND_NAME = { arithmetic: 'Arithmetic', convert: 'Unit conversion', perimeter: 'Perimeter', tiles: 'Tile count', grout: 'Grout volume', sealant: 'Joint sealant', bed: 'Bed volume', mixwater: 'Mixing water', timeline: 'Time until the next step', product: 'Product quantity' };
export function fillCalcSection(box, calcs, render, estimate) {
  const items = calcs.map((c) => {
    const edit = h('form', { class: 'proj-calc-edit no-print', hidden: true, 'aria-label': `Edit the inputs of ${c.title}`, onsubmit: (e) => e.preventDefault() });
    const fields = Object.entries(c.inputs || {}).filter(([, v]) => typeof v === 'number' || (typeof v === 'string' && v.length < 40));
    const inputs = fields.map(([k, v]) => { const id = `pc-${c.id}-${k}`; const i = h('input', { class: 'input', id, name: k, type: typeof v === 'number' ? 'number' : 'text', step: 'any', value: String(v) }); return [h('div', { class: 'field' }, h('label', { for: id }, NUM_LABEL[k] || k.replace(/([A-Z])/g, ' $1').toLowerCase()), i), i]; });
    const runIt = async (vals) => {
      const G = await import('./finder/gencalc.js');
      const r = G.rerun(c.kind, vals); if (!r.ok) { announce(r.reason || 'Could not re-run'); return false; }
      projectStore.updateCalculation(c.id, { inputs: vals, normalised: r.normalised, result: r.result, formula: r.formula, citation: r.citation, answer: G.resultText(c.kind, r.result) });
      render(); announce('Calculation updated'); return true;
    };
    const canRerun = ['arithmetic', 'convert', 'perimeter', 'tiles', 'grout', 'sealant', 'bed'].includes(c.kind);
    edit.append(...inputs.map((x) => x[0]), h('button', { class: 'btn btn--hollow', type: 'submit', onclick: async () => { const vals = { ...c.inputs }; fields.forEach(([k, v], i) => { const el = inputs[i][1]; vals[k] = typeof v === 'number' ? parseFloat(el.value) : el.value; }); await runIt(vals); } }, 'Save and re-run'));
    const cit = c.citation;
    return h('article', { class: 'proj-line proj-calc', 'data-calc': c.id, 'data-kind': c.kind },
      h('div', null, h('h3', null, c.title || KIND_NAME[c.kind]), h('p', { class: 'count', style: 'margin:0' }, KIND_NAME[c.kind] || c.kind, c.productName ? ` | ${c.productName}` : '', c.t ? ` | ${c.t.slice(0, 10)}` : ''),
        h('p', { class: 'proj-calc-answer' }, h('strong', null, c.answer || c.summary || '')),
        c.formula ? h('p', { class: 'count' }, 'Working: ', c.formula) : null,
        cit && cit.text ? h('p', { class: 'count' }, 'Source: ', cit.url ? h('a', { class: 'link link--ext', href: cit.url + (cit.page && /\.pdf/i.test(cit.url) ? '#page=' + cit.page : ''), target: '_blank', rel: 'noopener noreferrer' }, cit.kind === 'worked' ? cit.text : cit.text.slice(0, 160)) : cit.text) : null,
        c.usedIn && c.usedIn.length ? h('p', { class: 'count proj-used' }, 'Used in: ', c.usedIn.map((u) => (u.type === 'cart' ? 'cart line ' : 'quote ') + u.ref).join(', ')) : null,
        h('p', { class: 'estimate-line' }, c.estimate || estimate),
        edit),
      h('div', { class: 'proj-calc-actions no-print' },
        canRerun ? h('button', { class: 'btn btn--text', type: 'button', onclick: () => runIt({ ...c.inputs }) }, 'Re-run') : null,
        fields.length && canRerun ? h('button', { class: 'btn btn--text', type: 'button', 'aria-expanded': 'false', onclick: (e) => { edit.hidden = !edit.hidden; e.currentTarget.setAttribute('aria-expanded', String(!edit.hidden)); } }, 'Edit inputs') : null,
        c.product && c.product !== 'none' ? h('button', { class: 'btn btn--text', type: 'button', onclick: () => { const m = /^(\d+)\s*x/.exec(String((c.result && c.result.packs) || (c.result && c.result.rows && c.result.rows[0] && c.result.rows[0].packs) || '')); projectStore.addItem({ id: c.product, name: c.productName, qty: m ? +m[1] : 1, unit: 'pack', need: c.answer, basis: c.formula, url: cit && cit.url, phrase: cit && cit.text, estimate: c.estimate }); projectStore.markCalculationUsed(c.id, { type: 'cart', ref: c.product }); render(); announce(`${c.productName} added to the cart`); } }, 'Add to cart') : null,
        h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Delete the calculation ${c.title}`, onclick: () => { projectStore.removeCalculation(c.id); render(); announce('Calculation deleted'); } }, 'Delete')));
  });
  box.append(...(items.length ? items : [h('p', { class: 'count' }, 'No calculations saved yet. Ask the advisor, for example "how much grout for 20 m2 of 600x600 tiles with 3 mm joints", then say "save".')]));
}
