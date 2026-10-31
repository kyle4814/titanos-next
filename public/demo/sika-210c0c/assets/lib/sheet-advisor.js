// sheet-advisor.js (wave 2, bot on every page): on a static system sheet or the selector hub, "Ask the advisor" opens the REAL assistant panel in the page
// (the same mountAssistant(cfg) the portal uses), with a card that names the system and offers three questions. The button is also a plain link to
// the portal's deep link (#/ask?system=<slug>, the same address the QR code holds): if anything here fails, or scripts are off, the link is followed.
// Nothing is loaded until the first click. Nothing is sent anywhere.
import { suggestions, greetingCard } from './ask-system.js';
import { parseSheet } from './sheet_data.js';

const ROOT = new URL('../../', import.meta.url);
let mounted = null;

function mount() {
  return (mounted ||= (async () => {
    const [{ mountAssistant }, { data }] = await Promise.all([import('./assistant-ui.js'), import('./data.js')]);
    const a = await mountAssistant(await data.config());
    // answers hold portal addresses like #/product/<id>: on a sheet those must leave the sheet and open in the portal
    const panel = document.getElementById('assistant');
    if (panel) panel.addEventListener('click', (e) => { const l = e.target.closest && e.target.closest('a[href^="#/"]'); if (l) { e.preventDefault(); window.location.href = new URL(l.getAttribute('href'), ROOT).href; } }, true);
    return a;
  })().catch((e) => { mounted = null; throw e; }));
}

function askThroughBox(q) {
  const input = document.getElementById('asst-q'); const form = input && input.closest('form'); if (!input || !form) return;
  input.value = q; if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

function greet(title, hub) {
  const log = document.querySelector('#assistant .asst-log'); if (!log) return;
  let parsed = null;
  if (!hub) { try { parsed = parseSheet(document.documentElement.outerHTML); } catch { parsed = null; } }
  log.querySelectorAll('.ask-greet').forEach((n) => n.remove());
  log.append(greetingCard(title, suggestions(parsed && parsed.title ? parsed : null), askThroughBox)); log.scrollTop = log.scrollHeight;
}

async function open(el) {
  const title = el.getAttribute('data-adv-title') || 'tiling systems', hub = !el.getAttribute('data-adv-system');
  const a = await mount();
  a.open(undefined, el);
  document.body.classList.add('adv-open');
  greet(title, hub);
}

for (const el of document.querySelectorAll('[data-adv-open]')) {
  el.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    open(el).catch((err) => { console.error('advisor could not open on this page, following the link', err); window.location.href = el.href; });
  });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('adv-open'); });
