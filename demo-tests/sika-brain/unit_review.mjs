// unit_review.mjs: the independent adversarial review of the integration tip (2026-11-02). Every block fails on de58d764b and passes now.
import fs from 'node:fs';
import { makeBrain, PORTAL } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { deriveAliases } from '../../public/demo/sika-210c0c/assets/brain/names.js';
import { categoryListCard } from '../../public/demo/sika-210c0c/assets/brain/catlist.js';
import { normalise } from '../../public/demo/sika-210c0c/assets/brain/text.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n');
const conv = async (turns) => { let st = null, a = null; for (const q of turns) { a = await b.ask(q, st); st = a.state; } return a; };

// P0.1 a quantity ask that names another kind of product never reuses the held product
{ const a = await conv(['davco k10 plus', 'how much tile adhesive for 10 m2']); t('P0.1 K10 Plus then tile adhesive: not K10 Plus litres', !/K10 Plus/.test(a.cards[0].title || '') && !(a.cards[0].product && /K10/.test(a.cards[0].product.name)), a.cards[0].title); }
{ const a = await conv(['davco easy grout coverage', 'how much floor leveller for 15 m2 at 5 mm']); t('P0.1 Easy Grout then floor leveller: no tile size question', !/Easy Grout/.test(txt(a)) && !/tile size/i.test(txt(a)), a.cards[0].title); }
{ const a = await conv(['davco k10 plus', 'hi', 'how much for 10 m2']); t('P0.1 K10 Plus, hi, bare quantity: asks which product', a.cards[0].type === 'choose' && !/K10 Plus/.test(a.cards[0].title), a.cards[0].title); }
{ const a = await conv(['davco k10 plus', 'thanks', 'how much tile adhesive for 10 m2']); t('P0.1 K10 Plus, thanks, tile adhesive: not K10', !/K10 Plus/.test(a.cards[0].title || ''), a.cards[0].title); }
{ const a = await conv(['davco k10 plus', 'how much for 10 m2']); t('P0.1 same product, bare quantity: still the held product', /K10 Plus/.test(a.cards[0].title || ''), a.cards[0].title); }
{ const a = await conv(['davco k10 plus', 'how much waterproofing membrane for 10 m2']); t('P0.1 same kind named: still the held product', /K10 Plus/.test(a.cards[0].title || ''), a.cards[0].title); }

// P0.2 a shortened range name that fits several products asks which one
{ const core = JSON.parse(fs.readFileSync(PORTAL + '/data/brain/core.json', 'utf8')); core.alias = {}; deriveAliases(core, new Map(core.P.map((p, i) => [p.id, i])));
  const sets = core.P.map((p) => new Set(normalise(p.n).split(' ')));
  const bad = Object.keys(core.alias).filter((k) => sets.filter((s) => k.split(' ').every((w) => s.has(w))).length > 1);
  t('P0.2 no derived alias fits more than one product name', bad.length === 0, bad.join(' | ')); t('P0.2 derived alias count dropped (179 before)', Object.keys(core.alias).length < 179, Object.keys(core.alias).length); }
for (const q of ['sikaflex fc data sheet', 'sikatile lite coverage', 'sikafloor n']) { const a = await b.ask(q, null); t(`P0.2 "${q}" asks which one`, a.cards[0].type === 'choose', a.cards[0].title); }
{ const a = await b.ask('sikaflex-212 fc data sheet', null); t('P0.2 a full name still answers', /212 FC/.test(a.cards[0].title || ''), a.cards[0].title); }

{ const a = await b.ask('is SikaBond Instant Nails any good on timber', null); t('P0.2 a name that is one product minus its model number still answers for it', a.cards[0].type !== 'choose' && /142/.test(txt(a)), a.cards[0].title); }

// P0.3 a sell / do ask for something outside the range is never "Yes, happy to help"
for (const q of ['you guys sell timber?', 'do you guys do carpet', 'you sell paint brushes mate?', 'can you do plumbing']) { const a = await b.ask(q, null); const c = a.cards[0]; t(`P0.3 "${q}": honest not-in-documentation`, c.type === 'unknown' && !/happy to help/i.test(txt(a)) && /not in the Sika Australia documentation/.test(c.headline), c.title + ' :: ' + c.headline); }
for (const q of ['can you help me', 'what do you do', 'how do i use this', 'hello']) { const a = await b.ask(q, null); t(`P0.3 chat stays chat: "${q}"`, a.cards[0].type !== 'unknown', a.cards[0].title); }

// P1.4 compare with a range name asks which one
{ const a = await b.ask('sikaflex vs sikasil', null); const c = a.cards[0]; t('P1.4 sikaflex vs sikasil asks which one', c.type === 'choose' && c.followups.length >= 2 && c.followups.every((f) => /^Compare /.test(f)), c.title + ' ' + c.followups); for (const f of c.followups) { const a2 = await b.ask(f, a.state); t(`P1.4 chip "${f}" leads on (the other side asked, or a comparison)`, ['comparison', 'choose'].includes(a2.cards[0].type), a2.cards[0].type); } }
{ const a = await b.ask('sikaflex-212 fc vs sikaflex-11 fc+', null); t('P1.4 two full names still compare', a.cards[0].type === 'comparison', a.cards[0].type); }

