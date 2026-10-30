// Hand-off block view (T06). Demo only: it composes the visitor's question and selections into a copyable block and says so.
// Nothing is submitted anywhere. The link opens the real contact page in a new tab; the visitor pastes the block in themselves.
import { h } from './util.js';

function productUrl(id) { return location.href.split('#')[0] + '#/product/' + encodeURIComponent(id); }

export function handoffText(b) {
  return b.text + (b.products && b.products.length ? '\n' + b.products.map((p) => 'Product page: ' + productUrl(p.id)).join('\n') : '');
}

/** Copy to the clipboard if the browser allows it, otherwise select the text in the visible textarea so Ctrl+C works. */
async function copyOut(area, status) {
  area.focus(); area.select();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(area.value); status.textContent = 'Copied. Paste it into the enquiry form.'; return; }
  } catch { /* fall through to the selection fallback */ }
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  status.textContent = ok ? 'Copied. Paste it into the enquiry form.' : 'The text is selected. Press Ctrl+C (or hold and copy on a phone).';
}

export function renderHandoff(b) {
  const area = h('textarea', { class: 'textarea handoff-text', rows: '6', readonly: true, 'aria-label': 'Text to copy for the enquiry form' });
  area.value = handoffText(b);
  const status = h('p', { class: 'cite handoff-status', role: 'status', 'aria-live': 'polite' });
  const c = b.contact || {};
  return h('div', { class: 'handoff', 'data-block': 'handoff' },
    h('div', { class: 'm-title' }, b.title),
    h('p', null, b.reason + ' ' + b.note),
    area,
    h('div', { class: 'opts' },
      h('button', { class: 'btn', type: 'button', 'data-act': 'copy-handoff', onclick: () => copyOut(area, status) }, 'Copy for the enquiry form'),
      c.url ? h('a', { class: 'btn btn--text', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the contact page', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')) : null,
      c.phone ? h('a', { class: 'btn btn--text', href: 'tel:' + c.phone.replace(/[^+0-9]/g, '') }, 'Phone ' + c.phone) : null),
    status);
}
