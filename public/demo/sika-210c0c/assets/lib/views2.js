// Product detail, documents library, guides.
import { h, icon, nf, plural, hashHref, announce, debounce, tokens, norm, fmtBytes, titleCase } from './util.js';
import { derived, data, documents, docOk, docHref } from './data.js';
import { getSearcher } from './searcher.js';
import { productCard, breadcrumb, pager, emptyState, placeholder, addButton } from './components.js';
import { notFound } from './views.js';
import { specPanel } from './specs.js';

const TYPE_LABEL = { product_data_sheet: 'Product data sheet', safety_data_sheet: 'Safety data sheet', brochure: 'Brochure', environmental_product_declaration: 'Environmental declaration', system_data_sheet: 'System data sheet', certificate: 'Certificate', guide: 'Guide', technical_information: 'Technical information', colour_chart: 'Colour chart', reference: 'Reference', document: 'Other document', '': 'Other document' };
export const typeLabel = (t) => TYPE_LABEL[t] || titleCase(t || 'document');

/** Text with " | " rows becomes a small table; other lines become paragraphs. */
export function renderText(text) {
  const lines = String(text || '').split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    if (lines[i].includes(' | ')) {
      const rows = []; while (i < lines.length && lines[i].includes(' | ')) rows.push(lines[i++].split(' | ').map((c) => c.trim()));
      out.push(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c))))))));
    } else { if (lines[i].trim()) out.push(h('p', { style: 'margin-bottom:.5rem' }, lines[i])); i++; }
  }
  return out;
}

function accordion(sections) {
  const wrap = h('div', { class: 'accordion' });
  sections.forEach((s, i) => {
    const bid = `acc-${i}-${Math.random().toString(36).slice(2, 7)}`;
    const isFaq = /\?$/.test(s.title);
    const panel = h('div', { class: 'acc-panel', id: bid + '-p', role: 'region', 'aria-labelledby': bid + '-b', hidden: true },
      isFaq ? s.items.map((it) => renderText([it.label, it.text].filter(Boolean).join('\n'))) :
        h('dl', null, s.items.filter((it) => it.label || it.text).map((it) => [h('dt', null, it.label || ''), h('dd', null, renderText(it.text))])));
    const btn = h('button', { class: 'acc-btn', id: bid + '-b', type: 'button', 'aria-expanded': 'false', 'aria-controls': bid + '-p', onclick: () => { const on = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(on)); panel.hidden = !on; } }, h('span', null, s.title), h('span', { class: 'pm', 'aria-hidden': 'true' }));
    wrap.append(h('div', { class: 'acc-item' }, h('h3', null, btn), panel));
  });
  return wrap;
}

function docRow(d, dv, withProduct = false) {
  const ok = docOk(d);
  const prod = withProduct && d.products && d.products[0] && dv.byId.get(d.products[0]);
  return h('tr', null,
    h('td', null, ok ? h('a', { class: 'link doc-ico link--ext', href: docHref(d), target: '_blank', rel: 'noopener noreferrer' }, icon('file', 'i--sm'), d.title || d.file) : h('span', { class: 'doc-ico' }, icon('file', 'i--sm'), d.title || d.file, ' ', h('span', { class: 'badge badge--warn', title: 'The public link did not respond when checked on the build date' }, 'Link unavailable'))),
    h('td', null, typeLabel(d.type)), h('td', null, d.format || 'PDF'),
    h('td', { class: 'num' }, fmtBytes(d.bytes)), h('td', { class: 'num' }, d.version || ''),
    withProduct ? h('td', null, prod ? h('a', { class: 'link', href: '#/product/' + prod.id }, prod.n) : '') : null);
}

