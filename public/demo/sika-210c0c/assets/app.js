// Entry point: loads the configuration, mounts the site chrome, runs the hash router.
import { h, $, hashParams, hashHref, setTitle, announce, store, icon } from './lib/util.js';
import { data } from './lib/data.js';
import { mountChrome, setNavCurrent } from './lib/chrome.js';
import { mountAssistant } from './lib/assistant-ui.js';
import { homeView, finderView, categoryView, notFound } from './lib/views.js';
import { productView, documentsView, guidesView } from './lib/views2.js';
import { projectsView, aboutView } from './lib/views3.js';
import { errorState, skeletonGrid } from './lib/components.js';
import { personaBlock } from './lib/persona.js';
import { extraRoutes } from './lib/extras.js';

const main = $('#main');
let cfg, assistant, lastPath = null, token = 0, firstRender = true, leaving = false;
addEventListener('pagehide', () => { leaving = true; }); // a full navigation aborts in-flight fetches: not an error worth reporting

const openAssistant = (q, from) => { (assistant || Promise.resolve(null)).then((a) => a && a.open(q, from || document.activeElement)); };

function go(path, params, replace) {
  const href = hashHref(path, params instanceof URLSearchParams ? Object.fromEntries(params) : params);
  if (replace) { history.replaceState(null, '', href); render(true); } else { location.hash = href; }
}

const ROUTES = [
  [/^\/$/, (c) => homeView(c)],
  [/^\/products$/, (c) => finderView(c)],
  [/^\/category\/(.+)$/, (c, m) => categoryView({ ...c, rest: decodeURIComponent(m[1]) })],
  [/^\/product\/(.+)$/, (c, m) => productView({ ...c, rest: decodeURIComponent(m[1]) })],
  [/^\/documents$/, (c) => documentsView(c)],
  [/^\/guides$/, (c) => guidesView(c)],
  [/^\/projects$/, (c) => projectsView(c)],
  [/^\/about$/, (c) => aboutView(c)],
  ...extraRoutes,
];

async function render(sameAsBefore = false) {
  const my = ++token; const { path, params } = hashParams();
  const samePath = path === lastPath; lastPath = path;
  const ae = document.activeElement; const keep = samePath && ae && ae.id && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && main.contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const ctx = { cfg, params, path, go, openAssistant };
  if (path === '/') ctx.persona = personaBlock(cfg, () => render(true), openAssistant);
  let view;
  for (const [rx, fn] of ROUTES) { const m = path.match(rx); if (m) { view = () => fn(ctx, m); break; } }
  if (!samePath) { main.setAttribute('aria-busy', 'true'); if (!main.firstElementChild || !main.querySelector('.skeleton')) { /* keep old content until the new view is ready to avoid flashes */ } }
  try {
    const r = await (view ? view() : notFound(ctx));
    if (my !== token) return;
    main.replaceChildren(r.el); main.removeAttribute('aria-busy');
    setTitle(r.title, cfg.company.name + ' product portal'); setNavCurrent(r.nav);
    if (!samePath) { window.scrollTo(0, 0); if (!firstRender) { main.focus({ preventScroll: true }); announce(r.title); } }
    firstRender = false;
    if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch { /* not a text input */ } } }
  } catch (e) {
    if (my !== token || leaving) return;
    console.error('view error', e);
    main.replaceChildren(errorState(e, () => render())); main.removeAttribute('aria-busy');
  }
}

async function boot() {
  try {
    cfg = await data.config();
    const c = await mountChrome(cfg, { openAssistant });
    $('#chrome-top').replaceWith(c.header); $('#chrome-bottom').replaceWith(c.footer);
    document.body.append(c.drawer.scrim, c.drawer.panel, c.mbar);
    const toTop = h('button', { class: 'totop', type: 'button', 'aria-label': 'Back to top', onclick: () => window.scrollTo({ top: 0 }) }, icon('up'));
    document.body.append(toTop);
    window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 700), { passive: true });
    assistant = mountAssistant(cfg);
    window.addEventListener('hashchange', () => render());
    await render();
  } catch (e) {
    console.error('boot error', e);
    main.replaceChildren(errorState(e, () => location.reload())); main.removeAttribute('aria-busy');
  }
}
boot();
