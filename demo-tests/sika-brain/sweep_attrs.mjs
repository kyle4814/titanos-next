// sweep_attrs.mjs (Fable round, 2026-11-03): the coverage gate swept both ways over EVERY product.
//   PRESENT: for each product and each cover.js attribute whose words ARE in the product's own data (product page + data sheet numbers, never the SDS),
//            ask "what is the <attribute> of <product>": it must never be refused (no not-in-the-data card).  Also the data sheet numbers (shelf life, pot life,
//            pack sizes, cure time...) asked the same way.
//   ABSENT:  for each product and each attribute whose words are NOT in its data, the same ask must be refused, the refusal must name that product, and no
//            product card may carry a different product as the answer.
// No model, no network. Bars: PRESENT refused <= 1%, ABSENT answered <= 1% (set BAR). SHOW=n prints n misses per side. Exit 1 when a bar is missed.
import fs from 'node:fs'; import path from 'node:path';
import { makeBrain, PORTAL } from './harness.mjs';
import { COVER_ATTRS } from '../../public/demo/sika-210c0c/assets/brain/cover.js';
const b = makeBrain();
const NOTDOC = /not in the published documentation|I do not know this|do not state|do not mention|do not list/i;
const notfound = (a) => { const c = a.cards[0] || {}; return c.type === 'unknown' || NOTDOC.test((c.title || '') + ' ' + (c.headline || '')); };
const ASK = { fire: (n) => `is ${n} fire rated`, slip: (n) => `what is the slip rating of ${n}`, food: (n) => `is ${n} food safe`, potable: (n) => `is ${n} safe for drinking water`, acoustic: (n) => `what is the acoustic rating of ${n}`,
  greenstar: (n) => `is ${n} green star rated`, epd: (n) => `does ${n} have an EPD`, carbon: (n) => `what is the carbon footprint of ${n}`, thermal: (n) => `what is the thermal conductivity of ${n}`, origin: (n) => `where is ${n} made`, asbestos: (n) => `does ${n} contain asbestos`, voc: (n) => `what is the VOC content of ${n}` };
const NUMQ = { shelf_life: 'shelf life', pot_life: 'pot life', pack_sizes: 'pack sizes', cure_time: 'cure time', skin_time: 'skin time', open_time: 'open time', service_temp: 'service temperature', movement: 'movement capability', shore: 'Shore hardness', voc: 'VOC content', coverage: 'coverage', density: 'density', mix_ratio: 'mixing ratio' };
const BAR = Number(process.env.BAR || 0.01), SHOW = Number(process.env.SHOW || 6);
const dir = path.join(PORTAL, 'data/brain/p'); const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
let present = 0, presentRefused = 0, absent = 0, absentAnswered = 0, absentWrongName = 0; const missP = [], missA = [];
for (const id of ids) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')); delete p.sf; let text = JSON.stringify(p);
  const nf = path.join(PORTAL, 'data/brain/num', id + '.json'); const num = fs.existsSync(nf) ? JSON.parse(fs.readFileSync(nf, 'utf8')) : null; if (num) text += JSON.stringify(num);
  const name = p.n; if (!name || /\s(and|or)\s/.test(name) && name.length > 40) continue;
  for (const at of COVER_ATTRS) {
    if (!at.has || !ASK[at.id]) continue;
    const q = ASK[at.id](name); const a = await b.ask(q, null); const nf2 = notfound(a); const named = a.cards.map((c) => c.product && c.product.name).filter(Boolean);
    if (at.has.test(text)) { present++; if (nf2) { presentRefused++; if (missP.length < SHOW) missP.push(`${q} :: ${(a.cards[0].headline || '').slice(0, 110)}`); } }
    else { absent++;
      if (!nf2) { absentAnswered++; if (missA.length < SHOW) missA.push(`${q} :: [${a.cards[0].type}] ${(a.cards[0].title || '').slice(0, 50)} :: ${(a.cards[0].headline || '').slice(0, 90)}`); }
      else if (named.length || !(a.cards[0].headline || '').includes(name) && !(a.cards[0].about && a.cards[0].about.name === name)) { absentWrongName++; if (missA.length < SHOW) missA.push(`${q} :: refused but names ${named[0] || 'no product'} :: ${(a.cards[0].headline || '').slice(0, 90)}`); } }
  }
  if (num && num.f) for (const [k, lab] of Object.entries(NUMQ)) { if (!num.f[k] || !num.f[k].length) continue; present++; const q = `what is the ${lab} of ${name}`; const a = await b.ask(q, null); if (notfound(a)) { presentRefused++; if (missP.length < SHOW) missP.push(`${q} :: ${(a.cards[0].headline || '').slice(0, 110)}`); } }
}
const pr = present ? presentRefused / present : 0, ar = absent ? (absentAnswered + absentWrongName) / absent : 0;
console.log(`SWEEP ATTRS: products ${ids.length} | PRESENT asked ${present}, refused ${presentRefused} (${(pr * 100).toFixed(2)}%) | ABSENT asked ${absent}, answered ${absentAnswered}, refused with the wrong product ${absentWrongName} (${(ar * 100).toFixed(2)}%) | bar ${(BAR * 100).toFixed(1)}%`);
for (const m of missP) console.log('  PRESENT refused: ' + m); for (const m of missA) console.log('  ABSENT miss: ' + m);
process.exit(pr <= BAR && ar <= BAR ? 0 : 1);
