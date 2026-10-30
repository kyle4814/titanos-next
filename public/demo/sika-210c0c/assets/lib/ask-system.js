// "Ask about this system" (wave 2, QR on the system sheets). Route #/ask?system=<slug>: shows a short page and opens the advisor with a greeting card
// that names the system and offers three suggested questions. Reads only the sheet that already exists on this host. No tracking, nothing is sent anywhere.
// The advisor itself is not changed: the greeting is one extra message in its log, and a suggested question is sent by filling the advisor's own
// question box and submitting its own form, exactly as a person typing would.
import { h } from './util.js';
import { breadcrumb } from './components.js';
import { parseSheet } from './sheet_data.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const nice = (slug) => slug.replace(/-/g, ' ');
const low = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Pure: three suggested questions for a parsed sheet (or for the hub when parsed is null). */
export function suggestions(parsed) {
  if (!parsed || !parsed.title) return ['Which adhesive for porcelain tiles on a concrete floor?', 'What do I need to waterproof a shower floor before tiling?', 'How much adhesive do I need for 40 m2 of floor tiles?'];
  const a = parsed.answers || {}; const tile = low(a.Tile) || 'these tiles', sub = low(a.Substrate) || 'this surface', loc = low(a.Location) || 'this location';
  return [`Which adhesive for ${tile} on ${sub}, ${loc}?`, `How much adhesive do I need for 20 m2 of ${tile} on ${sub}?`, `What waterproofing or primer goes under ${tile} on ${sub}, ${loc}?`];
}

export function greetingCard(title, qs, onAsk) {
  return h('div', { class: 'msg msg--bot ask-greet', 'data-system-greeting': title },
    h('div', { class: 'm-title' }, 'Asking about: ' + title),
    h('p', null, title === 'tiling systems' ? 'Here are three questions to start with, or type your own.' : 'The published documentation covers this system step by step. Here are three questions to start with, or type your own.'),
    h('div', { class: 'opts', role: 'group', 'aria-label': 'Suggested questions about this system' }, qs.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => onAsk(q) }, q))));
}

function askThroughBox(q) {
  const input = document.getElementById('asst-q'); const form = input && input.closest('form'); if (!input || !form) return;
  input.value = q; if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

async function placeGreeting(title, qs, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const log = document.querySelector('#assistant .asst-log');
    if (log) { log.querySelectorAll('.ask-greet').forEach((n) => n.remove()); log.append(greetingCard(title, qs, askThroughBox)); log.scrollTop = log.scrollHeight; return true; }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export async function askView(ctx) {
  const raw = (ctx.params.get('system') || '').trim().toLowerCase();
  const slug = SLUG.test(raw) ? raw : '';
  let parsed = null;
  if (slug) { try { const r = await fetch('systems/' + slug + '/index.html'); if (r.ok) parsed = parseSheet(await r.text()); } catch { /* offline or unknown: fall back to the slug */ } }
  const known = !!(parsed && parsed.title);
  const title = slug ? (known ? parsed.title : nice(slug)) : 'tiling systems';
  const qs = suggestions(known ? parsed : null);
  const open = (from) => { ctx.openAssistant(undefined, from); placeGreeting(title, qs, 40); };
  const btn = h('button', { class: 'btn', type: 'button', id: 'ask-open', onclick: (e) => open(e.currentTarget) }, 'Open the advisor');
  const el = h('div', { class: 'container ask-page' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Ask about a system' }]),
    h('div', { class: 'page-head' }, h('h1', null, slug ? 'Ask about this system' : 'Ask about tiling systems')),
    h('div', { class: 'prose', style: 'max-width:46rem' },
      h('p', { class: 'lead' }, slug ? title : 'Pick a system on the selector, or ask the advisor anything about the tiling systems.'),
      slug && !known ? h('p', { class: 'notice', role: 'note' }, 'That system sheet could not be read just now, so the advisor opens with the system name from the address only.') : null,
      h('p', null, 'The product advisor is opening with a few questions to start. Answers come from the published documentation and always link their source.'),
      h('p', { class: 'btn-row' }, btn, ' ', slug ? h('a', { class: 'btn btn--hollow', href: 'systems/' + slug + '/' }, 'Back to the system sheet') : null, ' ', h('a', { class: 'btn btn--hollow', href: 'systems/' }, 'Tiling system selector'))));
  setTimeout(() => open(document.activeElement), 50);
  return { el, title: slug ? 'Ask about ' + title : 'Ask about tiling systems', nav: null };
}
