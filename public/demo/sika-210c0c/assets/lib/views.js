// Page views. Each view(ctx) returns {el, title, nav} (nav = main navigation item to mark current).
import { h, icon, nf, plural, hashHref, announce, debounce, tokens, norm } from './util.js';
import { derived, data } from './data.js';
import { getSearcher } from './searcher.js';
import { productCard, categoryCard, breadcrumb, pager, emptyState, skeletonGrid, placeholder, addButton } from './components.js';

const PER_PAGE = 24;
let filtersOpen = false; // the filter panel (phones) stays open while filters are changed

/* ------------------------------------------------------------------ home */
export async function homeView(ctx) {
  const { cfg, openAssistant } = ctx; const dv = await derived();
  const stats = (await data.stats()) || {};
  const top = dv.catById.get('construction');
  const groups = (top ? top.children : []).map((id) => dv.catById.get(id)).filter(Boolean);
  const feat = dv.catById.get(cfg.home.featureCategory);
  const featKids = feat ? feat.children.map((id) => dv.catById.get(id)).filter(Boolean) : [];
  const searchInput = h('input', { id: 'hero-q', type: 'search', name: 'q', autocomplete: 'off', placeholder: cfg.home.heroPlaceholder, 'aria-label': 'Search products, systems and documents', enterkeyhint: 'search' });
  const form = h('form', { class: 'bigsearch search-box', role: 'search', onsubmit: (e) => { e.preventDefault(); location.hash = hashHref('/products', { q: searchInput.value.trim() }); } }, searchInput, h('button', { type: 'submit', 'aria-label': 'Search' }, icon('search', 'i--lg')));
  const persona = ctx.persona;
  const el = h('div', null,
    h('section', { class: 'hero' }, h('div', { class: 'container' },
      h('div', { class: 'helpbox' },
        h('h1', null, cfg.home.heroTitle),
        form,
        h('div', { class: 'chips' }, cfg.home.heroChips.map((c) => h('a', { class: 'chip', href: hashHref('/products', { q: c }) }, c))),
        h('p', { class: 'count count--hero' }, `Search ${nf.format(dv.index.length)} products${stats.documents ? ' and ' + nf.format(stats.documents) + ' documents' : ''} from the public website.`)),
      h('div', { class: 'helpbtns' },
        h('a', { class: 'btn btn--dark', href: '#/products' }, icon('search', 'i--sm'), 'Find a product'),
        h('a', { class: 'btn btn--dark', href: '#/system' }, icon('layers', 'i--sm'), 'System finder'),
        h('a', { class: 'btn btn--dark', href: '#/documents' }, icon('file', 'i--sm'), 'SDS and TDS'),
        h('button', { class: 'btn btn--dark', type: 'button', onclick: () => openAssistant() }, icon('chat', 'i--sm'), 'Advisor')))),
    persona ? persona : null,
    h('section', { class: 'section section--grey' }, h('div', { class: 'container' },
      h('div', { class: 'layout-head' }, h('h2', null, 'Explore the range'), h('p', null, 'Every product category on the public website, with its data sheets and safety data sheets.')),
      h('div', { class: 'grid--center' }, groups.map((c) => categoryCard(c, dv))))),
    feat ? h('section', { class: 'section' }, h('div', { class: 'container' },
      h('div', { class: 'layout-head' }, h('h2', null, cfg.home.featureTitle), h('p', null, feat.description || 'Adhesives, primers, waterproofing and grout for tiling, in one place.')),
      h('div', { class: 'grid--center c3' }, featKids.map((c) => categoryCard(c, dv))),
      h('div', { class: 'btn-row btn-row--center', style: 'margin-top:1.5rem' }, h('a', { class: 'btn', href: '#/category/' + feat.id }, `All ${nf.format(feat.productCount)} tile and stone products`)))) : null,
    h('section', { class: 'section section--grey' }, h('div', { class: 'container' },
      h('div', { class: 'layout-head' }, h('h2', null, 'Documents and resources')),
      h('div', { class: 'grid grid--3' },
        docCard('Product data sheets', 'The technical data for each product, as published.', '#/documents?type=product_data_sheet'),
        docCard('Safety data sheets', 'SDS for every product on the public website.', '#/documents?type=safety_data_sheet'),
        docCard('Guides and knowledge hub', 'How-to guides, case studies and technical articles.', '#/guides')))),
    h('section', { class: 'section' }, h('div', { class: 'container' },
      h('div', { class: 'layout-head' }, h('h2', null, 'Ask the product advisor'), h('p', null, 'Answers come from the published product documentation, with a source link on every answer. No AI model is called and nothing leaves your browser.')),
      h('div', { class: 'btn-row', style: 'justify-content:center' }, cfg.home.assistantQuestions.map((q) => h('button', { class: 'chip chip--line', type: 'button', onclick: () => openAssistant(q) }, q))))));
  return { el, title: 'Customer product portal', nav: null };
}
function docCard(title, text, href) {
  return h('article', { class: 'card' }, h('div', { class: 'card-body' }, h('h3', null, h('a', { class: 'card-link', href }, title)), h('p', null, text)));
}