// P1.5 compare coverage carries its table basis and headings; "which is better" is answered plainly
{ const a = await b.ask('compare davco easy grout and davco k10 plus', null); const row = a.cards[0].table.rows.find((r) => r[0] === 'Coverage'); t('P1.5 Coverage cell carries the table columns', /Columns: .*Joint/.test(row[1]) && /2 Litre pail/.test(row[1]), row[1]); }
{ const a = await b.ask('which is better sikaflex-212 fc or sikaflex-11 fc+', null); t('P1.5 "which is better" says the sheets do not rank', /do not rank products/.test(a.cards[0].headline), a.cards[0].headline); }
{ const a = await b.ask('sikaflex-212 fc vs sikaflex-11 fc+', null); const row = a.cards[0].table.rows.find((r) => r[0] === 'Coverage'); t('P1.5 a plain compare has no headerless row', !/^(\d|~)/.test(row[1]) || /Columns:/.test(row[1]), row[1]); }

// P1.6 a category list is the section asked for
{ const core = JSON.parse(fs.readFileSync(PORTAL + '/data/brain/core.json', 'utf8'));
  for (const q of ['what adhesives does sika sell', 'what membranes does sika have', 'list the sealing and bonding products']) { const c = categoryListCard(q, normalise(q), core); t(`P1.6 "${q}" is not a narrow section under a general title`, c === null, c && c.title); }
  const ok = categoryListCard('what sanitary sealants does sika have', 'what sanitary sealants does sika have', core); t('P1.6 a real section still lists', ok && /Sanitary/.test(ok.title), ok && ok.title);
  const ok2 = categoryListCard('list the automotive sealing and bonding products', 'list the automotive sealing and bonding products', core); t('P1.6 a section named with its parent still lists', ok2 && /Sealing/.test(ok2.title), ok2 && ok2.title); }

// P1.7 the saved last question follows the room choice
{ const a = await conv(['how do i clean grout haze', 'kitchen', 'what do i use']); t('P1.7 room then "what do i use" does not pick for grout haze', !/grout haze|SikaCeram-960/i.test(txt(a)), a.cards[0].title + ' :: ' + a.cards[0].headline); }

// P-pre a buy / available word is not a price question when the data answers
for (const q of ['what waterproofing membrane is available for a balcony', 'i want to purchase a waterproofing membrane for my shower', 'what colours is davco easy grout available in']) { const a = await b.ask(q, null); t(`pre "${q}" is answered from the data`, a.cards[0].type !== 'unknown', a.cards[0].title); }
for (const q of ['is sikaflex in stock', 'what is the price of sikaflex', 'where can i buy sikaflex']) { const a = await b.ask(q, null); t(`pre "${q}" keeps the price / stock / where-to-buy answer`, a.cards[0].type === 'unknown' || /where to buy/i.test(a.cards[0].title), a.cards[0].title); }

// P1.8 the page code: a stale answer after New chat is dropped; a failed chunk load is said, not left in flight
{ const store = { n: 0, setItem() { store.n++; }, removeItem() {}, getItem() { return null; } }; globalThis.sessionStorage = store; globalThis.document = globalThis.document || { createElement: () => ({ style: {}, setAttribute() {}, append() {}, addEventListener() {} }), head: { append() {} }, body: { append() {} }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => { const f = String(u).replace(/^file:\/\//, ''); try { const body = fs.readFileSync(decodeURIComponent(f), 'utf8'); return { ok: true, json: async () => JSON.parse(body) }; } catch { return { ok: false, json: async () => null }; } };
  globalThis.__sikaJson = new Map();
  const ui = await import('../../public/demo/sika-210c0c/assets/lib/brain-ui.js');
  await ui.brainAnswer('davco easy grout coverage'); const base = store.n;
  const p = ui.brainAnswer('how much davco easy grout for 20 m2'); ui.resetBrain(store); const r = await p;
  t('P1.8 an answer in flight when New chat is pressed is dropped', r && r.stale === true, JSON.stringify(r).slice(0, 80)); t('P1.8 the stale answer wrote no state back', store.n === base, store.n + ' vs ' + base);
  const r2 = await ui.brainAnswer('davco easy grout coverage'); t('P1.8 a question after New chat is answered normally', r2 && !r2.stale && r2.blocks.length > 0, JSON.stringify(r2).slice(0, 80));
  globalThis.fetch = orig; }
{ const src = fs.readFileSync('../../public/demo/sika-210c0c/assets/lib/assistant-ui.js', 'utf8'); const send = src.slice(src.indexOf('export async function send('));
  const iLoad = send.indexOf('await loadUx()'), iTry = send.indexOf('try {');
  t('P1.8 send() loads the chat code inside a try', iLoad > iTry && iTry >= 0 && iTry < send.indexOf('The advisor is looking'), `${iTry} ${iLoad}`);
  t('P1.8 a failed load is said (visible, with a retry line) and the message is freed', /Try again\./.test(send) && /wait \? wait\.replaceWith\(m\) : add\(m\)/.test(send) && /finally \{ inflight\.delete\(key\)/.test(send));
  t('P1.8 send() drops a stale brain answer', /ba && ba\.stale\) return/.test(send)); }

console.log(`unit_review: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
