// "What best describes you?" chooser. Reorders the home page and swaps the example chips. Stored in this browser only.
import { h, store, icon, hashHref } from './util.js';
const KEY = 'sika-demo-210c0c-persona';
export const PERSONAS = {
  distributor: { label: 'Distributor or merchant', blurb: 'Look up data sheets and SDS fast, check ranges, build a quote.', links: [['SDS and TDS library', '#/documents'], ['Whole range by category', '#/category/construction'], ['Prepare a quote', '#/projects']], ask: 'Give me the safety data sheet for Sikaflex-11 FC+' },
  applicator: { label: 'Applicator or tradesperson', blurb: 'Pick the right product for the job, get coverage and quantities.', links: [['Find a product for a job', '#/products'], ['Tile and stone systems', '#/category/construction/tile-stone-installationsystems'], ['How-to guides', '#/guides']], ask: 'Which adhesive for porcelain tiles on a concrete floor?' },
  specifier: { label: 'Specifier or architect', blurb: 'Data sheets, system data sheets, certificates and environmental declarations.', links: [['Environmental declarations', '#/documents?type=environmental_product_declaration'], ['System data sheets', '#/documents?type=system_data_sheet'], ['Product data sheets', '#/documents?type=product_data_sheet']], ask: 'Which waterproofing membranes have a data sheet for a balcony?' },
  engineer: { label: 'Engineer', blurb: 'Technical data, approvals, strengthening and anchoring systems.', links: [['Structural strengthening', '#/category/construction/structural-strengthening'], ['Grouting and anchoring', '#/category/construction/grouts-anchoring'], ['Brochures and certificates', '#/documents?type=brochure']], ask: 'What is the consumption of Sikadur-30?' },
};
export const getPersona = () => { const v = store.get(KEY, ''); return PERSONAS[v] ? v : ''; };
export function personaBlock(cfg, rerender, openAssistant) {
  const cur = getPersona();
  const pick = (k) => { store.set(KEY, k); rerender(); setTimeout(() => { const el = document.getElementById('persona-' + k); if (el) el.focus(); }, 50); };
  const btns = Object.entries(PERSONAS).map(([k, p]) => h('button', { class: 'chip chip--line', type: 'button', id: 'persona-' + k, 'aria-pressed': String(cur === k), onclick: () => pick(k) }, p.label));
  const detail = cur ? h('div', { class: 'grid grid--3', style: 'margin-top:1.25rem' }, ...PERSONAS[cur].links.map(([l, href]) => h('a', { class: 'btn btn--hollow', href, style: 'justify-content:space-between' }, l, icon('arrow-right', 'i--sm'))),
    ) : null;
  return h('section', { class: 'section section--tight', 'aria-labelledby': 'persona-h' }, h('div', { class: 'container' },
    h('div', { class: 'layout-head', style: 'margin-bottom:1rem' }, h('h2', { id: 'persona-h', class: 'h4' }, 'What best describes you?'), h('p', null, cur ? PERSONAS[cur].blurb : 'Pick one and we will put the tools you need first. Stored in this browser only.')),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Choose what best describes you', style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center' }, btns, cur ? h('button', { class: 'btn btn--text', type: 'button', onclick: () => { store.set(KEY, ''); rerender(); } }, 'Reset') : null),
    detail, cur ? h('div', { class: 'btn-row', style: 'justify-content:center;margin-top:1rem' }, h('button', { class: 'chip chip--line', type: 'button', onclick: () => openAssistant(PERSONAS[cur].ask) }, `Try asking: ${PERSONAS[cur].ask}`)) : null));
}
