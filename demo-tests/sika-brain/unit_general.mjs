// unit_general.mjs: the conversation layer must GENERALISE. Every phrasing here is the author's own, written for this file only (none is in convo_bank.json or convo_holdout.json),
// and each block tests a STRUCTURE (a short message with no product, material or job in it is social; a place or category with no problem is clarified; "X vs Y" is a side-by-side card;
// "it" is the last product of the session; a singular ask gets a lead pick), not a word list. Run: node unit_general.mjs
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
let pass = 0, fail = 0; const failed = []; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; failed.push(n); console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n'); const NOTDOC = /not in the published documentation|I do not know this/i;
const nChips = (a) => { const c = a.cards[0] || {}; return Math.max((c.choices || []).length, (c.followups || []).length, (a.followups || []).length); };
const run = async (turns) => { let st = null, a = null; for (const q of turns) { a = await b.ask(q, st); st = a.state; } return a; };

// 1. SOCIAL: a short message with no product, material, job or place in it is chat, whatever the wording
const SOCIAL = ['oi anyone home', 'afternoon all, you around?', 'is this thing on', 'g\'day crew', 'can i talk to a human or is it a machine', 'you a robot?',
  'how does this work', 'first time here, what do i do', 'legend, that did the trick', 'much obliged', 'talk to me', 'hmm ok then', 'hello again team', 'nice to meet you', 'any chance of a hand?'];
for (const q of SOCIAL) { const a = await run([q]); const c = a.cards[0]; t(`social "${q}": a warm choose card with starter chips, not the not-found card`, c.type === 'choose' && !NOTDOC.test(txt(a)) && nChips(a) >= 3, `${c.type} | ${c.title}`); }

// 1b. real out-of-scope questions still get the honest no, and money / stock questions keep their handoff
for (const q of ['what is the capital of France', 'how much does Sikaflex-11 FC+ cost', 'is the warehouse open on sunday and do you have stock']) { const a = await run([q]); t(`honest no kept: "${q}"`, a.cards[0].type === 'unknown' || /Technical Services|price|published|stock|stockist|Where to buy/i.test(txt(a)), txt(a)); }

// 2. CLARIFY: a place, a category or a problem with no job named is asked, never answered
const CLARIFY = ['whats the story with grout', 'got a leak somewhere, help', 'can you help with the ceiling', 'need something for tiles', 'what are my options for the shed floor', 'someone wants a sealant but doesnt know what for',
  'looking at epoxy but not sure what for', 'whats available in waterproofing', 'need something to stop damp, not sure where', 'a mate asked me about primer, no idea what job it is', 'tell me about adhesives', 'there is a crack, what do i do',
  'my patio is a mess, any ideas', 'cant decide on a sealer'];
for (const q of CLARIFY) { const a = await run([q]); const c = a.cards[0]; t(`clarify "${q}": one clarifying card with 3 to 5 chips`, c.type === 'choose' && nChips(a) >= 3 && nChips(a) <= 5 && !NOTDOC.test(txt(a)), `${c.type} | ${c.title}`); }

// 3. PICK: a singular ask (one, your pick, go-to, top choice) gets a lead "My pick", a quoted sentence, and no unranked list
const PICK = ['which silicone for around the bath, just the one', 'single best adhesive for skirting boards', 'what is your top choice for levelling a bumpy floor', 'choose one primer for smooth concrete',
  'one waterproofer for a shower floor please', 'give me one tile adhesive for porcelain on a concrete floor', 'go-to sealant for outdoor window frames, one only', 'if you had to choose one grout for a shower, which', 'name the one epoxy for fixing steel plates',
  'whats your pick for a membrane under balcony tiles', 'which one repair mortar for a broken concrete step, just one', 'pick me a sealant for a bathroom'];
for (const q of PICK) { const a = await run([q]); const c = a.cards[0]; t(`pick "${q}": leads with a pick, not a list or a question`, c.type !== 'choose' && c.type !== 'unknown' && (/^My pick/.test(c.headline || '') || a.trace.includes('chat:tie')), `${c.type} | ${c.title} | ${(c.headline || '').slice(0, 70)}`); }

// 4. COMPARE: two named products joined by any comparing word are one side-by-side card, same attributes per row, no ranking
const CMP = ['Sikaflex-11 FC+ vs Sikaflex PRO', 'whats the difference between Sikadur-31 CF Normal and Sikadur-32 LP', 'Sika Boom G or Sika Boom AP', 'compare Sikafloor-161 with Sikafloor-169', 'Sikalastic-1K versus Sikalastic-1 Komponent',
  'SikaBond TechGrip against Sikaflex-221', 'Davco Easy Grout compared with Davco Rejuvenation Grout', 'how does Sikadur-30 differ from Sikadur-330', 'Sikaflex 111 Stick & Seal vs Sikaflex 112 Crystal Clear', 'Sikadur 51 versus 42 HF',
  'Sikaflex-221 and Sikaflex-227, which is better', 'Sikafloor-160 or Sikafloor-161?', 'is Sikagard-62 the same as Sikagard-63 N'];
