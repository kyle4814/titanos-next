// Site chrome: ribbon, meta bar, yellow header, floating white main navigation with mega menus, mobile drawer, footer, header search.
import { h, $, $$, icon, hashHref, debounce, plural, nf, focusSoon } from './util.js';
import { derivedLite } from './data.js';
import { getSearcher } from './searcher.js';
import { projects } from './projects.js';

let cfg, dv, searcher;
const isExternal = (l) => !!l.external;
function link(l, cls = '') {
  return h('a', { href: l.href, class: cls, target: isExternal(l) ? '_blank' : null, rel: isExternal(l) ? 'noopener' : null }, l.label, isExternal(l) ? h('span', { class: 'visually-hidden' }, ' (opens the company website in a new tab)') : null);
}

function wordmark() {
  return h('a', { class: 'logo', href: '#/', 'aria-label': `${cfg.company.name} product portal, home` },
    h('span', { class: 'wordmark', 'aria-hidden': 'true' }, cfg.company.wordmark),
    h('span', { class: 'hdr-title' }, cfg.company.region));
}

function searchBox(id, opts = {}) {
  const input = h('input', { id: id + '-q', type: 'search', name: 'q', autocomplete: 'off', placeholder: opts.placeholder || 'Find', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id + '-list', 'aria-autocomplete': 'list', 'aria-label': 'Search products and documents', enterkeyhint: 'search' });
  const list = h('ul', { class: 'suggest', id: id + '-list', role: 'listbox', hidden: true, 'aria-label': 'Suggestions' });
  const btn = h('button', { type: 'submit', 'aria-label': 'Search' }, icon('search'));
  const form = h('form', { class: 'search-box', role: 'search', onsubmit: (e) => { e.preventDefault(); go(input.value); } }, input, btn, list);
  let active = -1, items = [];
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const go = (q) => { close(); input.blur(); location.hash = hashHref('/products', { q: q.trim() }); if (opts.onGo) opts.onGo(); };
  const paint = () => {
    list.replaceChildren();
    items.forEach((p, i) => list.append(h('li', { role: 'option', id: `${id}-opt-${i}`, 'aria-selected': String(i === active), onmousedown: (e) => { e.preventDefault(); location.hash = '#/product/' + p.id; close(); if (opts.onGo) opts.onGo(); } }, h('span', null, p.n), h('small', null, [p.b, (dv.catById.get(p.c) || {}).name].filter(Boolean).join(' · ')))));
    if (input.value.trim()) list.append(h('li', { role: 'option', id: `${id}-opt-all`, class: 'sg-all', 'aria-selected': String(active === items.length), onmousedown: (e) => { e.preventDefault(); go(input.value); } }, `See all results for "${input.value.trim()}"`));
    list.hidden = !input.value.trim(); input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0) input.setAttribute('aria-activedescendant', active === items.length ? `${id}-opt-all` : `${id}-opt-${active}`); else input.removeAttribute('aria-activedescendant');
  };
  input.addEventListener('input', debounce(async () => { if (!searcher) { if (input.value.trim().length < 2) return; searcher = await getSearcher(); } items = input.value.trim().length >= 2 ? searcher.suggest(input.value, 6) : []; active = -1; if (input.value.trim().length >= 2) paint(); else close(); }, 90));
  input.addEventListener('keydown', (e) => {
    const n = items.length + (input.value.trim() ? 1 : 0);
    if (e.key === 'ArrowDown' && !list.hidden) { e.preventDefault(); active = (active + 1) % n; paint(); }
    else if (e.key === 'ArrowUp' && !list.hidden) { e.preventDefault(); active = (active - 1 + n) % n; paint(); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Enter' && active >= 0 && active < items.length) { e.preventDefault(); location.hash = '#/product/' + items[active].id; close(); if (opts.onGo) opts.onGo(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { form, input };
}

function megaFor(root) {
  const top = dv.categories.find((c) => c.id === root);
  const cols = (top ? top.children : []).map((id) => dv.catById.get(id)).filter(Boolean);
  const wrap = h('div', { class: 'mega-cols' });
  for (const c of cols) {
    const kids = (c.children || []).map((id) => dv.catById.get(id)).filter(Boolean).sort((a, b) => b.productCount - a.productCount).slice(0, 7);
    wrap.append(h('div', { class: 'mega-col' },
      h('h4', null, h('a', { href: '#/category/' + c.id }, c.name)),
      h('ul', null, kids.map((k) => h('li', null, h('a', { href: '#/category/' + k.id }, k.name))), (c.children || []).length > kids.length ? h('li', null, h('a', { href: '#/category/' + c.id, class: 'link' }, `All ${c.name} (${nf.format(c.productCount)})`)) : null)));
  }
  return h('div', { class: 'mega container' }, wrap, h('div', { class: 'mega-foot' }, h('a', { class: 'btn btn--hollow', href: '#/products?cat=' + encodeURIComponent(root) }, `All ${nf.format(top ? top.productCount : 0)} products in ${top ? top.name : ''}`), h('a', { class: 'btn btn--text', href: '#/documents' }, 'Data sheets and documents'), root === 'construction' ? h('a', { class: 'btn btn--text', href: '#/selector' }, 'Tiling system selector') : null));
}

function mainNav() {
  const ul = h('ul');
  for (const item of cfg.nav) {
    const li = h('li', { dataset: { id: item.id } });
    if (item.mega || item.menu) {
      li.classList.add('has-mega');
      const panelId = 'mega-' + item.id;
      const btn = h('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId, onclick: () => toggle(li, btn) }, item.label, icon('chevron-down', 'i--sm'));
      const panel = item.mega ? megaFor(item.mega) : h('div', { class: 'mega container' }, h('div', { class: 'mega-cols' }, h('div', { class: 'mega-col' }, h('ul', null, item.menu.map((m) => h('li', null, link(m)))))));
      panel.id = panelId;
      li.append(btn, panel);
    } else {
      li.append(link(item));
    }
    ul.append(li);
  }
  const closeAll = () => { $$('li.open', ul).forEach((l) => { l.classList.remove('open'); const b = $('button', l); if (b) b.setAttribute('aria-expanded', 'false'); }); };
  function toggle(li, btn) { const wasOpen = li.classList.contains('open'); closeAll(); if (!wasOpen) { li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); } }
  document.addEventListener('click', (e) => { if (!e.target.closest('.mainnav-bar')) closeAll(); });
  ul.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const open = $('li.open > button', ul); closeAll(); if (open) open.focus(); } });
  ul.addEventListener('focusout', (e) => { if (!ul.contains(e.relatedTarget)) closeAll(); });
  window.addEventListener('hashchange', closeAll);
  return h('nav', { class: 'mainnav', 'aria-label': 'Main' }, h('div', { class: 'container' }, h('div', { class: 'mainnav-bar' }, ul)));
}

