// Guided system selector: three questions (tile, surface, location) -> the ordered system on one keepable sheet (a static page with its own URL).
// The options and the combinations that exist come from data/selector.json, built from the published product documentation.
import { h, icon, nf, announce } from './util.js';
import { data } from './data.js';
import { breadcrumb, emptyState } from './components.js';

const base = new URL('../../', import.meta.url); // demo root, so links to the static sheets work under any prefix

export async function selectorView(ctx) {
  const sel = await data.selector();
  if (!sel) return { el: h('div', { class: 'container section' }, emptyState({ title: 'The selector data is not available in this build.', actions: [h('a', { class: 'btn', href: '#/products' }, 'Find a product')] })), title: 'System selector', nav: null };
  const Q = Object.fromEntries(sel.questions.map((q) => [q.id, q]));
  const p = ctx.params; const get = (k) => (p.get(k) || '');
  let tile = get('tile'), substrate = get('substrate'), location = get('location'), m2 = get('m2') || '';
  const pairKey = () => `${tile}|${substrate}`;
  const tileHas = (t) => (Q.tile.options.find((o) => o.id === t) || {}).hasSystems !== false;
  const substrateOk = (t, s) => Boolean(sel.locationsByPair[`${t}|${s}`]);
  const locationOk = (t, s, l) => (sel.locationsByPair[`${t}|${s}`] || []).includes(l);
  if (tile && !tileHas(tile)) substrate = location = '';
  if (tile && substrate && !substrateOk(tile, substrate)) { substrate = ''; location = ''; }
  if (tile && substrate && location && !locationOk(tile, substrate, location)) location = '';
  const setParams = (patch) => { const u = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); } ctx.go('/selector', u, true); };

  const group = (id, legend, options, current, enabled, hint) => h('fieldset', { class: 'sel-group' }, h('legend', null, h('span', { class: 'sel-n' }, id === 'tile' ? '1' : id === 'substrate' ? '2' : '3'), legend),
    hint ? h('p', { class: 'count', style: 'margin:.25rem 0 .75rem' }, hint) : null,
    h('div', { class: 'sel-opts' }, options.map((o) => { const on = enabled(o); return h('label', { class: 'sel-opt' + (on ? '' : ' is-off') }, h('input', { type: 'radio', name: id, value: o.id, checked: current === o.id, disabled: !on ? true : null, onchange: () => setParams(id === 'tile' ? { tile: o.id, substrate: '', location: '' } : id === 'substrate' ? { substrate: o.id, location: '' } : { location: o.id }) }), h('span', null, o.label, !on ? h('small', null, ' Not stated in the documentation') : null)); })));

  const gTile = group('tile', Q.tile.label, Q.tile.options, tile, (o) => o.hasSystems !== false);
  const gSub = tile ? group('substrate', Q.substrate.label, Q.substrate.options, substrate, (o) => substrateOk(tile, o.id)) : h('p', { class: 'count' }, 'Choose a tile type first.');
  const gLoc = tile && substrate ? group('location', Q.location.label, Q.location.options, location, (o) => locationOk(tile, substrate, o.id)) : null;

  let result = null;
  if (tile && !tileHas(tile)) result = h('div', { class: 'notice' }, icon('info'), h('span', null, sel.noSystemMessage));
  if (tile && substrate && location) {
    const slug = sel.slugs[`${tile}|${substrate}|${location}`];
    const areaIn = h('input', { class: 'input', id: 'sel-m2', type: 'number', min: '1', step: 'any', inputmode: 'decimal', value: m2, placeholder: 'e.g. 40', 'aria-describedby': 'sel-m2-h' });
    const label = (q, id) => (Q[q].options.find((o) => o.id === id) || {}).label || id;
    if (slug) {
      const go = h('a', { class: 'btn', id: 'sel-go', href: new URL(`systems/${slug}/`, base).href + (m2 ? `?m2=${encodeURIComponent(m2)}` : '') }, icon('arrow-right', 'i--sm'), 'Show my system');
      areaIn.addEventListener('input', () => { const v = areaIn.value.trim(); go.href = new URL(`systems/${slug}/`, base).href + (v ? `?m2=${encodeURIComponent(v)}` : ''); });
      result = h('section', { class: 'sel-result', 'aria-labelledby': 'sel-r-h' },
        h('h2', { id: 'sel-r-h', class: 'h4' }, 'Your system is ready'),
        h('p', null, `${label('tile', tile)} on ${label('substrate', substrate).toLowerCase()}, ${label('location', location).toLowerCase()}.`),
        h('ul', { class: 'checklist' }, ['Ordered steps: prepare and prime, waterproofing membrane where the location needs one, adhesive, grout, movement joints', 'The published coverage for your area, with the source beside every number', 'Data sheets and safety data sheets, printable on one page, with its own link'].map((t) => h('li', null, icon('checkbox'), h('span', null, t)))),
        h('div', { class: 'field', style: 'max-width:18rem' }, h('label', { for: 'sel-m2' }, 'Area to tile (m2)', h('span', { class: 'hint', id: 'sel-m2-h' }, 'Optional. You can change it on the sheet.')), areaIn),
        h('div', { class: 'btn-row', style: 'margin-top:1rem' }, go),
        h('p', { class: 'source-line' }, 'This is an estimate, not an offer. It gives quantities only. Confirm with the product data sheet and Sika Technical Services.'));
    } else result = h('div', { class: 'notice' }, icon('info'), h('span', null, sel.noSystemMessage));
  }
  const all = Object.keys(sel.slugs).length;
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'System selector' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Tiling system selector'),
      h('p', { class: 'lead', style: 'max-width:60rem' }, 'Three questions, one page. Get the ordered system for your job with the published coverage for your area, built only from the product documentation and with the source beside every statement.')),
    h('div', { class: 'sel' }, h('div', null, gTile, gSub, gLoc, result), h('aside', { class: 'sel-aside', 'aria-label': 'About the selector' },
      h('h2', { class: 'h5' }, 'How it works'),
      h('ul', null, h('li', null, 'Every product named here is in the published documentation for your answers.'), h('li', null, 'Where the documentation is silent a step says "Not stated in the published documentation".'), h('li', null, 'No model is called. The page is plain text and loads in a fraction of a second.')),
      h('p', null, h('a', { class: 'link', href: new URL('systems/', base).href }, `Browse all ${nf.format(all)} system sheets`)))));
  announce(result && result.id === undefined ? 'Your system is ready.' : '');
  return { el, title: 'System selector', nav: 'construction' };
}
