// cover.js: the coverage decision (Opus round, 2026-11-03). Before a question is routed, work out the OBJECT it asks about (a named product, a product held from the
// last turn, a model number, a thing the range does not hold) and the ATTRIBUTE (a fire rating, a standard, the price, the colours...), then check whether the
// published data covers that object AND that attribute. When it does not, the answer is the honest no for exactly that pair, never a different product.
// Pure functions: the brain hands in the product texts it has loaded. No model, no network.
import { normalise } from './text.js';

// ---- attributes a product sheet may or may not state. ask: the words in the question; has: the words in the data that would answer it.
export const COVER_ATTRS = [
  { id: 'fire', label: 'a fire rating', ask: /\bfire ?(rating|rated|rate|resistance|resistant|resisting|resistance level|proof|retardant|retardent|performance|classification|class|certified|tested)\b|\bfrl\b|\bfire ?rated\b/, has: /fire[ -]?(rating|rated|resist\w*|classif\w*|retard\w*|proof\w*|performance|behaviou?r|stop\w*|barrier)|reaction to fire|\bfrl\b|AS ?1530|AS ?4072|AS ?1668|intumescent|firestop/i },
  { id: 'slip', label: 'a slip rating', ask: /\bslip (rating|resist\w*|rated|class|value|test\w*)\b|\b(r9|r1[0-3]|p[0-5]) ?(rating|rated|class|slip)\b|\b(non|anti) ?slip\b(?! ?(tiles?|tape|mats?|paint|coatings?|finish|surfaces?|flooring|floors?|nosings?|strips?|treads?|pavers?|products?))|\bslippery\b/, has: /slip|AS ?4586/i },
  { id: 'food', label: 'whether it is food safe', ask: /\bfood\b/, has: /\bfood/i },
  { id: 'potable', label: 'whether it is safe with drinking water', ask: /\bpotable\b|drinking water|drinkable|safe to drink|water tanks? for drinking/, has: /potable|drinking water|AS ?4020/i },
  { id: 'acoustic', label: 'an acoustic rating', ask: /\bacoustic\w*|sound ?proof\w*|sound (rating|insulation|transmission|reduction)|noise (reduction|rating|insulation)|impact noise|decibels?\b/, has: /acoustic|sound (insulat\w*|reduc\w*|transmi\w*|absor\w*|proof\w*|rating)|noise (reduc\w*|insulat\w*)|impact noise|\bdB\b/i },
  { id: 'warranty', label: 'warranty terms', ask: /\bwarrant\w*|\bguarantee\w*/, has: /warrant|guarantee/i },
  { id: 'greenstar', label: 'a Green Star or LEED rating', ask: /\bgreen ?star\b|\bleed\b/, has: /green ?star|\bleed\b/i },
  { id: 'epd', label: 'an environmental product declaration (EPD)', ask: /\bepd\b|environmental product declaration/, has: /\bepd\b|environmental product declaration|environmental_product_declaration/i },
  { id: 'carbon', label: 'a carbon footprint figure', ask: /carbon footprint|embodied carbon|\bgwp\b|global warming potential|co2 (emissions?|footprint)|carbon neutral/, has: /carbon footprint|embodied carbon|carbon neutral|\bgwp\b|global warming|co2[ -]?e|carbon (emission|dioxide)/i },
  { id: 'thermal', label: 'a thermal conductivity or R value', ask: /thermal conductivity|\br ?value\b|insulation value|insulating value|\bu ?value\b/, has: /thermal (conductivity|insulat\w*)|\br[ -]value\b|\bu[ -]value\b|\blambda\b/i },
  { id: 'origin', label: 'where it is made', ask: /\bwhere (is|are) (\w+ ){0,4}(made|manufactured|produced)\b|\bmade in (australia|china|germany|switzerland|the usa|usa|europe)\b|country of origin|\baustralian made\b|\bmanufactured (in|where)\b/, has: /made in|country of origin|manufactured in|australian made|produced in/i },
  { id: 'asbestos', label: 'anything about asbestos', ask: /\basbestos\b/, has: /asbestos/i },
  { id: 'kosher', label: 'that certification', ask: /\b(halal|kosher|vegan)\b/, has: /halal|kosher|vegan/i },
  { id: 'voc', label: 'a VOC figure', ask: /\bvocs?\b|volatile organic|low emission|emissions? (class\w*|rating)/, has: /\bvoc|volatile organic|emission/i },
  { id: 'colour', label: 'its colours', ask: /\bcolou?rs?\b|\bshades?\b|\bwhat colou?r\b/, has: null }, // colours: answered from colour sentences in the text (see colourLines)
];
// near misses: these words in a property question are covered by the normal routes (uses, packs, coverage, times, safety, documents), never the honest no here
export const askedAttr = (n) => COVER_ATTRS.find((a) => a.ask.test(n)) || null;

