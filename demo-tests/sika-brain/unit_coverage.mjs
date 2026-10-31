// unit_coverage.mjs: regression tests for the answer-coverage wave (advisor, attributes, business pages, slang, typos, codes, vague asks, honest no-data).
// Plus the bank gate: zero WRONG over the question bank and the property checks (no invented number, no superlative claim) over every bank answer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { checkAnswer } from './props.mjs';
import { judge, makeSelectors } from './coverage/judge.mjs';
import { VAGUE, NOUN, TERMS } from '../../public/demo/sika-210c0c/assets/brain/vague.js';
import { applySlang, SLANG } from '../../public/demo/sika-210c0c/assets/brain/slang.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } };
const b = makeBrain(); await b.boot();
const ask = async (q) => { const a = await b.ask(q); return { a, txt: a.cards.map(cardText).join('\n'), ids: a.cards.filter((c) => c.product).map((c) => c.product.id), links: a.cards.flatMap((c) => (c.links || []).map((l) => l.url)) }; };
let r;
// ---- best X for Y: documented fit, criterion stated, hand-off, no superlative
r = await ask("what's the best screed for a big job");
t('screed big job: an advice card plus product cards from the levelling range', r.a.cards[0].type === 'advice' && r.ids.length >= 2 && r.ids.every((id) => /level|screed|floor/i.test(id)), r.ids);
t('screed big job: the criterion used is said', /Criterion used/.test(r.txt) && /large areas|pumping|thick/i.test(r.txt));
t('screed big job: each product line quotes a published sentence with the product page link', r.a.cards.slice(1).every((c) => c.facts.length && /^https:\/\/aus\.sika\.com\//.test(c.facts[0].source_url) && c.facts[0].sentence.length > 10));
t('screed big job: Technical Services hand-off is on the card', !!r.a.cards[0].handoff && /Technical Services/.test(r.a.cards[0].handoff.reason));
t('screed big job: says it is not a claim of the best', /not a claim that one is the best/.test(r.a.cards[0].headline) && !/\b(best choice|the best product)\b/i.test(r.txt), r.a.cards[0].headline);
r = await ask('best waterproofing for a shower');
t('shower waterproofing: only under-tile membranes, no sealants', r.ids.length >= 1 && r.ids.every((id) => !/silicone|sikasil|sealant/i.test(id)), r.ids);
r = await ask('what screeds does sika make');
t('list question gives a table of the whole group', r.a.cards[0].type === 'advice' && r.a.cards[0].table && r.a.cards[0].table.rows.length >= 6);
r = await ask('list all davco adhesives');
t('brand filter: Davco adhesives only', r.a.cards[0].links.length >= 4 && r.a.cards[0].links.every((l) => /davco/i.test(l.label)), r.a.cards[0].links.map((l) => l.label));
r = await ask('best waterproofing membrane for a large commercial wet area');
t('no documented fit is said plainly with a hand-off, never a guess', r.a.cards[0].status === 'UNKNOWN' && !!r.a.cards[0].handoff, r.txt);
// ---- attributes under a label on the product page
r = await ask('shelf life of sikafloor level top');
t('shelf life quotes the page', r.a.cards[0].type === 'info' && /months/.test(r.txt) && r.a.cards[0].links.some((l) => /level-top/.test(l.url)), r.txt);
r = await ask('what is the pot life of sikafloor level pro');
t('pot life still comes from the structured time fact', r.a.cards[0].type === 'time');
r = await ask('compressive strength of sikaceram sealing membrane a');
t('an attribute the page does not give is an honest no-data with hand-off', r.a.cards[0].status === 'UNKNOWN' && !!r.a.cards[0].handoff);
r = await ask('how many bags of sikatile 400 evo pro per pallet');
t('pallet question is a pack size question, not a quantity calculation', r.a.cards[0].type === 'info' && /pallet|bag/i.test(r.txt), r.txt);
// ---- business, from Sika\'s own pages
r = await ask('whats the head office address');
t('head office from the imprint page', /Wetherill Park/.test(r.txt) && r.a.cards[0].facts[0].source_url.endsWith('/imprint.html'));
r = await ask('phone number for sika australia');
t('phone number is quoted from the imprint page', /9725/.test(r.txt));
r = await ask('what are the working hours of the helpline');
t('opening hours are not published: honest no-data with the contact link', r.a.cards[0].status === 'UNKNOWN' && r.links.some((u) => /Contact/.test(u)));
r = await ask('warranty for a project bigger than 100 square metres');
t('warranty portal text for projects over the limit', /warranty/i.test(r.txt) && /100/.test(r.txt) && r.links.some((u) => /warranty-portal/.test(u)));
r = await ask('how long is the warranty on sikatile products');
t('warranty period is not published: honest no-data', r.a.cards[0].status === 'UNKNOWN');
r = await ask('is davco part of sika');
t('Davco is a Sika brand, quoted from the Davco page', /Sika family|Sika brand/.test(r.txt) && r.links.some((u) => /davco/.test(u)));
r = await ask('where can i buy sika products');
t('where to buy points at the published page and says the list is not held', r.links.some((u) => /where-to-buy/.test(u)) && /not in the documentation/i.test(r.txt));
r = await ask('can i buy sika from bunnings');
t('a named retailer is not guessed', r.a.cards[0].status === 'UNKNOWN');
r = await ask('who owns sika');
t('ownership is not in the documentation', r.a.cards[0].status === 'UNKNOWN');
r = await ask('price of sikaflex 11 fc');
t('prices stay declined', r.a.cards[0].status === 'UNKNOWN');
r = await ask('how do i fix a leaking shower');
t('the Sika home owner page on leaking showers is found by its name', r.links.some((u) => /leaking-shower/.test(u)) || r.a.cards.some((c) => c.facts.some((f) => /leaking-shower/.test(f.source_url))));
r = await ask('does sika sell to the automotive industry');
t('industry question goes to the industry page', r.links.some((u) => /automotive-aftermarket/.test(u)));
// ---- codes
r = await ask('en 1504 repair mortar');
t('a standard code finds the product lines that carry it', r.a.cards[0].type === 'info' && /1504/.test(r.txt));
r = await ask('as 3740 waterproofing of wet areas');
t('a code no product page quotes is said plainly, not guessed', r.a.cards[0].status === 'UNKNOWN');
// ---- slang, shorthand and typos
t('slang table: every entry names where it comes from', SLANG.every((s) => s.cite && s.cite.length > 3));
t('slang: flexi glue / tile on tile / goop', applySlang('flexi glue for big tiles').text.includes('flexible') && applySlang('tile on tile').text.includes('existing tiles') && applySlang('goop for the bath').text.includes('sealant'));
t('slang: fused product codes split', applySlang('sikaflex11fc').text === 'sikaflex 11 fc' && applySlang('viscocrete1250').text === 'viscocrete 1250');
for (const [q, rx] of [['waterprofing for shower floor', /membrane|waterproof/i], ['screed it out for a big shed floor', /level|screed/i], ['flexi glue for big tiles', /tile|davco|sikatile/i], ['silly cone for the shower', /sil|seal/i], ['sikaflex 11fc', /11 FC/]]) { r = await ask(q); t('messy: ' + q, r.a.cards.some((c) => rx.test(c.title + ' ' + (c.product ? c.product.name : '') + ' ' + c.headline)) && r.a.cards[0].status !== 'UNKNOWN', r.txt); }
r = await ask('srrvice temperature of sikaflex-400 fire');
t('typo in an attribute word still finds the label or says it is not published', r.a.cards[0].product && r.a.cards[0].product.id === 'sikaflex-400-fire');
// ---- vague asks: one short question, two to four options, each option answers
for (const q of ['what do i need for a bathroom', 'something for cracks', 'best stuff for outside', 'waterproofing', 'help with a leak', 'something for the roof', 'tile adhesive', 'grout', 'screed', 'need help with concrete', 'best stuff for the garage floor']) {
  r = await ask(q); const c = r.a.cards[0]; const n = (c.choices || []).length;
  t('vague "' + q + '": one choose card with 2 to 4 options', r.a.cards.length === 1 && c.type === 'choose' && n >= 2 && n <= 4, JSON.stringify(c.followups));
  let allAnswer = true; for (const o of c.followups || []) { const x = await ask(o); if (x.a.cards[0].type === 'choose' || x.a.cards[0].status === 'UNKNOWN') allAnswer = false; }
  t('vague "' + q + '": every option is answered with products or a page', allAnswer);
}
r = await ask('how much adhesive do i need for 15 square metres of 600x600 tiles');
t('a quantity with no product named gets the documented-fit products, each with a worked quantity that carries its source', r.a.cards[0].type === 'advice' && r.a.cards.filter((c) => c.type === 'calculation').length >= 2 && r.a.cards.filter((c) => c.type === 'calculation').every((c) => c.facts.length && /m2|bag|kg/i.test(cardText(c))), r.txt.slice(0, 200));
r = await ask('which tile adhesive has the longest open time');
t('a numeric criterion is a sort over cited published figures', r.a.cards[0].type === 'advice' && /ordered by the longest published open time/.test(r.a.cards[0].title) && r.a.cards.slice(1).every((c) => c.facts[0].sentence && /minute|hour/i.test(c.facts[0].sentence) && /\.pdf/.test(c.facts[0].source_url)), r.txt.slice(0, 200));
// ---- multi-turn: follow-ups to a best-X answer, ordinals, assumptions named
{ let st = null; const turn = async (q) => { const a = await b.ask(q, st); st = a.state || st; return { a, txt: a.cards.map(cardText).join('\n') }; };
  let x = await turn('best adhesive for large format tiles');
  t('follow-up: first answer names an assumption about inside or outside with a one-tap switch', x.a.cards[0].lines.some((l) => l.label === 'Assumption') && x.a.cards[0].followups.some((f) => /external/.test(f)), JSON.stringify(x.a.cards[0].lines));
  x = await turn('and for outside?');
  t('follow-up: "and for outside?" re-asks the same job for outside', x.a.cards[0].type === 'advice' && /exterior|external|outdoor/i.test(x.txt), x.txt.slice(0, 200));
  x = await turn('tell me more about the first one');
  t('follow-up: "the first one" is the first product of the last answer', x.a.cards[0].type === 'product');
  const first = x.a.cards[0].product.id; x = await turn('what about the second one');
  t('follow-up: "the second one" is a different product from the first', x.a.cards[0].type === 'product' && x.a.cards[0].product.id !== first); }
// ---- ambiguity on a range name, and failures needing a site look
r = await ask('can i put sikaflex over old silicone');
t('a range name alone gets one clarifying question with 2 to 4 products', r.a.cards.length === 1 && r.a.cards[0].type === 'choose' && r.a.cards[0].choices.length >= 2 && r.a.cards[0].choices.length <= 4);
r = await ask('my tiles are lifting in the kitchen what could have caused it');
t('a fault diagnosis is declined with the Technical Services hand-off', r.a.cards[0].status === 'UNKNOWN' && !!r.a.cards[0].handoff);
r = await ask('what does self levelling mean');
t('a term the data sheet defines is quoted from the data sheet', /highly fluid/.test(r.txt) && r.a.cards[0].facts.length >= 1);
r = await ask('wich adhesive fr 900x900 porclain on a wal');
t('heavy typos still reach the adhesive range', r.a.cards.some((c) => /adhesive|mastic|sikatile|davco/i.test(c.title + ' ' + (c.product ? c.product.id : ''))), r.txt.slice(0, 200));
r = await ask('need a seal for the window frame and the bath');
t('two jobs in one request: one clarifying question, one option each', r.a.cards.length === 1 && r.a.cards[0].type === 'choose' && r.a.cards[0].choices.length === 2);
for (const o of r.a.cards[0].followups) { const x = await ask(o); t('two-job option answers: ' + o, x.a.cards[0].status !== 'UNKNOWN' && x.a.cards[0].type !== 'choose', x.txt.slice(0, 120)); }
// ---- trade terms Sika does not define in one place
for (const q of ['what is pot life', 'what is open time', 'what does adjustability time mean']) { r = await ask(q); const c = r.a.cards[0]; t('term "' + q + '": says there is no general definition and offers products that publish the figure', c.type === 'choose' && /no general definition/.test(c.headline) && c.choices.length >= 2); const x = await ask(c.followups[0]); t('term "' + q + '": the first option answers with a published figure', x.a.cards[0].type === 'time' && x.a.cards[0].status === 'PUBLISHED', x.txt.slice(0, 160)); }
r = await ask('index fidia 4mm');
t('an old name the Sika page publishes finds the product and says where the name comes from', r.ids[0] === 'sikashield-p44-tfidia4mm' && /Formerly Index Fidia 4mm/i.test(r.txt), r.txt.slice(0, 200));
r = await ask('what is sikaflex 11 fc used for');
t('a name shared by two products shows both, never one silently', r.a.cards.filter((c) => c.type === 'product').length >= 2);
// ---- every clarifying option on every card must itself be answered (no dead taps)
{ const opts = [...VAGUE.flatMap((v) => v.opts), ...NOUN.flatMap(([, v]) => v.opts), ...TERMS.flatMap((x) => x.opts)]; const dead = []; for (const o of [...new Set(opts)]) { const x = await ask(o); if (x.a.cards[0].type === 'choose' || x.a.cards[0].status === 'UNKNOWN') dead.push(o + ' => ' + x.a.cards[0].type); }
  t(`all ${new Set(opts).size} clarifying options are answered`, dead.length === 0, dead.join(' | ')); }
r = await ask('i need something for the thingamajig');
t('an unknown job gets one clarifying question, not an index guess', r.a.cards.length === 1 && r.a.cards[0].type === 'choose' && r.a.cards[0].choices.length >= 2 && r.a.cards[0].choices.length <= 4);
// ---- out of scope
for (const q of ['what is the weather today', 'is mapei better than davco', 'who is the prime minister', 'asdfgh']) { r = await ask(q); t('out of scope declined: ' + q, r.a.cards.every((c) => c.status === 'UNKNOWN') && !/mapei/i.test(r.txt), r.txt); }
// ---- off-topic and unanswerable questions never get a published answer
{ const oos = JSON.parse(fs.readFileSync(path.join(HERE, 'coverage', 'oos_set.json'), 'utf8')); const leaks = []; for (const q of oos) { const a = await b.ask(q); if (a.cards.some((c) => c.status === 'PUBLISHED' && c.type !== 'choose')) leaks.push(q + ' => ' + a.cards[0].title); }
  t(`off-topic set (${oos.length} questions): no published answer`, leaks.length === 0, leaks.join(' | ')); }
// ---- the bank gate
const bank = ['bank.json', 'blind2.json', 'extra.json', 'wild.json', 'wild2.json', 'jobcompare.json'].flatMap((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'coverage', f), 'utf8')));
const sel = makeSelectors(b.core().P); let wrong = [], prop = 0, answered = 0, honest = 0;
for (const it of bank) { const a = await b.ask(it.q, null); const j = judge(it, a, sel); if (j.cls === 'WRONG') wrong.push(it.id + ' ' + it.q + ' :: ' + j.why); if (j.cls === 'ANSWERED') answered++; if (j.cls === 'HONEST-NO-DATA') honest++; { const pb = checkAnswer(it.q, a); prop += pb.length; if (pb.length) console.log('   P', it.q, JSON.stringify(pb[0]).slice(0, 200)); } }
t(`bank (${bank.length} questions): at most 1 judged WRONG`, wrong.length <= 1, wrong.join(' | '));
t('bank: ANSWERED plus HONEST-NO-DATA at least 95%', (answered + honest) / bank.length >= 0.95, ((answered + honest) / bank.length).toFixed(3));
t('bank: property checks (no invented number, no price, no dash, no compliance claim) find 0 violations', prop === 0, prop);
console.log(`unit_coverage: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
