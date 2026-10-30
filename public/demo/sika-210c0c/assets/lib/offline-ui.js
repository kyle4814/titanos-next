// The Offline mode panel on the About page (T19): state, cache size, and the control that removes the worker and its caches.
import { h, nf } from './util.js';
import { offlineState, onOffline, disableOffline } from './offline.js';

export function offlinePanel() {
  const status = h('p', { id: 'offline-status', role: 'status', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn btn--text', type: 'button', id: 'offline-off' }, 'Turn off offline mode and clear its cache');
  const draw = () => {
    const s = offlineState();
    status.textContent = s.ready ? `Offline mode is on. ${nf.format(s.files)} files saved in this browser, ${(s.bytes / 1048576).toFixed(1)} MB. After one visit the finder, the calculator and the advisor work with the network off for tile and stone. Data sheets and other PDFs always need the network.`
      : s.supported ? 'Offline mode is starting. Keep this page open for a moment.' : (s.reason || 'Offline mode is not available here.') + ' The portal works online as normal.';
    btn.hidden = !s.ready;
  };
  btn.addEventListener('click', async () => { await disableOffline(); draw(); });
  onOffline(draw); draw();
  return h('div', { id: 'offline-panel' }, h('h2', { class: 'h4' }, 'Offline mode'), status, btn);
}
