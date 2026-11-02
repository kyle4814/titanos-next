// unit_opus.mjs: the Opus quality round (2026-11-03). 160+ of the author's own probes (own phrasing, typos, Aussie slang, multi-turn), by class:
//   honest  : the coverage decision. The asked object or attribute is not in the published data, so the reply says exactly that and names no product as the answer
//             (strict: first card is the not-in-the-data card and no card carries a product). Absent-property probes first check the data really lacks the property.
//   near    : near misses that the data DOES cover (colours, packs, uses, a standard the sheet cites): these must still answer.
//   clarify : a vague ask gets one clarifying question with 3 to 5 chips.        pick    : a clear job gets "My pick" with a quoted sentence (or a real tie question).
//   compare : side by side, "the sheets do not rank" on which-is-better, a chooser when a side is a range.
//   qty     : area + product gives a computed number; the one missing variable is asked.     multi : context carried, dropped on a topic change, pronouns resolved.
// No model, no network: the brain is the local rule engine (harness.mjs). Exit 1 on any failure. CLASS=honest node unit_opus.mjs runs one class; V=1 prints every answer.
import fs from 'node:fs'; import path from 'node:path';
import { makeBrain, PORTAL } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const b = makeBrain();
const NOTDOC = /not in the published documentation|I do not know this/i;
const UNITS = /\d[\d.,]*\s*(m2|m²|sqm|metres?|litres?|L\b|pails?|cartridges?|bags?|kg|coats?|tubes?|units?|mm|sausages?|packs?)/i;
const txt = (a) => a.cards.map(cardText).join('\n');
const chips = (a) => { const c = a.cards[0] || {}; return Math.max((c.choices || []).length, (c.followups || []).length, (a.followups || []).length); };
const notfound = (a) => { const c = a.cards[0] || {}; return c.type === 'unknown' || NOTDOC.test((c.title || '') + ' ' + (c.headline || '')); };
const dataText = (id) => { let s = ''; for (const d of ['p', 'num']) { const f = path.join(PORTAL, 'data/brain', d, id + '.json'); if (fs.existsSync(f)) s += fs.readFileSync(f, 'utf8'); } return s; };
// ---- checks: each returns '' (pass) or the reason
const HN = (has, not) => (a) => { const t = txt(a); if (!notfound(a)) return 'not stated as unpublished'; if (a.cards.some((c) => c.product)) return 'a card names a product'; if (has && !has.test(t)) return 'missing ' + has; if (not && not.test(t)) return 'forbidden ' + not; if (/\u2014|\u2013/.test(t)) return 'long dash in buyer text'; return ''; };
const ANS = (has) => (a) => { if (notfound(a)) return 'not-found card on a covered ask'; if (has && !has.test(txt(a))) return 'missing ' + has; return ''; };
const CLAR = () => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; if (c.type !== 'choose') return 'answered instead of asking (' + c.type + ')'; const k = chips(a); return k < 3 || k > 5 ? 'chip count ' + k : ''; };
const PICK = (has) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; if (c.type === 'choose' && !(a.trace || []).includes('chat:tie')) return 'clarifier instead of a pick'; if (!/^My pick/.test(c.headline || '') && !(a.trace || []).includes('chat:tie')) return 'no My pick lead'; if (!a.cards.some((x) => x.source && x.source.sentence)) return 'no quoted sentence'; if (has && !has.test(txt(a))) return 'missing ' + has; return ''; };
const CMP = (has) => (a) => { if (notfound(a)) return 'not-found card'; const prods = a.cards.filter((x) => x.product).length; if (a.intent !== 'compare' && a.cards[0].type !== 'comparison' && prods < 2) return 'not side by side'; if (has && !has.test(txt(a))) return 'missing ' + has; return ''; };
const CHOOSER = (has) => (a) => { const c = a.cards[0] || {}; if (c.type !== 'choose') return 'no chooser (' + c.type + ')'; if (chips(a) < 2) return 'too few chips'; if (has && !has.test(txt(a) + ' ' + JSON.stringify(c.choices || c.followups || []))) return 'missing ' + has; return ''; };
const QTY = (has) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; if (c.type === 'choose') return 'clarifier, no number'; const t = txt(a); if (!/rounded up|packs?, rounded|you need|Working/i.test(t) && !(['calc'].includes(a.intent) || c.type === 'calculation')) return 'no computed quantity (' + a.intent + '/' + c.type + ')'; if (!UNITS.test(t)) return 'no number with a unit'; if (has && !has.test(t)) return 'missing ' + has; return ''; };
const ASKAREA = () => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; const t = (c.title || '') + ' ' + (c.headline || ''); return /\b(area|m2|square met|how big|size of)\b/i.test(t) && /\?/.test(t) ? '' : 'did not ask for the area: ' + t.slice(0, 120); };
// colours a sheet does not list: a near miss, so an answer that says so and shows what the sheet does publish (pack sizes), naming no other product
const COLNO = (name) => (a) => { if (notfound(a)) return 'not-found card on a near miss'; const t = txt(a); if (!/do not list its colours/.test(t)) return 'did not say the colours are not listed'; if (a.cards.some((c) => c.product && c.product.name !== name)) return 'named another product'; return ''; };
const MT = (has, not) => (a) => { if (notfound(a)) return 'not-found card'; const t = txt(a); if (has && !has.test(t)) return 'missing ' + has; if (not && not.test(t)) return 'forbidden ' + not; return ''; };
// absent: [productId, regex the data must NOT contain] so a probe never claims an absence the data contradicts
const P = [
  // ---------------- honest: a property the named product's own sheet does not state
  ['honest', 'what is the fire rating of Sikaflex-11 FC+', HN(/Sikaflex-11 FC\+.*fire|fire.*Sikaflex-11 FC\+/is, /Sikaflex-400 Fire|Sikasil-670 Fire/), ['1671', /fire[ -]?(rating|rated|resist)|\bfrl\b/i]],
  ['honest', 'is sikaflex 11fc fire rated', HN(/fire/i, /Sikaflex-400 Fire/), ['1671', /fire[ -]?(rating|rated|resist)|\bfrl\b/i]],
  ['honest', 'whats the FRL on Sikaflex-11 FC+ mate', HN(/Sikaflex-11 FC\+/), ['1671', /\bfrl\b|fire[ -]?(rating|rated|resist)/i]],
  ['honest', 'is Davco K10 Plus fire rated', HN(/K10 Plus/), ['davco-k10-plus', /fire[ -]?(rating|rated|resist)|\bfrl\b/i]],
  ['honest', 'what is the slip rating of Davco K10 Plus', HN(/slip/i), ['davco-k10-plus', /slip/i]],
  ['honest', 'is SikaSeal Kitchen and Bathroom food safe', HN(/food/i), ['sikaseal-kitchenandbathroom', /food (contact|safe|grade)/i]],
  ['honest', 'acoustic rating of Sikaflex PRO?', HN(/acoustic/i), ['4649', /acoustic/i]],
  ['honest', 'whats the warranty on Sikaflex PRO', HN(/warrant/i), ['4649', /warrant/i]],
  ['honest', 'how long is the warranty for davco k10 plus', HN(/warrant/i), ['davco-k10-plus', /warrant/i]],
  ['honest', 'is SikaGrout HES green star rated', HN(/green star/i), ['sikagrout-hes', /green ?star/i]],
  ['honest', 'what is the R value of Sikafloor-4020 FiberLevel', HN(/R.value|thermal/i), ['sikafloor-4020-fiberlevel', /r[ -]?value|thermal (resist|conduct)/i]],
  ['honest', 'where is Sikaflex-11 FC+ made', HN(/made|origin|manufactur/i), ['1671', /made in|country of origin|manufactured in/i]],
  ['honest', 'whats the thermal conductivity of SikaGrout HES', HN(/thermal/i), ['sikagrout-hes', /thermal conductivity/i]],
  ['honest', 'what is the carbon footprint of Sika MonoTop-910 N', HN(/carbon/i), ['sika-monotop-910n', /carbon footprint|embodied carbon|\bgwp\b/i]],
  ['honest', 'does sikadur 33 contain asbestos', HN(/asbestos/i), ['sikadur-33', /asbestos/i]],
  ['honest', 'is the k10 plus slip resistant once tiled', HN(/slip/i), ['davco-k10-plus', /slip/i]],
  ['honest', 'whats the fire resistance level of sikatile 410 secure set', HN(/fire/i, /Sikaflex-400 Fire|Sikasil-670 Fire|Sika Firerate/), ['sikatile-410-secureset', /fire[ -]?(rating|rated|resist)|\bfrl\b/i]],
  ['honest', 'Sikasil Pool acoustic performance', HN(/acoustic/i), ['sikasil-pool', /acoustic/i]],
  // ---------------- honest: a standard or regulation the data does not cite
  ['honest', 'does Sikaflex-11 FC+ comply with AS 3740', HN(/AS ?3740/i), ['1671', /AS ?3740/i]],
  ['honest', 'is davco k10 plus AS3740 compliant', HN(/AS ?3740/i), ['davco-k10-plus', /AS ?3740/i]],
  ['honest', 'does SikaTile-110 Secure Proof meet AS 3740', HN(/AS ?3740/i), ['sikatile-110-secureproof', /AS ?3740/i]],
  ['honest', 'which membrane complies with AS 3740', HN(/AS ?3740/i)],
  ['honest', 'is Sikalastic-1K certified to AS 4654', HN(/AS ?4654/i), ['sikalastic-1k', /AS ?4654/i]],
  ['honest', 'does SikaSeal Kitchen and Bathroom meet the NCC', HN(/NCC|building code/i), ['sikaseal-kitchenandbathroom', /\bNCC\b|building code/i]],
  ['honest', 'is SikaBond-142 Instant Nails BCA compliant', HN(/BCA|building code|NCC/i), ['sikabond-142-instantnails', /\bBCA\b|\bNCC\b|building code/i]],
  ['honest', 'do i need council approval to waterproof my shower', HN()],
  ['honest', 'is it legal for me to do my own bathroom waterproofing in qld', HN()],
  ['honest', 'can you sign off my waterproofing as compliant', HN()],
  ['honest', 'will my home insurance cover a leak if i use K10', HN()],
  ['honest', 'does this meet australian standards for wet areas, AS 3740 i mean', HN(/AS ?3740/i)],
  // ---------------- honest: price, stock, delivery, warranty terms (a named product is still not the answer)
  ['honest', 'is Sikaflex PRO in stock at bunnings', HN(/stock/i)],
  ['honest', 'how much does a 4 L pail of Davco K10 Plus cost', HN(/price|cost/i)],
  ['honest', 'got any K10 in stock at the Brissy store?', HN(/stock/i)],
  ['honest', 'when will sikaflex 11fc be back in stock', HN(/stock/i)],
  ['honest', 'can you deliver SikaGrout HES to Cairns by friday', HN(/deliver/i)],
  ['honest', 'whats the rrp on sikasil pool', HN(/price|rrp/i)],
  ['honest', 'do tradies get a discount on sikabond', HN()],
  ['honest', 'what is the price of Sikaflex-11 FC+', HN(/price/i)],
  ['honest', 'is it cheaper at mitre 10 or bunnings', HN()],
  ['honest', 'how much is a sausage of sikaflex pro at bunnings', HN()],
  // ---------------- honest: an object that is not in the range
  ['honest', 'do you sell timber', HN()],
  ['honest', 'do you guys sell plasterboard', HN()],
  ['honest', 'have you got any dulux wash and wear', HN()],
  ['honest', 'can i buy floor tiles from you', HN()],
  ['honest', 'do you sell paint rollers', HN()],
  ['honest', 'what Mapei grout should I use', HN()],
  ['honest', 'do you have a Bostik tile adhesive', HN()],
  ['honest', 'do you sell toilets', HN()],
  ['honest', 'do yous sell carpet', HN()],
  ['honest', 'what is the coverage of Sikaflex-999', HN(/Sikaflex-999|999/i)],
  ['honest', 'tell me about Sikalastic-152', HN(/152/)],
  ['honest', 'data sheet for sikatile 999', HN(/999/)],
  ['honest', 'warranty on sikalastic 152', HN(/152|warrant/i)],
  // ---------------- honest, multi-turn: the held product, an attribute its sheet does not hold
  ['honest', 'tell me about Sikaflex-11 FC+ || is it fire rated', HN(/Sikaflex-11 FC\+/, /Sikaflex-400 Fire/), ['1671', /fire[ -]?(rating|rated|resist)|\bfrl\b/i]],
  ['honest', 'Davco K10 Plus || is it in stock near me', HN(/stock/i)],
  ['honest', 'Sikaflex PRO || whats the warranty', HN(/warrant/i)],
  ['honest', 'SikaTile-110 Secure Proof || does it meet AS 3740', HN(/AS ?3740/i)],
  ['honest', 'Davco K10 Plus || what about its acoustic rating', HN(/acoustic/i), ['davco-k10-plus', /acoustic/i]],
  ['honest', 'Sikasil Pool || how much is it', HN(/price|cost/i)],
  // ---------------- near misses the data covers: must still answer
  ['near', 'what colours does Davco Sanitized Colorgrout come in', ANS(/colou?r/i)],
  ['near', 'what colours does Sikasil Pool come in', COLNO('Sikasil Pool')],
  ['near', 'what pack sizes is Davco K10 Plus available in', ANS(/K10 Plus/)],
  ['near', 'what is Sikaflex-11 FC+ used for', ANS(/Sikaflex-11 FC\+/)],
  ['near', 'what is the VOC content of Sikaflex-11 FC+', ANS(/VOC/i)],
  ['near', 'does Sikaflex-11 FC Purform meet ASTM C920', ANS(/C ?920/i)],
  ['near', 'does SikaTile-110 Secure Proof comply with AS 4858', ANS(/4858/)],
  ['near', 'is Sikaflex-400 Fire fire rated', ANS(/fire/i)],
  ['near', 'slip resistance of Sikafloor-264 T AU', ANS(/slip/i)],
  ['near', 'is Sikaflex-11 FC+ ok for food areas', ANS(/food/i)],
  ['near', 'what is the shelf life of Davco K10 Plus', ANS(/shelf|month/i)],
  ['near', 'where can i buy sikaflex', ANS(/buy|stockist|where/i)],
  ['near', 'what membranes meet AS 4858', ANS(/4858/)],
  ['near', 'what is SikaBond-142 Instant Nails good for', ANS(/Instant Nails/i)],
  ['near', 'is Davco K10 Plus available in a 15 L pail', ANS(/20 ?L/)],
  ['near', 'does Sikasil Pool come in white', ANS(/Sikasil Pool/)],
  // ---------------- clarify: one good question on a vague ask
  ['clarify', 'i need something for my bathroom', CLAR()],
  ['clarify', 'got a leak, what do i use', CLAR()],
  ['clarify', 'need help with my deck', CLAR()],
  ['clarify', 'what do you reckon for the garage floor', CLAR()],
  ['clarify', 'need a sealant', CLAR()],
  ['clarify', 'my balcony', CLAR()],
  ['clarify', 'help me pick a glue', CLAR()],
  ['clarify', 'reno job on the laundry, what do i need', CLAR()],
  ['clarify', 'tiles', CLAR()],
  ['clarify', 'something for the pool', CLAR()],
  ['clarify', 'need stuff for the kitchen', CLAR()],
  ['clarify', 'need an adhesive mate', CLAR()],
  ['clarify', 'recommend me something', CLAR()],
  ['clarify', 'what product should i use', CLAR()],
  ['clarify', 'fixing up the shower', CLAR()],
  ['clarify', 'need some waterproofing', CLAR()],
  ['clarify', 'whats good for outside', CLAR()],
  ['clarify', 'concrete', CLAR()],
  ['clarify', 'can u help with my ensuite', CLAR()],
  ['clarify', 'got some cracks', CLAR()],
  // ---------------- pick: a clear job gets one pick
  ['pick', 'best tile adhesive for large format porcelain on a concrete floor', PICK()],
  ['pick', 'what should i use to seal around my bath', PICK()],
  ['pick', 'recommend a waterproofing membrane for a shower floor under tiles', PICK()],
  ['pick', 'which grout for a shower floor', PICK()],
  ['pick', 'whats the best sealant for a fish tank', PICK(/Aquarium/i)],
  ['pick', 'best floor leveller for a 10mm dip in a concrete slab', PICK()],
  ['pick', 'what do i use to anchor a bolt into concrete', PICK()],
  ['pick', 'best silicone for a pool', PICK()],
  ['pick', 'what sealant for roof gutters', PICK()],
  ['pick', 'good adhesive for timber floorboards on concrete', PICK()],
  ['pick', 'waterproofing a balcony under tiles, what do you recommend', PICK()],
  ['pick', 'best sealant for expansion joints in a concrete driveway', PICK()],
  ['pick', 'reccomend a tile adhesive for outdoor pavers', PICK()],
  ['pick', 'what is the best repair mortar for a spalled concrete step', PICK()],
  ['pick', 'which sealant for a kitchen benchtop to splashback joint', PICK()],
  ['pick', 'whats the go for regrouting a shower floor', PICK()],
  ['pick', 'best primer before self levelling a concrete floor', PICK()],
  ['pick', 'what membrane for under tiles in a laundry', PICK()],
  // ---------------- compare
  ['compare', 'Sikaflex-11 FC+ vs Sikaflex PRO', CMP()],
  ['compare', 'whats the difference between Davco K10 Plus and Davco K10 Rapid', CMP()],
  ['compare', 'compare SikaTile-400 EVO PRO and SikaTile-410 Secure Set', CMP()],
  ['compare', 'which is better, Sikaflex PRO or Sikaflex-11 FC+', CMP(/do not rank/i)],
  ['compare', 'k10 plus or k10 rapid, which is better', CMP(/do not rank/i)],
  ['compare', 'how does SikaBond-142 Instant Nails stack up against SikaBond INSTANT NAILS FAST', CMP()],
  ['compare', 'Sikadur-31 CF Normal compared to Sikadur-33', CMP()],
  ['compare', 'SikaGrout HES vs SikaGrout Ultra', CMP()],
  ['compare', 'Sikafloor-4020 FiberLevel versus Sikafloor Level PRO', CMP()],
  ['compare', 'Sikasil Pool vs SikaSeal Kitchen and Bathroom', CMP()],
  ['compare', 'Sikaflex PRO || how does it compare to Sikaflex-11 FC+', CMP(/Sikaflex PRO/)],
  ['compare', 'Davco K10 Plus || compare it with Davco K10 Rapid', CMP(/K10 Rapid/)],
  ['compare', 'sikaflex vs sikasil', CHOOSER()],
  ['compare', 'compare sikagrout and sikadur-33', CHOOSER(/SikaGrout/i)],
  ['compare', 'whats better sikasil pool or sikaseal kitchen and bathroom for a shower', CMP(/do not rank/i)],
  // ---------------- quantity
  ['qty', 'how much Davco K10 Plus do i need for 6 m2', QTY()],
  ['qty', 'how much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint', QTY()],
  ['qty', 'how much Sikafloor-4020 FiberLevel for 15 m2 at 5 mm', QTY()],
  ['qty', 'how much SikaTile-400 EVO PRO for 12 sqm', QTY()],
  ['qty', 'how much K10 plus do I need', ASKAREA()],
  ['qty', 'how many bags of floor leveller for 30 m2 at 3mm', QTY()],
  ['qty', 'how much tile glue for 25 sqm of 600x600 porcelain', QTY()],
  ['qty', 'Davco K10 Plus || how much for 8 m2', QTY(/K10 Plus/)],
  ['qty', 'Sikafloor-4020 FiberLevel || how much for 20 m2 at 4mm', QTY(/4020/)],
  ['qty', 'how much davco k10 plus do i need || 10 m2', QTY(/K10 Plus/)],
  ['qty', 'how much Sikafloor-4020 FiberLevel do i need for 12 square metres 3mm thick', QTY()],
  ['qty', 'how much SikaTile-400 EVO PRO do I need', ASKAREA()],
  ['qty', 'how much Davco K10 Plus for a 2.4 m2 shower base', QTY()],
  // ---------------- multi-turn
  ['multi', 'Sikaflex PRO || what is it used for', MT(/Sikaflex PRO/)],
  ['multi', 'Davco K10 Plus || and the sds', MT(/K10 Plus/)],
  ['multi', 'Sikaflex PRO || thanks || how much for 10 m2', (a) => (/Sikaflex PRO/.test(txt(a)) ? 'carried the product past thanks' : '')],
  ['multi', 'Davco K10 Plus || ok now what grout for a shower floor', MT(/grout/i, /^(?![\s\S]*grout)/i)],
  ['multi', 'Davco Sanitized Colorgrout || what colours', MT(/colou?r/i)],
  ['multi', 'Sikasil Pool || what colours', COLNO('Sikasil Pool')],
  ['multi', 'Sikaflex PRO || is it ok outside', MT(/Sikaflex PRO/)],
  ['multi', 'Sikafloor-4020 FiberLevel || how long before i can walk on it', MT(/4020/)],
  ['multi', 'tell me about Sikaflex PRO || and Sikaflex-11 FC+?', MT(/Sikaflex-11 FC\+/)],
  ['multi', 'Sikaflex PRO || data sheet', MT(/data sheet/i)],
  ['multi', 'Davco K10 Plus || coverage?', MT(/K10 Plus/)],
  ['multi', 'SikaTile-400 EVO PRO || whats the pot life', MT(/400 EVO PRO/)],
  ['multi', 'Sikaflex-11 FC+ || is it fire rated || what colours does it come in', COLNO('Sikaflex-11 FC+')],
  ['multi', 'Davco K10 Plus || is it in stock || how long does it take to dry', MT(/K10 Plus/)],
  ['multi', 'Sikaflex PRO || whats the warranty || ok what about the shelf life', MT(/Sikaflex PRO/)],
  ['multi', 'Davco K10 Plus vs Davco K10 Rapid || the second one', MT(/K10 Rapid/)],
  ['multi', 'Davco K10 Plus || is it fire rated', HN(/K10 Plus/)],
  ['multi', 'SikaGrout HES || cheers mate || best sealant for a fish tank', MT(/Aquarium/i)],
  ['multi', 'Sikaflex PRO || do you sell timber', HN()],
  ['multi', 'best tile adhesive for a pool || and for 30 m2 how much', MT(null, /How much tile adhesives/)],
  ['compare', 'sikatile 400 or sikatile 410 for big porcelain tiles', CMP(/do not rank/i)],
  ['qty', 'how much Sikafloor-4020 FiberLevel do i need || about 15 square metres at 5mm', QTY(/4020/)],
  ['pick', 'whats the go for sealing around a bath', PICK()],
  ['honest', 'is SikaTile-110 Secure Proof in stock at reece', HN(/stock/i)],
  ['honest', 'do you sell gyprock', HN()],
  ['honest', 'can I get Sikaflex-11 FC+ delivered to Perth', HN(/deliver/i)],
  ['near', 'warranty for a tiling job with davco k10', ANS(/warrant/i)],
  ['qty', 'im tiling a 3 by 4 metre floor, how much SikaTile-400 EVO PRO do i need', QTY(/12 m2/)],
];
const only = process.env.CLASS; let pass = 0, fail = 0; const per = {};
for (const [cls, conv, chk, absent] of P) {
  if (only && cls !== only) continue;
  per[cls] = per[cls] || { pass: 0, n: 0 }; per[cls].n++;
  if (absent && absent[1].test(dataText(absent[0]))) { fail++; console.log(`  FAIL [${cls}] BAD PROBE: the data for ${absent[0]} does hold ${absent[1]}: "${conv}"`); continue; }
  let st = null, a = null; for (const q of conv.split(' || ')) { a = await b.ask(q, st); st = a.state; }
  const why = chk(a);
  if (process.env.V) { const c = a.cards[0] || {}; console.log(`[${cls}] ${conv}\n   -> [${c.type}] ${c.title} :: ${(c.headline || '').slice(0, 200)} | prods: ${a.cards.map((x) => x.product && x.product.name).filter(Boolean).slice(0, 3).join(', ')} | ${(a.trace || []).slice(-3).join(',')}`); }
  if (why) { fail++; const c = a.cards[0] || {}; console.log(`  FAIL [${cls}] "${conv}": ${why} :: [${c.type}] ${String(c.title || '').slice(0, 60)} :: ${String(c.headline || '').slice(0, 140)}`); } else { pass++; per[cls].pass++; }
}
console.log('unit_opus by class: ' + Object.entries(per).map(([k, v]) => `${k} ${v.pass}/${v.n}`).join(' | '));
console.log(`unit_opus: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
