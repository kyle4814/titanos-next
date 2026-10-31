// Outdoor mode (wave 2): big text and high contrast for use in sun, with gloves, on a phone. Stored in this browser only (localStorage), never sent anywhere.
// 'on' or 'off' is a choice the person made; nothing stored means "follow the device": on when the device asks for more contrast (prefers-contrast: more).
// The look lives in its own file (assets/outdoor.css), loaded only when the mode is on, so the normal first screen pays nothing for it.
const KEY = 'sika-demo-210c0c-outdoor';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { v === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch { /* private mode: the choice lasts this visit only */ } };
const mq = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-contrast: more)') : { matches: false });
let linkEl = null; const buttons = new Set();

export const outdoorOn = () => { const v = read(); return v === 'on' || (v === null && mq().matches); };

function sheet() {
  if (linkEl || typeof document === 'undefined') return;
  linkEl = document.createElement('link'); linkEl.rel = 'stylesheet'; linkEl.id = 'outdoor-css'; linkEl.href = new URL('../outdoor.css', import.meta.url).href; document.head.append(linkEl);
}
export function applyOutdoor() {
  const on = outdoorOn(); if (on) sheet();
  document.documentElement.classList.toggle('outdoor', on);
  buttons.forEach((b) => { b.setAttribute('aria-pressed', String(on)); b.querySelector('.od-state').textContent = on ? 'On' : 'Off'; });
  return on;
}
export function setOutdoor(on) { write(on ? 'on' : 'off'); return applyOutdoor(); }

/** A toggle button; each one is kept in step with the mode. */
export function outdoorButton(cls = 'od-toggle') {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('data-outdoor-toggle', '');
  b.innerHTML = '<span class="od-label">Outdoor mode</span> <span class="od-state"></span>';
  b.addEventListener('click', () => setOutdoor(!outdoorOn()));
  buttons.add(b); applyOutdoor(); return b;
}

/** Early call from app.js: sets the class before the first screen, and follows the device when no choice was made. */
export function initOutdoor() {
  applyOutdoor();
  // the browser fires beforeinstallprompt early; keep the event for lib/pwa.js (loaded a few seconds later) and hold back the browser's own banner
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__bip = e; });
  try { mq().addEventListener && mq().addEventListener('change', () => { if (read() === null) applyOutdoor(); }); } catch { /* old browser */ }
}
/** After the chrome exists: one toggle in the header quick links, one in the mobile menu. */
export function mountOutdoorButtons() {
  const ul = document.querySelector('.hdr-meta nav ul'); if (ul && !ul.querySelector('[data-outdoor-toggle]')) { const li = document.createElement('li'); li.append(outdoorButton('od-toggle od-toggle--hdr')); ul.append(li); }
  const foot = document.querySelector('.drawer .drawer-foot'); if (foot && !foot.querySelector('[data-outdoor-toggle]')) foot.append(outdoorButton('od-toggle od-toggle--drawer'));
}
