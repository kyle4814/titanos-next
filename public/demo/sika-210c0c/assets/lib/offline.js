// Offline mode (T19): registers sw.js when the host allows it (https or localhost) and reports the state. If the host cannot serve a
// service worker (file://, plain http, a browser without support) the portal just stays online-only and says so on the About page.
// Fallback for such hosts: open the portal once over https; there is no other cache. No background sync, no push, no analytics.
const state = { supported: false, ready: false, files: 0, bytes: 0, cache: '', reason: '' };
const subs = new Set();
const notify = () => subs.forEach((f) => { try { f(state); } catch { /* ignore */ } });
export const offlineState = () => state;
export const onOffline = (fn) => { subs.add(fn); return () => subs.delete(fn); };

function badge() {
  const host = document.querySelector('.demo-line'); if (!host) return;
  let b = document.getElementById('offline-badge');
  if (!state.ready) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('span'); b.id = 'offline-badge'; b.style.cssText = 'margin-left:.75rem;padding:.1rem .5rem;border:1px solid currentColor;font-size:.85rem'; host.append(b); }
  b.textContent = 'Available offline (tile and stone)';
}

function quietPeriod() {
  const c = navigator.connection || {};
  const slow = c.saveData === true || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '');
  const wait = slow ? 45000 : 5000;
  return new Promise((resolve) => {
    const go = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => resolve(), { timeout: 3000 }) : resolve()), wait);
    if (typeof document === 'undefined' || document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  });
}

/** The speed build's lazy chunks (dist/) are not in the worker's file list, so a product page or the advisor failed when the network dropped after the first screen.
 *  The page puts them into the worker's own cache; the cache name carries the hash of every asset, so a rebuilt chunk can never be served stale. */
const warmed = new Set();
const DIST = ['dist/main.js', 'dist/actions-panels.js', 'dist/actions.js', 'dist/brain.js', 'dist/engine.js'];
async function warmDist(cacheName) {
  if (warmed.has(cacheName)) return; warmed.add(cacheName);
  try {
    const c = await caches.open(cacheName);
    await Promise.all(DIST.map(async (u) => { if (await c.match(u)) return; const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); }));
  } catch { /* offline mode still works for everything else */ }
}

export async function initOffline() {
  if (!('serviceWorker' in navigator)) { state.reason = 'This browser does not support service workers.'; notify(); return state; }
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) { state.reason = 'This address is not https, so the browser will not allow offline mode.'; notify(); return state; }
  state.supported = true;
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'sika-offline') return;
    Object.assign(state, { ready: d.state === 'ready', files: d.files, bytes: d.bytes, cache: d.cache, reason: '' }); badge(); notify();
    if (d.state === 'ready' && d.cache) warmDist(d.cache);
  });
  try {
    // Speed: the worker precaches several MB, so it must never compete with the first screen. Wait for the page load, then for quiet
    // (5 s on a fast link, 45 s on a slow or data-saving one); nothing changes for the visitor except that the badge appears later.
    await quietPeriod();
    const reg = await navigator.serviceWorker.register('sw.js');
    const ready = await navigator.serviceWorker.ready;
    const target = ready.active || reg.active; if (target) target.postMessage({ type: 'sika-offline-status' });
  } catch (e) { state.supported = false; state.reason = 'Offline mode could not start: ' + (e && e.message ? e.message : e); notify(); }
  return state;
}

/** Remove the worker and every cache it made. The portal keeps working online. */
export async function disableOffline() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('sika-demo-210c0c-')) await caches.delete(k);
  } catch { /* nothing to remove */ }
  Object.assign(state, { ready: false, files: 0, bytes: 0, cache: '' }); badge(); notify();
}
