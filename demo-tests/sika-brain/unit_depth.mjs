// unit_depth.mjs: regressions for the conversation-depth fixes (CONVO_SCORE_2026-11-02.md, AFTER section). Each block fails on base 2e8900c64.
//  1 a clarifier reply keeps the job and place   2 social slang and place nouns never hit the not-found card   3 recommend asks lead with "My pick"
//  4 lone place nouns get a clarifier with chips   5 the conversation context survives a reload (sessionStorage, optional)
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { socialKind } from '../../public/demo/sika-210c0c/assets/brain/chat.js';
import { loadBrainState, saveBrainState, STATE_KEY } from '../../public/demo/sika-210c0c/assets/brain/persist.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } };
const b = makeBrain(); const NOTDOC = /not in the published documentation|I do not know this/i;
const run = async (turns) => { let st = null, a = null; for (const q of turns) { a = await b.ask(q, st); st = a.state; } return a; };
const nChips = (a) => Math.max((a.cards[0].choices || []).length, (a.cards[0].followups || []).length);
const traceHas = (a, s) => (a.trace || []).some((x) => x.includes(s));

// 1. carry the job and place through a clarifier reply
for (const [turns, label] of [[['balcony', 'tiles on it'], 'balcony + "tiles on it"'], [['bathroom', 'the floor'], 'bathroom + "the floor"'], [['bathroom', 'under the tiles'], 'bathroom + "under the tiles"'],
  [['laundry', 'waterproofing'], 'laundry + waterproofing']]) {
  const a = await run(turns); t(`${label}: answered, not another clarifier`, a.cards[0].type !== 'choose' && !NOTDOC.test(cardText(a.cards[0])), a.cards[0].title);
}
{ const a = await run(['bathroom', 'you pick']); t('"you pick" after a clarifier gives a My pick, not "what is the job" again', /^My pick/.test(a.cards[0].headline || ''), a.cards[0].headline); }
{ const a = await run(['recommend a tile adhesive', 'can you pick one for me']); t('"can you pick one for me" after the tile adhesive question gives a pick', /^My pick/.test(a.cards[0].headline || ''), a.cards[0].headline); }
{ const a = await run(['window', 'sealant']); const c = await b.ask('outside', a.state); t('a lone "outside" a turn after an answer keeps the job (window sealant)', c.cards[0].type !== 'choose' && traceHas(c, 'session:rewrite'), c.cards[0].title); }
{ const a = await run(['bath', 'it leaks at the edge', 'which silicone']); t('"which silicone" two turns after the bathroom is about the bathroom, not a fresh sealant question', a.cards[0].type !== 'choose', a.cards[0].title); }
{ const a = await run(['bathroom', 'kitchen']); t('a different ROOM is still a fresh question (kitchen clarifier)', a.cards[0].type === 'choose' && /kitchen/i.test(a.cards[0].title), a.cards[0].title); }
{ const a = await run(['bathroom', 'what is the coverage of Sikaflex-11 FC+']); t('a real question after a clarifier is still a fresh question', a.cards[0].type !== 'choose' || !/bathroom/i.test(a.cards[0].title), a.cards[0].title); }
{ const a = await run(['basement', 'damp walls', 'what do I use']); t('"what do I use" after a basement answer picks for that job, not "what are you working on"', /^My pick/.test(a.cards[0].headline || ''), a.cards[0].headline); }

// 2. social slang and place nouns
const SLANG = ['arvo mate need a hand with a reno', 'hey u there need help with the reno', 'u there', 'why cant you just answer me', 'lol ok', 'ur a legend', 'thx', 'cheers mate', 'hows it goin', 'wat can u do', 'pls help', 'sumthing', 'heyyy', 'arvo'];
for (const q of SLANG.filter((x) => x !== 'sumthing')) { const a = await b.ask(q, null); t(`social "${q}": warm reply, never the not-found card`, !!socialKind(q) && a.cards[0].type === 'choose' && !NOTDOC.test(cardText(a.cards[0])), a.cards[0].title); }
t('"your products" is not read as a social turn', !socialKind('what are your products for a roof'));
for (const q of ['fence', 'stairs', 'pergola', 'footpath', 'skylight', 'water tank', 'drivway', 'staircase', 'skylght']) { const a = await b.ask(q, null); t(`place noun "${q}": a clarifier with 3 to 5 chips`, a.cards[0].type === 'choose' && nChips(a) >= 3 && nChips(a) <= 5 && !NOTDOC.test(cardText(a.cards[0])), a.cards[0].title + ' ' + nChips(a)); }
{ const a = await b.ask('dunno what i need for a wet room', null); t('"dunno what i need for a wet room" gets the bathroom clarifier', a.cards[0].type === 'choose' && /bathroom/i.test(a.cards[0].title), a.cards[0].title); }
{ const a = await b.ask('hows it goin need advice on grout', null); t('a greeting in front of a grout ask still clarifies', a.cards[0].type === 'choose', a.cards[0].title); }

// 3. recommend asks lead with My pick
for (const q of ['which sealant for outdoor joints that move', 'which product for waterproofing a planter box', 'which grout for outdoor tiles', 'which product for a damp basement wall', 'wat do i use for tiles on a deck', 'sumthin to stick tiles to old tiles', 'wanna waterproof a laundry cheers']) {
  const a = await b.ask(q, null); t(`"${q}": leads with My pick`, /^My pick/.test(a.cards[0].headline || '') || traceHas(a, 'chat:tie'), a.cards[0].title + ' | ' + (a.cards[0].headline || '').slice(0, 60)); }
{ const a = await b.ask('how much do I need for 20 m2 of tile adhesive', null); t('a quantity question is not turned into a pick', !/^My pick/.test(a.cards[0].headline || '')); }

// 4. lone place nouns
for (const q of ['metal roof', 'gutter', 'driveway', 'retaining wall', 'outdoor area', 'water tank', 'tin roof']) { const a = await b.ask(q, null); t(`lone place noun "${q}": a clarifier with 3 to 5 chips`, a.cards[0].type === 'choose' && nChips(a) >= 3 && nChips(a) <= 5, a.cards[0].type + ' ' + a.cards[0].title + ' ' + nChips(a)); }

// 5. the context survives a reload
{ const mem = new Map(); const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const a = await run(['bathroom']); saveBrainState(a.state, store); t('state is stored as JSON under one key', mem.has(STATE_KEY));
  const back = loadBrainState(store); const c = await b.ask('the floor', back); t('a reloaded page (state read back from storage) still answers "the floor" for the bathroom', c.cards[0].type !== 'choose', c.cards[0].title);
  saveBrainState(null, store); t('saving null (a new chat) clears the stored context', loadBrainState(store) === null);
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  t('a blocked store never throws', loadBrainState(bad) === null && (saveBrainState({ x: 1 }, bad), true));
  mem.set(STATE_KEY, '{not json'); t('a corrupt store reads as no context', loadBrainState(store) === null); }
console.log(`unit_depth: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
