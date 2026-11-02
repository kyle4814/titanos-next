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
import { brainOn, brainAnswer, renderCard, prefetchBrain, resetBrain } from './brain-ui.js';

let cfg, engine, ready, state = null, log, input, panel, fab, opener, dv, D, rules = null, formEl, suggEl;
// Actions v2 (apply/actions): slash commands, action cards, project memory. Feature flag: config.actions.enabled; off with #/...?actions=off or localStorage sika-demo-210c0c-actions = off. Off means v1 behaviour exactly.
const actionsOn = () => { if (typeof navigator !== 'undefined' && navigator.onLine === false) return false; /* offline: the actions shards are not cached, so v1 exactly */ try { if (/[?&]actions=off/.test(location.href) || localStorage.getItem('sika-demo-210c0c-actions') === 'off') return false; } catch { /* storage blocked: keep the config value */ } return Boolean(cfg && cfg.actions && cfg.actions.enabled); };
let A = null, Ap = null;
// Voice input (sika-voice-phone): the browser's own Web Speech API only. No server, no model, nothing of ours listens. OFF until one tap; absent where the browser has no SpeechRecognition.
const VKEY = 'sika-demo-210c0c-voice';
const speechCtor = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
const voiceStored = () => { try { return localStorage.getItem(VKEY) === 'on'; } catch { return false; } };
const voiceStore = (on) => { try { if (on) localStorage.setItem(VKEY, 'on'); else localStorage.removeItem(VKEY); } catch { /* storage blocked: stays on for this visit only */ } };
const VOICE_ERR = { 'not-allowed': 'Microphone permission is blocked for this page. Allow it in your browser settings to use voice input.', 'service-not-allowed': 'Microphone permission is blocked for this page. Allow it in your browser settings to use voice input.', 'no-speech': 'No speech heard. Tap the microphone and try again.', 'audio-capture': 'No microphone was found on this device.', network: 'Your browser\'s speech service could not be reached. Type the question instead.' };
function voiceControls() {
  const C = speechCtor(); if (!C) return null; // no engine: no control at all
  let on = voiceStored(), rec = null, listening = false;
  const msg = h('p', { class: 'asst-voice-msg', id: 'asst-voice-msg', role: 'status' });
  const mic = h('button', { class: 'asst-mic', type: 'button', id: 'asst-mic', 'aria-pressed': 'false', 'aria-label': 'Speak your question', title: 'Speak your question' }, icon('mic', 'i--sm'));
  const tog = h('button', { class: 'chip chip--line', type: 'button', id: 'asst-voice-toggle', 'aria-pressed': String(on) });
  const paint = () => { tog.setAttribute('aria-pressed', String(on)); tog.textContent = on ? 'Voice input: on' : 'Voice input: off'; mic.hidden = !on; if (!on) msg.textContent = ''; };
  const stop = () => { try { rec && rec.stop(); } catch { /* already stopped */ } listening = false; mic.setAttribute('aria-pressed', 'false'); };
  tog.addEventListener('click', () => { on = !on; voiceStore(on); if (!on) stop(); paint(); });
  mic.addEventListener('click', () => {
    if (listening) { stop(); return; }
    msg.textContent = '';
    try {
      rec = new C(); rec.lang = 'en-AU'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { const r = e.results && e.results[e.results.length - 1]; const txt = r && r[0] ? String(r[0].transcript || '').trim() : ''; if (txt) { input.value = txt; input.focus(); } else msg.textContent = VOICE_ERR['no-speech']; };
      rec.onerror = (e) => { msg.textContent = VOICE_ERR[e && e.error] || 'Voice input could not run on this device. Type the question instead.'; };
      rec.onend = () => { listening = false; mic.setAttribute('aria-pressed', 'false'); };
      listening = true; mic.setAttribute('aria-pressed', 'true'); rec.start();
    } catch { listening = false; mic.setAttribute('aria-pressed', 'false'); msg.textContent = 'Voice input could not start on this device. Type the question instead.'; }
  });
  paint();
  const bar = h('div', { class: 'asst-voice' }, tog, h('small', null, 'Uses your phone\'s own speech input. Nothing leaves your device except what your browser\'s own speech service does. Off until you turn it on. You press send yourself.'), msg);
  return { mic, bar };
}
const ensureActions = () => (actionsOn() ? (Ap ||= import('../actions/ui.js').then((m) => { A = m.attachActions({ log, input, form: formEl, sugg: suggEl, add, send, config: cfg, close: closeOnMobile }); return A; }).catch(() => { A = null; return null; })) : Promise.resolve(null));
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
    case 'ask': return h('div', null, para(b.question), b.options ? chipRow(b.options, 'Choices') : null);
    case 'steps': return h('div', null, h('div', { class: 'm-title' }, b.title), chipRow(b.options, 'Choices'));
    case 'handoff': return renderHandoff(b);
    case 'brain': return renderCard(b.card, cfg, send);
    default: return null;
  }
}
const closeOnMobile = () => { if (window.matchMedia('(max-width: 39.99em)').matches) setOpen(false); };