function drawer(openAssistant) {
  const scrim = h('div', { class: 'drawer-scrim', onclick: () => setOpen(false) });
  const closeBtn = h('button', { class: 'burger', type: 'button', 'aria-label': 'Close menu', onclick: () => setOpen(false) }, icon('close'), 'Close');
  const sb = searchBox('dr', { placeholder: 'Find', onGo: () => setOpen(false) });
  const nav = h('nav', { 'aria-label': 'Main menu' });
  const ul = h('ul');
  for (const item of cfg.nav) {
    if (item.mega) {
      const top = dv.categories.find((c) => c.id === item.mega);
      const sub = h('ul');
      sub.append(h('li', null, h('a', { href: '#/products?cat=' + encodeURIComponent(item.mega), onclick: () => setOpen(false) }, `All products (${nf.format(top ? top.productCount : 0)})`)));
      for (const id of (top ? top.children : [])) { const c = dv.catById.get(id); if (c) sub.append(h('li', null, h('a', { href: '#/category/' + c.id, onclick: () => setOpen(false) }, c.name, h('span', { class: 'count' }, nf.format(c.productCount))))); }
      ul.append(h('li', null, h('details', null, h('summary', null, item.label, icon('chevron-down', 'i--sm')), sub)));
    } else if (item.menu) {
      const sub = h('ul', null, item.menu.map((m) => h('li', null, h('a', { href: m.href, onclick: () => setOpen(false) }, m.label))));
      ul.append(h('li', null, h('details', null, h('summary', null, item.label, icon('chevron-down', 'i--sm')), sub)));
    } else {
      ul.append(h('li', null, h('a', { href: item.href, target: item.external ? '_blank' : null, rel: item.external ? 'noopener' : null, onclick: () => setOpen(false) }, item.label, item.external ? icon('chevron-right', 'i--sm') : null)));
    }
  }
  nav.append(ul);
  const foot = h('div', { class: 'drawer-foot' },
    h('a', { href: '#/products', onclick: () => setOpen(false) }, 'Product finder'),
    h('a', { href: '#/projects', onclick: () => setOpen(false) }, 'My projects and quotes'),
    h('a', { href: '#/about', onclick: () => setOpen(false) }, 'About this demo'));
  const panel = h('aside', { class: 'drawer', id: 'drawer', 'aria-label': 'Menu', 'aria-hidden': 'true' }, h('div', { class: 'drawer-head' }, h('span', { class: 'wordmark', 'aria-hidden': 'true' }, cfg.company.wordmark), closeBtn), sb.form, nav, foot);
  let opener = null;
  function setOpen(on, from) {
    panel.classList.toggle('open', on); scrim.classList.toggle('open', on); document.body.classList.toggle('lock', on);
    panel.setAttribute('aria-hidden', String(!on)); if (from) opener = from; const burger = $('#burger'); if (burger) burger.setAttribute('aria-expanded', String(on));
    if (on) focusSoon(closeBtn); else if (opener) focusSoon(opener);
  }
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.addEventListener('hashchange', () => { if (panel.classList.contains('open')) setOpen(false); });
  return { panel, scrim, setOpen };
}

