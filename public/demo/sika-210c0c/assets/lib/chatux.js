// chatux.js: the conversation layer of the advisor panel (bubbles, chips under the bubble that asked, welcome, typing pause, scroll and focus).
// Loaded the first time the panel opens or a question is sent, so none of it is in the first-screen bundle (sika-citematch budget). assistant-ui.js owns the thread and the send path.
export function createChatUx({ h, getLog, getInput, getPanel, send, brainOn }) {
  let welcomeP = null, cssP = null;
  // the conversation styles are a separate sheet, fetched with this module (not inlined in the first screen); the welcome bubble waits for it so nothing flashes unstyled
  const css = () => (cssP ||= new Promise((r) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../chat.css', import.meta.url).href; l.onload = l.onerror = () => r(); document.head.append(l); }));
  // Conversational replies: a social reply or a clarifying question (a brain "choose" card that quotes no document) is a compact left bubble with its chips right under it. Product and evidence answers keep their card, in the same thread.
  const isChat = (a) => Boolean(a && a.brain && a.blocks.length && a.blocks.every((b) => b.type === 'brain' && b.card && b.card.type === 'choose' && !(b.card.facts && b.card.facts.length)));
  const chatBubble = (card) => {
    const lead = String(card.title || '').trim(), head = String(card.headline || '').trim();
    const text = lead && head ? (/[.!?]$/.test(lead) ? lead : lead + '.') + ' ' + head : lead || head;
    const opts = (card.choices || (card.followups || []).map((f) => ({ label: f, value: f })));
    return h('div', { class: 'msg msg--bot msg--chat' }, h('p', null, text), opts.length ? chipRow(opts, 'Suggested replies') : null);
  };
  // chips sit under the bubble that asked; once one is tapped the row is marked used (it stays tappable, so a changed mind or a double tap still works)
  const chipRow = (opts, label) => {
    const row = h('div', { class: 'opts', role: 'group', 'aria-label': label });
    opts.forEach((o) => row.append(h('button', { class: 'chip', type: 'button', onclick: (e) => { row.classList.add('opts--used'); row.querySelectorAll('.chip').forEach((c) => c.removeAttribute('aria-pressed')); e.currentTarget.setAttribute('aria-pressed', 'true'); send(o.value, o.label); } }, o.label)));
    return row;
  };
  // Welcome bubble: the brain's own greeting reply, read from its chat module without asking the brain (so no state moves); a plain copy if that module cannot load.
  const WELCOME_FALLBACK = { title: "G'day", headline: 'Good to have you here. Tell me what you are working on, like the surface and the problem, and I will find the Sika products whose data sheets cover it.', choices: [{ label: 'Waterproof a bathroom', value: 'Waterproofing for a shower floor under tiles' }, { label: 'Tile a floor', value: 'Tile adhesive for porcelain tiles on a concrete floor' }, { label: 'Seal around a shower', value: 'Silicone sealant for a shower' }, { label: 'Fix a crack', value: 'I need something to fix a crack' }] };
  const welcome = () => (welcomeP ||= (async () => {
    let card = WELCOME_FALLBACK; const log = getLog(); await css();
    try { if (brainOn()) { const m = await import('../brain/chat.js'); const c = m.socialCard('greet', 'hi'); if (c && c.headline && c.choices && c.choices.length) card = c; } } catch { /* the plain copy stands */ }
    if (!log.querySelector('.msg')) { const b = chatBubble(card); b.classList.add('msg--welcome'); log.append(b); }
  })());
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** the "typing" pause before a reply: 300 to 600 ms by reply length, so a short hello is quick and a long answer is not instant; 120 ms under reduced motion */
  const typingPause = async (a, since) => { const ms = Math.max(0, (reduced() ? 120 : 300 + Math.min(300, Math.round(JSON.stringify((a && a.blocks) || '').length / 12))) - (performance.now() - since)); await new Promise((r) => setTimeout(r, ms)); return Math.round(ms); };
  const keepFocus = () => { const input = getInput(); if (!window.matchMedia('(pointer: coarse)').matches && input && getPanel().classList.contains('open')) input.focus({ preventScroll: true }); };
  /** newest message into view: a short one to the bottom; a reply taller than the thread to its own top, so the first line is read first */
  const toNewest = (node) => { const log = getLog(); if (!log) return; const tall = node && node.offsetHeight > log.clientHeight * 0.85; if (tall) log.scrollTop = Math.max(0, node.offsetTop - log.offsetTop - 8); else log.scrollTop = log.scrollHeight; };
  return { isChat, chatBubble, chipRow, welcome, typingPause, keepFocus, toNewest, reset: () => { welcomeP = null; } };
}