// Conversational replies: a social reply or a clarifying question (a brain "choose" card that quotes no document) is a compact left bubble with its chips right under it. Product and evidence answers keep their card, in the same thread.
const isChat = (a) => Boolean(a && a.brain && a.blocks.length && a.blocks.every((b) => b.type === 'brain' && b.card && b.card.type === 'choose' && !(b.card.facts && b.card.facts.length)));
function chatBubble(card) {
  const lead = String(card.title || '').trim(), head = String(card.headline || '').trim();
  const text = lead && head ? (/[.!?]$/.test(lead) ? lead : lead + '.') + ' ' + head : lead || head;
  const opts = (card.choices || (card.followups || []).map((f) => ({ label: f, value: f })));
  return h('div', { class: 'msg msg--bot msg--chat' }, h('p', null, text), opts.length ? chipRow(opts, 'Suggested replies') : null);
}
// chips sit under the bubble that asked; once one is tapped the row is marked used (it stays tappable, so a changed mind or a double tap still works)
function chipRow(opts, label) {
  const row = h('div', { class: 'opts', role: 'group', 'aria-label': label });
  opts.forEach((o) => row.append(h('button', { class: 'chip', type: 'button', onclick: (e) => { row.classList.add('opts--used'); row.querySelectorAll('.chip').forEach((c) => c.removeAttribute('aria-pressed')); e.currentTarget.setAttribute('aria-pressed', 'true'); send(o.value, o.label); } }, o.label)));
  return row;
}
// Welcome bubble: the brain's own greeting reply, read from its chat module without asking the brain (so no state moves); a plain copy if that module cannot load.
let welcomeP = null;
const WELCOME_FALLBACK = { title: "G'day", headline: 'Good to have you here. Tell me what you are working on, like the surface and the problem, and I will find the Sika products whose data sheets cover it.', choices: [{ label: 'Waterproof a bathroom', value: 'Waterproofing for a shower floor under tiles' }, { label: 'Tile a floor', value: 'Tile adhesive for porcelain tiles on a concrete floor' }, { label: 'Seal around a shower', value: 'Silicone sealant for a shower' }, { label: 'Fix a crack', value: 'I need something to fix a crack' }] };
function welcome() {
  return (welcomeP ||= (async () => {
    let card = WELCOME_FALLBACK;
    try { if (brainOn()) { const m = await import('../brain/chat.js'); const c = m.socialCard('greet', 'hi'); if (c && c.headline && c.choices && c.choices.length) card = c; } } catch { /* the plain copy stands */ }
    if (!log.querySelector('.msg')) { const b = chatBubble(card); b.classList.add('msg--welcome'); log.append(b); }
  })());
}
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** the "typing" pause before a reply: 300 to 600 ms by reply length, so a short hello is quick and a long answer is not instant; 120 ms under reduced motion */
const typingPause = async (a, since) => { const ms = Math.max(0, (reduced() ? 120 : 300 + Math.min(300, Math.round(JSON.stringify((a && a.blocks) || '').length / 12))) - (performance.now() - since)); await sleep(ms); return Math.round(ms); };
const desktop = () => typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches;
const keepFocus = () => { if (desktop() && input && panel.classList.contains('open')) input.focus({ preventScroll: true }); };
/** newest message into view: a short one to the bottom; a reply taller than the thread to its own top, so the first line is read first */
function toNewest(node) { if (!log) return; const tall = node && node.offsetHeight > log.clientHeight * 0.85; if (tall) log.scrollTop = Math.max(0, node.offsetTop - log.offsetTop - 8); else log.scrollTop = log.scrollHeight; }
export function newChat() {
  if (!log) return; log.replaceChildren(); state = null; resetBrain(); inflight.clear(); welcomeP = null; input.value = '';
  welcome().then(() => { log.scrollTop = 0; announce('New chat started.'); keepFocus(); });
}

