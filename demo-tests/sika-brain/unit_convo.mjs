// unit_convo.mjs: the talking layer (chat.js + session.js step 0): social turns, vague asks with a clarifying question, two-turn follow-ups, the "My pick" lead, honest refusals kept.
// Each block fails on base 26fe70419 (those turns answered "Not in the published documentation" or a bare list) and passes on the chat layer.
import { makeBrain } from './harness.mjs';
import { cardText, validateCard } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n'); const NOTDOC = /not in the published documentation|I do not know this/i;
const chips = (a) => (a.cards[0].choices || (a.cards[0].followups || []).map((v) => ({ label: v, value: v })));

// 1. social turns: warm, short, steer to the job, starter chips, never the "not in the documentation" card
const SOCIAL = ['hello', 'hi mate how are you', "g'day", 'hey mate', 'good morning', 'thanks', 'cheers mate', 'ta', 'bye', 'see ya later', 'who are you', 'what can you do', 'hey can u help', 'you are useless', 'ok', 'yes', 'no thanks', 'how are you'];
for (const q of SOCIAL) {
  const a = await b.ask(q, null); const c = a.cards[0];
  t(`social "${q}": a choose card with 3 to 4 starter chips, not the not-published card`, c.type === 'choose' && !NOTDOC.test(txt(a)) && chips(a).length >= 3 && chips(a).length <= 4 && a.stage === 'chat', txt(a));
  t(`social "${q}": short (under 330 characters of prose), no dashes, validates`, (c.headline.length + c.title.length) < 330 && !/[–—]/.test(txt(a)) && validateCard(c).length === 0, c.headline);
}
{ const a = await b.ask('hello', null); t('hello steers to the job', /surface and the problem/.test(txt(a))); }
{ const a = await b.ask('thanks', null); t('thanks does not offer three random jobs ("Which of these do you mean")', !/which of these do you mean/i.test(txt(a))); }
{ const a = await b.ask('you are useless', null); t('frustration is met plainly and asks for the surface and the problem', /missed it/i.test(txt(a)) && /surface/.test(txt(a))); }
{ const a = await b.ask('who are you', null); t('who are you states the evidence rule and the Technical Services route', /quote the sheet/.test(txt(a)) && /Technical Services/.test(txt(a))); }
// social turns must not eat real questions that start with a social word
for (const q of ['thanks, what is the coverage of Davco Grey One Pot', 'hi can you tell me the pot life of Davco Ceramacrete', 'ok what primer goes under SikaTile-410 Secure Set']) { const a = await b.ask(q, null); t(`a real question after a greeting is still answered: "${q}"`, a.stage !== 'chat', a.stage); }
// a social turn keeps the conversation: thanks after an answer leaves the product and job in the state
{ let a = await b.ask('coverage of Davco Grey One Pot adhesive', null); const st = a.state; a = await b.ask('thanks mate', st); const a2 = await b.ask('and the SDS?', a.state); t('thanks in the middle of a chat keeps the product for the next follow-up', a2.cards[0].type === 'document' || /safety|sds/i.test(txt(a2)), txt(a2)); }

// 2. vague asks: ONE clarifying question with 3 to 5 chips, each chip a question the assistant answers
const VAGUE = ['what do you recommend for my bathroom', 'bathroom', 'splashback', 'garage floor', 'pool', 'balcony', 'roof', 'can you recommend a sealant', 'i need an adhesive', 'waterproofing', 'a grout', 'a sealent', 'laundry', 'shower'];
for (const q of VAGUE) {
  const a = await b.ask(q, null); const c = a.cards[0]; const n = chips(a).length;
  t(`vague "${q}": clarifying card with 3 to 5 chips and a free-text hint`, c.type === 'choose' && n >= 3 && n <= 5 && /own words|tell me/i.test(txt(a)) && !NOTDOC.test(txt(a)), `${c.type} ${n} ${txt(a)}`);
}
{ let bad = 0; for (const q of ['what do you recommend for my bathroom', 'garage floor', 'can you recommend a sealant']) { const a = await b.ask(q, null); for (const o of chips(a)) { const r = await b.ask(o.value, a.state); if (r.cards[0].type === 'unknown' || r.cards[0].type === 'choose') bad++; } } t('every chip of those clarifiers runs a precise ask that gets a published answer', bad === 0, bad); }
{ const a = await b.ask('what do you recommend', null); t('a bare "what do you recommend" asks for the job with starter chips', a.cards[0].type === 'choose' && chips(a).length >= 3 && /job|surface/i.test(txt(a)) && !NOTDOC.test(txt(a))); }

