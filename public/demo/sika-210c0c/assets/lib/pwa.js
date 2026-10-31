// Install as an app (wave 2). Offers "add to home screen" politely: only after real use (several pages viewed over at least 30 seconds), never on top of an
// open advisor, dismissible, and once dismissed it stays away on this browser. The browser decides whether an install is possible at all (beforeinstallprompt);
// where it cannot (iPhone Safari, already installed, an unsupported host) nothing is shown. No tracking: the counters live in localStorage on this device only.
const K_USE = 'sika-demo-210c0c-use', K_NO = 'sika-demo-210c0c-install-no';
export const NEED_VIEWS = 4, NEED_MS = 30000;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const standalone = () => (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/** Pure: should the card show now? */
export function shouldOffer({ views, msOnPage, dismissed, standalone: sa, canInstall, advisorOpen }) {
  return !!canInstall && !sa && !dismissed && !advisorOpen && views >= NEED_VIEWS && msOnPage >= NEED_MS;
}

export function initInstall() {
  let deferred = window.__bip || null, card = null; const t0 = Date.now();
  const count = () => { set(K_USE, String((+get(K_USE) || 0) + 1)); maybe(); };
  const advisorOpen = () => { const a = document.getElementById('assistant'); return !!(a && a.classList.contains('open')); };
  function hide() { if (card) { card.remove(); card = null; } }
  function show() {
    if (card) return;
    const yes = Object.assign(document.createElement('button'), { type: 'button', className: 'ic-yes', textContent: 'Add to home screen' });
    const no = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Not now' });
    card = document.createElement('div'); card.className = 'install-card'; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Install this portal as an app');
    const p = document.createElement('p'); p.textContent = 'Add this portal to your home screen so it opens like an app and keeps working with no signal.';
    const row = document.createElement('div'); row.className = 'ic-row'; row.append(yes, no); card.append(p, row); document.body.append(card);
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('../pwa.css', import.meta.url).href; document.head.append(css);
    no.addEventListener('click', () => { set(K_NO, String(Date.now())); hide(); });
    yes.addEventListener('click', async () => { const e = deferred; deferred = null; hide(); if (!e) return; try { await e.prompt(); const r = await e.userChoice; if (r && r.outcome === 'dismissed') set(K_NO, String(Date.now())); } catch { /* the browser refused */ } });
  }
  function maybe() { if (shouldOffer({ views: +get(K_USE) || 0, msOnPage: Date.now() - t0, dismissed: !!get(K_NO), standalone: standalone(), canInstall: !!deferred, advisorOpen: advisorOpen() })) show(); }
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; maybe(); });
  addEventListener('appinstalled', () => { deferred = null; hide(); set(K_NO, String(Date.now())); });
  addEventListener('hashchange', count);
  setTimeout(maybe, NEED_MS + 500);
  window.__sikaInstall = { views: () => +get(K_USE) || 0, maybe }; // read by the tests only
}