function renderAnswer(a) {
  if (isChat(a)) return chatBubble(a.blocks[0].card);
  const body = h('div', { class: 'msg msg--bot' });
  const hasFrom = a.blocks.some((b) => b.type === 'text' && /published documentation/i.test(b.text));
  a.blocks.forEach((b) => { const n = renderBlock(b); if (n) body.append(decorateBlock(n, b)); });
  if (a.citations && a.citations.length) {
    const seen = new Set(); const cites = a.citations.filter((c) => !seen.has(c.url) && seen.add(c.url));
    body.append(h('div', { class: 'cite' }, h('strong', null, 'Sources'), h('ol', null, cites.map((c) => h('li', null, extLink(c.url, c.label + (c.kind === 'pdf' ? ' (PDF)' : ''), 'link')))), hasFrom ? null : h('div', null, `From ${cfg.company.publishedDocsPhrase}.`), h('div', null, h('a', { href: '#/rules', class: 'link', onclick: closeOnMobile }, 'How the rules are kept: the rule ledger'))));
  }
  if (a.correctedBy) body.append(h('p', { class: 'cite' }, `Corrected by ${a.correctedBy.who} on ${String(a.correctedBy.when).slice(0, 10)}. This answer comes from a rule that is checked before the documentation index.`));
  body.append(h('button', { class: 'btn btn--text suggest-btn', type: 'button', onclick: () => { add(suggestPanel(a.query)); } }, 'Suggest a correction'));
  if (a.followups && a.followups.length) body.append(chipRow(a.followups.slice(0, 3).map((f) => ({ label: f, value: f })), 'Suggested follow-up questions'));
  return body;
}