function footer() {
  const f = cfg.footer;
  const cols = f.columns.map((c) => h('div', null, h('h2', { class: c.underline ? '' : 'plain' }, c.title), h('ul', null, c.links.map((l) => h('li', null, link(l))))));
  cols.push(h('div', null, h('h2', { class: 'plain' }, f.address.title), h('address', null, f.address.lines.map((l, i) => [i ? h('br') : null, l]), h('br'), h('br'), f.address.abn)));
  const d = cfg.demo;
  return h('footer', { class: 'site-footer', id: 'site-footer' },
    h('div', { class: 'container' }, h('div', { class: 'cols' }, cols)),
    h('div', { class: 'footbar' }, h('div', { class: 'container' }, h('ul', null, f.legal.map((l) => h('li', null, h('a', { href: l.href, target: '_blank', rel: 'noopener' }, l.label)))))),
    h('div', { class: 'footbar', style: 'background:#2f2f2f' }, h('div', { class: 'container demo-line' },
      h('strong', { id: 'demo-line' }, `Demo prepared for ${d.preparedFor} by `, h('a', { href: d.byUrl, target: '_blank', rel: 'noopener' }, d.by), `, built in ${d.builtInHours} hours`), '. ',
      d.notice)));
}

export async function mountChrome(config, { openAssistant }) {
  cfg = config; dv = await derivedLite(); // the product search index is built on first use (see searchBox), not at boot
  const cnt = h('span', { class: 'count-pill', id: 'proj-count' }, '0');
  const header = h('header', { class: 'site-header' },
    h('div', { class: 'hdr-notice', role: 'note' }, h('strong', null, 'Demo'), ' ', cfg.demo.ribbon),
    h('div', { class: 'hdr-meta' },
      h('div', { style: 'display:flex;align-items:center' }, h('span', { style: 'padding:0 1.25rem 0 0' }, cfg.meta.left)),
      h('nav', { 'aria-label': 'Quick links' }, h('ul', null,
        cfg.meta.right.map((l) => h('li', null, link(l))),
        h('li', { class: 'tab-mine' }, h('a', { href: '#/projects' }, 'My projects ', cnt))))),
    h('div', { class: 'hdr-main' }, h('div', { class: 'container' }, wordmark(),
      h('div', { class: 'triad', role: 'group', 'aria-label': 'Quick tools' },
        h('a', { class: 'tri', href: '#/products' }, icon('search', 'i--sm'), 'Find a Product'),
        h('a', { class: 'tri', href: '#/documents' }, icon('file', 'i--sm'), 'SDS & TDS'),
        h('button', { class: 'tri', type: 'button', id: 'tri-advisor', onclick: (e) => openAssistant(undefined, e.currentTarget) }, icon('chat', 'i--sm'), 'Advisor')),
      h('div', { class: 'hdr-search' }, searchBox('hd').form),
      h('button', { class: 'burger', id: 'burger', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'drawer', onclick: (e) => dr.setOpen(true, e.currentTarget) }, h('span', { class: 'lines', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', null, 'Menu')))),
    mainNav());
  const dr = drawer(openAssistant);
  const projCount = () => { const n = projects.count(); cnt.textContent = String(n); cnt.parentElement.setAttribute('aria-label', `My projects, ${n} items`); };
  projects.onChange(projCount); projCount();
  const mbar = h('nav', { class: 'mbar', 'aria-label': 'Quick tools' },
    h('a', { href: '#/products' }, icon('search'), 'Find a Product'),
    h('a', { href: '#/documents' }, icon('file'), 'SDS & TDS'),
    h('button', { type: 'button', onclick: (e) => openAssistant(undefined, e.currentTarget) }, icon('chat'), 'Advisor'));
  return { header, drawer: dr, footer: footer(), searcher, mbar };
}
export function setNavCurrent(id) { $$('.mainnav-bar > ul > li').forEach((l) => l.classList.toggle('current', l.dataset.id === id)); }
