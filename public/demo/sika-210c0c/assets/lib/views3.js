// My projects and the demo-only quote request, plus the About page.
import { h, icon, nf, plural, announce, fmtBytes } from './util.js';
import { derived, data, documents } from './data.js';
import { breadcrumb, emptyState, placeholder } from './components.js';
import { projects } from './projects.js';

const ROLES = ['Distributor or merchant', 'Applicator or tradesperson', 'Builder or contractor', 'Specifier or architect', 'Engineer', 'Home owner', 'Other'];

export async function projectsView(ctx) {
  const dv = await derived(); const { cfg } = ctx;
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'My projects and quotes' }]));
  const head = h('div', { class: 'page-head' }, h('h1', null, 'My projects and quotes'),
    h('p', { class: 'lead', style: 'max-width:60rem' }, 'Collect the products for a job, set quantities and prepare a quote request.'),
    h('p', { class: 'notice' }, icon('info'), h('span', null, h('span', { class: 'demo-only' }, 'Demo only'), ' This list is kept in your browser on this device. The quote request below ', h('strong', null, 'submits nowhere'), ': there is no server behind this demo, so nothing is sent, stored or shared.')));
  const body = h('div');
  el.append(head, body);
  const render = () => {
    body.replaceChildren();
    const list = projects.list();
    if (!list.length) { body.append(emptyState({ title: 'Your project is empty', text: 'Add products from the finder or from any product page, then come back here to set quantities and prepare a quote request.', actions: [h('a', { class: 'btn', href: '#/products' }, 'Find a product'), h('button', { class: 'btn btn--dark', type: 'button', onclick: () => ctx.openAssistant('What do I need for 40 m2 of floor tiles?') }, 'Ask the advisor')] })); return; }
    const lines = list.map((it) => {
      const p = dv.byId.get(it.id); if (!p) return null;
      const qty = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: String(it.qty), 'aria-label': `Quantity of ${p.n}`, onchange: (e) => { const v = Math.max(1, parseInt(e.target.value || '1', 10) || 1); e.target.value = String(v); projects.set(it.id, { qty: v }); } });
      const dec = h('button', { type: 'button', 'aria-label': `Decrease quantity of ${p.n}`, onclick: () => { qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) - 1)); qty.dispatchEvent(new Event('change')); } }, '−');
      const inc = h('button', { type: 'button', 'aria-label': `Increase quantity of ${p.n}`, onclick: () => { qty.value = String((parseInt(qty.value, 10) || 1) + 1); qty.dispatchEvent(new Event('change')); } }, '+');
      const unit = h('select', { class: 'select', 'aria-label': `Unit for ${p.n}`, onchange: (e) => projects.set(it.id, { unit: e.target.value }) }, ['pack', 'pail', 'bag', 'cartridge', 'roll', 'litre', 'kg'].map((u) => h('option', { value: u, selected: u === it.unit }, u)));
      return h('div', { class: 'proj-line' },
        h('div', null, h('h3', null, h('a', { class: 'link', href: '#/product/' + p.id }, p.n)), h('p', { class: 'count', style: 'margin:0' }, [p.b, (dv.catById.get(p.c) || {}).name].filter(Boolean).join(' · ')), (it.estimate ? h('p', { class: 'count', style: 'margin:.25rem 0 0' }, it.estimate) : null)),
        h('div', { class: 'qty' }, dec, qty, inc), unit,
        h('button', { class: 'btn btn--text', type: 'button', 'aria-label': `Remove ${p.n} from my projects`, onclick: () => { projects.remove(it.id); render(); announce(`${p.n} removed`); } }, icon('trash', 'i--sm'), 'Remove'));
    }).filter(Boolean);
    body.append(h('section', { 'aria-label': 'Products in this project' }, lines, h('div', { class: 'btn-row', style: 'margin-top:1rem' }, h('a', { class: 'btn btn--hollow', href: '#/products' }, 'Add more products'), h('button', { class: 'btn btn--text', type: 'button', onclick: () => { projects.clear(); render(); } }, 'Clear project'))), quoteForm(ctx, dv));
  };
  render();
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
  wrap.append(h('h2', { id: 'quote-h', class: 'h3' }, 'Request a quote'), h('p', null, 'Fill this in to see the confirmation a customer would get. ', h('strong', null, 'Nothing is sent'), ' in this demo.'), form);
  function submit() {
    let ok = true; const v = (k) => fields[k].value.trim();
    const set = (k, msg) => { err[k].textContent = msg || ''; fields[k].setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) ok = false; };
    set('name', v('name') ? '' : 'Enter your name.'); set('company', v('company') ? '' : 'Enter your company.');
    set('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')) ? '' : 'Enter a valid email address, for example name@company.com.au.');
    set('project', v('project') ? '' : 'Give the project a name.');
    set('postcode', !v('postcode') || /^\d{4}$/.test(v('postcode')) ? '' : 'A postcode has 4 digits.');
    if (!ok) { const first = Object.keys(fields).find((k) => fields[k].getAttribute('aria-invalid') === 'true'); if (first) fields[first].focus(); announce('The form has errors. Please check the highlighted fields.'); return; }
    const items = projects.list().map((it) => { const p = dv.byId.get(it.id); return p ? { name: p.n, qty: it.qty, unit: it.unit } : null; }).filter(Boolean);
    const summary = [`Quote request (DEMO, not sent)`, `Name: ${v('name')}`, `Company: ${v('company')}`, `Email: ${v('email')}`, v('phone') && `Phone: ${v('phone')}`, `Role: ${fields.role.value}`, `Project: ${v('project')}`, v('postcode') && `Postcode: ${v('postcode')}`, v('needed') && `Needed by: ${v('needed')}`, '', 'Items:', ...items.map((i) => `- ${i.qty} x ${i.unit}: ${i.name}`), v('notes') && '', v('notes') && `Notes: ${v('notes')}`].filter((x) => x !== '' || true).filter((x) => x !== false && x !== '').join('\n');
    const done = h('div', { class: 'success', role: 'status', tabindex: '-1', id: 'quote-done' },
      h('span', { class: 'demo-only' }, 'Demo only'), h('h2', null, 'Thanks, your quote request is ready'),
      h('p', null, h('strong', null, 'Nothing was sent.'), ' This is a demonstration with no server behind it, so your request was not submitted, stored or shared with anyone. In a live portal this is the point where the request would reach the sales team and you would get a reference number.'),
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
  const { cfg } = ctx; const stats = (await data.stats()) || {}; const d = cfg.demo;
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
        h('li', null, 'Product images are not copied. Neutral placeholders are shown; real images can be switched on once permission to embed them is confirmed.')),
      h('h2', { class: 'h4' }, 'What is in it'),
      h('table', { class: 'table' }, h('tbody', null,
        row('Products', nf.format(stats.products || 0)), row('Documents (PDS, SDS, brochures, certificates)', nf.format(stats.documents || 0)),
        row('Categories', nf.format(stats.categories || 0)), row('Guide and section pages indexed', nf.format(stats.pages || 0)),
        stats.docs_link_ok !== undefined ? row('Document links checked on the build date', `${nf.format(stats.docs_link_ok)} responded, ${nf.format(stats.docs_link_failed)} did not (marked in the library)`) : null)),
      h('h2', { class: 'h4' }, 'The product advisor'),
      h('p', null, `It answers from ${cfg.company.publishedDocsPhrase}: it finds products, quotes published coverage rates, opens data sheets and works out quantities. It is plain code running in your browser. No AI model is called, nothing is sent anywhere and it costs nothing to run. When the documentation does not say, it says so.`),
      h('h2', { class: 'h4' }, 'What is demo-only'),
      h('p', null, 'The quote request submits nowhere. The projects list lives in this browser only. There are no accounts, no tracking and no cookies.'),
      h('p', null, h('a', { class: 'btn', href: '#/' }, 'Back to the portal'))));
  return { el, title: 'About this demo', nav: null };
}
