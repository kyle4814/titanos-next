// T17: the system finder. Three questions (tile, surface, place), then the ordered system from the published text, with the quoted reason for each
// product and a "Ruled out by their own text" list. State lives in the hash, so a link restores the result.
import { h, icon, announce, hashHref } from '../util.js';
import { breadcrumb, addButton } from '../components.js';
import { systems, getJSON } from './load.js';
import { resolve, parseParams, toParams, chipFor, NO_MATCH } from './model.js';

const plain = (s) => String(s || '').replace(/[–—]/g, '-');
const link = (href, text, cls = 'link link--ext') => h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' }, text);

export async function systemView(ctx) {
  const [S, SEL] = await Promise.all([systems(), getJSON('selector.json')]);
  const { sel, job, pick } = parseParams(ctx.params);
  const Q = Object.fromEntries(SEL.questions.map((q) => [q.id, q]));
  const go = (patch, replace = false) => {
    const next = { ...sel, ...patch };
    // a place that does not exist for the new pair is dropped, so the visitor never lands on an empty answer by accident
    const pair = SEL.locationsByPair[next.tile + '|' + next.sub];
    if (pair && next.loc && !pair.includes(next.loc)) next.loc = '';
    ctx.go('/system', toParams({ sel: next, job, pick: patch.tile || patch.sub || patch.loc ? {} : pick }), replace);
  };
  const group = (qid, key, label, step, opts, current) => h('fieldset', { class: 'finder-q', id: 'q-' + qid },
    h('legend', null, h('span', { class: 'finder-step' }, step), label),
    h('div', { class: 'chips', role: 'group', 'aria-label': label, style: 'display:flex;gap:8px;flex-wrap:wrap' },
      opts.map((o) => h('button', { type: 'button', class: 'chip chip--line', 'aria-pressed': String(current === o.id), dataset: { id: o.id }, onclick: () => go({ [key]: o.id }) }, o.label))));
  const pair = SEL.locationsByPair[sel.tile + '|' + sel.sub];
  const locOpts = Q.location.options.filter((o) => !pair || pair.includes(o.id));
  const form = h('div', { class: 'finder-form' },
    group('tile', 'tile', Q.tile.label, '1', Q.tile.options, sel.tile),
    group('sub', 'sub', Q.substrate.label, '2', Q.substrate.options, sel.sub),
    group('loc', 'loc', Q.location.label, '3', locOpts, sel.loc));
  const el = h('div', { class: 'container finder-page' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'System finder' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Find the system'),
      h('p', { class: 'lead', style: 'max-width:60rem' }, 'Three questions. The answer is an ordered system of products, each with the sentence from the published documentation that names it, and the products the published text rules out.'),
      h('p', { class: 'notice' }, icon('info'), h('span', null, 'Built from Sika Australia\'s public data sheets and product pages, read on 2026-10-30. Where the published text is silent, this page says so. Technical Services decides suitability.'))),
    form);
  const done = sel.tile && sel.sub && sel.loc;
  const result = h('div', { id: 'finder-result', 'aria-live': 'polite' });
  el.append(result);
  if (!done) { result.append(h('p', { class: 'count' }, 'Choose ' + [!sel.tile && 'a tile type', !sel.sub && 'the surface', !sel.loc && 'the place'].filter(Boolean).join(', ') + ' to see the system.')); return { el, title: 'System finder', nav: 'construction' }; }

  const r = resolve(S, sel);
  if (!r.ok) {
    result.append(h('div', { class: 'finder-none', role: 'status' }, h('h2', null, r.tileLabel + ' on ' + r.subLabel.toLowerCase() + ': ' + r.locLabel), h('p', null, h('strong', null, r.message))));
    announce(r.message);
    return { el, title: 'System finder', nav: 'construction' };
  }
  const area = h('input', { id: 'f-m2', class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: job.area || '', 'aria-describedby': 'f-m2-h' });
  const sheetHref = () => hashHref('/sheet', toParams({ sel, job: { ...job, area: parseFloat(area.value) > 0 ? parseFloat(area.value) : null }, pick }));
  const sheetBtn = h('a', { class: 'btn', id: 'f-sheet', href: sheetHref() }, icon('file', 'i--sm'), 'Make my sheet');
  area.addEventListener('input', () => { sheetBtn.setAttribute('href', sheetHref()); });
  const actions = h('div', { class: 'finder-actions' },
    h('div', { class: 'field' }, h('label', { for: 'f-m2' }, 'Area for your sheet (m2)'), area, h('span', { class: 'hint', id: 'f-m2-h' }, 'Optional. Quantities are worked out on the sheet.')),
    h('div', { class: 'btn-row' }, sheetBtn,
      h('button', { class: 'btn btn--dark', type: 'button', id: 'f-ask', onclick: () => ctx.openAssistant(`What do I need to tile ${r.tileLabel.toLowerCase()} over ${r.subLabel.toLowerCase()}, ${r.locLabel.toLowerCase()}?`) }, icon('chat', 'i--sm'), 'Ask the advisor about this')));
  result.append(h('h2', { class: 'finder-title' }, r.title), actions);
  const stepEls = r.steps.map((st, i) => {
    const sec = h('section', { class: 'finder-stepcard', 'aria-labelledby': 'st-' + st.role }, h('h3', { id: 'st-' + st.role }, h('span', { class: 'finder-step' }, String(i + 1)), st.label));
    if (!st.options.length) { sec.append(h('p', { class: 'finder-silent' }, NO_MATCH + (st.note ? ' ' + plain(st.note) : ''))); return sec; }
    const chosen = pick[st.role] && st.options.some((o) => o.productId === pick[st.role]) ? pick[st.role] : st.options[0].productId;
    const grid = h('div', { class: 'finder-opts' }, st.options.map((o) => {
      const ev = o.evidence[0];
      const radio = h('input', { type: 'radio', name: 'pick-' + st.role, id: `pk-${st.role}-${o.productId}`, value: o.productId, checked: o.productId === chosen, });
      radio.addEventListener('change', () => ctx.go('/system', toParams({ sel, job, pick: { ...pick, [st.role]: o.productId } }), true));
      return h('article', { class: 'card finder-opt' }, h('div', { class: 'card-body' },
        h('h4', null, h('a', { class: 'link', href: '#/product/' + o.productId }, plain(o.name))),
        h('p', { class: 'count' }, plain(o.reason)),
        ev ? h('p', { class: 'finder-quote' }, h('q', null, plain(ev.sentence)), ' ', link(ev.url, 'source'), ' ', h('span', { class: 'chip-status' }, chipFor(ev.url))) : null,
        o.cautions[0] ? h('p', { class: 'count' }, 'Note from the page: ', h('q', null, plain(o.cautions[0].sentence))) : null,
        h('div', { class: 'card-actions' }, addButton(o.productId, plain(o.name)),
          h('label', { class: 'finder-pick', for: radio.id }, radio, ' Use in my sheet'))));
    }));
    sec.append(grid);
    return sec;
  });
  result.append(...stepEls);
  if (r.ruledOut.length) {
    result.append(h('section', { class: 'finder-ruled', 'aria-labelledby': 'ruled-h' }, h('h3', { id: 'ruled-h' }, 'Ruled out by their own text'),
      h('p', { class: 'count' }, 'Products whose own published text says they are not for this combination, with the sentence.'),
      h('ul', null, r.ruledOut.map((x) => h('li', null, h('strong', null, plain(x.name)), ` (${x.roleLabel.toLowerCase()}): `, h('q', null, plain(x.quote)), ' ', link(x.url, 'source'))))));
  }
  announce(`${r.title}: ${r.steps.length} steps`);
  return { el, title: 'System finder: ' + r.title, nav: 'construction' };
}
