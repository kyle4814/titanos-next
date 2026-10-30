// Actions v2, parsing: slash commands and plain English into { action, rest }, and facets out of free text.
// Plain regular expressions. No model. Facet ids match data/selector.json so a parsed answer can feed the system finder directly.

export const COMMANDS = [
  ['/calc', 'calc', 'How much and how many packs: /calc 20 m2 Davco Grey One Pot adhesive'],
  ['/system', 'system', 'The ordered system: /system porcelain on concrete, internal wet floor'],
  ['/pack', 'pack', 'One printable project pack from what we have so far'],
  ['/compare', 'compare', 'Two products side by side: /compare Davco Easy Grout vs SikaCeram-690 Elite'],
  ['/safety', 'safety', 'Safety data sheet statements: /safety gloves for Davco Grey One Pot adhesive'],
  ['/time', 'time', 'Open, cure and recoat times: /time open time Davco Grey One Pot adhesive'],
  ['/spec', 'spec', 'Draft specification clause for a product'],
  ['/export', 'export', 'Download the last result as CSV, or print it'],
  ['/ask', 'ask', 'Ask the product advisor anything: /ask which primer for concrete'],
  ['/can', 'compat', 'Can I use it: /can Davco Grey One Pot adhesive go over old tiles'],
  ['/link', 'link', 'Check a document link: /link Davco Grey One Pot adhesive'],
  ['/handoff', 'handoff', 'Ask Technical Services with the context so far'],
  ['/save', 'save', 'Save the last result to the current project'],
  ['/projects', 'projects', 'My projects, notes and saved items (this browser only)'],
  ['/gaps', 'gaps', 'Questions I could not answer'],
  ['/recent', 'recent', 'Recent questions'],
  ['/help', 'help', 'What I can do'],
];
const CMD = new Map(COMMANDS.map(([c, a]) => [c, a]));

const N = '(\\d+(?:[.,]\\d+)?)';
const num = (s) => parseFloat(String(s).replace(',', '.'));
const first = (re, t) => { const m = re.exec(t); return m ? num(m[1]) : null; };

/** Numbers the visitor typed: area (m2), length (m), volume (m3), thickness (mm), coats, allowance (%). */
export function parseNumbers(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/²/g, '2').replace(/³/g, '3') + ' ';
  const out = {};
  const area = first(new RegExp(N + '\\s*(?:m2|m\\^2|sqm|sq\\.?\\s*m|square\\s*met(?:re|er)s?|sq\\s*metres)\\b'), t);
  const vol = first(new RegExp(N + '\\s*(?:m3|m\\^3|cubic\\s*met(?:re|er)s?|cu\\.?\\s*m)\\b'), t);
  const len = first(new RegExp(N + '\\s*(?:lm|linear\\s*met(?:re|er)s?|lineal\\s*met(?:re|er)s?|met(?:re|er)s?\\s*(?:of|length)|m)(?![a-z0-9^])'), t.replace(new RegExp(N + '\\s*(?:mm|m2|m3)', 'g'), ' '));
  const th = first(new RegExp(N + '\\s*mm\\b(?!\\s*(?:notch|notched|trowel|comb))'), t);
  const coats = first(new RegExp(N + '\\s*coats?\\b'), t);
  const al = first(new RegExp('(?:' + N + '\\s*(?:%|percent|per cent)\\s*(?:extra|allowance|waste|wastage|spare|overage)?)'), t) ?? first(new RegExp('allowance(?: of)?\\s*' + N), t);
  const notch = first(new RegExp(N + '\\s*mm\\s*(?:notch|notched|trowel|comb)'), t) ?? first(new RegExp('(?:notch|notched|trowel)(?: size)?\\s*(?:of\\s*)?' + N), t);
  if (notch != null) out.notch = notch;
  const csp = first(/\bcsp\s*(\d{1,2})\b/, t); if (csp != null) out.csp = String(csp);
  const dil = /\b(\d+)\s*:\s*(\d+)\b/.exec(t); if (dil) out.dilution = dil[1] + ':' + dil[2];
  const ts = new RegExp(N + '\\s*(?:x|by|\\*)\\s*' + N + '(?:\\s*mm)?').exec(t); if (ts && !/m2|sqm/.test(ts[0])) out.tileSize = [num(ts[1]), num(ts[2])];
  if (/\bmosaic/.test(t)) out.mosaic = true;
  if (area != null && area > 0) out.area = area;
  if (vol != null && vol > 0) out.volume = vol;
  if (len != null && len > 0 && out.area == null) out.length = len;
  if (th != null && th > 0) out.thickness = th;
  if (coats != null && coats > 0 && coats < 20) out.coats = coats;
  if (al != null && al >= 0 && al < 100) out.allowance = al;
  return out;
}