/* ------------------------------------------------------------------ product detail */
export async function productView(ctx) {
  const id = ctx.rest; const dv = await derived();
  let p; try { p = await data.product(id); } catch { return notFound(ctx, 'product'); }
  const specIdx = await data.specIndex(); const hasSpec = !!(specIdx && specIdx.ids.includes(id));
  const docs = (p.docs || []); const okDocs = docs.filter(docOk);
  const pds = okDocs.find((d) => d.type === 'product_data_sheet'); const sds = okDocs.find((d) => d.type === 'safety_data_sheet');
  const path = p.categoryPath; const crumbs = [{ label: 'Home', href: '#/' }];
  path.forEach((_, i) => { const c = dv.catById.get(path.slice(0, i + 1).join('/')); if (c) crumbs.push({ label: c.name, href: '#/category/' + c.id }); });
  crumbs.push({ label: p.name });

  const DETAIL = ['Product Information', 'Technical Information', 'System information', 'Sustainability / Certifications / Approvals'];
  const APPLIC = ['Application Information', 'Consumption', 'Application steps'];
  const faq = p.sections.filter((s) => /\?$/.test(s.title));
  const detail = p.sections.filter((s) => DETAIL.includes(s.title)); const applic = p.sections.filter((s) => APPLIC.includes(s.title));
  const other = p.sections.filter((s) => !faq.includes(s) && !detail.includes(s) && !applic.includes(s));

  const tabs = [];
  tabs.push({ id: 'overview', label: 'Overview', body: () => h('div', null,
    h('div', { class: 'cols-2' },
      p.usage.length ? h('div', { class: 'under' }, h('h3', null, 'Usage'), h('ul', null, p.usage.map((u) => h('li', null, u)))) : null,
      p.advantages.length ? h('div', { class: 'under' }, h('h3', null, 'Advantages'), h('ul', null, p.advantages.map((u) => h('li', null, u)))) : null),
    p.packaging ? h('div', { class: 'under', style: 'margin-top:1.5rem;max-width:34rem' }, h('h3', null, 'Packaging'), h('p', null, p.packaging)) : null,
    !p.usage.length && !p.advantages.length && !p.packaging ? h('p', null, p.summary || 'See the product data sheet for details.') : null) });
  if (detail.length || other.length) tabs.push({ id: 'details', label: 'Product details', body: () => accordion([...detail, ...other]) });
  if (applic.length) tabs.push({ id: 'application', label: 'Application', body: () => accordion(applic) });
  if (hasSpec) tabs.push({ id: 'specification', label: 'Specification', body: () => specPanel(p, ctx.cfg) });
  if (faq.length) tabs.push({ id: 'faq', label: 'FAQs', body: () => accordion(faq) });
  tabs.push({ id: 'documents', label: `Documents (${docs.length})`, body: () => docs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Document', 'Type', 'Format', 'Size', 'Version'].map((x, i) => h('th', { class: i > 2 ? 'num' : '' }, x)))), h('tbody', null, docs.map((d) => docRow(d, dv))))) : h('p', null, 'No documents are listed on the public product page. Check the company website or contact technical services.') });
  const want = ctx.params.get('tab'); let active = Math.max(0, tabs.findIndex((t) => t.id === want));
  const panelHost = h('div', { class: 'tabpanel', id: 'tabpanel', role: 'tabpanel', tabindex: '0' });
  const tablist = h('ul', { class: 'tablist', role: 'tablist', 'aria-label': 'Product information' });
  const tabBtns = tabs.map((t, i) => h('button', { type: 'button', role: 'tab', id: 'tab-' + t.id, 'aria-selected': 'false', 'aria-controls': 'tabpanel', tabindex: '-1', onclick: () => select(i), onkeydown: (e) => { const k = e.key; let n = null; if (k === 'ArrowRight') n = (i + 1) % tabs.length; else if (k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length; else if (k === 'Home') n = 0; else if (k === 'End') n = tabs.length - 1; if (n !== null) { e.preventDefault(); select(n, true); } } }, t.label));
  tabBtns.forEach((b) => tablist.append(h('li', { role: 'presentation' }, b)));
  function select(i, focus) { active = i; tabBtns.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; }); panelHost.setAttribute('aria-labelledby', 'tab-' + tabs[i].id); panelHost.replaceChildren(tabs[i].body()); if (focus) tabBtns[i].focus(); const u = new URLSearchParams(ctx.params); u.set('tab', tabs[i].id); history.replaceState(null, '', hashHref('/product/' + id, Object.fromEntries(u))); }

  const heroBtns = h('div', { class: 'docbar' },
    pds ? h('a', { class: 'btn btn--text', href: docHref(pds), target: '_blank', rel: 'noopener noreferrer' }, icon('download', 'i--sm'), 'Product data sheet') : null,
    sds ? h('a', { class: 'btn btn--text', href: docHref(sds), target: '_blank', rel: 'noopener noreferrer' }, icon('download', 'i--sm'), 'Safety data sheet') : null,
    docs.length ? h('button', { class: 'btn btn--text', type: 'button', onclick: () => { const i = tabs.findIndex((t) => t.id === 'documents'); select(i); document.getElementById('tabpanel').scrollIntoView({ block: 'start' }); } }, 'Show all documents') : null);

  const related = relatedProducts(p, dv);
  const el = h('div', { class: 'container' }, breadcrumb(crumbs),
    h('div', { class: 'pdp' },
      h('div', null, h('div', { class: 'pdp-media' }, placeholder(p.category, p.name))),
      h('div', null,
        h('p', { class: 'eyebrow' }, p.brand),
        h('h1', null, p.name),
        p.tagline ? h('p', { class: 'tagline' }, p.tagline) : null,
        p.summary && p.summary !== p.tagline ? h('p', { class: 'lead' }, p.summary) : null,
        p.attributes.length ? h('ul', { class: 'checklist' }, p.attributes.map((a) => h('li', null, icon('checkbox'), h('span', null, a)))) : null,
        h('div', { class: 'btn-row', style: 'margin-top:1rem' }, addButton(p.id, p.name), h('button', { class: 'btn btn--dark', type: 'button', onclick: () => ctx.openAssistant(`How much ${p.name} do I need for 40 m2?`) }, icon('chat', 'i--sm'), 'Ask the advisor')),
        heroBtns,
        h('p', { class: 'source-line' }, 'Source: ', h('a', { class: 'link link--ext', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'this product on the company website'), `, read ${String(p.fetched || '').slice(0, 10)}.`))),
    h('div', { class: 'tabs' }, tablist), panelHost,
    related.length ? h('section', { class: 'section' }, h('div', { class: 'layout-head' }, h('h2', null, 'Related products')), h('div', { class: 'grid grid--4' }, related.map((r) => productCard(r, dv)))) : null);
  select(active);
  return { el, title: p.name, nav: path[0] === 'industry' ? 'industry' : 'construction' };
}

function relatedProducts(p, dv) {
  const same = dv.index.filter((x) => x.c === p.category && x.id !== p.id);
  const pool = same.length >= 4 ? same : [...same, ...dv.index.filter((x) => x.c !== p.category && x.c.split('/').slice(0, 2).join('/') === p.category.split('/').slice(0, 2).join('/'))];
  // prefer the same brand, then those with data sheets
  return pool.sort((a, b) => (b.b === p.brand) - (a.b === p.brand) || (b.pds - a.pds) || a.n.localeCompare(b.n)).slice(0, 4);
}

/* ------------------------------------------------------------------ documents library */
const TYPE_CHIPS = [['', 'All documents'], ['product_data_sheet', 'Product data sheets'], ['safety_data_sheet', 'Safety data sheets'], ['system_data_sheet', 'System data sheets'], ['brochure', 'Brochures'], ['environmental_product_declaration', 'Environmental declarations'], ['other', 'Other']];
const DOC_PER = 30;
export async function documentsView(ctx) {
  const { params } = ctx; const dv = await derived(); const D = await documents();
  const type = params.get('type') || ''; const q = params.get('q') || ''; const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const known = new Set(['product_data_sheet', 'safety_data_sheet', 'system_data_sheet', 'brochure', 'environmental_product_declaration']);
  const typeOf = (d) => (known.has(d.type) ? d.type : 'other');
  const qt = tokens(q);
  const text = (d) => norm((d.title || '') + ' ' + (d.file || '') + ' ' + ((d.products && d.products[0] && (dv.byId.get(d.products[0]) || {}).n) || ''));
  const counts = new Map(); let base = D.docs.filter((d) => { const t = text(d); return qt.every((w) => t.includes(w)); });
  for (const d of base) counts.set(typeOf(d), (counts.get(typeOf(d)) || 0) + 1);
  const rowsAll = base.filter((d) => !type || typeOf(d) === type).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'en', { sensitivity: 'base' }));
  const pages = Math.max(1, Math.ceil(rowsAll.length / DOC_PER)); const pg = Math.min(page, pages);
  const rows = rowsAll.slice((pg - 1) * DOC_PER, pg * DOC_PER);
  const set = (patch, replace = true) => { const u = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); } if (!('page' in patch)) u.delete('page'); ctx.go('/documents', u, replace); };
  const input = h('input', { id: 'doc-q', type: 'search', value: q, autocomplete: 'off', placeholder: 'Search by product or document name', 'aria-label': 'Search documents', enterkeyhint: 'search' });
  input.addEventListener('input', debounce(() => set({ q: input.value.trim() }), 220));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Document type', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:1rem 0' }, TYPE_CHIPS.map(([v, l]) => h('button', { type: 'button', class: 'chip chip--line', 'aria-pressed': String(type === v), onclick: () => set({ type: v }) }, l, v ? h('span', { class: 'count', style: 'margin-left:.25rem' }, `(${nf.format(counts.get(v) || 0)})`) : h('span', { class: 'count', style: 'margin-left:.25rem' }, `(${nf.format(base.length)})`))));
  const unavailable = D.docs.filter((d) => !docOk(d)).length;
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Documents' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Data sheets and documents'), h('p', { class: 'lead', style: 'max-width:60rem' }, `${nf.format(D.docs.length)} public documents listed on the company website: product data sheets, safety data sheets, brochures and certificates. Each link opens the original file on the company website.`)),
    h('div', { class: 'search-box', style: 'max-width:40rem' }, h('label', { class: 'visually-hidden', for: 'doc-q' }, 'Search documents'), input, h('button', { type: 'button', 'aria-label': 'Search', onclick: () => set({ q: input.value.trim() }) }, icon('search'))),
    chips,
    h('div', { class: 'resultline', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'n' }, plural(rowsAll.length, 'document')), D.checked && unavailable ? h('span', { class: 'count' }, `${nf.format(unavailable)} links did not respond when checked and are marked.`) : null),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Document', 'Type', 'Format', 'Size', 'Version', 'Product'].map((x, i) => h('th', { class: i === 3 || i === 4 ? 'num' : '' }, x)))), h('tbody', null, rows.map((d) => docRow(d, dv, true))))) : emptyState({ title: 'No documents match', text: 'Try a product name such as "Sikaflex" or "Davco grout", or clear the type filter.', actions: [h('button', { class: 'btn', type: 'button', onclick: () => ctx.go('/documents', new URLSearchParams(), true) }, 'Clear filters')] }),
    pager({ page: pg, pages, onPage: (p) => { set({ page: String(p) }, false); window.scrollTo({ top: 0 }); } }),
    h('div', { style: 'height:2rem' }));
  announce(`${plural(rowsAll.length, 'document')}`);
  return { el, title: 'Data sheets and documents', nav: 'docs' };
}