/* ------------------------------------------------------------------ finder */
const catLabel = (dv, id) => (dv.catById.get(id) || {}).name || id;

export async function finderView(ctx) {
  const { params, cfg } = ctx;
  const dv = await derived(); const searcher = await getSearcher();
  const q = params.get('q') || ''; const cat = params.get('cat') || ''; const brand = (params.get('brand') || '').split(',').filter(Boolean);
  const docs = (params.get('docs') || '').split(',').filter(Boolean); const sort = params.get('sort') || ''; const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const res = searcher.search({ q, cat, brand, docs, sort });
  const pages = Math.max(1, Math.ceil(res.total / PER_PAGE)); const pg = Math.min(page, pages);
  const rows = res.rows.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);
  const set = (patch, replace = true) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) p.delete(k); else p.set(k, Array.isArray(v) ? v.join(',') : v); } if (!('page' in patch)) p.delete('page'); ctx.go('/products', p, replace); };

  // ---- filters
  const topLevel = (cat ? cat.split('/') : []);
  const roots = ['construction', 'industry', 'products'].filter((r) => res.facets.cats.has(r) || dv.catById.has(r));
  const level2 = [...res.facets.cats.keys()].filter((id) => id.split('/').length === 2);
  const selL2 = cat ? cat.split('/').slice(0, 2).join('/') : '';
  const level3 = selL2 ? [...res.facets.cats.keys()].filter((id) => id.startsWith(selL2 + '/') && id.split('/').length === 3) : [];
  const radio = (id, label, n, cls = '') => h('li', null, h('label', { class: 'fopt ' + cls }, h('input', { type: 'radio', name: 'cat', checked: cat === id, onchange: () => set({ cat: id }) }), h('span', null, label), h('span', { class: 'n' }, nf.format(n))));
  const catGroup = h('div', { class: 'fgroup' }, h('h3', null, 'Category'), h('ul', null,
    h('li', null, h('label', { class: 'fopt' }, h('input', { type: 'radio', name: 'cat', checked: !cat, onchange: () => set({ cat: '' }) }), h('span', null, 'All categories'), h('span', { class: 'n' }, nf.format([...res.facets.cats.entries()].filter(([id]) => !id.includes('/')).reduce((s, [, n]) => s + n, 0))))),
    ['construction', 'industry', 'products'].map((root) => { if (root === 'products') { const n = res.facets.cats.get('products'); return n ? [h('li', { class: 'fhead', 'aria-hidden': 'true' }, 'Other products'), radio('products', 'Other products', n)] : null; }
      const ids = level2.filter((id) => id.startsWith(root + '/')).sort((a, b) => catLabel(dv, a).localeCompare(catLabel(dv, b))); if (!ids.length) return null; return [h('li', { class: 'fhead', 'aria-hidden': 'true' }, root === 'construction' ? 'Residential & Commercial Construction' : 'Manufacturing & Automotive'), ids.map((id) => [radio(id, catLabel(dv, id), res.facets.cats.get(id)), id === selL2 ? level3.sort((a, b) => catLabel(dv, a).localeCompare(catLabel(dv, b))).map((k) => radio(k, catLabel(dv, k), res.facets.cats.get(k), 'child')) : null])]; })));
  const brands = [...dv.brands.keys()].sort();
  const brandGroup = h('div', { class: 'fgroup' }, h('h3', null, 'Brand'), h('ul', null, brands.map((b) => h('li', null, h('label', { class: 'fopt' }, h('input', { type: 'checkbox', checked: brand.includes(b), onchange: (e) => set({ brand: e.target.checked ? [...brand, b] : brand.filter((x) => x !== b) }) }), h('span', null, b), h('span', { class: 'n' }, nf.format(res.facets.brands.get(b) || 0)))))));
  const docGroup = h('div', { class: 'fgroup' }, h('h3', null, 'Documents available'), h('ul', null,
    [['pds', 'Product data sheet', res.facets.pds], ['sds', 'Safety data sheet', res.facets.sds]].map(([k, l, n]) => h('li', null, h('label', { class: 'fopt' }, h('input', { type: 'checkbox', checked: docs.includes(k), onchange: (e) => set({ docs: e.target.checked ? [...docs, k] : docs.filter((x) => x !== k) }) }), h('span', null, l), h('span', { class: 'n' }, nf.format(n)))))));
  const filtersBody = h('div', { class: 'filters-body' + (filtersOpen ? ' open' : ''), id: 'filters-body' }, catGroup, brandGroup, docGroup);
  const toggle = h('button', { class: 'btn btn--dark filters-toggle', type: 'button', 'aria-expanded': String(filtersOpen), 'aria-controls': 'filters-body', onclick: (e) => { filtersOpen = filtersBody.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(filtersOpen)); } }, h('span', { style: 'display:inline-flex;gap:.5rem;align-items:center' }, icon('filter', 'i--sm'), 'Filters'), icon('chevron-down', 'i--sm'));

  // ---- toolbar
  const input = h('input', { id: 'finder-q', type: 'search', value: q, autocomplete: 'off', placeholder: 'Search by name, use or substrate, e.g. "porcelain tile adhesive"', 'aria-label': 'Search products', enterkeyhint: 'search' });
  input.addEventListener('input', debounce(() => set({ q: input.value.trim() }), 220));
  const sortSel = h('select', { class: 'select', id: 'sort', 'aria-label': 'Sort results', onchange: (e) => set({ sort: e.target.value }) },
    [['', q ? 'Best match' : 'Category'], ['name', 'Name A to Z'], ['name-desc', 'Name Z to A'], ['docs', 'Most documents']].map(([v, l]) => h('option', { value: v, selected: v === sort }, l)));
  const toolbar = h('div', { class: 'toolbar' },
    h('div', { class: 'search-box' }, h('label', { for: 'finder-q' }, 'Search'), input),
    h('div', null, h('label', { for: 'sort' }, 'Sort by'), sortSel));

  // ---- active filters
  const pills = [];
  if (q) pills.push(pill(`Search: ${q}`, () => set({ q: '' })));
  if (cat) pills.push(pill(`Category: ${catLabel(dv, cat)}`, () => set({ cat: '' })));
  brand.forEach((b) => pills.push(pill(`Brand: ${b}`, () => set({ brand: brand.filter((x) => x !== b) }))));
  docs.forEach((d) => pills.push(pill(d === 'pds' ? 'Has data sheet' : 'Has SDS', () => set({ docs: docs.filter((x) => x !== d) }))));
  const resultline = h('div', { class: 'resultline', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'n' }, plural(res.total, 'product')), pills.length ? h('div', { class: 'pills' }, pills, h('button', { class: 'btn btn--text', type: 'button', onclick: () => ctx.go('/products', new URLSearchParams(), true) }, 'Clear all')) : null);

  let results;
  if (!res.total) {
    results = emptyState({ title: q ? `No products match "${q}"` : 'No products match these filters', text: 'Try fewer words, a different spelling, or clear a filter. You can also ask the advisor, which understands questions such as "what adhesive for porcelain on concrete".',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => ctx.go('/products', new URLSearchParams(), true) }, 'Clear all filters'), h('button', { class: 'btn btn--dark', type: 'button', onclick: () => ctx.openAssistant(q) }, 'Ask the advisor')] });
  } else {
    results = h('div', { class: 'grid grid--3' }, rows.map((p) => productCard(p, dv)));
  }
  const pgr = pager({ page: pg, pages, onPage: (p) => { set({ page: String(p) }, false); window.scrollTo({ top: 0 }); } });
  const crumbs = breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Product finder' }]);
  const el = h('div', { class: 'container' }, crumbs,
    h('div', { class: 'page-head' }, h('h1', null, 'Find a product')),
    h('div', { class: 'finder' }, h('aside', { class: 'filters', 'aria-label': 'Filters' }, toggle, filtersBody), h('section', { class: 'results', 'aria-label': 'Results' }, toolbar, resultline, results, pgr)));
  if (res.total) announce(`${plural(res.total, 'product')} found`); else announce('No products found');
  return { el, title: q ? `Search: ${q}` : 'Find a product', nav: null };
}
function pill(text, onRemove) { return h('span', { class: 'pill' }, text, h('button', { type: 'button', 'aria-label': 'Remove filter: ' + text, onclick: onRemove }, icon('close', 'i--sm'))); }

