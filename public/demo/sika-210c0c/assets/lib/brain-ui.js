// brain-ui.js: the v2 brain behind the existing chat panel. Plain code, no model. The panel keeps its look: cards are rendered with the panel's own classes.
// Feature flag: ?brain=0 forces the v1 advisor, ?brain=1 forces v2, otherwise BRAIN_DEFAULT decides. A missing shard falls back to v1.
import { h, icon } from './util.js';
import { chipEl } from './apply_data.js';
import { buildHandoff } from '../assistant/handoff.js';
import { renderHandoff } from './handoff-ui.js';
import { estimateNote } from './terms.js';

export const BRAIN_DEFAULT = true;
export function brainOn() {
  // offline the shards and the brain modules are not in the cache: go straight to v1 (cached) instead of failing four fetches and logging console errors
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try { const p = new URLSearchParams(location.search).get('brain'); if (p === '0') return false; if (p === '1') return true; } catch { /* no location in tests */ }
  return BRAIN_DEFAULT;
}

// Lane D: the plan engine (brain/rules.js) is not in the bundle. The first time a question looks like a job with several constraints it is fetched as a plain module script
// (script-src 'self' allows it); it hands { createRules } back on globalThis. Offline, or if it cannot load, the answer stack carries on without it.
function loadRulesModule() {
  if (globalThis.__sikaRules) return Promise.resolve(globalThis.__sikaRules);
  return (globalThis.__sikaRulesP ||= new Promise((resolve) => {
    try { const s = document.createElement('script'); s.type = 'module'; s.src = new URL('../brain/rules.js', import.meta.url).href; s.onload = () => resolve(globalThis.__sikaRules || null); s.onerror = () => resolve(null); document.head.appendChild(s); } catch { resolve(null); }
  }));
}
let brainP = null, bstate = null, stateLoaded = false, persist = null;
// the conversation context survives a page reload (assets/brain/persist.js: sessionStorage, optional)
// persist.js is fetched with the brain (first question), not with the first screen
export const resetBrainState = (store) => { bstate = null; stateLoaded = true; try { (store || globalThis.sessionStorage).removeItem('sika-brain-state-v1'); } catch { /* no storage */ } };
// one in-page memo of fetched JSON, shared with the actions layer (assets/actions/core.js), so a shard is never downloaded twice on a cold load
const jsonMemo = (globalThis.__sikaJson ||= new Map());
const fetchJson = (rel) => { const url = new URL('../../' + rel, import.meta.url).href; if (!jsonMemo.has(url)) jsonMemo.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)); return jsonMemo.get(url); };
export function ensureBrain() {
  return (brainP ||= (async () => {
    // the two shards every question needs start downloading while the modules are still loading
    const seed = { 'core.json': fetchJson('data/brain/core.json'), 'rules.json': fetchJson('data/brain/rules.json') };
    // every module is requested at once (brain.js imports the rest, so asking for them together removes one round trip)
    const [{ createBrain }, { createLoader }] = await Promise.all([import('../brain/brain.js'), import('../brain/loader.js'), import('../brain/text.js'), import('../brain/syn.js'), import('../brain/facets.js'), import('../brain/schema.js'), import('../brain/cards.js')]);
    const brain = createBrain({ load: createLoader({ base: 'data/brain/', fetchJson, seed }), loadRules: loadRulesModule });
    await brain.boot();
    return brain;
  })().catch(() => { brainP = null; return null; }));
}
/** New chat: forget the conversation state the brain carries between turns and its saved copy (persist.js), so a reload does not bring it back (the loaded data stays). */
export function resetBrain(store) { resetBrainState(store); }
/** Start loading the brain while the visitor is still typing (called when the panel opens). */
export function prefetchBrain() { if (brainOn()) ensureBrain(); }
/** Ask the brain and return a panel-shaped answer, or null when the brain cannot run (the caller falls back to v1). */
export async function brainAnswer(text) {
  const brain = await ensureBrain(); if (!brain) return null;
  try { persist ||= await import('../brain/persist.js'); } catch { persist = { loadBrainState: () => null, saveBrainState() {} }; }
  if (!stateLoaded) { stateLoaded = true; bstate = persist.loadBrainState(); }
  let a; try { a = await brain.ask(text, bstate); } catch { return null; }
  bstate = a.state || bstate; persist.saveBrainState(bstate);
  const sourced = a.cards.filter((c) => c.status === 'PUBLISHED' && c.source);
  const noneKnown = a.cards.length && a.cards.every((c) => c.type === 'unknown');
  return { intent: noneKnown && !a.cards.some((c) => c.product) ? 'out_of_scope' : a.intent, query: text, blocks: a.cards.map((card) => ({ type: 'brain', card })), citations: sourced.map((c) => ({ label: c.title, url: c.source.source_url, kind: 'page' })), followups: a.followups, state: null, debug: { tokens: [], matched: [], ms: a.ms }, brain: a };
}

