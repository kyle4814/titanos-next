// "How complete is this?" panel for the About page. Numbers come from data/coverage.json, which is computed at build time
// (demo-tests/sika-210c0c/build_coverage.mjs) from the product data and the verified rate facts. Nothing here is typed by hand.
import { h, nf } from './util.js';
import { data } from './data.js';

export async function coveragePanel() {
  const m = await data.manifest();
  if (!m.files.includes('coverage.json')) return null;
  const r = await fetch(new URL('../../data/coverage.json', import.meta.url));
  if (!r.ok) return null;
  const c = await r.json(); const t = c.tileStone;
  return h('section', { 'aria-labelledby': 'cov-h', id: 'coverage' },
    h('h2', { id: 'cov-h', class: 'h4' }, 'How complete is this?'),
    h('p', { id: 'cov-line' }, `For ${nf.format(t.ratePublished)} of ${nf.format(t.products)} tile and stone products the consumption rate is published on the data sheet or the product page. For the other ${nf.format(t.products - t.ratePublished)} the advisor says so and sends you to the data sheet.`),
    h('p', null, `This build holds ${nf.format(c.products)} products and ${nf.format(c.documents)} documents from the public website, built on ${c.builtOn}. Every rate the advisor shows links to the page of the published document it was read from.`));
}