/* ------------------------------------------------------------------ category */
export async function categoryView(ctx) {
  const dv = await derived(); const id = ctx.rest; const c = dv.catById.get(id);
  if (!c) return notFound(ctx, 'category');
  const kids = (c.children || []).map((k) => dv.catById.get(k)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const path = id.split('/'); const crumbs = [{ label: 'Home', href: '#/' }];
  path.slice(0, -1).forEach((_, i) => { const a = dv.catById.get(path.slice(0, i + 1).join('/')); if (a) crumbs.push({ label: a.name, href: '#/category/' + a.id }); });
  crumbs.push({ label: c.name });
  const searcher = await getSearcher(); const res = searcher.search({ cat: id });
  const prods = res.rows.slice(0, kids.length ? 8 : 48);
  const el = h('div', { class: 'container' }, breadcrumb(crumbs),
    h('div', { class: 'page-head' }, h('h1', null, c.name), c.description ? h('p', { class: 'lead', style: 'max-width:60rem' }, c.description) : null,
      h('p', { class: 'count' }, `${plural(c.productCount, 'product')} in this category`),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: hashHref('/products', { cat: id }) }, 'Filter and search these products'), c.url ? h('a', { class: 'btn btn--hollow link--ext', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, 'View on the company website') : null)),
    kids.length ? h('section', { class: 'section section--tight' }, h('div', { class: 'layout-head' }, h('h2', null, 'Browse by type')), h('div', { class: 'grid grid--3' }, kids.map((k) => categoryCard(k, dv)))) : null,
    h('section', { class: 'section section--tight' }, h('div', { class: 'layout-head' }, h('h2', null, kids.length ? 'Products in this range' : 'Products')),
      prods.length ? h('div', { class: 'grid grid--3' }, prods.map((p) => productCard(p, dv))) : emptyState({ title: 'No products listed here', text: 'This is a grouping page on the public website.' }),
      res.total > prods.length ? h('div', { class: 'btn-row', style: 'justify-content:center;margin-top:1.5rem' }, h('a', { class: 'btn', href: hashHref('/products', { cat: id }) }, `See all ${nf.format(res.total)} products`)) : null));
  return { el, title: c.name, nav: path[0] === 'industry' ? 'industry' : 'construction' };
}

export function notFound(ctx, what = 'page') {
  const el = h('div', { class: 'container section' }, emptyState({ title: `We could not find that ${what}`, text: 'It may have been renamed. Try the product finder.', actions: [h('a', { class: 'btn', href: '#/products' }, 'Find a product'), h('a', { class: 'btn btn--hollow', href: '#/' }, 'Home')] }));
  return { el, title: 'Not found', nav: null };
}
