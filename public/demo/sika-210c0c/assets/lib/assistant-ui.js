// Chat panel for the rule-based advisor. The engine (assets/assistant/engine.js) is plain code: no model, no network calls.
// It is imported and its data is fetched only when the panel is first opened.
import { h, icon, esc, $, announce, hashHref, focusSoon } from './util.js';
import { data, derived, documents, docOk, docHref } from './data.js';
import { typeLabel } from './views2.js';
import { renderHandoff } from './handoff-ui.js';
import { insights } from './insights.js';
import { outcomeOf } from './insights-core.js';
import { matchRule, previewRule, validSource } from './corrections.js';
import { askWithData, decorateBlock } from './apply_data.js';
import { estimateNote } from './terms.js';

let cfg, engine, ready, state = null, log, input, panel, fab, opener, dv, D, rules = null;
const history = [];

function inline(text) { // plain text with **bold** only
  const frag = document.createDocumentFragment();
  String(text).split(/(\*\*[^*]+\*\*)/g).forEach((part) => { if (/^\*\*[^*]+\*\*$/.test(part)) frag.append(h('strong', null, part.slice(2, -2))); else if (part) frag.append(document.createTextNode(part)); });
  return frag;
}
function para(text) { return h('p', null, ...String(text).split('\n').flatMap((l, i) => [i ? h('br') : null, inline(l)])); }
function extLink(href, label, cls = '') { return h('a', { href, class: cls, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')); }

function renderBlock(b) {
  switch (b.type) {
    case 'text': return para(b.text);
    case 'products': return h('div', { class: 'stack', style: 'display:grid;gap:.5rem' }, b.title ? h('div', { class: 'm-title' }, b.title) : null,
      b.items.map((it) => { const p = dv.byId.get(it.id); if (!p) return null; return h('div', { class: 'm-prod' }, h('a', { href: '#/product/' + p.id, onclick: closeOnMobile }, p.n), ' ', h('span', { class: 'count' }, p.b), it.reason ? h('p', null, it.reason) : null); }));
    case 'docs': return h('div', null, b.title ? h('div', { class: 'm-title' }, b.title) : null, h('ul', { class: 'm-docs' }, b.items.map((it) => { const d = D.byId.get(it.id); if (!d || !docOk(d)) return null; return h('li', null, icon('file', 'i--sm'), extLink(docHref(d), it.label || d.title, 'link')); })));
    case 'facts': return h('div', null, b.title ? h('div', { class: 'm-title' }, b.title) : null, h('table', { class: 'm-table' }, h('tbody', null, b.rows.map((r) => h('tr', null, h('th', { scope: 'row' }, r.label), h('td', null, r.value, r.source ? [' ', extLink(r.source.url, `(${r.source.label})`, 'link')] : null))))));
    case 'quote': return h('div', null, h('div', { class: 'm-title' }, b.title),
      h('div', { class: 'table-wrap' }, h('table', { class: 'm-table' }, h('thead', null, h('tr', null, ['Product', 'Quantity', 'Basis', 'Source'].map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, b.lines.map((l) => h('tr', null, h('td', null, h('a', { href: '#/product/' + l.productId, onclick: closeOnMobile }, l.product)), h('td', null, l.quantity, l.packs ? h('br') : null, l.packs || ''), h('td', null, l.basis, l.note ? [h('br'), l.note] : null), h('td', null, extLink(l.source.url, l.source.label, 'link'))))))),
      b.total ? para(b.total) : null, b.assumptions && b.assumptions.length ? h('ul', { class: 'm-assume' }, b.assumptions.map((a) => h('li', null, a))) : null,
      h('p', { class: 'estimate-note' }, estimateNote(cfg)));
    case 'ask': return h('div', null, para(b.question), b.options ? h('div', { class: 'opts' }, b.options.map((o) => h('button', { class: 'chip', type: 'button', onclick: () => send(o.value, o.label) }, o.label))) : null);
    case 'steps': return h('div', null, h('div', { class: 'm-title' }, b.title), h('div', { class: 'opts' }, b.options.map((o) => h('button', { class: 'chip', type: 'button', onclick: () => send(o.value, o.label) }, o.label))));
    case 'handoff': return renderHandoff(b);
    default: return null;
  }
}
const closeOnMobile = () => { if (window.matchMedia('(max-width: 39.99em)').matches) setOpen(false); };

function renderAnswer(a) {
  const body = h('div', { class: 'msg msg--bot' });
  const hasFrom = a.blocks.some((b) => b.type === 'text' && /published documentation/i.test(b.text));
  a.blocks.forEach((b) => { const n = renderBlock(b); if (n) body.append(decorateBlock(n, b)); });
  if (a.citations && a.citations.length) {
    const seen = new Set(); const cites = a.citations.filter((c) => !seen.has(c.url) && seen.add(c.url));
    body.append(h('div', { class: 'cite' }, h('strong', null, 'Sources'), h('ol', null, cites.map((c) => h('li', null, extLink(c.url, c.label + (c.kind === 'pdf' ? ' (PDF)' : ''), 'link')))), hasFrom ? null : h('div', null, `From ${cfg.company.publishedDocsPhrase}.`), h('div', null, h('a', { href: '#/rules', class: 'link', onclick: closeOnMobile }, 'How the rules are kept: the rule ledger'))));
  }
  if (a.correctedBy) body.append(h('p', { class: 'cite' }, `Corrected by ${a.correctedBy.who} on ${String(a.correctedBy.when).slice(0, 10)}. This answer comes from a rule that is checked before the documentation index.`));
  body.append(h('button', { class: 'btn btn--text suggest-btn', type: 'button', onclick: () => { add(suggestPanel(a.query)); } }, 'Suggest a correction'));
  if (a.followups && a.followups.length) body.append(h('div', { class: 'opts', 'aria-label': 'Suggested follow-up questions' }, a.followups.slice(0, 3).map((f) => h('button', { class: 'chip', type: 'button', onclick: () => send(f) }, f))));
  return body;
}

function add(node) { log.append(node); log.scrollTop = log.scrollHeight; }
export async function send(text, label) {
  text = String(text || '').trim(); if (!text) return;
  add(h('div', { class: 'msg msg--user' }, label || text));
  const wait = h('div', { class: 'msg msg--bot', 'aria-label': 'The advisor is looking' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i'))); add(wait);
  try {
    await ensure();
    const t0 = performance.now();
    const rule = matchRule(rules, text);
    const a = rule ? ruleAnswer(rule, text) : await askWithData(engine, text, state); state = a.state || null;
    await new Promise((r) => setTimeout(r, 140));
    wait.replaceWith(renderAnswer(a)); log.scrollTop = log.scrollHeight;
    announce('The advisor has answered.');
    history.push({ q: text, intent: a.intent, ms: Math.round(performance.now() - t0) });
    const oc = outcomeOf(a); if (oc) insights.question(text, oc); // T11, this browser only
    if (a.state && a.state.facets && Object.values(a.state.facets).filter((v) => Array.isArray(v) && v.length).length >= 2) insights.combo(Object.values(a.state.facets).flat().join(' / '));
  } catch (e) {
    wait.replaceWith(h('div', { class: 'msg msg--bot' }, h('p', null, 'The advisor could not run in this browser. ' + (e && e.message ? e.message : ''))));
  }
}


function ruleAnswer(rule, text) {
  return { intent: 'clarify', query: text, blocks: [{ type: 'text', text: rule.answer }], citations: [{ label: 'Source for this correction', url: rule.source_url, kind: 'page' }], followups: [], state: null, debug: { tokens: [], matched: [], ms: 0 },
    correctedBy: { who: rule.who, when: rule.corrected_at } };
}
function suggestPanel(lastQ) {
  const q = h('input', { class: 'input', id: 'sg-q', value: lastQ || '', 'aria-label': 'The question that was answered wrongly' });
  const ans = h('textarea', { class: 'textarea', id: 'sg-a', rows: '3', 'aria-label': 'The right answer' });
  const src = h('input', { class: 'input', id: 'sg-s', placeholder: 'https:// link to the page or data sheet that proves it', 'aria-label': 'Source link' });
  const who = h('input', { class: 'input', id: 'sg-w', placeholder: 'Your name', 'aria-label': 'Your name' });
  const out = h('pre', { class: 'rule-preview', 'aria-live': 'polite' });
  const form = h('form', { class: 'sg-form', onsubmit: (e) => { e.preventDefault(); if (!validSource(src.value)) { out.textContent = 'A correction needs a source link (https://...). Without one it never becomes a rule.'; return; } out.textContent = 'Demo only: nothing was saved or sent. This is the rule that would be created, with a test case added the same day:\n\n' + JSON.stringify(previewRule({ question: q.value, answer: ans.value, source: src.value.trim(), who: who.value || 'a rep' }), null, 1); } },
    h('p', null, 'In a live version a rep fixes an answer in one minute. The fix is saved with their name, the date and a source link, becomes a rule that beats the index the next time that question is asked, and gets a test so it cannot slip back. Nothing here is saved or sent.'),
    q, ans, src, who, h('button', { class: 'btn', type: 'submit' }, 'Preview the rule'), out);
  return h('div', { class: 'msg msg--bot' }, h('div', { class: 'm-title' }, 'Suggest a correction (demo only)'), form);
}

async function ensure() {
  if (ready) return ready;
  ready = (async () => {
    const [{ createAssistant }, products, documents_, categories, pages] = await Promise.all([import('../assistant/engine.js'), data.products(), documents(), data.categories(), data.pages()]);
    D = documents_;
    const knowledge = {}; for (const k of ['rates', 'compatibility', 'safety', 'decision_trees', 'problems']) { const v = await data.knowledge(k); if (v) knowledge[k] = v; }
    const rj = await data.knowledge('rules'); rules = rj && rj.rules ? rj.rules : null;
    engine = createAssistant({ products, documents: D.docs, categories, pages, config: cfg, knowledge: Object.keys(knowledge).length ? knowledge : undefined });
    return engine;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export function setOpen(on, from) {
  panel.classList.toggle('open', on); panel.setAttribute('aria-hidden', String(!on)); fab.hidden = on && window.matchMedia('(max-width: 39.99em)').matches;
  if (from) opener = from;
  if (on) { document.body.classList.toggle('lock', window.matchMedia('(max-width: 39.99em)').matches); focusSoon(input); }
  else { document.body.classList.remove('lock'); const o = opener && document.contains(opener) ? opener : fab; if (o && !o.hidden) focusSoon(o); }
}

export async function mountAssistant(config) {
  cfg = config; dv = await derived(); D = { byId: new Map(), docs: [] };
  fab = h('button', { class: 'fab', type: 'button', id: 'asst-fab', 'aria-controls': 'assistant', 'aria-expanded': 'false', onclick: (e) => setOpen(!panel.classList.contains('open'), e.currentTarget) }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Product advisor');
  log = h('div', { class: 'asst-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  input = h('input', { id: 'asst-q', type: 'text', autocomplete: 'off', placeholder: 'Ask about a product, a job or a document', 'aria-label': 'Ask the product advisor', enterkeyhint: 'send' });
  const form = h('form', { class: 'asst-form', onsubmit: (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(v); } }, input, h('button', { class: 'btn', type: 'submit', 'aria-label': 'Send' }, icon('send', 'i--sm'), h('span', { class: 'visually-hidden' }, 'Send')));
  const sugg = h('div', { class: 'asst-sugg', 'aria-label': 'Example questions' }, cfg.home.assistantQuestions.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => send(q) }, q)));
  panel = h('aside', { class: 'assistant', id: 'assistant', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'asst-title', 'aria-hidden': 'true', onkeydown: (e) => { if (e.key === 'Escape') setOpen(false); } },
    h('div', { class: 'asst-head' }, h('h2', { id: 'asst-title' }, 'Product advisor', h('small', null, 'Demo, built from ' + cfg.company.publishedDocsPhrase)), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': 'Close the advisor', onclick: () => setOpen(false) }, icon('close'), h('span', { class: 'visually-hidden' }, 'Close'))),
    h('div', { class: 'asst-note' }, 'Plain code running in your browser: no AI model, no network calls, no tracking, zero running cost. Every answer links its source. Where the documentation does not say, it says so.'),
    log, sugg, form);
  add(h('div', { class: 'msg msg--bot' }, para(`Hi. I can find the right ${cfg.company.short} product for a job, quote published coverage rates, open a data sheet or SDS, check what goes with what, and work out how much you need for an area.`), para('I only answer from the published documentation, and I will say so when it does not cover something.')));
  document.body.append(fab, panel);
  window.addEventListener('hashchange', () => {});
  return { open: (q, from) => { setOpen(true, from || document.activeElement); if (q) send(q); }, send, history };
}