function add(node) { log.append(node); toNewest(node); }
const inflight = new Set(); let lastSend = { text: '', at: 0 }; // one activation = one question: a double click or double tap on a chip, or the same text while it is still being answered, is sent once
export async function send(text, label) {
  text = String(text || '').trim(); const key = text + '\u0001' + (label || ''); // two chips can share a value ('yes' on consent and on confirm): the double-tap guard keys on the chip, not the value
  if (!text || inflight.has(key) || (key === lastSend.text && Date.now() - lastSend.at < 700)) return;
  inflight.add(key); lastSend = { text: key, at: Date.now() };
  await welcome(); // the welcome bubble is always first in the thread, even when a question arrives with the panel (deep link, example chip)
  add(h('div', { class: 'msg msg--user' }, label || text));
  const tStart = performance.now();
  const wait = h('div', { class: 'msg msg--bot msg--typing', 'aria-label': 'The advisor is looking' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i'))); add(wait);
  try {
    const act = await ensureActions();
    const handled = act ? await act.handle(text) : null;
    if (handled) { const node = handled.node; if (!handled.private) insights.question(text, handled.outcome); // T11, this browser only; a quote-request answer (it may be an email address) is never logged
      await new Promise((r) => setTimeout(r, 60)); wait.replaceWith(node); toNewest(node); announce('The advisor has answered.'); keepFocus(); history.push({ q: handled.private ? '' : text, intent: 'action', ms: 0 }); return; }
    const useBrain = brainOn();
    const ba = useBrain ? await brainAnswer(text) : null; // v2 brain; null means it could not run, so v1 answers
    if (!ba) await ensure();
    const t0 = performance.now();
    const rule = ba ? null : matchRule(rules, text);
    const a = ba || (rule ? ruleAnswer(rule, text) : await askWithData(engine, text, state)); if (!ba) state = a.state || null;
    if (!ba) await new Promise((r) => setTimeout(r, 140));
    const pauseMs = await typingPause(a, tStart);
    const out = renderAnswer(a); out.dataset.pauseMs = String(pauseMs); /* the deliberate typing pause, so speed tests can subtract it */ wait.replaceWith(out); toNewest(out);
    announce('The advisor has answered.'); keepFocus();
    history.push({ q: text, intent: a.intent, ms: Math.round(performance.now() - t0) });
    const oc = outcomeOf(a); if (oc) insights.question(text, oc); // T11, this browser only
    if (act && ba) act.observeBrain(ba); // actions v2: remember the product and facets a brain answer carried, so "make that a project pack" works after it
    if (act) act.observeV1(text, a, oc); // actions v2: recent questions and the gap list, this browser only
    if (a.state && a.state.facets && Object.values(a.state.facets).filter((v) => Array.isArray(v) && v.length).length >= 2) insights.combo(Object.values(a.state.facets).flat().join(' / '));
  } catch (e) {
    wait.replaceWith(h('div', { class: 'msg msg--bot' }, h('p', null, 'The advisor could not run in this browser. ' + (e && e.message ? e.message : ''))));
  } finally { inflight.delete(key); }
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
    D = documents_; dv = await derived();
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
  if (on) { prefetchBrain(); ensureActions(); welcome(); document.body.classList.toggle('lock', window.matchMedia('(max-width: 39.99em)').matches); focusSoon(input); }
  else { document.body.classList.remove('lock'); const o = opener && document.contains(opener) ? opener : fab; if (o && !o.hidden) focusSoon(o); }
}

export async function mountAssistant(config) {
  cfg = config; D = { byId: new Map(), docs: [] }; // the product index (dv) is loaded with the engine, on first use
  fab = h('button', { class: 'fab', type: 'button', id: 'asst-fab', 'aria-controls': 'assistant', 'aria-expanded': 'false', onclick: (e) => setOpen(!panel.classList.contains('open'), e.currentTarget) }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Product advisor');
  log = h('div', { class: 'asst-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  input = h('input', { id: 'asst-q', type: 'text', autocomplete: 'off', placeholder: 'Ask about a product, a job or a document', 'aria-label': 'Ask the product advisor', enterkeyhint: 'send' });
  const voice = voiceControls();
  const form = h('form', { class: 'asst-form', onsubmit: (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(v); } }, input, voice ? voice.mic : null, h('button', { class: 'btn', type: 'submit', 'aria-label': 'Send' }, icon('send', 'i--sm'), h('span', { class: 'visually-hidden' }, 'Send')));
  const sugg = h('div', { class: 'asst-sugg', role: 'group', 'aria-label': 'Example questions' }, cfg.home.assistantQuestions.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => send(q) }, q)));
  panel = h('aside', { class: 'assistant', id: 'assistant', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'asst-title', 'aria-hidden': 'true', onkeydown: (e) => { if (e.key === 'Escape') setOpen(false); } },
    h('div', { class: 'asst-head' }, h('h2', { id: 'asst-title' }, 'Product advisor', h('small', null, 'Demo, built from ' + cfg.company.publishedDocsPhrase)), h('div', { class: 'asst-tools' }, h('button', { class: 'btn btn--text asst-new', type: 'button', id: 'asst-new', onclick: () => newChat() }, 'New chat'), h('button', { class: 'btn btn--text', type: 'button', 'aria-label': 'Close the advisor', onclick: () => setOpen(false) }, icon('close'), h('span', { class: 'visually-hidden' }, 'Close')))),
    h('div', { class: 'asst-note' }, 'Plain code running in your browser: no AI model, no network calls, no tracking, zero running cost. Every answer links its source. Where the documentation does not say, it says so.'),
    log, sugg, voice ? voice.bar : null, form);
  formEl = form; suggEl = sugg;
  document.body.append(fab, panel);
  if (actionsOn()) setTimeout(() => (window.requestIdleCallback || ((f) => f()))(() => ensureActions()), 15000); // speed: not while the first screen and a first click are being served; opening the panel starts it at once (setOpen)
  window.__asstClose = () => setOpen(false);
  window.addEventListener('hashchange', () => {});
  return { open: (q, from) => { setOpen(true, from || document.activeElement); if (q) send(q); }, send, history, observeBrain: (ans) => { if (A) A.observeBrain(ans); } };
}