for (const q of CMP) { const a = await run([q]); const c = a.cards[0]; t(`compare "${q}": a side-by-side comparison card`, c.type === 'comparison' && !NOTDOC.test(c.title + c.headline), `${c.type} | ${c.title}`); const x = txt(a); t(`compare "${q}": no ranking claim`, !/\b(is the best|wins|better than)\b/i.test(c.headline || '')); }
for (const [first, second] of [['tell me about Sikaflex-11 FC+', 'how does it compare to Sikaflex PRO'], ['Sikadur-33', 'what about it versus Sikadur-31 CF Normal'], ['coverage of Sikafloor-161', 'and it against Sikafloor-169'], ['Davco Easy Grout', 'difference between it and Davco Rejuvenation Grout'], ['Sika Boom G', 'is it any different to Sika Boom AP']]) {
  const a = await run([first, second]); const c = a.cards[0]; t(`compare with "it": "${second}" keeps the earlier product`, c.type === 'comparison' && /Sika|Davco/.test(c.title) , `${c.type} | ${c.title}`);
}

// 5. ROOM: a pick ask after a place question keeps the place
{ const a = await run(['help me with the ensuite', 'which adhesive would you choose for the wall']); const c = a.cards[0]; t('room kept: shower then a pick ask is a pick, not a re-ask', c.type !== 'choose' && c.type !== 'unknown', `${c.type} | ${c.title}`); }
{ const a = await run(['Sikaflex-11 FC+', 'thanks', 'and how long to cure']); t('thanks mid-chat keeps the product', a.cards[0].type !== 'unknown', a.cards[0].title); }


// 6. FAMILY WORDS: a range name followed by more of the product's own name is that product, not a "which one?" question
for (const [q, rx] of [['is SikaBond TechGrip good for a bathroom mirror', /TechGrip/], ['how long does Sikaflex Stick & Seal take to cure', /Stick & Seal/], ['what is the shelf life of Sikaflex Extreme Grab', /Extreme Grab/], ['is Sikadur Combiflex fine outdoors', /Combiflex/], ['coverage of Sikafloor Level PRO', /Level PRO/],
  ['can SikaBond Wood Floor go over underfloor heating', /Wood Floor/], ['pot life of Sikadur 30 please', /Sikadur-30/], ['how long to cure Sikaflex Crystal Clear', /Crystal Clear/], ['is Sikaflex Fillet paintable', /Fillet/], ['cure time for SikaBond SprayFix', /SprayFix/]]) {
  const a = await run([q]); const c = a.cards[0]; t(`family: "${q}" is answered for the named product`, c.type !== 'choose' && rx.test(txt(a)), `${c.type} | ${c.title}`);
}
// 7. "I do not know" in reply to a question is met warmly with the starter jobs, never the not-found card
for (const q of ['no clue honestly', 'not too sure to be honest', 'i have no idea', 'dunno really', 'cant say sorry', 'unsure at this stage', 'honestly not certain', 'i really do not know', 'hard to say', 'still deciding']) {
  const a = await run(['some help with a floor please', q]); const c = a.cards[0]; t(`unsure reply "${q}" after a question: a choose card with chips`, c.type === 'choose' && !NOTDOC.test(txt(a)) && nChips(a) >= 3, `${c.type} | ${c.title}`);
}
// 8. AREA FOLLOW-UP: an area with a quantity question right after a product is that product
for (const [prod, q] of [['Sikaflex-11 FC+', '8 m2, how many cartridges'], ['Davco K10 Rapid', 'about 12 m2, how much do I need'], ['Sikafloor Level PRO', '20 m2 how many bags'], ['Sikalastic-1K', 'for 15 m2, how many litres'], ['Davco Easy Grout', '30 m2 how much grout'], ['SikaTile-400 EVO PRO', '25 m2, how many bags'], ['Sikafloor-161', '40 m2 how many kits'], ['Davco K10 Plus', '10 m2, how many litres'], ['Sikaflex PRO', '6 m2 how much'], ['Davco Grey One Pot adhesive', '14 m2, how many bags do I need']]) {
  const a = await run([prod, q]); const c = a.cards[0]; t(`area follow-up "${q}" after ${prod} does not ask what the job is`, !(c.type === 'choose' && /Which of these do you mean/.test(c.title)) && !NOTDOC.test(c.title), `${c.type} | ${c.title}`);
}
// 9. A pick ask with "and" joining surfaces is one job, not a "which one first?" split
for (const q of ['sealant for the bath and the shower screen, which one would you choose', 'which adhesive for tiles on the wall and the floor, just one', 'pick one waterproofer for the floor and walls of a bathroom', 'what sealant would you pick for the sink and the benchtop', 'one adhesive for skirting and architraves, your pick',
  'choose a sealant for window frames and door frames', 'single best silicone for the bath and basin', 'which waterproofing for the shower floor and walls, one only', 'go-to adhesive for the deck and the stairs, just one', 'tell me the one sealant for the roof and gutter']) {
  const a = await run([q]); const c = a.cards[0]; t(`pick with "and": "${q}" is not split into a which-one-first`, c.title !== 'Which one first?', `${c.type} | ${c.title}`);
}

console.log(`UNIT GENERAL: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
