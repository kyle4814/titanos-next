// slang.js: query normalisation for trade slang, shorthand, phone typos, fused product codes and number words.
// Every entry says where the term comes from: a Sika page or standard that uses it, or "common trade usage" (a reading of a visitor's word, never a claim about Sika).
// applySlang(normalisedQuestion) -> { text, notes[] }. notes lists what was read as what, so the assistant can say its assumption out loud.
const U = 'https://aus.sika.com/en/';
export const SLANG = [
  // trade slang (common trade usage unless a page is named)
  { rx: /\bflexi\b/g, to: 'flexible', cite: 'common trade usage; Sika pages say "flexible cement-based tile adhesive"' },
  { rx: /\btile on tile\b|\btiling on tile\b/g, to: 'tiling over existing tiles', cite: U + 'home-owners/Blogs/tile-over-tile-a-laundry-refresh.html' },
  { rx: /\bmud\b/g, to: 'adhesive', cite: 'common trade usage (bedding mud); read as tile adhesive' },
  { rx: /\bgoop\b|\bgunk\b/g, to: 'sealant', cite: 'common trade usage; read as sealant or adhesive' },
  { rx: /\bsilly ?cone\b|\bsilicon\b/g, to: 'silicone', cite: 'common trade usage' },
  { rx: /\bgrot\b/g, to: 'grout', cite: 'common trade usage and typo' },
  { rx: /\bbog\b/g, to: 'repair filler', cite: 'common trade usage (bog = filler)' },
  { rx: /\bscreed it out\b/g, to: 'screed', cite: 'common trade usage' },
  { rx: /\btwo ?pack\b|\btwo ?part\b|\b2 ?part\b/g, to: 'two component', cite: 'common trade usage; Sika data sheets say "two-component" or "2-component"' },
  { rx: /\bone ?pack\b|\bone ?part\b/g, to: 'one component', cite: 'common trade usage; Sika data sheets say "one-component" or "1-component"' },
  { rx: /\bliquid nails?\b|\bno more nails?\b|\bconstruction glue\b/g, to: 'construction adhesive', cite: 'common trade usage (brand style names for construction adhesive)' },
  { rx: /\bclass (3|iii)\b/g, to: 'class iii', cite: U + 'construction/tile-stone-installationsystems/waterproofing/davco-k10-rapid.html ("CLASS III WATERPROOFING MEMBRANE")' },
  { rx: /\bcta\b/g, to: 'cementitious tile adhesive', cite: 'common trade usage (cementitious tile adhesive)' },
  { rx: /\blft\b/g, to: 'large format tile', cite: 'common trade usage; Sika pages say "large format tiles"' },
  { rx: /\bsparky\b|\bchippy\b|\bchippies\b|\btradie\b|\bmate\b|\bpls\b|\bplease\b|\bhey\b/g, to: '', cite: 'filler words dropped' },
  { rx: /\bwet room\b|\bensuite\b|\bwetroom\b/g, to: 'wet area', cite: 'AS 3740 wet area wording; Sika pages say "wet areas"' },
  { rx: /\bcellar\b/g, to: 'basement', cite: 'common usage' },
  { rx: /\b(yellow|white|old) davco\b/g, to: 'davco', cite: U + 'construction/davco.html (Davco packaging changed from white to Sika yellow, product names unchanged)' },
  { rx: /\bgrey pot\b/g, to: 'grey one pot', cite: 'common trade usage for Davco Grey One Pot' },
  { rx: /\bdept\b/g, to: 'department', cite: 'shorthand' },
  { rx: /\bcany\b/g, to: 'cant', cite: 'phone typo' },
  { rx: /\bbumpy\b/g, to: 'uneven', cite: 'common trade usage' },
  { rx: /\blvl\b/g, to: 'level', cite: 'shorthand' },
  { rx: /\b(rooted|stuffed|knackered|munted|cooked)\b/g, to: 'damaged', cite: 'common Australian trade slang' },
  { rx: /\bcrete\b/g, to: 'concrete', cite: 'common trade usage' },
  { rx: /\btanking\b/g, to: 'waterproofing', cite: 'Sika pages use "tanking" for below-ground waterproofing' },
  // phone and shorthand typos
  { rx: /\bfr\b/g, to: 'for', cite: 'phone typo' }, { rx: /\bhw\b/g, to: 'how', cite: 'phone typo' }, { rx: /\bwat\b|\bwht\b/g, to: 'what', cite: 'phone typo' }, { rx: /\bwher\b/g, to: 'where', cite: 'phone typo' },
  { rx: /\bda\b/g, to: 'the', cite: 'phone typo' }, { rx: /\bcnt\b/g, to: 'cant', cite: 'phone typo' }, { rx: /\bphne\b/g, to: 'phone', cite: 'phone typo' }, { rx: /\bnumbr\b/g, to: 'number', cite: 'phone typo' },
  { rx: /\bshwr\b/g, to: 'shower', cite: 'shorthand' }, { rx: /\bbthrm\b|\bbthroom\b/g, to: 'bathroom', cite: 'shorthand' }, { rx: /\bconc\b/g, to: 'concrete', cite: 'shorthand' }, { rx: /\badhsv\b|\badh\b/g, to: 'adhesive', cite: 'shorthand' },
  { rx: /\btecnical\b|\btechnial\b/g, to: 'technical', cite: 'typo' }, { rx: /\bwarrenty\b|\bwarrantee\b/g, to: 'warranty', cite: 'typo' }, { rx: /\bby\b(?= (davco|sika))/g, to: 'buy', cite: 'phone typo' },
  { rx: /\bltrs?\b|\bltr\b/g, to: 'litre', cite: 'unit shorthand' }, { rx: /\bkgs\b/g, to: 'kg', cite: 'unit shorthand' }, { rx: /\bsq ?m(etres?)?\b|\bsquare met(re|er)s?\b/g, to: 'm2', cite: 'unit' },
];
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
export function applySlang(n) {
  let t = ' ' + n + ' '; const notes = [];
  // fused product codes: sikaflex11fc, viscocrete1250, sikatile400, 11fc
  t = t.replace(/\b([a-z]{4,})(\d{1,4})([a-z]{0,3})\b/g, (m, a, b, c) => `${a} ${b}${c ? ' ' + c : ''}`).replace(/\b(\d{1,3})(fc|evo|pro|top|hp|plus|nfg)\b/g, '$1 $2');
  for (const s of SLANG) { const before = t; t = t.replace(s.rx, ` ${s.to} `); if (t !== before && s.to && !/^(typo|phone|shorthand|unit|filler)/.test(s.cite)) notes.push({ from: (before.match(s.rx) || [''])[0].trim(), to: s.to, cite: s.cite }); }
  t = t.replace(/\b(as|nzs|en|iso)(\d{3,5})\b/g, '$1 $2').replace(/\bc ?([12]) ?t ?e ?s ?([12])\b/g, 'c$1tes$2');
  t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred) (m2|square)/g, (m, w, u) => `${NUMW[w]} ${u}`);
  t = t.replace(/\s+/g, ' ').trim();
  // "tiling over old tiles" with no material named: read as the adhesive question
  if (/\b(tiling|tile|tiles|tiled)\b.* over (old|existing|ceramic) tiles?/.test(t) && !/\b(adhesive|glue|grout|membrane|waterproof\w*|primer|sealant|silicone|levell?er|screed)\b/.test(t)) { t += ' adhesive'; notes.push({ from: 'tiling over tiles', to: 'tile adhesive for tiling over existing tiles', cite: 'assumed: the question names no product type, so it is read as an adhesive question' }); }
  if (/\bunder (vinyl|carpet|lvt|floor covering|floorcovering|vinyl planks?|timber flooring|laminate)\b/.test(t) && !/\b(adhesive|glue|levell?er|screed|primer|membrane|underlay\w*)\b/.test(t)) { t += ' levelling compound'; notes.push({ from: 'under vinyl', to: 'levelling compound', cite: 'assumed: what goes under a floor covering is read as a levelling compound or underlayment (Sika floor leveller pages)' }); }
  return { text: t, notes };
}
