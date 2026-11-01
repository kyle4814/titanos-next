// My projects and the demo-only quote request, plus the About page.
import { offlinePanel } from './offline-ui.js';
import { h, icon, nf, plural, announce, fmtBytes } from './util.js';
import { coveragePanel } from './coverage_panel.js';
import { derived, data, documents } from './data.js';
import { breadcrumb, emptyState, placeholder } from './components.js';
import { projects, projectStore, UNITS } from './projects.js';
import { buildJobPack } from './projectstore.js';
import { bomSection } from './finder/bom.js';
import { estimateNote } from './terms.js';

const ROLES = ['Distributor or merchant', 'Applicator or tradesperson', 'Builder or contractor', 'Specifier or architect', 'Engineer', 'Home owner', 'Other'];

const SOURCE_TEXT = { bot: 'Added by the advisor', finder: 'Added from the finder with its quantity', portal: 'Added on this page', migrated: 'Carried over from an earlier saved project' };
const saveBlob = (text, name, type) => { try { const url = URL.createObjectURL(new Blob([text], { type })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); announce(`${name} downloaded`); } catch { /* ignore */ } };


export async function projectsView(ctx) {
  const dv = await derived(); const { cfg } = ctx;
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'My projects and quotes' }]));
  const head = h('div', { class: 'page-head' }, h('h1', null, 'My projects and quotes'),
    h('p', { class: 'lead', style: 'max-width:60rem' }, 'Collect the products for a job, set quantities and prepare a quote request. Anything the product advisor adds for you appears here, and what you change here the advisor sees on its next answer.'),
    h('p', { class: 'notice' }, icon('info'), h('span', null, h('span', { class: 'demo-only' }, 'Demo only'), ' This list is kept in your browser on this device. The quote request below ', h('strong', null, 'submits nowhere'), ': there is no server behind this demo, so nothing is sent, stored or shared.')));
  const cartBox = h('div', { id: 'cart-box' });
  el.append(head, cartBox, quoteForm(ctx, dv));
  const render = () => {
    cartBox.replaceChildren();
    const list = projects.list(); const proj = projectStore.currentProject();
    const extra = proj ? proj.systems.length + proj.documents.length + proj.notes.length + (proj.calculations || []).length : 0;
    if (!list.length && !extra) { cartBox.append(emptyState({ title: 'Your project is empty', text: 'Add products from the finder or from any product page, or ask the advisor and say "add this to my project". Then come back here to set quantities and prepare a quote request.', actions: [h('a', { class: 'btn', href: '#/products' }, 'Find a product'), h('button', { class: 'btn btn--dark', type: 'button', onclick: () => ctx.openAssistant('What do I need for 40 m2 of floor tiles?') }, 'Ask the advisor')] })); return; }
    const all = projectStore.list();
    const bar = all.length > 1 ? h('div', { class: 'proj-switch no-print' }, h('label', { for: 'proj-pick' }, 'Project '), h('select', { class: 'select', id: 'proj-pick', onchange: (e) => { projectStore.use(e.target.value); render(); } }, all.map((x) => h('option', { value: x.name, selected: x.name === (proj && proj.name) }, x.name)))) : null;
    const lines = list.map((it) => {
      const p = dv.byId.get(it.id); const name = (p && p.n) || it.name || it.id;
      const qty = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: String(it.qty), 'aria-label': `Quantity of ${name}`, onchange: (e) => { const v = Math.max(1, parseInt(e.target.value || '1', 10) || 1); e.target.value = String(v); projects.set(it.id, { qty: v }); } });
      const dec = h('button', { type: 'button', 'aria-label': `Decrease quantity of ${name}`, onclick: () => { qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) - 1)); qty.dispatchEvent(new Event('change')); } }, '−');
      const inc = h('button', { type: 'button', 'aria-label': `Increase quantity of ${name}`, onclick: () => { qty.value = String((parseInt(qty.value, 10) || 1) + 1); qty.dispatchEvent(new Event('change')); } }, '+');
      const unit = h('select', { class: 'select', 'aria-label': `Unit for ${name}`, onchange: (e) => projects.set(it.id, { unit: e.target.value }) }, (UNITS.includes(it.unit) ? UNITS : [...UNITS, it.unit]).map((u) => h('option', { value: u, selected: u === it.unit }, u)));
      const from = SOURCE_TEXT[it.from] || SOURCE_TEXT.portal;
      const src = h('p', { class: 'count proj-src', 'data-from': it.from }, from,
        it.question ? [': "', it.question, '"'] : null,
        it.need ? ['. Quantity needed: ', it.need, it.packs ? ', packs: ' + it.packs : ''] : null,
        it.basis ? ['. Basis: ', it.basis] : null,
        it.systemTitle ? ['. From the system: ', it.systemTitle] : null,
        it.url ? ['. ', h('a', { class: 'link', href: it.url, target: '_blank', rel: 'noopener noreferrer' }, 'Data sheet line', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'))] : null);
      return h('div', { class: 'proj-line', 'data-id': it.id },
        h('div', null, h('h3', null, p ? h('a', { class: 'link', href: '#/product/' + p.id }, name) : name), h('p', { class: 'count', style: 'margin:0' }, p ? [p.b, (dv.catById.get(p.c) || {}).name].filter(Boolean).join(' · ') : 'Not in the catalogue of this demo'), (it.estimate ? h('p', { class: 'count', style: 'margin:.25rem 0 0' }, it.estimate) : null), src),
        h('div', { class: 'qty' }, dec, qty, inc), unit,
        h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Remove ${name} from my projects`, onclick: () => { projects.remove(it.id); render(); announce(`${name} removed`); } }, icon('trash', 'i--sm'), 'Remove'));
    });
    const extras = [];
    if (proj && proj.systems.length) extras.push(h('section', { class: 'proj-extra', 'aria-label': 'Systems in this project' }, h('h2', { class: 'h4' }, 'System'), proj.systems.map((x, i) => h('div', { class: 'proj-line proj-line--text' }, h('div', null, h('h3', null, x.title), x.slug ? h('p', { class: 'count', style: 'margin:0' }, h('a', { class: 'link', href: new URL('../../systems/' + encodeURIComponent(x.slug) + '/', import.meta.url).href, target: '_blank', rel: 'noopener noreferrer' }, 'Open the system sheet', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'))) : null), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Remove the system ${x.title}`, onclick: () => { projectStore.removeSystem(i); render(); } }, icon('trash', 'i--sm'), 'Remove')))));
    if (proj && proj.documents.length) extras.push(h('section', { class: 'proj-extra', 'aria-label': 'Documents in this project' }, h('h2', { class: 'h4' }, 'Documents'), proj.documents.map((d) => h('div', { class: 'proj-line proj-line--text' }, h('div', null, h('h3', null, h('a', { class: 'link', href: d.url, target: '_blank', rel: 'noopener noreferrer' }, d.title || d.url, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')))), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Remove the document ${d.title}`, onclick: () => { projectStore.removeDocument(d.url); render(); } }, icon('trash', 'i--sm'), 'Remove')))));
    { const box = h('section', { class: 'proj-extra', id: 'proj-calcs', 'aria-label': 'Calculations in this project' }, h('h2', { class: 'h4' }, 'Calculations')); extras.push(box); import('./calcsection.js').then((m) => m.fillCalcSection(box, proj ? proj.calculations || [] : [], render, estimateNote(cfg))); }
    const noteIn = h('input', { class: 'input', id: 'proj-note-in', type: 'text', maxlength: '500', 'aria-label': 'Add a note to this project', placeholder: 'Add a note, for example grout colour to confirm' });
    const addNote = () => { if (noteIn.value.trim()) { projectStore.addNote(noteIn.value); render(); announce('Note added'); } };
    extras.push(h('section', { class: 'proj-extra', 'aria-label': 'Notes in this project' }, h('h2', { class: 'h4' }, 'Notes'), (proj ? proj.notes : []).map((n, i) => h('div', { class: 'proj-line proj-line--text' }, h('div', null, h('p', { style: 'margin:0' }, n.text), n.saved ? h('p', { class: 'count', style: 'margin:0' }, n.saved.slice(0, 10)) : null), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Remove the note: ${n.text.slice(0, 40)}`, onclick: () => { projectStore.removeNote(i); render(); } }, icon('trash', 'i--sm'), 'Remove'))),
      h('div', { class: 'proj-note-add no-print' }, noteIn, h('button', { class: 'btn btn--hollow', type: 'button', id: 'proj-note-btn', onclick: addNote }, 'Add note'))));
    noteIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
    const packOut = h('textarea', { class: 'textarea', id: 'enquiry-text', rows: '8', readonly: true, hidden: true, 'aria-label': 'Text for the enquiry form' });
    const jobPack = async () => buildJobPack(projectStore.currentProject(), async (id) => { const rec = await data.product(id); return (rec && rec.docs) || []; }, { nameOf: (id) => { const p = dv.byId.get(id); return p && p.n; } });
    const pack = h('section', { class: 'section job-pack no-print', id: 'job-pack', 'aria-labelledby': 'job-pack-h' }, h('h2', { id: 'job-pack-h' }, 'Job pack'),
      h('p', { class: 'lead', style: 'max-width:50rem' }, 'The whole project as one pack: a printable page, the quantities as a CSV, a list of every data sheet and safety data sheet link, and the text for the enquiry form. All made in your browser; nothing is sent.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', id: 'pack-print', onclick: () => window.print() }, icon('file', 'i--sm'), 'Print the job pack'),
        h('button', { class: 'btn btn--hollow', type: 'button', id: 'pack-csv', onclick: async () => saveBlob((await jobPack()).csv, 'job-pack-quantities.csv', 'text/csv;charset=utf-8') }, icon('download', 'i--sm'), 'Download quantities (CSV)'),
        h('button', { class: 'btn btn--hollow', type: 'button', id: 'pack-docs', onclick: async () => saveBlob((await jobPack()).docsText, 'job-pack-documents.txt', 'text/plain;charset=utf-8') }, icon('download', 'i--sm'), 'Download data sheet and SDS links'),
        h('button', { class: 'btn btn--hollow', type: 'button', id: 'pack-copy', onclick: async () => { const t = (await jobPack()).enquiry; packOut.value = t; packOut.hidden = false; packOut.select(); try { await navigator.clipboard.writeText(t); announce('Copied for the enquiry form'); } catch { try { document.execCommand('copy'); } catch { /* the text is shown to copy by hand */ } } } }, 'Copy for the enquiry form')),
      packOut);
    cartBox.append(...[bar, list.length ? h('section', { 'aria-label': 'Products in this project' }, h('h2', { class: 'h4 visually-hidden' }, 'Products and quantities'), lines, h('div', { class: 'btn-row', style: 'margin-top:1rem' }, h('a', { class: 'btn btn--hollow', href: '#/products' }, 'Add more products'), h('button', { class: 'btn btn--text', type: 'button', onclick: () => { projects.clear(); render(); } }, 'Clear project'))) : null, ...extras, list.length ? bomSection(list, dv) : null, (list.length || (proj && (proj.calculations || []).length)) ? pack : null].filter(Boolean));
  };
  render();
  // the advisor changed the project while this page is open: show it (the page's own edits are already on screen)
  const off = projects.onChange((info) => { if (!el.isConnected) { off(); return; } if (!info || info.origin !== 'portal') render(); });
  return { el, title: 'My projects and quotes', nav: null };
}

function quoteForm(ctx, dv) {
  const wrap = h('section', { class: 'section', 'aria-labelledby': 'quote-h' });
  const fields = {};
  const err = {};
  const mk = (id, label, opts = {}) => {
    const input = opts.textarea ? h('textarea', { class: 'textarea', id, name: id, rows: '4', 'aria-describedby': id + '-e' }) : opts.select ? h('select', { class: 'input', id, name: id, 'aria-describedby': id + '-e' }, opts.select.map((o) => h('option', { value: o }, o))) : h('input', { class: 'input', id, name: id, type: opts.type || 'text', autocomplete: opts.autocomplete || 'off', inputmode: opts.inputmode || null, 'aria-describedby': id + '-e', required: opts.required ? true : null, 'aria-required': opts.required ? 'true' : null, maxlength: opts.max || null });
    const e = h('span', { class: 'err', id: id + '-e', role: 'alert' });
    fields[id] = input; err[id] = e;
    return h('div', { class: 'field' + (opts.full ? ' full' : '') }, h('label', { for: id }, label, opts.hint ? h('span', { class: 'hint' }, opts.hint) : null), input, e);
  };
  const form = h('form', { class: 'form form--2', novalidate: true, id: 'quote-form', onsubmit: (ev) => { ev.preventDefault(); submit(); } },
    mk('name', 'Full name', { required: true, autocomplete: 'name' }), mk('company', 'Company', { required: true, autocomplete: 'organization' }),
    mk('email', 'Email', { required: true, type: 'email', autocomplete: 'email' }), mk('phone', 'Phone', { type: 'tel', autocomplete: 'tel', hint: 'Optional' }),
    mk('role', 'I am a', { select: ROLES }), mk('project', 'Project name', { required: true }),
    mk('postcode', 'Delivery postcode', { inputmode: 'numeric', max: 4, hint: 'Optional, 4 digits' }), mk('needed', 'Needed by', { type: 'date', hint: 'Optional' }),
    mk('notes', 'Notes for the sales team', { textarea: true, full: true, hint: 'Optional: area, substrate, access, anything that helps' }),
    h('div', { class: 'full' }, h('button', { class: 'btn', type: 'submit' }, 'Request a quote (demo)'), h('span', { class: 'count', style: 'margin-left:1rem' }, 'Demo only: this form submits nowhere.')));
  wrap.append(h('h2', { id: 'quote-h', class: 'h3' }, 'Request a quote'), h('p', null, 'Fill this in to see the confirmation a customer would get. ', h('strong', null, 'Nothing is sent'), ' in this demo.'), h('p', { class: 'estimate-note' }, estimateNote(ctx.cfg)), form);
  function submit() {
    let ok = true; const v = (k) => fields[k].value.trim();
    const set = (k, msg) => { err[k].textContent = msg || ''; fields[k].setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) ok = false; };
    set('name', v('name') ? '' : 'Enter your name.'); set('company', v('company') ? '' : 'Enter your company.');
    set('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')) ? '' : 'Enter a valid email address, for example name@company.com.au.');
    set('project', v('project') ? '' : 'Give the project a name.');
    set('postcode', !v('postcode') || /^\d{4}$/.test(v('postcode')) ? '' : 'A postcode has 4 digits.');
    if (!ok) { const first = Object.keys(fields).find((k) => fields[k].getAttribute('aria-invalid') === 'true'); if (first) fields[first].focus(); announce('The form has errors. Please check the highlighted fields.'); return; }
    const items = projects.list().map((it) => { const p = dv.byId.get(it.id); return { name: (p && p.n) || it.name || it.id, qty: it.qty, unit: it.unit }; });
    const summary = [`Quote request (DEMO, not sent)`, `Name: ${v('name')}`, `Company: ${v('company')}`, `Email: ${v('email')}`, v('phone') && `Phone: ${v('phone')}`, `Role: ${fields.role.value}`, `Project: ${v('project')}`, v('postcode') && `Postcode: ${v('postcode')}`, v('needed') && `Needed by: ${v('needed')}`, '', 'Items:', ...items.map((i) => `- ${i.qty} x ${i.unit}: ${i.name}`), v('notes') && '', v('notes') && `Notes: ${v('notes')}`].filter((x) => x !== '' || true).filter((x) => x !== false && x !== '').join('\n');
    const done = h('div', { class: 'success', role: 'status', tabindex: '-1', id: 'quote-done' },
      h('span', { class: 'demo-only' }, 'Demo only'), h('h2', null, 'Thanks, your quote request is ready'),
      h('p', null, h('strong', null, 'Nothing was sent.'), ' This is a demonstration with no server behind it, so your request was not submitted, stored or shared with anyone. In a live portal this is the point where the request would reach the sales team and you would get a reference number.'),
      h('p', { class: 'estimate-note' }, estimateNote(ctx.cfg)),
      h('h3', { class: 'h5', style: 'margin-top:1rem' }, 'What you would have sent'), h('pre', { style: 'white-space:pre-wrap;background:#fff;border:1px solid #ddd;padding:1rem;font:inherit;overflow:auto' }, summary),
      h('div', { class: 'btn-row', style: 'margin-top:1rem' }, h('button', { class: 'btn', type: 'button', onclick: () => saveText(summary) }, icon('download', 'i--sm'), 'Save a copy as a text file'), h('button', { class: 'btn btn--hollow', type: 'button', onclick: () => { wrap.replaceChildren(...Array.from(prev)); fields.name.focus(); } }, 'Start another request')));
    const prev = Array.from(wrap.childNodes);
    wrap.replaceChildren(done); done.focus(); announce('Quote request ready. Demo only: nothing was sent.');
  }
  return wrap;
}
function saveText(text) {
  try { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); const a = h('a', { href: url, download: 'quote-request-demo.txt' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ about */
export async function aboutView(ctx) {
  const cov = await coveragePanel();
  const { cfg } = ctx; const stats = (await data.stats()) || {}; const d = cfg.demo;
  const imgStats = { packshots: stats.packshots || 0, illustrated: stats.illustrated || 0 }; // counts come from stats.json (add_images.mjs); the 600 KB products file is not fetched for them
  const row = (k, v) => h('tr', null, h('th', { scope: 'row', style: 'text-transform:none;letter-spacing:0;font-size:1rem' }, k), h('td', null, v));
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'About this demo' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'About this demo')),
    h('div', { class: 'prose', style: 'max-width:52rem' },
      h('p', { class: 'lead' }, `A working preview of a customer product portal for ${d.preparedFor}, built by ${d.by} in ${d.builtInHours} hours on ${d.builtOn}.`),
      h('div', { class: 'notice' }, icon('info'), h('span', null, d.notice)),
      h('h2', { class: 'h4' }, 'What it is'),
      h('p', null, 'A product finder, product pages, a documents library, a guides index, a my-projects list with a quote request, and a product advisor, all in the look of the public website so you can judge how it would sit inside it.'),
      h('h2', { class: 'h4' }, 'Where the information comes from'),
      h('ul', null,
        h('li', null, 'Public pages and the public sitemaps of ', h('a', { href: cfg.company.site, target: '_blank', rel: 'noopener noreferrer' }, cfg.company.site.replace('https://', '')), ', read on 2026-10-30, respecting robots.txt and at no more than one request per second.'),
        h('li', null, 'Nothing behind a login, no pricing, no stock, no customer data, nothing from internal systems. Nothing here touches any company system.'),
        h('li', null, 'Every document link opens the original file on the company website. No document was copied.'),
        h('li', null, `Product pictures: all ${nf.format(stats.products || 0)} products carry a picture. ${nf.format(imgStats.packshots)} show the packshot published on their public product page, loaded from a copy made for this demo. Where the company site publishes no product picture (${nf.format(imgStats.illustrated)} products) an illustrative Creative Commons photograph of the product's category is shown instead, always labelled "Illustrative photo, not the product". Category pictures are the same kind of photograph.`),
        h('li', null, 'The illustrative photographs come from Wikimedia Commons under Creative Commons licences (CC0, public domain, CC BY, CC BY-SA). Each is credited on the page where it is shown, and every credit is listed on ', h('a', { href: '#/credits' }, 'the photo credits page'), '. Nothing else was copied.')),
      h('h2', { class: 'h4' }, 'What is in it'),
      h('table', { class: 'table' }, h('tbody', null,
        row('Products', nf.format(stats.products || 0)), row('Documents (PDS, SDS, brochures, certificates)', nf.format(stats.documents || 0)),
        row('Categories', nf.format(stats.categories || 0)), row('Guide and section pages indexed', nf.format(stats.pages || 0)),
        stats.docs_link_ok !== undefined ? row('Document links checked on the build date', `${nf.format(stats.docs_link_ok)} responded, ${nf.format(stats.docs_link_failed)} did not (marked in the library)`) : null)),
      cov,
      h('h2', { class: 'h4' }, 'The product advisor'),
      h('p', null, `It answers from ${cfg.company.publishedDocsPhrase}: it finds products, quotes published coverage rates, opens data sheets and works out quantities. It is plain code running in your browser. No AI model is called, nothing is sent anywhere and it costs nothing to run. When the documentation does not say, it says so.`),
      h('p', null, h('a', { href: '#/rules' }, 'See the rule ledger'), ': every rule the advisor works from, with its source sentence, filterable and downloadable. See also ', h('a', { href: '#/insights' }, 'the insights and gap list'), ' (this browser only).'),
      h('p', null, h('a', { href: '#/about/data-quality' }, 'Data quality notes for Sika'), ': things we noticed in the public data that you may want to look at, with a PDF.'),
      offlinePanel(), // T19
      h('h2', { class: 'h4' }, 'What is demo-only'),
      h('p', null, 'The quote request submits nowhere. The projects list lives in this browser only. There are no accounts, no tracking and no cookies.'),
      h('p', null, h('a', { class: 'btn', href: '#/' }, 'Back to the portal'))));
  return { el, title: 'About this demo', nav: null };
}

/** Photo credits: one line per photograph (author, licence, source page), built from the credit data saved with each category. */
export async function creditsView(ctx) {
  const cats = await data.categories(); const by = new Map();
  for (const c of cats) { const im = c.image; if (!im || !im.credit) continue; if (!by.has(im.src)) by.set(im.src, { cr: im.credit, title: im.credit.title || '', cats: [] }); by.get(im.src).cats.push(c.name); }
  const rows = [...by.values()].sort((a, b) => a.cr.author.localeCompare(b.cr.author));
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'About this demo', href: '#/about' }, { label: 'Photo credits' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Photo credits'), h('p', { class: 'lead', style: 'max-width:60rem' }, `${nf.format(rows.length)} photographs from Wikimedia Commons are used as illustrations. They are not product pictures. Each is shown under its Creative Commons licence or as public domain; the links open the original file page.`)),
    h('ul', { class: 'credits-list' }, rows.map((r) => h('li', null,
      h('a', { class: 'link link--ext', href: r.cr.page, target: '_blank', rel: 'noopener noreferrer' }, r.title || 'Photograph'), ' by ', r.cr.author, ', ',
      r.cr.licenseUrl ? h('a', { class: 'link link--ext', href: r.cr.licenseUrl.replace(/^http:/, 'https:'), target: '_blank', rel: 'noopener noreferrer' }, r.cr.license) : r.cr.license,
      '. Used for: ', r.cats.slice(0, 4).join(', '), r.cats.length > 4 ? ` and ${r.cats.length - 4} more` : '', '.'))),
    h('p', null, h('a', { class: 'btn', href: '#/about' }, 'Back to About this demo')));
  return { el, title: 'Photo credits', nav: null };
}