// ---- a standard named by code ("AS 3740", "AS/NZS 4858", "ISO 13007", "EN 1504", "ASTM C920")
const CODE_RX = /\b(as nzs|as|nzs|iso|en|astm|bs|din)\s?([a-z]?\d{3,5})(?:\.\d+)?\b/;
export function askedCode(n) { const m = CODE_RX.exec(n); if (!m) return null; return { code: (m[1] === 'as nzs' ? 'AS/NZS' : m[1].toUpperCase()) + ' ' + m[2].toUpperCase(), digits: m[2].replace(/^[a-z]/, ''), letter: /^[a-z]/.test(m[2]) ? m[2][0] : '' }; }
export const codeIn = (text, c) => new RegExp('(^|[^0-9])' + (c.letter ? c.letter + ' ?' : '') + c.digits + '(?![0-9])', 'i').test(text);
const NCC_RX = /\b(ncc|bca|building code( of australia)?|national construction code)\b/;
export const askedNcc = (n) => NCC_RX.test(n);
export const nccIn = (text) => /\bNCC\b|\bBCA\b|building code|national construction code/i.test(text);

// ---- questions no product data sheet answers: permits, the law, sign-off, insurance, landlords, strata
const LEGAL_RX = /\b(council (approval|permit|permission|sign ?off)|need (a |an )?(permit|approval|council|licen[cs]e)|building (permit|approval)|is it legal|is this legal|legally|illegal|against the law|allowed to (do|diy|waterproof|tile|do my own)|licen[cs]ed (tradie|waterproofer|plumber|builder)|need a licen[cs]e|qbcc|form 16|sign (it |this |my |the |our )?(waterproofing |work |job )?off|signoff|certify (my|the|our|this)|compliance certificate|certificate of compliance|insurance|insurer|landlord|strata|body corporate|by ?laws?|structural adequacy|engineer (to )?sign)\b/;
export const askedLegal = (n) => LEGAL_RX.test(n);

// ---- price, stock, delivery: the documentation holds none of it for any product
const COMM_RX = /\b(in stock|out of stock|back in stock|stock levels?|have (any |some )?stock|got (any |some )?stock|stock (at|in|near)|stocked|price|prices|pricing|priced|cost|costs|costing|rrp|cheap|cheaper|cheapest|discount\w*|deliver(y|ies|ed)?|freight|shipping|lead time|on sale|on special|specials|trade price)\b|\bhow much (is|are|does|do|would|will) (a|an|one|it|they|the|this|that|\d)\b(?!.*\b(need|needed|cover|use|for (a |an |the |my )?\d))|\bhow much (is|are) it\b/;
const WHERE_RX = /\bwhere (can|do|could|to|should) (i |we |you )?(buy|get|find|purchase|pick up)\b|\bstockists?\b|\bwho (sells|stocks)\b|\bretailers?\b/;
export const askedComm = (n) => COMM_RX.test(n) && !WHERE_RX.test(n);
export const commWhat = (n) => (/\bstock\w*\b/.test(n) ? 'stock levels' : /\bdeliver(y|ies|ed)?\b|freight|shipping|lead time\b/.test(n) ? 'delivery times and costs' : /\bwarrant\w*|guarantee/.test(n) ? 'warranty terms' : 'prices');
export const areaAsk = (n) => /\b\d+(\.\d+)? ?(m2|m 2|square met\w*|sq m)\b/.test(n);

// ---- things that are not in the range: asked to sell or supply them, with no Sika product kind in the same message
const NOT_RANGE = [
  [/\b(timber|wood|lumber|hardwood|decking boards?|floor ?boards?)\b/, 'Timber products'], [/\b(plasterboard|gyprock|drywall|villaboard|fibro|cement sheets?)\b/, 'Plasterboard and sheeting'],
  [/\b(floor tiles|wall tiles|tiles|pavers?|bricks?|stone slabs?)\b/, 'Tiles, pavers and bricks'], [/\b(paint|paints|paint rollers?|rollers?|paint ?brushes|brushes)\b/, 'Paint and painting gear'],
  [/\b(toilets?|vanit(y|ies)|taps?|basins?|sinks?|showers? screens?|shower heads?|baths?|tubs?)\b/, 'Bathroom fixtures'], [/\b(carpets?|lino|vinyl planks?|laminate( flooring)?|rugs?)\b/, 'Floor coverings'],
  [/\b(screws?|nails|bolts|nuts|fasteners?|hinges?)\b/, 'Hardware items'], [/\b(tools?|ladders?|drills?|trowels?|grinders?|saws?)\b/, 'Tools'], [/\b(insulation|batts)\b/, 'Insulation products'],
  [/\b(colorbond|roof sheets?|roofing iron|gutters? (guards?|sections?)|downpipes?|pipes?|fittings?)\b/, 'Roof sheeting and plumbing'], [/\b(glass|windows?|doors?|benchtops?|cabinets?)\b/, 'Building fittings'],
];
const SELL_RX = /\b(sell|sells|selling|stock|stocks|carry|carries|supply|supplies|make|makes|have|got|buy|get|order)\b/;
const KIND_WORDS = /\b(anti ?slip|non ?slip|slip resistant|floor paint|epoxy paint|concrete paint|roof paint|membrane paint|paint on|paintable|adhesives?|glue|glues|grout\w*|sealants?|silicones?|membranes?|primers?|level\w*|mortars?|sealer|waterproof\w*|repair\w*|coatings?|epoxy|epoxies|caulk\w*|for|to|on|under|around|between|onto|with|stick|seal|bond|fix|lay|laying)\b/;
export function notInRange(n) {
  if (!SELL_RX.test(n) || KIND_WORDS.test(n.replace(/^.*?\b(sell|sells|stock|stocks|carry|supply|make|makes|have|got|buy|get|order)\b/, ''))) return null;
  if (!/^(do|does|can|could|have|got|any|where|is|are|will|would|you|u|ya|yous|youse)\b|\bfrom you\b|\byou (guys |lot )?(sell|stock|carry|have|supply|make)\b/.test(n)) return null;
  for (const [rx, what] of NOT_RANGE) if (rx.test(n)) return what;
  return null;
}

