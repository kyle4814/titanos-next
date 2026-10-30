// Actions v2, UI: renders action cards inside the existing advisor panel, the slash command list, and speech input (only if the
// browser has its own speech API). Loaded lazily by assistant-ui.js when the feature flag is on; the v1 panel never depends on it.
import { h, icon, announce } from '../lib/util.js';
import { fetchStore, createData, ESTIMATE_LINE, IN_BROWSER_NOTICE } from './core.js';
import { createActions, newSession } from './flow.js';
import { createMemory } from './memory.js';
import { sharedStorage } from '../lib/projectstore.js';
import { COMMANDS } from './parse.js';
import { renderHandoff } from '../lib/handoff-ui.js';
import { observeBrainAnswer } from './brain_adapter.js';

const extLink = (href, label, cls = 'link') => h('a', { href, class: cls, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
const baseUrl = new URL('../../', import.meta.url); // the demo root, for links to the static system sheets

let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../actions.css', import.meta.url).href; document.head.append(l); }
export function safeStorage() { try { const s = window.localStorage; s.getItem('x'); return s; } catch { return null; } }

function download(ex) {
  const url = URL.createObjectURL(new Blob([ex.text], { type: ex.mime }));
  const a = h('a', { href: url, download: ex.filename }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce(`${ex.filename} downloaded`);
}

/** Print only this card: a temporary block that the print stylesheet shows alone. */
export function printCard(c, plainNode) {
  const old = document.getElementById('actions-print'); if (old) old.remove();
  const box = h('div', { id: 'actions-print' }, plainNode);
  document.body.append(box); document.body.classList.add('printing-actions');
  const done = () => { document.body.classList.remove('printing-actions'); box.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (document.getElementById('actions-print')) done(); }, 4000);
}

let onNavigate = () => {};
function valueNode(r) {
  const kids = [r.productId ? h('a', { href: '#/product/' + encodeURIComponent(r.productId), class: 'link', onclick: () => onNavigate() }, r.value) : r.value];
  if (r.source && r.source.url) kids.push(' ', extLink(r.source.url, `(${r.source.label})`));
  if (r.source && r.source.sentence && r.source.sentence !== r.value && (r.derived || !r.quote)) kids.push(h('details', { class: 'how' }, h('summary', null, 'How I know'), h('blockquote', null, r.source.sentence)));
  if (r.command) kids.push(' ', h('button', { class: 'chip chip--line', type: 'button', 'data-command': r.command }, 'Use'));
  return kids;
}
// Key and value lists, not <table>: rows are statements with a source each, and a definition list reads well on a phone. (Also keeps the portal's own tables, such as the rule ledger, the only tables on a page.)
// A compact summary list (one line per product): used for the system card steps and quantities so the chat answer stays short.
const sumList = (rows) => h('ul', { class: 'sumlist' }, rows.map((r) => h('li', null, ...(r.productId ? [h('a', { href: '#/product/' + encodeURIComponent(r.productId), class: 'link', onclick: () => onNavigate() }, r.label), ': '] : [h('strong', null, r.label), ': ']), r.value, r.source && r.source.url ? [' ', extLink(r.source.url, '(source)')] : null)));
const rowsTable = (rows, cls = '') => h('dl', { class: 'kv ' + cls }, rows.map((r) => [h('dt', { class: r.verdict ? 'v-' + r.verdict : null }, r.label), h('dd', { class: r.verdict ? 'v-' + r.verdict : null }, ...valueNode(r))]));

/** Build the DOM of one card. `act` = { send, memory, session } for buttons. */
export function renderCard(c, act) {
  const root = h('div', { class: 'msg msg--bot action-card', 'data-action': c.action, 'data-kind': c.kind });
  if (c.kind === 'clarify') {
    root.append(h('p', null, c.clarify.question));
    if (c.clarify.options && c.clarify.options.length) root.append(h('div', { class: 'opts' }, c.clarify.options.map((o) => h('button', { class: 'chip', type: 'button', onclick: () => act.send(o.value, o.label) }, o.label))));
    root.append(h('div', { class: 'cite' }, h('a', { href: '#/rules', class: 'link', onclick: () => onNavigate() }, 'How the rules are kept: the rule ledger')));
    return root;
  }
  root.append(h('div', { class: 'm-title' }, c.title));
  if (c.status === 'unknown') root.append(h('p', { class: 'chip-status chip-status--unknown' }, 'Not in the published data'));
  if (c.summary) root.append(h('p', null, c.summary));
  if (c.topButtons) root.append(h('div', { class: 'opts' }, c.topButtons.map((b) => h('a', { class: 'chip', href: new URL(b.href, baseUrl).href, target: '_blank', rel: 'noopener noreferrer' }, b.label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')))));
  if (c.assumptions && c.assumptions.length) root.append(h('ul', { class: 'm-assume' }, c.assumptions.map((a) => h('li', null, a))));
  if (c.rows && c.rows.length) root.append(rowsTable(c.rows));
  if (c.table) root.append(h('div', { class: 'cmp', role: 'table', 'aria-label': c.title },
    h('div', { class: 'cmp-row cmp-head', role: 'row' }, c.table.head.map((x) => h('div', { role: 'columnheader' }, x))),
    c.table.rows.map((r) => h('div', { class: 'cmp-row', role: 'row' }, h('div', { role: 'rowheader', class: 'cmp-label' }, r.label), r.cells.map((cell) => h('div', { role: 'cell' }, ...valueNode(cell)))))));
  for (const s of c.sections || []) { root.append(h('div', { class: 'm-title sec' }, s.title), s.compact ? sumList(s.rows) : rowsTable(s.rows)); if (s.more && s.more.length) root.append(h('details', { class: 'more' }, h('summary', null, 'More detail, limits and products that are only partly documented'), rowsTable(s.more))); }
  (c.notes || []).forEach((n) => root.append(h('p', { class: 'cite' }, n)));
  if (c.estimate) root.append(h('p', { class: 'estimate-note' }, ESTIMATE_LINE));
  if (c.copyText) { const area = h('textarea', { class: 'textarea', rows: '5', 'aria-label': c.copyAria || 'Draft clause to copy' }); area.value = c.copyText; root.append(area, h('button', { class: 'btn btn--text', type: 'button', onclick: async () => { area.select(); try { await navigator.clipboard.writeText(area.value); announce('Copied'); } catch { document.execCommand && document.execCommand('copy'); } } }, c.copyLabel || 'Copy the clause')); }
  if (c.handoffBlock) root.append(renderHandoff(c.handoffBlock));
  if (c.kind !== 'clarify' && c.kind !== 'help' && c.kind !== 'memory') {
    const seen = new Set(); const all = [...(c.rows || []), ...((c.sections || []).flatMap((s) => [...(s.rows || []), ...(s.more || [])])), ...((c.table && c.table.rows) || []).flatMap((r) => r.cells)].filter((r) => r.source && r.source.url && !seen.has(r.source.url.split('#')[0]) && seen.add(r.source.url.split('#')[0])).slice(0, 6);
    root.append(h('div', { class: 'cite' }, all.length ? h('details', { class: 'srcs' }, h('summary', null, 'Sources'), h('ol', null, all.map((r) => h('li', null, extLink(r.source.url, r.source.label, 'link'))))) : h('strong', null, 'Sources'), h('div', null, h('a', { href: '#/rules', class: 'link', onclick: () => onNavigate() }, 'How the rules are kept: the rule ledger'))));
  }
  if (c.notice) root.append(h('p', { class: 'cite notice-local' }, c.notice));
  if (c.importBox) {
    const ta = h('textarea', { class: 'textarea', rows: '5', 'aria-label': 'Projects file contents' }); const st = h('p', { class: 'cite', role: 'status', 'aria-live': 'polite' });
    const file = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Choose a projects file', onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
    root.append(file, ta, h('button', { class: 'btn', type: 'button', onclick: () => { const r = act.memory.importJSON(ta.value); st.textContent = r.ok ? `Imported ${r.projects} project(s) into this browser.` : r.error; } }, 'Import'), st);
  }
  const btns = [];
  for (const b of c.buttons || []) {
    if (b.href) btns.push(h('a', { class: 'chip', href: new URL(b.href, baseUrl).href, target: '_blank', rel: 'noopener noreferrer' }, b.label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')));
    else if (b.print) btns.push(h('button', { class: 'chip', type: 'button', onclick: () => printCard(c, printNode(c)) }, icon('file', 'i--sm'), b.label));
    else if (b.printLast) btns.push(h('button', { class: 'chip', type: 'button', onclick: () => printCard(c, printNode(act.session.last || c)) }, icon('file', 'i--sm'), b.label));
    else if (b.command) btns.push(h('button', { class: 'chip', type: 'button', onclick: () => act.send(b.command, b.label) }, b.label));
  }
  for (const ex of c.exports || []) btns.push(h('button', { class: 'chip', type: 'button', onclick: () => download(ex) }, icon('download', 'i--sm'), ex.label));
  if (btns.length) root.append(h('div', { class: 'opts', role: 'group', 'aria-label': 'What next' }, btns));
  root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-command]'); if (b) act.send(b.getAttribute('data-command')); });
  return root;
}

/** The print form: plain headings and tables, links as text, the estimate line, no chat chrome. */
export function printNode(c) {
  const wrap = h('div', { class: 'print-card' }, h('h1', null, c.title));
  if (c.summary) wrap.append(h('p', null, c.summary));
  const tbl = (rows) => h('table', { class: 'print-table' }, h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.value, r.source && r.source.url ? h('div', { class: 'print-src' }, `${r.source.label}: ${r.source.url}`) : null)))));
  if (c.rows && c.rows.length) wrap.append(tbl(c.rows));
  if (c.table) wrap.append(h('table', { class: 'print-table' }, h('thead', null, h('tr', null, c.table.head.map((x) => h('th', null, x)))), h('tbody', null, c.table.rows.map((r) => h('tr', null, h('th', null, r.label), r.cells.map((cell) => h('td', null, cell.value, cell.source && cell.source.url ? h('div', { class: 'print-src' }, cell.source.url) : null)))))));
  for (const s of c.sections || []) wrap.append(h('h2', null, s.title), tbl([...s.rows, ...(s.more || [])]));
  (c.notes || []).forEach((n) => wrap.append(h('p', null, n)));
  if (c.estimate) wrap.append(h('p', { class: 'print-estimate' }, ESTIMATE_LINE));
  wrap.append(h('p', { class: 'print-foot' }, 'Built from Sika Australia\'s public data sheets. Not an official Sika document. Technical Services decides suitability.'));
  return wrap;
}

/* ---------------------------------------------------------------- slash command list and speech */
function attachSlash(input, form, send) {
  const list = h('ul', { class: 'slash-list', id: 'slash-list', role: 'listbox', 'aria-label': 'Commands', hidden: true });
  form.parentNode.insertBefore(list, form);
  let items = []; let idx = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); idx = -1; input.removeAttribute('aria-activedescendant'); };
  const pick = (cmd) => { input.value = cmd + ' '; close(); input.focus(); };
  const render = () => {
    list.replaceChildren(...items.map(([cmd, , desc], i) => h('li', { role: 'option', id: 'slash-' + i, 'aria-selected': String(i === idx), class: i === idx ? 'on' : '' }, h('button', { type: 'button', tabindex: '-1', onmousedown: (e) => e.preventDefault(), onclick: () => pick(cmd) }, h('strong', null, cmd), ' ', h('span', null, desc)))));
    list.hidden = !items.length; input.setAttribute('aria-expanded', String(!!items.length));
    if (idx >= 0) input.setAttribute('aria-activedescendant', 'slash-' + idx); else input.removeAttribute('aria-activedescendant');
  };
  input.setAttribute('aria-controls', 'slash-list'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
  input.addEventListener('input', () => {
    const v = input.value;
    if (!v.startsWith('/') || /\s/.test(v)) { close(); return; }
    items = COMMANDS.filter(([cmd]) => cmd.startsWith(v.toLowerCase())); idx = items.length ? 0 : -1; render();
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Tab' || (e.key === 'Enter' && idx >= 0 && input.value.toLowerCase() !== items[idx][0])) { e.preventDefault(); pick(items[idx][0]); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { show() { input.value = '/'; input.focus(); input.dispatchEvent(new Event('input')); } };
}

export const speechSupported = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
// Voice input is OFF unless the address carries voice=1 (or localStorage sika-demo-210c0c-voice = on). The browser's own speech service sends the audio to its vendor (Chrome sends it to Google),
// which would break the portal's promise that nothing leaves the page; typing sends nothing. When it is on, a note beside the button says so.
export const voiceOn = () => { try { return /[?&]voice=1/.test(location.href) || localStorage.getItem('sika-demo-210c0c-voice') === 'on'; } catch { return false; } };
function attachSpeech(input, form) {
  const status = h('p', { class: 'cite voice-status', role: 'status', 'aria-live': 'polite' });
  let rec = null; let on = false;
  const btn = h('button', { class: 'btn btn--text mic', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Speak your question', onclick: () => {
    if (!speechSupported()) { status.textContent = 'Voice input is not available in this browser. Please type your question instead.'; return; }
    if (on && rec) { rec.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new SR(); rec.lang = 'en-AU'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { on = true; btn.setAttribute('aria-pressed', 'true'); status.textContent = 'Listening. Speak your question.'; };
    rec.onresult = (e) => { const t = e.results[0][0].transcript; input.value = t; status.textContent = 'Heard: ' + t + '. Press Send, or edit it first.'; input.focus(); };
    rec.onerror = (e) => { status.textContent = 'Voice input did not work (' + (e.error || 'error') + '). Please type your question instead.'; };
    rec.onend = () => { on = false; btn.setAttribute('aria-pressed', 'false'); };
    try { rec.start(); } catch { status.textContent = 'Voice input could not start. Please type your question instead.'; }
  } }, icon('send', 'i--sm'), h('span', { class: 'visually-hidden' }, 'Speak'));
  btn.classList.toggle('mic--off', !speechSupported());
  status.textContent = "Voice input uses your browser's own speech service, which may send the audio to the browser's vendor. Typing sends nothing.";
  form.insertBefore(btn, form.lastElementChild);
  form.parentNode.insertBefore(status, form);
  return btn;
}

/** After a v2 advisor answer that names products: an "add to my project" chip for each (the ordinary /add command, by name). */
function brainAddButtons(log, answer, send) {
  try {
    const seen = new Map(); for (const c of (answer && answer.cards) || []) if (c && c.product && c.product.id && c.product.name && !seen.has(c.product.id)) seen.set(c.product.id, String(c.product.name).replace(/[®™]/g, ''));
    const last = log && log.lastElementChild; if (!seen.size || !last || last.querySelector('[data-cart-add]')) return;
    const chips = [...seen].slice(0, 3).map(([id, name]) => h('button', { class: 'chip', type: 'button', 'data-cart-add': id, onclick: () => send('/add ' + name, 'Add ' + name + ' to my project') }, 'Add ' + name + ' to my project'));
    last.append(h('div', { class: 'opts', role: 'group', 'aria-label': 'Add to my project' }, chips));
  } catch { /* a missing button never breaks an answer */ }
}

/**
 * Attach the actions to the advisor panel. panel parts: { log, input, form, sugg, add(node), send(text,label) }.
 * Returns { handle(text) -> Node|null, observeV1(text, answer, outcome), observeBrain(answer) }.
 */
export function attachActions({ log, input, form, sugg, add, send, config, close }) {
  if (close) onNavigate = close;
  css();
  const store = fetchStore(new URL('../../data/', import.meta.url));
  const data = createData(store);
  const memory = createMemory(sharedStorage()); // the same store the My projects page uses
  const actions = createActions({ data, memory, config });
  let session = newSession();
  const slash = attachSlash(input, form, send);
  if (voiceOn()) attachSpeech(input, form);
  if (sugg) sugg.prepend(h('button', { class: 'chip', type: 'button', onclick: () => slash.show() }, '/ commands'));
  const act = { send, memory, get session() { return session; } };
  return {
    memory, actions, get session() { return session; },
    async handle(text) {
      const r = await actions.run(text, session); session = r.session;
      if (!r.handled) return null;
      const oc = r.card.kind === 'clarify' ? 'CLARIFY' : r.card.status === 'unknown' ? 'NOT_IN_PUBLISHED_DATA' : 'ANSWERED_WITH_SOURCE';
      const node = renderCard(r.card, act);
      if (r.card.cartLinks) node.append(h('div', { class: 'opts' }, h('a', { class: 'chip chip--line', href: '#/projects', 'data-cart-page': '1', onclick: () => onNavigate() }, 'Open my projects page')));
      return { node, outcome: oc };
    },
    observeV1(text, answer, outcome) { if (outcome === 'NOT_IN_PUBLISHED_DATA' && text && !text.startsWith('/')) memory.addGap(text); memory.rememberQuestion(text, 'ask'); },
    observeBrain(answer) { const raw = (answer && answer.brain) || answer; /* the panel hands over the adapted answer; the brain's own answer (with its cards) is inside it */ session.cartFocus = null; observeBrainAnswer(session, raw); brainAddButtons(log, raw, send); },
  };
}