// Ids follow the knowledge lane's decision trees (data/actions/trees.json): environment, tile, substrate.
const TILE = [
  ['moisture_sensitive_stone', /moisture[ -]sensitive|green marble/],
  ['natural_stone', /natural stone|\bmarble\b|granite|limestone|travertine|bluestone|sandstone/],
  ['terracotta', /quarry|terracotta/],
  ['large_format', /large[ -]format/],
  ['brick_slip', /brick slip/],
  ['mosaic', /mosaic/],
  ['glass_tile', /\bglass\b/],
  ['porcelain', /porcelain/],
  ['ceramic', /ceramic/],
];
const SUBSTRATE = [
  ['existing_tiles', /existing (?:\w+ )?tiles?|old (?:\w+ )?tiles?|tile (?:on|over) tile|over tiles?/],
  ['underfloor_heating', /under ?floor heating|heated floor|in ?floor heating|radiant|hydronic/],
  ['self_levelling_underlayment', /self[ -]?levell?ing|\bslu\b|levelling compound/],
  ['waterproofing_membrane', /waterproofing membrane|\bmembrane\b|waterproofed/],
  ['aac', /autoclaved|\baac\b/],
  ['fibre_cement', /fib(?:re|er)[ -]cement|cement (?:sheet|board)|villaboard|hardie/],
  ['plasterboard', /plaster ?board|gyprock|gypsum/],
  ['tile_underlay', /tile underlay|underlayment/],
  ['timber', /timber|plywood|particle ?board|chip ?board|wooden|\bwood\b/],
  ['cement_screed', /\bscreed/],
  ['cement_render', /\brender(?:ed|ing)?\b/],
  ['brick_block', /brick|block ?work|masonry|\bblocks?\b/],
  ['concrete', /\bconcrete\b|slab/],
];
/** Facets named in the text. io: internal | wet | external | pool. surface: floor | wall. Only what the text says. */
export function parseFacets(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[-_]/g, ' ') + ' ';
  const f = {};
  for (const [id, re] of TILE) if (re.test(t)) { f.tile = id; break; }
  for (const [id, re] of SUBSTRATE) if (re.test(t)) { f.substrate = id; break; }
  if (/\bpool|\bspa\b|water feature|fountain|submerged/.test(t)) f.io = 'pool';
  else if (/balcon|patio|terrace|outdoor|external|exterior|outside|deck|verandah|courtyard|pergola|driveway/.test(t)) f.io = 'external';
  else if (/bathroom|shower|laundry|ensuite|wet area|wet room|wet floor|wet wall|splash|bath\b/.test(t)) f.io = 'wet';
  else if (/internal|interior|indoor|inside|kitchen|living|bedroom|hallway|lounge|dry area|dining/.test(t)) f.io = 'internal';
  if (/\bwalls?\b|splashback|backsplash/.test(t) && !/\bfloors?\b/.test(t)) f.surface = 'wall';
  else if (/\bfloors?\b|flooring/.test(t)) f.surface = 'floor';
  return f;
}
/** Decision-tree environment id from io + surface (surface defaults to floor and is reported as assumed by the caller). */
export function envId(io, surface) {
  if (io === 'pool') return 'pool';
  if (io === 'wet') return 'wet_area';
  return `${io === 'external' ? 'external' : 'internal'}_${surface || 'floor'}`;
}
export function ioFromEnv(env) {
  if (!env) return {};
  if (env === 'pool') return { io: 'pool' };
  if (env === 'wet_area') return { io: 'wet', surface: 'floor' };
  const [io, surface] = env.split('_');
  return { io, surface };
}

