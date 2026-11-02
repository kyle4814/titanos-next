// unit_honestno.mjs: the honest no (integration 2026-11-02). When no product, rule or sheet in the published data answers (price, stock, delivery, finance, warranty terms,
// other brands, a property no sheet carries, hardware and gas fittings Sika does not make), the reply is the unknown card only: never a "which product?" clarifier, a page that
// shares a word, or a near-miss product. Phrasings here are the author's own probes, not taken from any exam bank. The positives at the end must still answer.
import { makeBrain } from './harness.mjs';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } };
const b = makeBrain(); const sig = (a) => a.cards.map((c) => c.type + ':' + c.title).join(' | ');
const NO = [
  'how much is a tube of Sikaflex', 'any discount on pallets of SikaBond', 'can I pay for Sika products over time', 'is SikaBond stocked at Bunnings', 'what is the lead time for Sikafloor', 'do you deliver Sikalastic to Darwin',
  'do you stock Selleys silicone', 'is Sikaflex stronger than Bostik', 'what is the best Resene primer', 'how does a Hilti anchor compare', 'do you sell Dulux paint', 'is Sikaflex cheaper than Liquid Nails',
  'what is the magnetic permeability of SikaBond', 'what is the refractive index of Sikaflex', 'what is the boiling point of Sikaflex Construction AP+',
  'what is the warranty on SikaBond', 'how many years warranty does Sikalastic have', 'does Sikaflex come with a lifetime warranty',
  'do you sell screws', 'do you make a sealant for gas pipes',
];
for (const q of NO) { const a = await b.ask(q, null); t(`honest no: "${q}"`, a.cards.length > 0 && a.cards.every((c) => c.type === 'unknown'), sig(a)); }
// positives: the same routes still answer what the data does hold
{ const a = await b.ask('how do I register for the Sika warranty portal', null); t('warranty portal registration still answers from the portal page', a.cards.some((c) => c.type === 'info'), sig(a)); }
{ const a = await b.ask('where can I buy Sikaflex', null); t('where to buy still answers from the published stockist page', a.cards.some((c) => c.type === 'info' && /where to buy/i.test(c.title)), sig(a)); }
{ const a = await b.ask('what is the shelf life of Sikaflex Construction AP+', null); t('a published property still answers', a.cards.some((c) => c.type !== 'unknown'), sig(a)); }
{ const a = await b.ask('what is the service temperature of Sikaflex Construction AP+', null); t('service temperature still answers', a.cards.some((c) => c.type !== 'unknown'), sig(a)); }
{ const a = await b.ask('what is the best sealant for a bathroom', null); t('a real best-product ask still answers', a.cards.some((c) => c.type === 'advice' || c.type === 'product'), sig(a)); }
console.log(`unit_honestno: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
