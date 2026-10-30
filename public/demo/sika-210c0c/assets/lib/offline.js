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

export async function initOffline() {
  if (!('serviceWorker' in navigator)) { state.reason = 'This browser does not support service workers.'; notify(); return state; }
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) { state.reason = 'This address is not https, so the browser will not allow offline mode.'; notify(); return state; }
  state.supported = true;
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'sika-offline') return;
    Object.assign(state, { ready: d.state === 'ready', files: d.files, bytes: d.bytes, cache: d.cache, reason: '' }); badge(); notify();
  });
  try {
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