const SAFETY_RE = /\b(ppe|protective equipment|(?:eye|hand|respiratory|face|skin) protection|gloves?|respirator|dust mask|goggles|safety glasses|first aid|hazards?|hazardous|flammable|toxic|dangerous goods|adg|un number|transport class|signal word|precaution(?:ary)?|safe to (?:use|handle|store)|safety data|sds|msds|storage|store it|stored)\b/i;
const TIME_RE = /\b(open time|working time|pot ?life|cure|curing|cured|setting time|set time|how long (?:before|until|till|to wait|do i wait|does it take|should i wait)|wait (?:before|until|for)|before (?:i )?grout|grout(?:ing)? after|foot traffic|walk on|return(?:ing)? to service|re-?coat|over-?coat|dry(?:ing)? time|how long (?:to|for) dry|time to dry|adjustab)/i;
const CALC_RE = /\b(how (?:much|many)|calculate|quantity|quantities|coverage|cover|litres?|liters?|packs?|buckets?|pails?|bags?|need for|do i need|order for|work out)\b/i;
const SYSTEM_RE = /\b(system|build me|what do i need to tile|what goes (?:under|on)|order of (?:products|application)|steps? to tile|layers?|prime[rs]? (?:and|then) )\b/i;
const COMPAT_RE = /\b(can i (?:use|tile|apply|put|lay|go|install|stick|fix|fit|put it)|compatible|compatibility|go over|work (?:over|on|with)|suitable (?:for|over|on)|safe (?:to use )?(?:over|on)|okay (?:over|on)|ok (?:over|on)|(?:use|apply|lay|fix|tile)[a-z ]{0,40}\b(?:over|onto|on top of)\b)/i;
const SPEC_RE = /\b(specification|spec clause|spec for|write a spec|draft (?:a )?spec|clause for|specify)\b/i;
const EXPORT_RE = /\b(export|download|csv|spreadsheet|print(?:able)?|save as pdf|save to file)\b/i;
const HANDOFF_RE = /\b(hand ?off|technical services|talk to (?:a|an|someone|the)|speak to (?:a|an|someone|the)|call (?:sika|technical)|human|rep\b|an expert|ask an expert)\b/i;
const PACK_RE = /\b(project pack|make (?:that|this|it) a (?:project )?pack|pack for|spec pack|printable pack|put (?:that|this|it) (?:in|into) a pack)\b/i;
const COMPARE_RE = /\b(compare|comparison|versus|vs\.?|difference between|differences between|side by side|which is better|better than)\b/i;
const LINK_RE = /\b(link|links|url|pdf)\b[^.?!]{0,40}\b(work|working|broken|dead|ok|okay|alive|live|health|valid|check|404)\b|\b(work|working|broken|dead|alive|live|health|check)\b[^.?!]{0,40}\b(link|links|url|pdf)\b|\bbroken link|\bdead link/i;
const SAVE_RE = /^(?:please )?(?:save|add|keep|store|remember)\b[^.?!]{0,50}\b(project|that|this|it)\b/i;

