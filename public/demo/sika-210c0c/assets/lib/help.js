// Problem solver view (T22), route #/help. Symptom chips; each shows verbatim passages from the published product pages, with the source link,
// then the Technical Services hand-off. It does not diagnose. If data/knowledge/problems.json is not present it says so instead of failing.
import { h, icon } from './util.js';
import { data } from './data.js';
import { breadcrumb } from './components.js';
import { buildHandoff } from '../assistant/handoff.js';
import { renderHandoff } from './handoff-ui.js';

const ext = (href, label) => h('a', { href, class: 'link', target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));

function result(chip, cfg) {
  const box = h('div', { class: 'help-result', id: 'help-result', tabindex: '-1', 'aria-live': 'polite' });
  if (chip.items.length) {
    box.append(h('h2', { class: 'h4' }, chip.label),
      h('p', null, `I cannot diagnose this. The published product pages mention it in ${chip.items.length} place${chip.items.length === 1 ? '' : 's'}. This is what they say, word for word.`),
      h('ul', { class: 'help-list', style: 'list-style:none;padding:0;display:grid;gap:.75rem' }, chip.items.map((i) => h('li', { class: 'help-item' },
        h('blockquote', { style: 'margin:0;padding-left:.75rem;border-left:4px solid var(--primary,#ffc510)' }, i.quote),
        h('p', { class: 'cite' }, 'The published page for ', h('a', { href: '#/product/' + encodeURIComponent(i.product) }, i.name), ' says this (', i.where, '). ', ext(i.url, 'Source on aus.sika.com'))))));
  } else {
    box.append(h('h2', { class: 'h4' }, chip.label), h('p', null, 'The published product pages I hold do not say anything about this. I will not guess.'));
  }
  box.append(renderHandoff(buildHandoff({ query: chip.label, products: chip.products.slice(0, 3), reason: chip.items.length ? 'This is as far as the published text goes. It does not diagnose your job.' : 'This is not in the published data I hold.', config: cfg })));
  return box;
}

export async function helpView(ctx) {
  const { cfg } = ctx;
  const p = await data.knowledge('problems');
  const head = [breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Problem solver' }]), h('div', { class: 'page-head' }, h('h1', null, 'Problem solver'))];
  if (!p || !Array.isArray(p.chips)) {
    return { el: h('div', { class: 'container' }, ...head, h('p', null, 'The problem solver is not available in this demo.')), title: 'Problem solver', nav: null };
  }
  const out = h('div', { id: 'help-out' });
  const chips = h('div', { class: 'opts', role: 'group', 'aria-label': 'Symptoms' }, p.chips.map((c) => h('button', {
    class: 'chip', type: 'button', 'aria-pressed': 'false', 'data-chip': c.id,
    onclick: (e) => { chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); out.replaceChildren(result(c, cfg)); const r = out.firstElementChild; if (r) r.focus({ preventScroll: false }); },
  }, c.label)));
  const el = h('div', { class: 'container' }, ...head,
    h('div', { class: 'prose', style: 'max-width:52rem' },
      h('p', { class: 'lead' }, 'Pick what you can see. You get the published wording that mentions it, with the page it came from.'),
      h('div', { class: 'notice' }, icon('info'), h('span', null, `It does not diagnose. It shows passages from ${cfg.company.publishedDocsPhrase} (product pages, read ${p.generated}). Where the pages say nothing, it hands you to Technical Services with your context.`)),
      chips, out));
  return { el, title: 'Problem solver', nav: null };
}