// 3. two-turn follow-ups: the reply joins the question that was asked
{ let a = await b.ask('what do you recommend for my bathroom', null); a = await b.ask('under tiles', a.state); t('bathroom then "under tiles" = waterproofing under tiles', /waterproof|membrane/i.test(txt(a)) && a.cards[0].type !== 'unknown' && a.cards[0].type !== 'choose', txt(a)); }
{ let a = await b.ask('can you recommend a sealant', null); a = await b.ask('around the bath', a.state); t('a sealant then "around the bath" = a wet-area sealant', /silicone|sealant|seal/i.test(txt(a)) && /bath|shower|wet/i.test(txt(a)) && a.cards[0].type !== 'unknown', txt(a)); }
{ let a = await b.ask('garage floor', null); a = await b.ask('its cracked and broken', a.state); t('garage floor then "cracked and broken" = repair', /repair/i.test(txt(a)) && a.cards[0].type !== 'unknown', txt(a)); }
{ let a = await b.ask('i need an adhesive', null); a = await b.ask('for skirting boards', a.state); t('an adhesive then "for skirting boards" = the skirting adhesive', /skirting/i.test(txt(a)) && a.cards[0].type !== 'unknown', txt(a)); }
{ let a = await b.ask('kitchen', null); a = await b.ask('kitchen splashback tiles', a.state); t('kitchen then a more specific reply is not stuck on the clarifier', a.cards[0].type !== 'choose' || a.cards[0].title !== 'Kitchen'); }
{ let a = await b.ask('bathroom', null); a = await b.ask('thanks', a.state); const a2 = await b.ask('grout', a.state); t('a thanks in between does not lose the question; a new topic starts a fresh clarifier', a2.cards[0].type === 'choose' && /Grout/.test(a2.cards[0].title), a2.cards[0].title); }
{ let a = await b.ask('bathroom', null); a = await b.ask('Waterproofing for a shower floor under tiles', a.state); t('tapping a chip runs that precise ask', a.cards[0].type !== 'choose' && a.cards[0].type !== 'unknown'); const reset = await b.ask('under tiles', a.state); t('after the answer the clarifier is cleared (a stray short reply is not glued onto it)', !(reset.trace || []).some((x) => /chat/.test(x)) || reset.stage !== 'chat'); }

// 4. recommending: "My pick" lead with a quoted sentence, up to two alternatives, one Technical Services line
const REC = ['what do you recommend for a balcony leak', "what's good for a balcony leak", 'which grout is best for a shower floor', 'whats the best sealent for a bathrm', 'need sumthing for shower leak', 'recommend something for tiles on a balcony', 'what should i use for my kitchen splashback', 'best waterproofing membrane for a leaking shower'];
for (const q of REC) {
  const a = await b.ask(q, null); const c = a.cards[0]; const lead = c.headline;
  t(`recommend "${q}": leads with "My pick from the data sheets: <product>, because its ... says: "<sentence>""`, /^My pick from the data sheets: .+, because its (data sheet|product page) says: "/.test(lead) && c.source && lead.includes(c.source.sentence.slice(0, 40)), lead);
  const names = a.cards.filter((x) => x.product).map((x) => x.product.name); const alt = a.cards.slice(1).filter((x) => x.product).length;
  t(`recommend "${q}": at most two alternatives, one honesty line, Technical Services route`, alt <= 2 && (txt(a).match(/Before you buy/g) || []).length === 1 && /Technical Services/.test(txt(a)) && (txt(a).match(/not a claim that one is the best/gi) || []).length <= 1, txt(a));
}
{ const a = await b.ask('can you recommend a sealant', null); const r = await b.ask(chips(a)[0].value, a.state); t('a recommend ask that went through a clarifier still ends in a My pick lead after the tap', /^My pick from the data sheets/.test(r.cards[0].headline), r.cards[0].headline); }
{ const a = await b.ask('what is a sealant for a window frame', null); t('a plain question (no recommend words) keeps its existing answer shape, no My pick', !/^My pick/.test(a.cards[0].headline)); }
// the tie rule: two products that tie with the inside/outside question open are said to tie, with the question and chips
{ let tied = null; for (const q of ['recommend a floor leveller', 'what is the best tile adhesive', 'recommend a waterproofing membrane', 'best sealant', 'what is the best primer', 'best grout for tiles']) { const a = await b.ask(q, null); if ((a.trace || []).includes('chat:tie')) { tied = a; break; } } t('a tie (when it occurs) states the tie in one line and offers inside/outside chips', !tied || (/tie/.test(tied.cards[0].headline) && /inside or outside/i.test(tied.cards[0].headline) && chips(tied).length === 2)); }

// 5. tone and honesty kept
{ const a = await b.ask('price of sikaflex 11 fc', null); t('prices are still declined with the hand-off', a.cards[0].type === 'unknown' && !!a.cards[0].handoff); }
{ const a = await b.ask('is Sikaflex-11 FC+ in stock near me', null); t('stock questions are still declined honestly', a.cards[0].type === 'unknown' && /stock/i.test(txt(a))); }
{ const all = []; for (const q of [...SOCIAL, ...VAGUE, ...REC]) { const a = await b.ask(q, null); all.push(txt(a)); } const text = all.join('\n');
  t('no em or en dashes in any chat reply', !/[–—]/.test(text)); t('no AI-tell words in any chat reply', !/\b(delve|leverage|robust|seamless|holistic|cutting-edge|synergy|streamline)\b/i.test(text)); }
{ const a1 = await b.ask('what do you recommend for my bathroom', null), a2 = await b.ask('what do you recommend for my bathroom', null); t('deterministic', JSON.stringify(a1.cards) === JSON.stringify(a2.cards)); }
console.log(`unit_convo: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
