// intents.js: plain regex/keyword scoring for the questions distributors, applicators, specifiers and engineers ask. No model.
import { normalise } from './tokenize.js';

const RULES = {
  quote: [
    [/\bhow (many|much)\b/, 2], [/\bwhat do i need for\b/, 4.5], [/\b(quantity|quantities|estimate|calculate|calculator|takeoff|take off)\b/, 3],
    [/\b(pails?|bags?|cartridges?|kits?|packs?|drums?|sausages?|tubes?|litres?|liters?|kg) (do|will|would|should) i (need|order|buy|get)\b/, 4], [/\bhow many (pails?|bags?|cartridges?|kits?|packs?|litres?|liters?|kg|tubes?|drums?|boxes)\b/, 4],
    [/\bhow much (\w+ ){0,4}(do|will|would) i need\b/, 4.5], [/\bfor (a |an )?\d+(\.\d+)? ?(m2|m3|lm|linear)/, 2.5], [/\b(m2|m3) (of|job|area)\b/, 1.5],
  ],
  consumption: [
    [/\b(coverage|consumption|yield|usage rate|spread rate|application rate|dosage|dose rate|dosing|mix rate|usage)\b/, 4], [/\bcovers?\b/, 2.5], [/\bhow far (does|will)\b/, 4],
    [/\bper (m2|square|coat|layer|m3)\b/, 2], [/\b(kg|l|litres?) ?\/ ?m2\b/, 3], [/\bhow much (\w+ ){0,3}(does|will) (it|\w+) (use|cover|take)\b/, 3],
  ],
  documents: [
    [/\b(data ?sheets?|pds|tds|sds|msds|safety data|brochures?|certificates?|certification|epds?|environmental product|technical (data|sheet|document|information)|method statement|download|pdf|documents?|specification|datasheets?|warranty|approval|literature|catalogue|catalog|hazard)\b/, 4.5],
  ],
  compatibility: [
    [/\b(compatible|compatibility|compatib\w*)\b/, 4], [/\b(what|which) primer\b/, 4], [/\bprimer (for|to use|required|needed)\b/, 3.5], [/\bdo i (need|have to) (a |to use a )?primer\b/, 3.5],
    [/\bcan (i|you|we) (use|apply|put|lay|tile|install|bond|stick|fix|paint|coat|seal)\b[^?]*\b(over|on|onto|with|to|under|after)\b/, 4], [/\b(on top of|work with|go with|used with|use with|together with|mix with|combine with|apply over|tile over|bond to|adhere to)\b/, 3],
  ],
  where_to_buy: [[/\b(where (can|do|to|could) (i |we )?(buy|get|purchase|find)|buy|purchase|stockists?|distributors?|retailers?|suppliers?|price|pricing|how much does (it|\w+) cost|available (at|from)|bunnings|store|stores|order online|shop)\b/, 4.5]],
  contact: [[/\b(contact|phone|call (you|someone|them)|email|telephone|speak (to|with)|talk to|technical (support|services?|advice)|customer service|address|head office|opening hours|representative|enquir\w+)\b/, 4.5]],
  help: [[/\b(help|what can you (do|answer)|how (do|does) (this|it|the assistant) work|capabilities|what do you do|who are you|instructions)\b/, 4]],
  greeting: [[/^\s*(hi|hello|hey|g'?day|good (morning|afternoon|evening)|howdy|yo|thanks|thank you|cheers)\b[\s!.,]*(there|mate|team)?[\s!.,]*$/, 6]],
  find_product: [
    [/\b(which|what) (product|products|adhesive|sealant|primer|membrane|grout|mortar|screed|waterproofing|admixture|coating|glue|tile adhesive|system)\b/, 3.5],
    [/\b(recommend|suitable|looking for|i need (a|an|some)|best|suggest|something (for|to)|what (should|can|do) i use|use for|for (tiling|waterproofing|sealing|bonding|repairing|levelling|leveling))\b/, 2.5],
    [/\b(waterproof\w*|leak\w*|seal|bond|glue|stick|level\w*|repair\w*|fix)\b/, 1.2],
  ],
};

const AREA = /(\d+(?:\.\d+)?)\s*(m2|m3|lm)\b/;

/** Score each intent for the normalised text; returns {intent, scores}. ctx: {hasProduct, hasState, hasArea, domain}. */
export function classify(text, ctx = {}) {
  const n = normalise(text).replace(/\s+/g, ' ').trim();
  const scores = {};
  for (const [k, rules] of Object.entries(RULES)) { let s = 0; for (const [re, w] of rules) if (re.test(n)) s += w; scores[k] = s; }
  const hasArea = ctx.hasArea || AREA.test(n);
  if (hasArea) scores.quote += 2.5;
  if (hasArea && (ctx.hasProduct || ctx.hasState)) scores.quote += 1.5;
  if (scores.consumption && hasArea && scores.quote >= 4) scores.consumption -= 1.5;
  if (/\bhow much\b/.test(n) && !hasArea && scores.consumption) scores.quote -= 1.5;
  if (scores.where_to_buy && /\bcost\b|\bprice\b/.test(n) && !/where|buy|stockist|distributor/.test(n)) scores.where_to_buy = 3;
  if (scores.documents && scores.compatibility && !/compatib|primer/.test(n)) scores.compatibility = 0;
  if (scores.documents && /\b(hazard|safety)\b/.test(n) && !/data|sds|sheet/.test(n)) scores.documents -= 2;
  const order = ['documents', 'quote', 'consumption', 'compatibility', 'where_to_buy', 'contact', 'help', 'greeting', 'find_product'];
  let best = null, bs = 0;
  for (const k of order) if (scores[k] > bs + 0.001) { best = k; bs = scores[k]; }
  if (!best || bs < 2) best = (ctx.domain || ctx.hasProduct) ? 'find_product' : 'find_product';
  return { intent: best, score: bs, scores };
}

/** Parse the numbers a customer gives: area, volume, length, thickness, coats, allowance, pack, joint, cement content, user-stated rate. */
export function parseRequest(text) {
  const n = normalise(text).replace(/(\d),(\d{3})\b/g, '$1$2');
  const req = {};
  let m;
  if ((m = /(\d+(?:\.\d+)?)\s*(?:m2)\b/.exec(n))) req.area = parseFloat(m[1]);
  if ((m = /(\d+(?:\.\d+)?)\s*(?:m3)\b/.exec(n))) req.volume = parseFloat(m[1]);
  if ((m = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*mm\b/.exec(n))) { req.width = parseFloat(m[1]); req.depth = parseFloat(m[2]); }
  if ((m = /(\d+(?:\.\d+)?)\s*(?:lm|linear met\w+|lineal met\w+|l\/m|(?:metres?|meters?|m)\b(?!2|3))/.exec(n)) && !/\b\d+\s*m\b(?=\s*x)/.test(n)) req.length = parseFloat(m[1]);
  if ((m = /(\d+(?:\.\d+)?)\s*mm\s*(?:thick|thickness|deep|layer|bed)|(?:thick(?:ness)?|layer|at|@|build)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*mm/.exec(n))) req.thickness = parseFloat(m[1] || m[2]);
  else if (!req.width && (m = /(\d+(?:\.\d+)?)\s*mm\b/.exec(n))) req.thicknessGuess = parseFloat(m[1]);
  const words = { one: 1, two: 2, three: 3, four: 4 };
  if ((m = /\b(\d+|one|two|three|four)\s*coats?\b/.exec(n))) req.coats = words[m[1]] || parseInt(m[1], 10);
  if ((m = /(\d+(?:\.\d+)?)\s*%\s*(?:waste|wastage|allowance|extra|overage|spare)|(?:waste|wastage|allowance|add)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/.exec(n))) req.allowancePct = parseFloat(m[1] || m[2]);
  if ((m = /(\d+(?:\.\d+)?)\s*kg\s*(?:\/\s*m3\s*)?(?:of\s+)?(?:cement\w*|binder)|(?:cement\w*|binder)\s*(?:content\s*)?(?:of\s*|is\s*)?(\d+(?:\.\d+)?)\s*kg/.exec(n))) req.cementitious = parseFloat(m[1] || m[2]);
  if ((m = /(\d+(?:\.\d+)?)\s*(kg|l|ltr|lt|litres?|liters?|ml)\b(?!\s*(?:\/|per)\s*m)/.exec(n)) && !req.cementitious) req.pack = { size: parseFloat(m[1]), unit: /^kg$/.test(m[2]) ? 'kg' : /^ml$/.test(m[2]) ? 'ml' : 'L' };
  if ((m = /(\d{2,4})\s*x\s*(\d{2,4})(?:\s*x\s*\d+)?\s*(?:mm)?\s*tiles?/.exec(n))) req.tile = m[1] + 'x' + m[2];
  if ((m = /(\d+(?:\.\d+)?)\s*mm\s*(?:grout\s*)?joints?/.exec(n))) req.joint = parseFloat(m[1]);
  return req;
}
