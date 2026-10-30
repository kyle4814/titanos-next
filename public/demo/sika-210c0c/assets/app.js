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
import { initOffline } from './lib/offline.js';
import { data as dataApi } from './lib/data.js';
import { warmProduct } from './lib/apply_data.js';

// speed: start the files the opening route needs the moment the script runs, in parallel with config.json, instead of one after another
{ const h0 = location.hash || '#/'; dataApi.catsLite().catch(() => {}); if (/^#\/selector/.test(h0)) dataApi.selector().catch(() => {}); const pm = /^#\/product\/([^?]+)/.exec(h0); if (pm) warmProduct(decodeURIComponent(pm[1])); }

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

// one selector only: the retired duplicate routes land on it
const REDIRECTS = { '/system': '/selector', '/sheet': '/selector' };

async function render(sameAsBefore = false) {
  let { path, params } = hashParams();
  if (REDIRECTS[path]) { history.replaceState(null, '', hashHref(REDIRECTS[path], {})); path = REDIRECTS[path]; params = new URLSearchParams(); }
  const my = ++token;
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
    initOffline(); // T19, no-op where the host cannot serve a service worker
    // "Skip to main content" is a #main anchor: in a hash-routed page it must move focus, never become a route (it used to land on "We could not find that page")
    document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a.skip-link'); if (!a) return; e.preventDefault(); main.focus(); main.scrollIntoView(); });
    window.addEventListener('hashchange', () => { if (location.hash && !location.hash.startsWith('#/')) return; render(); }); // a plain in-page anchor is not a route
    await render();
    fontsAfterRender();
  } catch (e) {
    console.error('boot error', e);
    main.replaceChildren(errorState(e, () => location.reload())); main.removeAttribute('aria-busy');
  }
}
boot();
// speed: the web fonts (fonts/fonts.css) are attached once the page has loaded, so they never compete with the first screen
const attachFonts = () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('fonts/fonts.css', import.meta.url).href; document.head.append(l); };
// after the first screen is usable; until then the text shows in the system font
let fontsDone = false; function fontsAfterRender() { if (fontsDone) return; fontsDone = true; const go = () => setTimeout(attachFonts, 2500); if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true }); }
