// unit_fable.mjs: the Fable quality round (2026-11-03). The author's own probes, phrased differently from unit_opus, by class:
//   clarify : a vague ask (a room or surface with no problem, a problem with no surface, two jobs in one message, a typo'd "what should I use", a pick ask after an
//             unrelated turn) gets ONE clarifying question with chips, never a guessed product.
//   pick    : a clear job gets "My pick" and the quoted sentence fits the surface, place or condition named (the regex checks the words of the fit).
//   honest  : a FALSE YES path: the asked attribute is not in that product's data, so no product is named as the answer (absent-property probes check the data first).
//   near    : a FALSE NO path: the data covers it (colours in a table row, a real model number, a special primer ask, anti slip paint) so it must answer.
//   compare : side by side and the honest "do not rank".          multi : context carried or dropped correctly across turns.
//   qty     : quantity edge cases (bare number reply, "3 by 4", "3 x 4 m2", "2400 x 1200 mm", joints are metres).
//   catafter: a short category question right after a product was shown is a new ask of the range, never the held product (reviewer's missing class).
// No model, no network. Exit 1 on any failure. CLASS=pick node unit_fable.mjs runs one class; V=1 prints every answer.
import fs from 'node:fs'; import path from 'node:path';
import { makeBrain, PORTAL } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const b = makeBrain();
const NOTDOC = /not in the published documentation|I do not know this|not in the Sika Australia documentation|There is no /i;
const UNITS = /\d[\d.,]*\s*(m2|m²|sqm|metres?|litres?|L\b|pails?|cartridges?|bags?|kg|coats?|tubes?|units?|mm|sausages?|packs?)/i;
const txt = (a) => a.cards.map(cardText).join('\n');
const chips = (a) => { const c = a.cards[0] || {}; return Math.max((c.choices || []).length, (c.followups || []).length, (a.followups || []).length); };
const notfound = (a) => { const c = a.cards[0] || {}; return c.type === 'unknown' || NOTDOC.test((c.title || '') + ' ' + (c.headline || '')); };
const prods = (a) => a.cards.map((c) => c.product && c.product.name).filter(Boolean);
const dataText = (id) => { let s = ''; for (const d of ['p', 'num']) { const f = path.join(PORTAL, 'data/brain', d, id + '.json'); if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); delete j.sf; s += JSON.stringify(j); } } return s; };
const dash = (t) => (/—|–/.test(t) ? 'long dash in buyer text' : '');
// ---- checks: '' passes, else the reason
const CLAR = (has) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card on a vague ask'; if (c.type !== 'choose') return 'guessed instead of asking (' + c.type + ': ' + (c.title || '').slice(0, 50) + ')'; if (a.cards.some((x) => x.product && /^My pick/.test(x.headline || ''))) return 'a pick on a vague ask'; const k = chips(a); if (k < 2 || k > 5) return 'chip count ' + k; if (has && !has.test(txt(a) + ' ' + JSON.stringify(c.choices || c.followups || []))) return 'missing ' + has; return dash(txt(a)); };
const PICK = (fit, not) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; if (c.type === 'choose' && !(a.trace || []).includes('chat:tie')) return 'clarifier instead of a pick'; if (!/^My pick/.test(c.headline || '') && !(a.trace || []).includes('chat:tie')) return 'no My pick lead'; const src = a.cards.find((x) => x.source && x.source.sentence); if (!src) return 'no quoted sentence'; const quoted = (c.headline || '') + ' ' + src.source.sentence; if (fit && !fit.test(quoted)) return 'the quoted reason does not mention ' + fit + ' :: ' + quoted.slice(0, 160); if (not && not.test(prods(a)[0] || '')) return 'picked ' + prods(a)[0]; return ''; };
const HN = (has, not) => (a) => { const t = txt(a); if (!notfound(a)) return 'answered instead of the honest no (' + (a.cards[0] || {}).type + ')'; if (a.cards.some((c) => c.product)) return 'a card names a product: ' + prods(a)[0]; if (has && !has.test(t)) return 'missing ' + has; if (not && not.test(t)) return 'forbidden ' + not; return dash(t); };
const ANS = (has, not) => (a) => { if (notfound(a)) return 'not-found card on a covered ask :: ' + ((a.cards[0] || {}).headline || '').slice(0, 120); const t = txt(a); if (has && !has.test(t)) return 'missing ' + has; if (not && not.test(t)) return 'forbidden ' + not; return dash(t); };
const CMP = (has) => (a) => { if (notfound(a)) return 'not-found card'; const n = a.cards.filter((x) => x.product).length; if (a.intent !== 'compare' && (a.cards[0] || {}).type !== 'comparison' && n < 2) return 'not side by side (' + a.intent + ')'; if (has && !has.test(txt(a))) return 'missing ' + has; return dash(txt(a)); };
const CHOOSER = (has) => (a) => { const c = a.cards[0] || {}; if (c.type !== 'choose') return 'no chooser (' + c.type + ')'; if (chips(a) < 2) return 'too few chips'; if (has && !has.test(txt(a) + ' ' + JSON.stringify(c.choices || c.followups || []))) return 'missing ' + has; return ''; };
const QTY = (has) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; if (c.type === 'choose') return 'clarifier, no number: ' + (c.headline || '').slice(0, 80); const t = txt(a); if (!(a.intent === 'calc' || c.type === 'calculation' || /rounded up|you need|Working/i.test(t))) return 'no computed quantity (' + a.intent + '/' + c.type + ')'; if (!UNITS.test(t)) return 'no number with a unit'; if (has && !has.test(t)) return 'missing ' + has; return ''; };
const ASK = (has) => (a) => { const c = a.cards[0] || {}; if (notfound(a)) return 'not-found card'; const t = (c.title || '') + ' ' + (c.headline || ''); return c.type === 'choose' && has.test(t) ? '' : 'did not ask ' + has + ' :: ' + t.slice(0, 100); };
const NEWASK = (has, heldName) => (a) => { if (notfound(a)) return 'honest no on a covered category ask :: ' + ((a.cards[0] || {}).headline || '').slice(0, 100); const t = txt(a); if (heldName && (a.cards[0] || {}).type === 'unknown') return 'unknown card'; if (has && !has.test(t)) return 'missing ' + has; if (heldName && prods(a)[0] === heldName && !has.test(heldName)) return 'reused the held product ' + heldName; return ''; };
const MT = (has, not) => (a) => { if (notfound(a)) return 'not-found card'; const t = txt(a); if (has && !has.test(t)) return 'missing ' + has; if (not && not.test(t)) return 'forbidden ' + not; return ''; };
const FIRE = /fire[ -]?(rating|rated|resist\w*|classif\w*|retard\w*|proof\w*|performance|behaviou?r|stop\w*|barrier)|reaction to fire|\bfrl\b|AS ?1530|AS ?4072|intumescent|firestop/i;
// [class, conversation (" || " = next turn), check, optional [productId, regex the data must NOT hold]]
const P = [
  // ---------------- clarify: a room or surface with no problem
  ['clarify', 'the bathroom floor', CLAR()],
  ['clarify', 'my shower walls', CLAR()],
  ['clarify', 'the kitchen bench', CLAR(/bench/i)],
  ['clarify', 'kitchen benchtop', CLAR(/bench/i)],
  ['clarify', 'outside wall', CLAR()],
  ['clarify', 'garage floor', CLAR()],
  ['clarify', 'the laundry', CLAR()],
  ['clarify', 'our back patio', CLAR()],
  ['clarify', 'ensuite reno', CLAR()],
  ['clarify', 'the roof', CLAR()],
  ['clarify', 'basement', CLAR()],
  ['clarify', 'a window frame', CLAR()],
  ['clarify', 'the shed floor', CLAR()],
  ['clarify', 'sumfin for the balcony', CLAR()],
  ['clarify', 'need somthing for the deck', CLAR()],
  ['clarify', 'sumthing for the bathrom', CLAR()],
  ['clarify', 'the concrete slab', CLAR()],
  ['clarify', 'timber', CLAR()],
  // ---------------- clarify: a problem with no surface
  ['clarify', 'got a leak', CLAR()],
  ['clarify', 'its peeling off', CLAR()],
  ['clarify', 'it keeps lifting', CLAR()],
  ['clarify', 'its all flaky', CLAR()],
  ['clarify', 'its cracked', CLAR()],
  ['clarify', 'need to stick something down', CLAR()],
  ['clarify', 'something to seal it up', CLAR()],
  ['clarify', 'need to waterproof it', CLAR()],
  ['clarify', 'water getting in', CLAR()],
  ['clarify', 'need to glue something', CLAR()],
  // ---------------- clarify: two jobs in one message
  ['clarify', 'need glue for tiles and a sealant for the bath', CLAR(/tile adhesive/i)],
  ['clarify', 'waterproofing and grout for the laundry', CLAR(/grout/i)],
  ['clarify', 'need adhesive and grout', CLAR(/grout/i)],
  ['clarify', 'a membrane plus some silicone for the shower', CLAR(/sealant|silicone/i)],
  ['clarify', 'tile glue and a leveller for the kitchen floor', CLAR(/level/i)],
  ['clarify', 'need grout, and a primer for the tiles', CLAR(/primer/i)],
  // ---------------- clarify: a pick ask with no job, typo'd, or after an unrelated turn
  ['clarify', 'wat shud i use', CLAR()],
  ['clarify', 'wich one shud i get', CLAR()],
  ['clarify', 'wut do u recomend', CLAR()],
  ['clarify', 'whats the best stuff', CLAR()],
  ['clarify', 'recomend sumthing', CLAR()],
  ['clarify', 'Sikaflex PRO || what should i use', CLAR()],
  ['clarify', 'tell me about Davco K10 Plus || wat shud i use', CLAR()],
  ['clarify', 'what is the shelf life of Sikaflex-11 FC+ || what do you reckon i should use', CLAR()],
  ['clarify', 'hi || what should i use', CLAR()],
  ['clarify', 'need a glue', CLAR()],
  ['clarify', 'need a membrane', CLAR()],
  ['clarify', 'which grout', CLAR()],
  ['clarify', 'primer?', CLAR()],
  // ---------------- pick: the quoted reason fits the surface, place or condition
  ['pick', 'best tile adhesive for a pool', PICK(/pool|spa|submerg|immers/i)],
  ['pick', 'best tile glue for a swimming pool', PICK(/pool|spa|submerg|immers/i)],
  ['pick', 'good adhesive for timber floorboards on concrete', PICK(/wood|timber|parquet/i, /TechGrip|SuperGrip|Max Tack/)],
  ['pick', 'best glue for engineered timber flooring over a slab', PICK(/wood|timber|engineered/i, /TechGrip|SuperGrip|Max Tack/)],
  ['pick', 'best adhesive for solid hardwood floorboards', PICK(/wood|timber|hardwood/i, /TechGrip|SuperGrip|Max Tack/)],
  ['pick', 'best grout for a swimming pool', PICK(/pool|spa|submerg|immers/i)],
  ['pick', 'best silicone for a swimming pool', PICK(/pool|spa|submerg|immers|underwater/i)],
  ['pick', 'what sealant for an aquarium', PICK(/aquarium|fish/i)],
  ['pick', 'best tile adhesive for large format porcelain outside', PICK(/large|porcelain|external|outdoor|exterior/i)],
  ['pick', 'which membrane for a shower floor under tiles', PICK(/shower|wet|bathroom|membrane|waterproof/i)],
  ['pick', 'best sealant for a shower screen', PICK(/shower|bath|sanitary|wet|silicone|seal/i)],
  ['pick', 'what do i use to level a garage floor with a 20mm dip', PICK(/level|screed|mm/i)],
  ['pick', 'best repair mortar for spalling concrete on a balcony', PICK(/repair|concrete|spall|mortar/i)],
  ['pick', 'which adhesive for tiling over existing tiles', PICK(/existing|over tile|tile over tile|old tile/i)],
  ['clarify', 'what adhesive for mosaic tiles in a shower', (a) => (notfound(a) ? 'not-found' : (a.cards[0] || {}).type !== 'choose' ? 'guessed instead of asking the substrate' : !/onto|substrate/i.test((a.cards[0] || {}).headline || '') ? 'wrong question' : '')],
  ['pick', 'best glue for skirting boards', PICK(/skirting|timber|wood|board|trim|bond|adhesive/i)],
  ['pick', 'best sealant for expansion joints in a car park slab', PICK(/joint|movement|expansion|traffic|car ?park|concrete|elastic|mechanical/i)],
  ['pick', 'whats good for sealing a gutter', PICK(/gutter|roof|seal|metal/i)],
  ['pick', 'best primer for tiling over smooth concrete', PICK(/prim|smooth|concrete|tile/i)],
  ['pick', 'what sealant do i use around a toilet pan', PICK(/sanitary|bathroom|bath|silicone|seal|toilet|wet|kitchen/i)],
  ['pick', 'the tiles are drummy', PICK(/tile|floor|wall/i)],
  ['pick', 'the grout is going mouldy', PICK(/mould|mold|grout/i)],
  ['pick', 'whats best for mouldy grout in the shower', PICK(/mould|mold|grout/i)],
  // ---------------- honest: false-yes paths closed (data checked first)
  ['honest', 'is Davco Easy Grout fire rated', HN(/Easy Grout/, /Sikaflex-400 Fire|Sikasil-670 Fire|Firerate/), ['davco-easy-grout', FIRE]],
  ['honest', 'does SikaBond T-55 J have a fire rating', HN(/T-55 J/, /Sikaflex-400 Fire|Sikasil-670 Fire/), ['sikabond-t-55-j', FIRE]],
  ['honest', 'acoustic rating of Davco K10 Plus', HN(/acoustic/i), ['davco-k10-plus', /acoustic|sound (insulat|reduc|transmi)|\bdB\b/i]],
  ['honest', 'is Davco Easy Grout safe for drinking water tanks', HN(/drinking|potable/i), ['davco-easy-grout', /potable|drinking water|AS ?4020/i]],
  ['honest', 'does Sikaflex PRO have an EPD', HN(/EPD|environmental/i), ['4649', /\bepd\b|environmental product declaration/i]],
  ['honest', 'carbon footprint of SikaWrap-230 C', HN(/carbon/i), ['sikawrap-230-c', /carbon footprint|embodied carbon|\bgwp\b|global warming|carbon neutral/i]],
  ['honest', 'embodied carbon of Davco K10 Plus', HN(/carbon/i), ['davco-k10-plus', /carbon footprint|embodied carbon|\bgwp\b|global warming|carbon neutral/i]],
  ['honest', 'thermal conductivity of Davco K10 Plus', HN(/thermal/i), ['davco-k10-plus', /thermal (conductivity|insulat)|\br[ -]value\b|\blambda\b/i]],
  ['honest', 'is Davco Easy Grout halal certified', HN(/certif/i), ['davco-easy-grout', /halal|kosher/i]],
  ['honest', 'does Sikaflex PRO comply with AS 1530', HN(/AS ?1530/i), ['4649', /AS ?1530/i]],
  ['honest', 'is Davco K10 Plus certified to ISO 9001', HN(/ISO ?9001/i), ['davco-k10-plus', /ISO ?9001/i]],
  ['honest', 'is SikaTile-400 EVO PRO NCC compliant', HN(/NCC|building code/i), ['sikatile-400-evopro', /\bNCC\b|\bBCA\b|building code/i]],
  ['honest', 'what does Davco K10 Plus cost per pail', HN(/price|cost/i)],
  ['honest', 'is SikaTile-400 EVO PRO on special this week', HN(/price|special|cost/i)],
  ['honest', 'can you deliver Davco K10 Plus to Townsville', HN(/deliver/i)],
  ['honest', 'whats the cheapest grout', HN(/price|cheap/i)],
  ['honest', 'cheapest tile adhesive you have', HN(/price|cheap/i)],
  ['honest', 'are your waterproofing membranes in stock', HN(/stock/i)],
  ['honest', 'Sikaflex PRO || cheapest tile adhesive', HN(/price|cheap/i, /Sikaflex PRO/)],
  ['honest', 'Davco K10 Plus || is there a trade discount', HN(/price|discount/i)],
  ['honest', 'do you need a licence to use Davco K10 Plus in qld', HN()],
  ['honest', 'will Sika certify my shower waterproofing', HN()],
  ['honest', 'does strata have to approve Sikaflex PRO on my balcony', HN()],
  ['honest', 'tell me about Sikaflex-777', HN(/777/)],
  ['honest', 'coverage of SikaTile-999 Ultra', HN(/999/)],
  ['honest', 'sikalastic 9999 data sheet', HN(/9999/)],
  ['honest', 'do you sell floor tiles', HN()],
  ['honest', 'can i get gyprock from you', HN()],
  ['honest', 'do you stock Dulux paint', HN()],
  ['honest', 'do you have Ardex grout', HN()],
  ['honest', 'where is Davco K10 Plus manufactured', HN(/made|manufactur|origin/i), ['davco-k10-plus', /made in|country of origin|manufactured in|australian made|produced in/i]],
  ['honest', 'Sikaflex PRO || where is it made', HN(/made|manufactur|origin/i), ['4649', /made in|country of origin|manufactured in|australian made|produced in/i]],
  ['honest', 'SikaBond T-55 J || is it fire rated', HN(/T-55 J/, /Sikaflex-400 Fire/), ['sikabond-t-55-j', FIRE]],
  ['honest', 'Davco Easy Grout || does it have an acoustic rating', HN(/acoustic/i), ['davco-easy-grout', /acoustic|sound (insulat|reduc|transmi)|\bdB\b/i]],
  // ---------------- near: false-no paths opened (the data covers it)
  ['near', 'what colours does Sarnafil Metal PVC come in', ANS(/grey|colour/i)],
  ['near', 'Sikaflex-268 colour', ANS(/black/i)],
  ['near', 'what colour is Sikaflex-268 PowerCure', ANS(/black/i)],
  ['near', 'do i need a special primer for sikaflex pro', ANS(/Sikaflex PRO/, /Prices, stock/)],
  ['near', 'any special prep for Davco K10 Plus', ANS(/K10 Plus/, /Prices, stock/)],
  ['near', 'is there a special trowel for SikaTile-400 EVO PRO', ANS(/400 EVO PRO/, /Prices, stock/)],
  ['near', 'Sikaflex-11 FC+ delivers a strong bond?', ANS(/Sikaflex-11 FC\+/, /delivery times/)],
  ['near', 'is sikabond 55 good for timber floors', ANS(/T-55 J/)],
  ['near', 'sikafloor 32', ANS(/32/)],
  ['near', 'sikasil 25', ANS(/Sikasil/)],
  ['near', 'tell me about sikabond 58', ANS(/SikaBond-58/)],
  ['near', 'have you got anti slip paint', ANS(/Sikafloor|slip/i)],
  ['near', 'do you sell non slip floor coating', ANS(/Sikafloor|slip|coating/i)],
  ['near', 'slip joint sealant', ANS(/sealant|joint/i, /slip rating/)],
  ['near', 'what is the pot life of Sikadur-33', ANS(/pot life|minutes|min\b/i)],
  ['near', 'shelf life of Sikaflex PRO', ANS(/shelf|month/i)],
  ['near', 'what temperature can Sikaflex PRO be applied at', ANS(/°|temperature|\d+ ?c\b/i)],
  ['near', 'pack sizes for Sikaflex-11 FC+', ANS(/cartridge|ml/i)],
  ['near', 'what substrates does SikaBond T-55 J bond to', ANS(/wood|timber|subfloor|substrate/i)],
  ['near', 'what primer do i use with Davco K10 Plus', ANS(/prim/i)],
  ['near', 'what standards does SikaTile-110 Secure Proof meet', ANS(/AS|standard/i)],
  ['near', 'VOC of Sikaflex-11 FC+', ANS(/VOC|emission/i)],
  ['near', 'what is Sikaflex-11 FC+ movement capability', ANS(/movement|%/i)],
  ['near', 'is Sikaflex-400 Fire fire rated', ANS(/fire/i)],
  ['near', 'does Sikaflex-11 FC+ have an EPD', ANS(/EPD|environmental product/i)],
  ['near', 'Sikaflex-11 FC+ || is it low VOC', ANS(/VOC|emission/i)],
  ['near', 'Sarnafil Metal PVC || what colours', ANS(/grey|colour/i)],
  // ---------------- compare
  ['compare', 'SikaBond T-55 J vs SikaBond-58 Wood Floor', CMP()],
  ['compare', 'is Davco K10 Rapid any different to Davco K10 Plus', CMP()],
  ['compare', 'SikaTile-305 Master Lite or SikaTile-510 Mega Lite for a pool', CMP(/do not rank/i)],
  ['compare', 'Sikaflex-11 FC+ against Sikaflex-11 FC Purform', CMP()],
  ['compare', 'how does Davco Easy Grout measure up to Davco Sanitized Colorgrout', CMP()],
  ['compare', 'which one should i buy, SikaGrout HES or SikaGrout Ultra', CMP(/do not rank/i)],
  ['compare', 'Sikadur-33 compared with Sikadur-31 CF Normal', CMP()],
  ['compare', 'whats the difference between sikaflex pro and sikaflex 11 fc+', CMP()],
  ['compare', 'SikaBond-58 Wood Floor || and versus SikaBond T-55 J?', CMP(/T-55 J/)],
  ['compare', 'Davco K10 Plus || how does K10 Rapid compare', CMP(/K10 Rapid/)],
  ['compare', 'sikatile vs davco', CHOOSER()],
  ['compare', 'compare sikabond and sikaflex pro', CHOOSER(/SikaBond/i)],
  ['compare', 'Davco Sanitized Colorgrout vs Davco Easy Grout, which is better for a shower floor', CMP(/do not rank/i)],
  // ---------------- multi-turn
  ['multi', 'Davco K10 Plus || coverage || and the shelf life', MT(/K10 Plus/)],
  ['multi', 'Sikaflex PRO || pack sizes || what about colours', MT(/Sikaflex PRO/)],
  ['multi', 'SikaBond T-55 J || what does it stick to', MT(/T-55 J/)],
  ['multi', 'Sikaflex-11 FC+ || thanks || the grout is going mouldy', MT(/grout|mould/i, /Sikaflex-11 FC\+/)],
  ['multi', 'Sikaflex-11 FC+ || cheers || what should i use', CLAR()],
  ['multi', 'Davco K10 Plus || the bathroom floor', CLAR()],
  ['multi', 'best tile adhesive for a pool || the second one', MT(/SikaTile|Davco/)],
  ['multi', 'best tile adhesive for a pool || data sheet', MT(/data sheet/i)],
  ['multi', 'Davco K10 Plus || is it in stock || coverage', MT(/K10 Plus/)],
  ['multi', 'Sikaflex PRO || do you sell timber || pack sizes', MT(/Sikaflex PRO/)],
  ['multi', 'SikaTile-400 EVO PRO || how much for 10 m2 || and for 25 m2', QTY(/25 m2/)],
  ['multi', 'Davco K10 Plus || new topic, need a sealant for a bath', MT(/sealant|silicone|Sikasil|SikaSeal/i, /^(?![\s\S]*(silicone|sealant))/i)],
  ['multi', 'the bathroom floor || waterproofing', (a) => (notfound(a) ? 'not-found' : (a.cards[0] || {}).type === 'choose' && !/which product/i.test((a.cards[0] || {}).title || '') ? 'still asking' : '')],
  ['multi', 'need glue for tiles and a sealant for the bath || the sealant first', (a) => (notfound(a) ? 'not-found' : !/sealant|silicone|seal/i.test(txt(a)) ? 'did not pick up the sealant job' : '')],
  ['multi', 'waterproofing and grout for the laundry || grout first', (a) => (notfound(a) ? 'not-found' : !/grout/i.test(txt(a)) ? 'did not pick up the grout job' : '')],
  // ---------------- quantity edge cases
  ['qty', 'how much Davco K10 Plus do i need || 12', QTY(/12 m2/)],
  ['qty', 'how much Davco K10 Plus do i need || about 3 by 4 metres', QTY(/12 m2/)],
  ['qty', 'how much Davco K10 Plus do i need || 3 x 4', QTY(/12 m2/)],
  ['qty', 'how much SikaTile-400 EVO PRO for 3 x 4 m2', QTY(/12 m2/)],
  ['qty', 'how much Davco K10 Plus for a 2400 x 1200 mm shower base', QTY(/2\.88 m2/)],
  ['qty', 'SikaTile-400 EVO PRO for a 2.4m x 1.2m splashback, how much', QTY(/2\.88 m2/)],
  ['qty', 'how many bags of SikaTile-400 EVO PRO for 18 square metres', QTY(/18 m2/)],
  ['qty', 'how much Davco K10 Plus for 20 sqm', QTY(/20 m2/)],
  ['qty', 'how much Davco Easy Grout do i need', ASK(/area|m2|square/i)],
  ['qty', 'how much SikaTile-400 EVO PRO do i need || 10 m2 || and at 25 m2', QTY(/25 m2/)],
  ['qty', 'how much davco k10 plus for 30 m2 || and for 45 m2', QTY(/45 m2/)],
  ['qty', 'how much Davco K10 Plus for 15 m2 || same for SikaTile-400 EVO PRO', QTY(/400 EVO PRO/)],
  // ---------------- catafter: a short category ask right after a product was shown
  ['catafter', 'Sikaflex PRO || fire rated sealant', NEWASK(/Fire/, 'Sikaflex PRO')],
  ['catafter', 'Sikaflex PRO || food safe sealant', NEWASK(/food/i, 'Sikaflex PRO')],
  ['catafter', 'Sikaflex PRO || low VOC sealant', NEWASK(/VOC|emission/i, 'Sikaflex PRO')],
  ['catafter', 'Sikaflex PRO || acoustic sealant', NEWASK(/acoustic|sound/i, 'Sikaflex PRO')],
  ['catafter', 'Davco K10 Plus || anti slip floor coating', NEWASK(/slip|Sikafloor/i, 'Davco K10 Plus')],
  ['catafter', 'Davco K10 Plus || potable water tank membrane', NEWASK(/potable|drinking|water tank/i, 'Davco K10 Plus')],
  ['catafter', 'Davco K10 Plus || drinking water tank coating', NEWASK(/potable|drinking|water tank/i, 'Davco K10 Plus')],
  ['catafter', 'Davco K10 Plus || grout colours', NEWASK(/grout/i, 'Davco K10 Plus')],
  ['catafter', 'Davco K10 Plus || NCC compliant membrane', (a) => (a.cards.some((c) => c.product && c.product.name === 'Davco K10 Plus') && /do not mention the NCC/.test(txt(a)) ? 'answered for the held product' : '')],
  ['catafter', 'Sikaflex PRO || cheapest tile adhesive', HN(/price|cheap/i, /Sikaflex PRO/)],
  ['catafter', 'SikaTile-400 EVO PRO || epoxy grout', NEWASK(/epoxy|SikaCeram-880|grout/i, 'SikaTile-400 EVO PRO')],
  ['catafter', 'Sikaflex-11 FC+ || wood floor adhesive', NEWASK(/wood|T-55|SikaBond-58/i, 'Sikaflex-11 FC+')],
  ['catafter', 'Davco K10 Plus || tile primer', NEWASK(/prim/i, 'Davco K10 Plus')],
  ['catafter', 'Sikaflex PRO || gutter sealant', NEWASK(/gutter|roof/i, 'Sikaflex PRO')],
  ['catafter', 'Sikaflex PRO || and what about a fire rated one', NEWASK(/Fire/, 'Sikaflex PRO')],
];
const only = process.env.CLASS; let pass = 0, fail = 0; const per = {};
for (const [cls, conv, chk, absent] of P) {
  if (only && cls !== only) continue;
  per[cls] = per[cls] || { pass: 0, n: 0 }; per[cls].n++;
  if (absent && absent[1].test(dataText(absent[0]))) { fail++; console.log(`  FAIL [${cls}] BAD PROBE: the data for ${absent[0]} does hold ${absent[1]}: "${conv}"`); continue; }
  let st = null, a = null; for (const q of conv.split(' || ')) { a = await b.ask(q, st); st = a.state; }
  const why = chk(a);
  if (process.env.V) { const c = a.cards[0] || {}; console.log(`[${cls}] ${conv}\n   -> [${c.type}] ${c.title} :: ${(c.headline || '').slice(0, 200)} | prods: ${prods(a).slice(0, 3).join(', ')} | ${(a.trace || []).slice(-3).join(',')}`); }
  if (why) { fail++; const c = a.cards[0] || {}; console.log(`  FAIL [${cls}] "${conv}": ${why} :: [${c.type}] ${String(c.title || '').slice(0, 60)} :: ${String(c.headline || '').slice(0, 140)}`); } else { pass++; per[cls].pass++; }
}
console.log('unit_fable by class: ' + Object.entries(per).map(([k, v]) => `${k} ${v.pass}/${v.n}`).join(' | '));
console.log(`unit_fable: ${pass} passed, ${fail} failed (${P.length} probes)`); process.exit(fail ? 1 : 0);