// ---- a product range word with a model number no product carries ("Sikaflex-999", "Sikalastic 152")
const FAM_NUM = /\b(sikaflex|sikalastic|sikatile|sikafloor|sikadur|sikabond|sikaseal|sikasil|sikagrout|sikaproof|sikagard|sikaceram|monotop|sikatop|sikaswell|sikacryl|sikament|viscocrete|sikaplan|sarnafil|sikaroof|sikacrete|sikarapid|sikawrap|sikacor|sikalatex)\s?(\d{1,4})(?![\d.])(?:[a-z]*)\b(?!\s?(ml|l|lt|litres?|liters?|kg|kgs|mm|cm|m2|m|g|x|metres?|meters?|lineal|lm|coats?|layers?|lots?|pcs|pieces?|packs?|tubes?|cartridges?|sausages?|pails?|bags?|boxes?|cans?|rolls?|sheets?|cartons?|units?|of|or|and|for|on|in|to)\b)/;
export function unknownModel(n, names) {
  const m = FAM_NUM.exec(n); if (!m) return null;
  const rx = new RegExp('\\b' + m[1] + ' ?' + m[2] + '(?![0-9])');
  if (names.some((x) => rx.test(x))) return null;
  const loose = new RegExp('(^|[^0-9])' + m[2] + '(?![0-9])');
  if (names.some((x) => x.startsWith(m[1]) && loose.test(x))) return null; // the number sits inside a longer name of the same family: a fuzzy match later resolves it
  return { fam: m[1], num: m[2], family: names.filter((x) => x.startsWith(m[1] + ' ')).length };
}

// ---- colour sentences in a product's own text (never a table row, never the "colour variations may occur" note)
export function colourLines(sh) {
  const pool = [...(sh.d.a || []), ...(sh.d.us || []), sh.d.s, sh.d.t, sh.d.pk, ...(sh.pk || []).map((f) => f && f.text), ...(sh.d.sec || []).filter((x) => /colou?r|appearance/i.test(x.l || '')).map((x) => x.l + ': ' + x.t)].filter(Boolean);
  const out = [];
  for (const t of pool) { if (!/\|/.test(String(t))) continue; const cells = String(t).split('|').map((c) => c.replace(/\s+/g, ' ').trim());
    for (let i = 0; i < cells.length; i++) { const lab = /(?:^|\s)((?:available |standard |stock )?colou?rs?(?: \([^)]*\))?)$/i.exec(cells[i]); if (!lab) continue; let v = ''; for (let j = i + 1; j < cells.length && j <= i + 3; j++) if (cells[j]) { v = cells[j]; break; }
      if (!v || /colou?r variation|discolou?r/i.test(v) || v.length > 200) continue; const row = lab[1].replace(/^\w/, (ch) => ch.toUpperCase()) + ': ' + v.replace(/\s+(?:[A-Z][a-z]+ ){2,}.*$/, ''); if (!out.includes(row)) out.push(row); } }
  if (out.length) return out.slice(0, 3);
  for (const t of pool) for (const s of String(t).split(/(?<=[.!?])\s+/)) { if (/\|/.test(s) || !/colou?rs?\b|\b(white|grey|gray|black|translucent|clear|beige|brown|ivory|charcoal)\b/i.test(s) || /colou?r variation|discolou?r/i.test(s)) continue; const c = s.replace(/\s+/g, ' ').trim(); if (c.length > 3 && c.length < 300 && !out.includes(c)) out.push(c); }
  return out.slice(0, 3);
}

// ---- what a sheet DOES cover, for the offer after the honest no
export function sheetCovers(sh) {
  const labs = [...new Set((sh.d.sec || []).map((x) => String(x.l || '').trim()).filter((l) => l && l.length < 40 && !/^[A-Z ]{12,}$/.test(l)))];
  const head = [(sh.d.us || []).length ? 'what it is used for' : null, sh.d.pk || (sh.pk || []).length ? 'pack sizes' : null].filter(Boolean);
  return head.concat(labs.map((l) => l.toLowerCase())).slice(0, 8);
}
export const coverName = (names) => (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]);
export { normalise };