/** Decide what the visitor wants. Returns { action, rest, slash } or null (hand it to the product advisor). */
export function route(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/')) {
    const m = /^\/([a-z]+)\b\s*(.*)$/i.exec(raw);
    if (!m) return { action: 'help', rest: '', slash: true };
    const c = '/' + m[1].toLowerCase();
    if (c === '/new') return { action: 'newproject', rest: m[2], slash: true };
    if (c === '/note') return { action: 'note', rest: m[2], slash: true };
    if (c === '/use') return { action: 'useproject', rest: m[2], slash: true };
    if (c === '/import') return { action: 'import', rest: m[2], slash: true };
    if (c === '/exportjson') return { action: 'exportjson', rest: m[2], slash: true };
    if (c === '/clear') return { action: 'clearmemory', rest: m[2], slash: true };
    if (c === '/start') return { action: 'start', rest: m[2], slash: true };
    const a = CMD.get(c);
    if (a === 'ask') return null;
    return { action: a || 'help', rest: m[2], slash: true, unknownSlash: !a };
  }
  const t = raw;
  if (/^(?:help|what can you do|commands?|\?)$/i.test(t)) return { action: 'help', rest: '' };
  if (/\b(my projects?|show (?:my )?projects?|saved (?:items|systems))\b/i.test(t)) return { action: 'projects', rest: '' };
  if (/\b(my gaps|unanswered questions|questions you could ?n.t answer)\b/i.test(t)) return { action: 'gaps', rest: '' };
  if (/\b(recent questions|what did i ask|my history)\b/i.test(t)) return { action: 'recent', rest: '' };
  if (/^(?:new|start|create) (?:a )?project\b/i.test(t)) return { action: 'newproject', rest: t.replace(/^(?:new|start|create) (?:a )?project\s*(?:called|named)?\s*/i, '') };
  if (SAVE_RE.test(t) && !PACK_RE.test(t)) return { action: 'save', rest: t };
  if (PACK_RE.test(t)) return { action: 'pack', rest: t };
  if (HANDOFF_RE.test(t) && !SAFETY_RE.test(t)) return { action: 'handoff', rest: t };
  if (EXPORT_RE.test(t) && !/\bsds\b|\bdata sheet|\bsafety data/i.test(t)) return { action: 'export', rest: t };
  if (LINK_RE.test(t)) return { action: 'link', rest: t };
  if (COMPARE_RE.test(t)) return { action: 'compare', rest: t };
  if (SPEC_RE.test(t)) return { action: 'spec', rest: t };
  if (TIME_RE.test(t)) return { action: 'time', rest: t };
  if (SAFETY_RE.test(t) && !/\b(store|storage|stored)\b/i.test(t) || /\b(sds|msds|ppe|gloves?|respirator|hazard|signal word|first aid)\b/i.test(t) || /\bstor(?:e|age|ed)\b/i.test(t) && /\b(how|where|should|can)\b/i.test(t)) return { action: 'safety', rest: t };
  if (COMPAT_RE.test(t) && !CALC_RE.test(t)) return { action: 'compat', rest: t };
  const n = parseNumbers(t);
  if (CALC_RE.test(t) && (n.area || n.length || n.volume)) return { action: 'calc', rest: t };
  if (SYSTEM_RE.test(t) && /tile|tiling|grout|membrane|waterproof/i.test(t)) return { action: 'system', rest: t };
  if (/\b(?:tile|tiling)\b/i.test(t) && (parseFacets(t).substrate || parseFacets(t).io) && /\b(what|which|need|use|system|products?)\b/i.test(t) && !/\b(can|could)\b/i.test(t)) return { action: 'system', rest: t };
  if (/^\s*(?:now|ok|okay|and)?\s*(?:work out|calculate)\s+(?:the )?(?:quantities|packs|amounts)\b/i.test(t)) return { action: 'calc', rest: t };
  return null;
}

/** Strip the command words so what is left names the product or the job. */
export function stripWords(text) {
  return String(text || '').replace(/\b(please|can you|could you|show me|tell me|work out|calculate|how much|how many|do i need|i need|compare|versus|vs\.?|safety|time|specification|spec|draft|clause|check|link|for|of|the|a|an|and|with|to|on|in|over|under)\b/gi, ' ').replace(/\s+/g, ' ').trim();
}