/* ------------------------------------------------------------------ guides */
const SECTION_LABEL = { 'knowledge-hub': 'Knowledge hub', 'documents-resources': 'Documents and resources', 'home-owners': 'Home owners', 'local-projects': 'Local projects', 'international-reference-projects': 'Reference projects', 'solutions-for-projects': 'Solutions for projects', industry: 'Industry guides', 'where-to-buy': 'Where to buy', 'Remedial-Solutions': 'Remedial solutions', '3-must-haves': 'Trade guides' };
export async function guidesView(ctx) {
  const { params } = ctx; const pages = (await data.pages()).filter((p) => p.kind === 'guide' || p.kind === undefined);
  const q = params.get('q') || ''; const sec = params.get('s') || ''; const qt = tokens(q);
  const hay = (p) => norm(p.title + ' ' + (p.metaDescription || '') + ' ' + (p.excerpt || '') + ' ' + (p.headings || []).join(' '));
  const base = pages.filter((p) => qt.every((w) => hay(p).includes(w)));
  const bySec = new Map(); for (const p of base) bySec.set(p.section, (bySec.get(p.section) || 0) + 1);
  const rows = base.filter((p) => !sec || p.section === sec);
  const set = (patch) => { const u = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); } ctx.go('/guides', u, true); };
  const input = h('input', { id: 'guide-q', type: 'search', value: q, autocomplete: 'off', placeholder: 'Search guides, case studies and articles', 'aria-label': 'Search guides', enterkeyhint: 'search' });
  input.addEventListener('input', debounce(() => set({ q: input.value.trim() }), 220));
  const secs = [...new Set(pages.map((p) => p.section))].sort((a, b) => (SECTION_LABEL[a] || a).localeCompare(SECTION_LABEL[b] || b));
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Guides' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Guides and knowledge hub'), h('p', { class: 'lead', style: 'max-width:60rem' }, 'How-to guides, technical articles and project case studies from the public website. Each card links to the original page.')),
    h('div', { class: 'search-box', style: 'max-width:40rem' }, h('label', { class: 'visually-hidden', for: 'guide-q' }, 'Search guides'), input, h('button', { type: 'button', 'aria-label': 'Search', onclick: () => set({ q: input.value.trim() }) }, icon('search'))),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Section', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:1rem 0' }, [['', 'All', base.length], ...secs.map((s) => [s, SECTION_LABEL[s] || titleCase(s), bySec.get(s) || 0])].map(([v, l, n]) => h('button', { type: 'button', class: 'chip chip--line', 'aria-pressed': String(sec === v), onclick: () => set({ s: v }) }, l, h('span', { class: 'count', style: 'margin-left:.25rem' }, `(${nf.format(n)})`)))),
    h('div', { class: 'resultline', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'n' }, plural(rows.length, 'guide'))),
    rows.length ? h('div', { class: 'grid grid--3' }, rows.slice(0, 60).map((p) => h('article', { class: 'card' }, h('div', { class: 'card-body' }, h('div', { class: 'eyebrow' }, SECTION_LABEL[p.section] || titleCase(p.section)), h('h3', null, h('a', { class: 'card-link', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, p.title)), (p.metaDescription || p.excerpt) ? h('p', { class: 'clamp-3' }, p.metaDescription || p.excerpt) : null, h('p', { class: 'count' }, 'Opens on the company website'))))) : emptyState({ title: 'No guides match', text: 'Try a shorter search or clear the section filter.', actions: [h('button', { class: 'btn', type: 'button', onclick: () => ctx.go('/guides', new URLSearchParams(), true) }, 'Clear filters')] }),
    rows.length > 60 ? h('p', { class: 'count', style: 'margin-top:1rem' }, `Showing the first 60 of ${nf.format(rows.length)}. Narrow the search to see the rest.`) : null,
    h('div', { style: 'height:2rem' }));
  announce(`${plural(rows.length, 'guide')}`);
  return { el, title: 'Guides and knowledge hub', nav: 'docs' };
}