const ext = (href, label, cls = '') => h('a', { href, class: cls, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
/** The document's own title, read from the product shard the answer was built from (already in the page memo, so no new request); null when it is not there. */
async function docTitle(c, f) {
  if (!c.product || !c.product.id) return null;
  const sh = await fetchJson('data/brain/p/' + encodeURIComponent(c.product.id) + '.json'); if (!sh) return null;
  const base = String(f.source_url || '').replace(/#page=\d+$/, '');
  const d = (sh.dc || []).find((x) => x.u === base); if (d && d.t) return d.t;
  return sh.sp && sh.sp.ds && sh.sp.ds.url === base && sh.sp.ds.title ? sh.sp.ds.title : null;
}
/** "Show the source" for one fact of a card (see cite.js): [control], or [] when the fact has no link to open. The panel code is fetched the first time the button is pressed, so it is not part of the first screen. */
function cite(c, f) {
  if (!(f && /^https?:/.test(f.source_url))) return [];
  const first = h('button', { class: 'src-btn', type: 'button', 'aria-expanded': 'false' }, 'Show the source');
  const slot = h('span', { class: 'src-slot' }, first);
  first.addEventListener('click', async () => {
    const { citeModel, sourceControl } = await import('./cite.js');
    const [btn, panel] = sourceControl(citeModel({ quote: f.sentence, url: f.source_url, docType: f.doc_type, version: f.doc_version, page: f.page, productName: c.product ? c.product.name : '' }), { lazyTitle: () => docTitle(c, f) });
    slot.replaceChildren(btn, panel); btn.click(); btn.focus();
  }, { once: true });
  return [slot];
}
const closeOnMobile = () => { const m = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 39.99em)').matches; if (m && window.__asstClose) window.__asstClose(); };

/** Lane D: the button under a plan card: saves the system, its documents and the timeline note into the shared project store when pressed. */
function planSaveButton(commit) {
  const msg = h('span', { role: 'status' }), btn = h('button', { class: 'chip', type: 'button' }, 'Add the plan to my project');
  btn.addEventListener('click', async () => { try { const [{ createProjectStore: c, sharedStorage: s }, { commitPlan: p }] = await Promise.all([import('./projectstore.js'), import('../brain/plansave.js')]); msg.textContent = p(c(s(), null, { origin: 'portal' }), commit).ok ? ' Saved to your project.' : ' Could not save the plan.'; } catch { msg.textContent = ' Could not save the plan.'; } });
  return h('p', null, btn, msg);
}

/** One card -> DOM. The same fields feed schema.cardText(), which the tests read. */
export function renderCard(c, cfg, send) {
  const kids = [];
  if (c.title) kids.push(h('div', { class: 'm-title' }, c.product && c.type === 'product' ? h('a', { href: '#/product/' + c.product.id, onclick: closeOnMobile }, c.title) : c.title));
  if (c.headline) kids.push(h('p', null, c.headline));
  const srcOf = (l) => c.facts.find((f) => f.sentence && f.sentence === l.text);
  if (c.lines && c.lines.length) kids.push(h('table', { class: 'm-table' }, h('tbody', null, c.lines.map((l) => { const f = srcOf(l); return h('tr', null, h('th', { scope: 'row' }, l.label), h('td', null, l.text, f && /^https?:/.test(f.source_url) ? [' ', ...cite(c, f)] : null)); }))));
  if (c.table) kids.push(h('div', { class: 'table-wrap' }, h('table', { class: 'm-table' }, h('thead', null, h('tr', null, c.table.cols.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, c.table.rows.map((r) => h('tr', null, r.map((x, i) => (i === 0 ? h('th', { scope: 'row' }, x) : h('td', null, x)))))))));
  if (c.links && c.links.length) kids.push(h('ul', { class: 'm-docs' }, c.links.map((l) => h('li', null, icon('file', 'i--sm'), /^https?:/.test(l.url) ? ext(l.url, l.label, 'link') : h('a', { class: 'link', href: l.url }, l.label)))));
  if (c.type === 'calculation') kids.push(h('p', { class: 'estimate-note' }, estimateNote(cfg)));
  if (c.handoff) {
    const blk = buildHandoff({ query: c.handoff.question, products: c.product ? [{ id: c.product.id, name: c.product.name }] : [], reason: c.handoff.reason, config: cfg });
    kids.push(renderHandoff(blk));
  }
  if (c.type === 'choose' && c.followups.length && send) kids.push(h('div', { class: 'opts' }, (c.choices || c.followups.map((f) => ({ label: f, value: f }))).map((o) => h('button', { class: 'chip', type: 'button', onclick: () => send(o.value, o.label) }, o.label))));
  if (c.type === 'plan' && c.plan && c.plan.commit) kids.push(planSaveButton(c.plan.commit)); // lane D: "Add the plan to my project", through the shared project store
  if (c.type === 'calculation' && ((send && (c.followups || []).some((f) => /^How much /.test(f))) || c.cart)) { const slot = h('span'); kids.push(slot); import('./cartbtn.js').then((m) => slot.replaceWith(...m.calcExtras(c, send))).catch(() => slot.remove()); } // the product, tile or joint options a quantity answer still needs, and "Add 3 x 2 L pails to my quote": fetched only when a quantity answer offers them
  if (c.chip) kids.push(chipEl(c.status, c.chip));
  const evid = c.facts.filter((f) => f.sentence);
  if (evid.length) kids.push(h('details', { class: 'hik' }, h('summary', null, 'How I know'), h('ul', null, evid.map((f) => h('li', null,
    h('blockquote', null, f.sentence),
    h('span', { class: 'hik-src' }, (f.doc_type === 'PDS' ? 'Data sheet' : f.doc_type === 'SDS' ? 'Safety data sheet' : 'Published page') + (f.doc_version ? ', ' + f.doc_version : '') + (f.page ? ', page ' + f.page : '')), ' ', ...cite(c, f))))));
  return h('div', { class: 'blk', 'data-card': c.type, 'data-status': c.status }, kids);
}
