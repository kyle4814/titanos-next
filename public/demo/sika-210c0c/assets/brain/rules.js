// rules.js: the engineer's reasoning layer (lane D). A customer describes a job with several constraints; this module returns a cited STEP PLAN, not a product list.
//   1. parseConstraints(text, prior): substrate, condition, location, tile, traffic, site conditions, area, from one or more messages.
//   2. assemblePlan(K, data): the published system as ordered steps, the waits between them (summed only when every window is published), the conditions
//      that void the plan, prerequisites, joints, standards, and the published rule that blocks the job when the constraints collide with it.
//   3. createRules({ load }).handle(...): loads the rule shards on demand (data/brain/rules/*.json, never precached), builds the cards.
// Rules of the demo: no model, no network beyond the shard loader, every statement carries the sentence, data sheet edition and page it came from,
// "not published" beats a guess, and a total is never shown when one of its windows is missing.
// The shard rows are written by scripts/sika-brain/build_rules.mjs from the specification clauses; nothing numeric is typed here.
import * as C from './cards.js';
import { card, fact, CHIPS, NOT_KNOWN } from './schema.js';

/** Minimal follow-up state kept by this module (Lane C owns the shared follow-up state; until it lands, state.plan carries the constraints). */
export const KEEP_OWN_STATE = true;

// ------------------------------------------------------------------ 1. the constraint model
const lc = (s) => String(s == null ? '' : s).toLowerCase().replace(/[‘’]/g, "'").replace(/º/g, '°').replace(/m²/g, 'm2').replace(/\s+/g, ' ').trim();
export const TILE_LABEL = { porcelain: 'porcelain tiles', ceramic: 'ceramic tiles', mosaic: 'mosaic tiles', glass: 'glass tiles', 'natural-stone': 'natural stone', 'engineered-stone': 'engineered stone', 'quarry-terracotta': 'quarry, terracotta or slate tiles', 'large-format': 'large format tiles', 'moisture-sensitive-stone': 'moisture sensitive stone' };
export const SUB_LABEL = { concrete: 'concrete', 'screed-render': 'cement screed or render', masonry: 'brick or blockwork', 'cement-board': 'fibre cement sheet or cement board', plasterboard: 'plasterboard', 'timber-floor': 'timber or particleboard floor (over-sheeted)', 'existing-tiles': 'existing tiles', aac: 'autoclaved aerated concrete (AAC)' };
export const LOC_LABEL = { 'internal-floor': 'internal floor (dry area)', 'internal-wall': 'internal wall (dry area)', 'internal-wet-floor': 'internal wet area floor', 'internal-wet-wall': 'internal wet area wall', 'external-floor': 'external floor', 'external-wall': 'external wall', pool: 'swimming pool or spa' };
const TILE_RX = [
  ['moisture-sensitive-stone', /moisture[- ]sensitive|green marble|resin[- ]backed/],
  ['large-format', /large[- ]format|\blft\b|oversize/],
  ['glass', /glass (?:mosaic|tile)s?|\bglass tiles?\b|\bglass\b(?! (?:sheet|panel|substrate|balustrade|door|window))/],
  ['mosaic', /mosaics?/],
  ['engineered-stone', /engineered stone|agglomerate|reconstituted stone/],
  ['natural-stone', /natural stone|marble|granite|travertine|limestone|sandstone|bluestone|basalt|\bstone tiles?\b|\bstone\b/],
  ['quarry-terracotta', /terracotta|quarry|\bslate\b|clay pavers?/],
  ['porcelain', /porcelain/],
  ['ceramic', /ceramic/],
];
// the substrate the tile is fixed to, in the order the text is read when more than one is named (the layer touching the new tile wins)
const SUB_RX = [
  ['existing-tiles', /existing (?:ceramic |porcelain )?tiles?|old tiles?|tile[- ]over[- ]tile|tiles? over (?:the )?(?:old |existing )?tiles?|over (?:the )?(?:old |existing )?tiles?|retil\w+ over|(?:tiling|tile) (?:on|onto) (?:top of )?(?:the )?(?:old |existing )?tiles?|previous tiles?|current tiles?/],
  ['timber-floor', /timber|plywood|\bply\b|particle ?board|chip ?board|floor ?boards?|\bmdf\b|masonite|wooden|\bt&g\b|tongue and groove/],
  ['plasterboard', /plasterboard|gyprock|dry ?wall|\bgyp\b|gypsum|plaster board|villa ?board lined/],
  ['cement-board', /cement (?:sheet|board)s?|fibre ?cement|fiber ?cement|\bfc sheet|villa ?board|hardie|fibro|compressed (?:fibre )?(?:cement )?sheet|tile underlay|\bcfc\b|scyon/],
  ['aac', /\baac\b|hebel|autoclaved|aerated concrete|\bprecast aerated/],
  ['masonry', /brick|block ?work|\bblocks?\b|masonry|besser|rendered (?:wall|brick)/],
  ['screed-render', /screed|render(?:ed|ing)?\b/],
  ['concrete', /concrete|\bslab\b|\bcrete\b/],
];
const UNSUPPORTED_RX = /\b(steel|metal|aluminium|aluminum|galvanis\w+|vinyl|lino(?:leum)?|carpet|asphalt|bitumen|bitumous|laminate|polystyrene|foam board|fibreglass|fiberglass|acrylic sheet|gib ?board|magnesite|terrazzo|linoleum|cork|rubber|pvc|plastic|stainless)\b/;
const NUMW = '(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)';
const WORDN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const n2 = (s) => (WORDN[s] != null ? WORDN[s] : Number(s));
const UNIT_H = { hour: 1, hours: 1, hr: 1, hrs: 1, day: 24, days: 24, week: 168, weeks: 168, month: 720, months: 720, minute: 1 / 60, minutes: 1 / 60 };

/** Read the constraints from one message. `prior` is the constraint object of an earlier message in the same conversation; new facts replace old ones, nothing is dropped silently. */
export function parseConstraints(text, prior = null) {
  const s = lc(text);
  const K = prior ? JSON.parse(JSON.stringify(prior)) : { tile: null, tiles: [], sub: null, subs: [], unsupported: [], locs: [], where: {}, flags: {}, age: null, temp: null, rh: null, budget: null, area: null, size: null, traffic: null, raw: [] };
  K.raw = (K.raw || []).concat(s).slice(-6);
  // tile type
  const tiles = TILE_RX.filter(([, rx]) => rx.test(s)).map(([id]) => id).filter((id) => id !== 'ceramic' || !/porcelain|mosaic|stone|glass|terracotta|slate|quarry/.test(s));
  if (/\btiles?\b|\btiling\b|\btiled\b/.test(s)) K.tileWord = true;
  // tile size, "1200 x 600" or "600x600mm"; a side over 600 on both is the published large format reading
  const sz = /(\d{2,4})\s*(?:mm)?\s*(?:x|×|by|\*)\s*(\d{2,4})\s*(?:mm)?\b/.exec(s);
  if (sz) { const a = Number(sz[1]), b = Number(sz[2]); K.size = [Math.min(a, b), Math.max(a, b)]; if (K.size[0] >= 600 && K.size[1] > 600) tiles.unshift('large-format'); }
  if (tiles.length) { const pri = ['moisture-sensitive-stone', 'large-format', 'glass', 'mosaic', 'engineered-stone', 'natural-stone', 'quarry-terracotta', 'porcelain', 'ceramic']; K.tiles = [...new Set(tiles)]; K.tile = pri.find((x) => K.tiles.includes(x)); }
  // substrate
  const subs = SUB_RX.filter(([, rx]) => rx.test(s)).map(([id]) => id);
  if (subs.length) { K.subs = [...new Set(subs)]; K.sub = subs[0]; }
  const un = new RegExp('(?:\\bon|onto|over|to|bonded to|fixed to|laid on|laid over)\\s+(?:an? |the |existing |old |new |some |sheet |a layer of )?(?:[a-z]+ ){0,2}?(' + UNSUPPORTED_RX.source.replace(/^\\b\(/, '').replace(/\)\\b$/, '') + ')\\b').exec(s);
  if (un) K.unsupported = [...new Set([...(K.unsupported || []), un[1]])];
  // location
  const w = {}; // a message that names a place replaces the earlier place; one that does not keeps it
  if (/\b(swimming )?pool\b|\bspa\b|submerged|water feature|\bpond\b/.test(s)) w.pool = true;
  if (/bathroom|shower|laundry|ensuite|wet area|wet room|toilet|\bwc\b|wet floor|wet wall|\bwet\b/.test(s)) w.wet = true;
  if (/external|exterior|outdoor|outside|balcon(?:y|ies)|terrace|patio|\bdeck\b|alfresco|pergola|courtyard|rooftop|roof deck|podium|facade|verandah|veranda|driveway|entry|pavers?|paving/.test(s)) w.external = true;
  if (/internal|interior|indoor|inside|kitchen|living|hallway|bedroom|lounge|dining|entry hall/.test(s)) w.internal = true;
  if (/\bwalls?\b|splashback|feature wall|cladding|facade/.test(s)) w.wall = true;
  if (/\bfloors?\b|flooring|balcon(?:y|ies)|terrace|patio|\bdeck\b|paving|pavers?|stairs?|treads?|shower base|driveway/.test(s)) w.floor = true;
  if (/\bgarage\b|workshop|warehouse|car ?port/.test(s)) w.garage = true;
  if (/commercial kitchen|restaurant kitchen|food (?:prep|processing)|abattoir|cool ?room|freezer|cold ?room/.test(s)) w.commercialKitchen = true;
  if (/hallway|living room|lounge room|bedroom|dining room|entry hall|corridor|family room/.test(s) && !w.wall && !w.floor) { w.floor = true; w.floorAssumed = true; }
  if (Object.keys(w).length || !K.where) K.where = w;
  const fl = K.flags || {};
  const set = (k, rx) => { if (rx.test(s)) fl[k] = true; };
  set('new', /\bnew\b|freshly|just (?:poured|laid|screeded|rendered|finished)|green (?:concrete|screed|slab)|early[- ]ag(?:e|ed)/);
  set('old', /\bold\b|decades|years old|aged\b/); set('cracked', /crack/);
  set('risingDamp', /rising damp|negative (?:hydrostatic )?pressure|hydrostatic|water coming (?:up|through)|efflorescence/);
  set('damp', /\bdamp\b|\bmoist|\bwet (?:slab|substrate|concrete|screed|walls?|render)|not dry|hasn't dried|still wet|sweating|condensation/);
  set('painted', /painted|paint\b|coating|sealed with|epoxy (?:floor|coat)|glossy|polished/);
  set('uneven', /uneven|out of level|not level|undulat|bumpy|lumpy|dished|out of flat|not flat/);
  set('smooth', /steel[- ]trowel|power[- ]float|burnish|polished concrete|smooth (?:concrete|slab)|dense concrete/);
  set('contaminated', /\boil\b|grease|\bwax\b|curing compound|laitance|dusty|contaminat/);
  set('vehicular', /vehicle|\bcars?\b|forklift|truck|garage floor|driveway|heavy traffic|trolley|pallet/);
  set('commercial', /commercial|cafe|restaurant|shopping|retail|office|hotel|hospital|school|mall/);
  set('residential', /residential|domestic|\bhome\b|\bhouse\b|family/);
  set('chemical', /chemical|acid|bleach|degreaser|caustic/);
  set('exposed', /full sun|direct sun|\buv\b|exposed to (?:the )?(?:sun|weather)|left exposed/);
  set('freezing', /frost|freez|ice\b/);
  set('heated', /under ?floor heating|floor heating|heated (?:floor|slab)|hydronic|in-?floor heating|radiant/);
  set('hotWindy', /hot (?:and )?windy|windy|hot day|heat ?wave/);
  set('steam', /steam room|sauna|hammam|\bkiln\b|furnace|fireplace|hearth/);
  set('timePressure', /urgent|asap|rush|deadline|quickly|fast as|as fast|need it done|in a hurry|tight (?:deadline|schedule)|by (?:the )?weekend|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|handover/);
  set('direct', /directly|straight (?:on|onto)|bare timber|without (?:an? )?(?:overlay|over-?sheet\w*|underlay|sheeting)|no (?:overlay|underlay|over-?sheet\w*)/);
  set('confined', /totally confined|confined space|no ventilation|unventilated|airtight|sealed room/);
  set('stairs', /stairs?|treads?|risers?/);
  set('heightHigh', /(?:above|over|higher than|more than)\s*(?:3|three)\s*(?:m|metres?|meters?)\b|multi[- ]?storey|high[- ]?rise|second storey|upper (?:storey|level)|storey/);
  K.flags = fl;
  // age of the new substrate: "poured 2 weeks ago", "a 10 day old slab", "cured for 6 weeks"
  let m = new RegExp('(?:poured|laid|screeded|rendered|cured|finished|placed|cast|put down|installed)[^.,;]{0,30}?' + NUMW + '[- ](hours?|hrs?|days?|weeks?|months?)\\b').exec(s) || new RegExp(NUMW + '[- ](hours?|hrs?|days?|weeks?|months?)[- ](?:old|ago|cured|of curing)\\b').exec(s) || new RegExp('(?:aged|cured for|curing for|been curing)\\s*(?:about |around |only |just )?' + NUMW + '[- ](hours?|hrs?|days?|weeks?|months?)').exec(s);
  if (m) { const v = n2(m[1]); if (Number.isFinite(v)) K.age = { hours: v * UNIT_H[m[2]], said: m[0], value: v, unit: m[2] }; }
  // time available: "I have 3 days", "done within 48 hours"
  const bm = new RegExp('(?:within|inside|in|only have|have only|have|got only|got|only got|can wait|will wait|wait|waiting|finish (?:in|within)|done (?:in|within)|ready (?:in|within)|available is|window of|time frame of)\\s*(?:about |around |just |only )?' + NUMW + '[- ](hours?|hrs?|days?|weeks?)\\b').exec(s);
  if (bm && !(m && m.index <= bm.index && m[0].length > 0 && bm[0] === m[0])) { const v = n2(bm[1]); if (Number.isFinite(v) && !/(?:poured|laid|screeded|rendered|cured|cast|old)\b/.test(s.slice(Math.max(0, bm.index - 20), bm.index))) K.budget = { hours: v * UNIT_H[bm[2]], said: bm[0] }; }
  // site conditions
  const tm = /(-?\d{1,2}(?:\.\d+)?)\s*(?:°|degrees?|deg\b)\s*(?:c\b|celsius)?|\b(-?\d{1,2})\s?c\b(?!m)/.exec(s);
  if (tm) { const t = Number(tm[1] != null ? tm[1] : tm[2]); if (t >= -30 && t <= 60) K.temp = t; }
  { const mi = /\bminus (\d{1,2})\s*(?:\u00b0|degrees?|deg\b|c\b)/.exec(s); if (mi) K.temp = -Number(mi[1]); }
  const hm = /(\d{1,3})\s*%\s*(?:humidity|rh|relative humidity|r\.h\.)|humidity\s*(?:is|of|at|around|about|sitting at)?\s*(\d{1,3})\s*%?/.exec(s);
  if (hm) { const h = Number(hm[1] != null ? hm[1] : hm[2]); if (h >= 0 && h <= 100) K.rh = h; }
  const am = /(\d+(?:\.\d+)?)\s*(?:m2|sqm|sq ?m|square met(?:er|re)s?)\b/.exec(s); if (am) K.area = Number(am[1]);
  if (/(?:^|[^a-z])(?:commercial|heavy|industrial)\b/.test(s)) K.traffic = K.flags.vehicular ? 'vehicular' : 'commercial'; else if (K.flags.vehicular) K.traffic = 'vehicular'; else if (K.flags.residential) K.traffic = K.traffic || 'residential';
  return K;
}

/** the published system key parts from the constraints: one location id per zone the customer described */
export function zonesOf(K) {
  const w = K.where || {};
  if (w.pool) return ['pool'];
  const floor = !!w.floor, wall = !!w.wall; const wet = !!w.wet; const ext = !!w.external;
  const out = [];
  const make = (axis) => (wet ? 'internal-wet-' + axis : ext ? 'external-' + axis : w.internal || w.garage || w.commercialKitchen ? 'internal-' + axis : null);
  const axes = floor && wall ? ['floor', 'wall'] : floor ? ['floor'] : wall ? ['wall'] : (wet ? ['floor', 'wall'] : ext ? ['floor'] : []);
  for (const a of axes) { const z = make(a); if (z) out.push(z); }
  return out;
}

// ------------------------------------------------------------------ what the question is
const PLAN_RX = /\b(plan|method|steps?|step by step|steps? (?:to|for|in|i)|in what order|order of (?:work|works|operations|application)|what order|sequence|timeline|schedule|how long (?:until|before|will|would|does|do|is|should|in total|overall|all up)|total time|earliest|finish (?:by|in|within)|done (?:by|in|within)|ready (?:by|for|in|within)|when can|what (?:must|do i need|should i)|prerequisites?|before i start|build[- ]?up|walk me through|process|stages?|specification|spec for|method statement|how do i (?:tile|waterproof|prepare|prep|install|lay|fix)|how to (?:tile|waterproof|prepare|install|lay))\b/;
const ASK_RX = /\b(can i|could i|is it ok|is it okay|will (?:it|that|this) work|is it possible|is it allowed|should i|am i allowed|does this work|would this work|is that ok|is that okay)\b/;
const RULE_TOPICS = [
  ['age', /\bcure age\b|\bminimum age\b|\b(cure|curing|cured) (?:age|time|period)\b.{0,60}\b(slab|screed|render|concrete)\b|\b(slab|screed|render|concrete)\b.{0,40}\b(age|old|cure|cured|curing|weeks?|days?)\b|\bminimum (?:cure|cure age|age)\b|\bhow (?:old|long (?:must|should|does|do))\b.{0,40}\b(slab|screed|render|concrete|cure)\b/],
  ['temp', /\b(temperature|temp|degrees|hot|cold|cool|frost|freez\w*|°c)\b/],
  ['humidity', /\bhumidity|\brh\b|dew point|condensation/],
  ['moisture', /\bmoisture|damp|dry enough|rising damp|moisture content/],
  ['thickness', /\bthick\w*|coats?|dry film|layer|build up (?:the )?membrane/],
  ['standard', /\bstandards?\b|\bas ?\d{3,4}|\bas\/nzs?\b|\bastm\b|\biso\b|\bcode\b|\bcomplian\w*|\bcertif\w*/],
  ['joint', /\bmovement joints?|expansion joints?|control joints?|bond ?breaker|backing rod|perimeter|crack\b/],
  ['primer', /\bprim\w*|prep n prime|moisture seal/],
  ['wait', /\bhow long\b|\bwait(?:ing)?\b|\bcure\b|\bdry\b|\bdrying\b|\brecoat|\bgrout(?:ing)? (?:after|when)|walk on|foot traffic|ready for/],
  ['mix', /\bmix\w*|water per|ratio|pot life/],
  ['open', /\bhow soon\b.{0,40}\b(cover\w*|coat\w*|tile\w*)\b|\bleft uncovered\b|\bcover(?:ed)? within\b|\btime limit\b.{0,40}\b(prim\w*|cover\w*)|\bhow long can\b.{0,40}\b(stand|sit|be left)\b|\bre-?prim\w*/],
  ['lf', /(?:flat\w*|even and true|lippage|tolerance)\W+(?:\w+\W+){0,8}?(?:large format|\d{3,4}\s*x\s*\d{3,4})|(?:large format|\d{3,4}\s*x\s*\d{3,4})\W+(?:\w+\W+){0,12}?(?:flat\w*|even and true|lippage|tolerance)/],
];
export function ruleTopics(text) { const s = lc(text); return RULE_TOPICS.filter(([, rx]) => rx.test(s)).map(([id]) => id); }

const dimsOf = (K) => (K.tile ? 1 : 0) + (K.sub || (K.unsupported && K.unsupported.length) ? 1 : 0) + (zonesOf(K).length || K.where.wet || K.where.external || K.where.internal || K.where.pool || K.where.floor || K.where.wall || K.where.garage ? 1 : 0);
const extraOf = (K) => Object.entries(K.flags || {}).some(([k, v]) => v && !['residential'].includes(k)) || K.age != null || K.temp != null || K.rh != null || K.budget != null || K.area != null || K.size != null;

/** Does this message ask for a plan (or a rule answer) rather than for a single product or the plain system lookup? Returns 'plan', 'rule' or null. */
export function classifyAsk(text, K, { hasProduct = false, prior = null, own = null } = {}) { // eslint-disable-line no-param-reassign
  const s = lc(text);
  if (/\b(price|cost|how much (?:is|does|will it cost)|quote|cheapest|discount|where (?:can|do) i buy|stockist|in stock|warranty|guarantee)\b/.test(s) && !/\bhow much (?:adhesive|grout|primer|membrane|sealant)\b/.test(s)) return null;
  const follow0 = !!(prior && prior.raw && prior.raw.length) && !!own && !hasProduct && s.split(' ').length <= 8 && dimsOf(own) + (extraOf(own) ? 1 : 0) >= 1 && dimsOf(K) >= 2;
  if (prior && own && !follow0) { K = own; prior = null; } // without a short follow-up, only what this message says counts
  const d = dimsOf(K); const topics = ruleTopics(s);
  const strong = topics.filter((t) => ['age', 'standard', 'joint', 'primer', 'humidity', 'lf', 'open'].includes(t) || (t === 'thickness' && /\bcoats?\b/.test(s)) || (t === 'temp' && /\b(limits?|range|window|allowed|permitted|minimum|maximum|what temperature|how (?:hot|cold))\b/.test(s)) || (t === 'thickness' && /\b(maximum|minimum|limit|max|min)\b/.test(s)) || (t === 'wait' && /\b(wet area|dry area|submerged|grout\w*|tiling|between coats|flood\w*|walk\w*)\b/.test(s)));
  if (hasProduct) {
    if (!topics.length || /\bhow much\b|\bhow many (?:bags|pails|packs|litres|kg)\b/.test(s) || /^(?:what is|what's|whats|tell me about)\b.*\b(?:shelf life|pot life|open time)\b/.test(s)) return null;
    if (strong.length && d >= 1) return 'rule';
    if (d >= 2 || (d >= 1 && (extraOf(K) || PLAN_RX.test(s)))) return 'rule';
    return null;
  }
  if (!K.tile && !K.tileWord && !prior) return null; // a job with several constraints is a tiling job: repairs, screeds and floor coatings are not this module's
  const follow = follow0;
  if (follow) return 'plan';
  if (d >= 2 && PLAN_RX.test(s)) return 'plan';
  if (d >= 2 && strong.length) return 'rule';
  if (d >= 2 && (ASK_RX.test(s) || extraOf(K))) return 'plan';
  if (d >= 1 && topics.length && /\b(minimum|maximum|limit|range|how (?:old|long|hot|cold|thick|many coats)|what (?:standard|temperature|humidity))\b/.test(s) && /\b(tile|tiling|tiled|waterproof\w*|membrane|primer|adhesive|grout|screed|slab|substrate)\b/.test(s)) return 'rule';
  return null;
}

// ------------------------------------------------------------------ 2. reading the rule rows
const KIND_OF_ROLE = { prime: 'Prepare and prime', membrane: 'Waterproofing membrane', adhesive: 'Tile adhesive', grout: 'Grout', sealant: 'Movement joints and perimeter sealant' };
export const ROLE_ORDER = ['prime', 'membrane', 'adhesive', 'grout', 'sealant'];
const POROUS = new Set(['concrete', 'screed-render', 'masonry', 'aac']);
const NONPOROUS = new Set(['cement-board', 'plasterboard', 'existing-tiles', 'timber-floor']);
export const locClass = (loc) => (loc === 'pool' ? 'submerged' : /wet|external/.test(loc) ? 'wet' : 'dry');
const axisOf = (loc) => (/wall$/.test(loc) ? 'wall' : /floor$|pool/.test(loc) ? 'floor' : null);

/** a citation for one rule row of one product */
export function cite(pid, row, meta) {
  return { pid, name: meta ? meta.m[0] : pid, ed: meta ? meta.m[4] : '', url: meta ? meta.m[2] : '', k: row[0], v: row[1], q: row[2], c: row[3], p: row[4] };
}
const rowsOf = (data, pid, kind) => ((data.rules[pid] && data.rules[pid].r) || []).filter((r) => r[0] === kind);

/** The published wait of one product for one purpose. kinds = the wait kinds acceptable, in order of preference. Several published figures are merged to the longer, and all are kept. */
export function pickWait(data, pid, kinds, ctx = {}) {
  const meta = data.rules[pid]; if (!meta) return null;
  for (const kind of kinds) {
    let c = rowsOf(data, pid, 'wait').filter((r) => r[1].kinds.includes(kind) && (!r[1].on || !ctx.axis || r[1].on === ctx.axis) && (r[1].porous == null || ctx.porous == null || r[1].porous === ctx.porous));
    if (!c.length) continue;
    // a figure for a specific wall or floor beats a general one for the same purpose only when the axis is known; otherwise all stay
    const refs = c.map((r) => cite(pid, r, meta));
    const min = Math.max(...c.map((r) => r[1].min)), max = Math.max(...c.map((r) => r[1].max));
    const plus = c.some((r) => r[1].plus && r[1].max === max);
    const distinct = new Set(c.map((r) => r[1].min + '-' + r[1].max)).size > 1;
    return { kind, min, max, plus, raw: c.map((r) => r[1].raw).join(' / '), refs, distinct, at: c[0][1].at || {} };
  }
  return null;
}
const pickCold = (data, pid, K, locKind) => {
  if (K.temp == null) return null;
  const r = rowsOf(data, pid, 'wait').find((x) => x[1].kinds.includes('cold') && K.temp < x[1].below);
  if (!r) return null;
  const h = locKind === 'wet' ? r[1].wet : r[1].dry; if (h == null) return null;
  return { kind: 'cold', min: h, max: h, plus: false, raw: locKind === 'wet' ? r[1].wetRaw : r[1].dryRaw, refs: [cite(pid, r, data.rules[pid])], distinct: false, at: { c: r[1].below } };
};

// ------------------------------------------------------------------ 3. matching "do not" rules to the constraints
const SUBTAG = { concrete: ['concrete'], 'screed-render': ['screed', 'render'], masonry: ['render'], 'cement-board': ['cement_board'], plasterboard: ['plasterboard'], 'timber-floor': ['cement_board'], 'existing-tiles': ['existing_tiles'], aac: ['aac'] };
const TILETAG = { porcelain: ['porcelain'], 'natural-stone': ['stone'], 'moisture-sensitive-stone': ['msstone', 'stone'], glass: ['glass'], 'large-format': ['large'], mosaic: ['mosaic'] };
/** The user's side of a rule's tags. Returns null when the rule does not apply to this job, otherwise the list of dimensions that matched (never empty). */
export function ruleApplies(tags, K, zone, v = {}, text = '') {
  const hit = [];
  // a caution is not a ban, and a rule about a special surface (steel trowelled, early aged, sealed, solvent coated) applies only when the customer said so
  if (text) {
    if (/\b(without|unless|except|provided|only (?:if|when)|if\b|may |can be)\b/i.test(text) && /\b(without|unless|except|provided)\b/i.test(text)) return null;
    if (/steel[- ]?trowel|power[- ]?float|burnish|non-?porous/i.test(text) && !K.flags.smooth) return null;
    if (/early[- ]ag|green (?:screed|concrete)/i.test(text) && !(K.flags.new || (K.age && K.age.hours < 24 * 28))) return null;
    if (/sealers? (?:previously )?applied|solvent[- ]based|resinous|coatings?\b|painted/i.test(text) && !K.flags.painted) return null;
    if (/highly porous|porous concrete/i.test(text)) return null;
    if (/totally confined|confined spaces?/i.test(text) && !K.flags.confined) return null;
  }
  if (v.size != null && !(K.size && K.size[0] > v.size)) return null; // "larger than N x N" needs a tile size above N
  if (v.height != null && !K.flags.heightHigh) return null; // "above N m" needs a height above N
  if (K.flags.direct && K.sub === 'timber-floor' && tags.substrate && tags.substrate.includes('timber')) { hit.push('substrate'); }
  const loc = zone && zone.loc; const lcl = loc ? locClass(loc) : null; const axis = loc ? axisOf(loc) : null;
  const sub = zone ? zone.sub : K.sub; const tile = zone ? zone.tile : K.tile;
  if (tags.substrate && !hit.includes('substrate')) { const mine = SUBTAG[sub] || []; if (!tags.substrate.some((x) => mine.includes(x)) && !(K.flags.smooth && tags.substrate.includes('concrete') && false)) return null; hit.push('substrate'); }
  if (tags.tile) { const mine = [...(TILETAG[tile] || []), ...(K.tiles || []).flatMap((t) => TILETAG[t] || [])]; if (!tags.tile.some((x) => mine.includes(x))) return null; hit.push('tile'); }
  if (tags.env) {
    const mine = []; if (loc === 'pool') mine.push('pool'); if (lcl === 'wet' && loc !== 'pool') mine.push(/wet/.test(loc) ? 'wet' : 'external'); if (/external/.test(loc || '')) mine.push('external'); if (/internal/.test(loc || '')) mine.push('internal');
    if (axis) mine.push(axis);
    const need = tags.env.filter((x) => !['floor', 'wall', 'internal'].includes(x));
    if (need.length && !need.some((x) => mine.includes(x))) return null;
    if (need.length) hit.push('env');
    else if (!tags.substrate && !tags.tile && !tags.cond) return null; // "floor" or "wall" alone is not a conflict
  }
  if (tags.cond) {
    const F = K.flags || {};
    const on = { hydrostatic: F.risingDamp, traffic: F.vehicular, uv: F.exposed, frost: false, chemical: F.chemical, moving: F.cracked && false, heated: F.heated };
    if (!tags.cond.some((x) => on[x])) return null; hit.push('cond');
  }
  return hit.length ? hit : null;
}

// ------------------------------------------------------------------ 4. assembling the plan
/** One zone's key parts, or null when the constraints are incomplete. */
export function zoneOf(K, loc) { return { tile: K.tile, sub: K.sub, loc, key: [K.tile, K.sub, loc].join('|') }; }

function sealantInfo(data, pid) {
  const r = rowsOf(data, pid, 'wait').find((x) => x[1].kinds.includes('skin') || x[1].kinds.includes('tack'));
  return r ? cite(pid, r, data.rules[pid]) : null;
}
const SVC = { dry: 'dry area', wet: 'wet area', submerged: 'submerged' };

/**
 * assemblePlan(K, data, zoneLoc): data = { sys, rules } where sys is rules/sys.json and rules maps product id -> { m, r } (rules/tile.json products).
 * Returns the plan object. The shape of the card made from it is documented at planCard() below.
 */
export function assemblePlan(K, data, loc) {
  const zone = zoneOf(K, loc); const sys = data.sys.systems[zone.key];
  const plan = { mode: 'plan', zone: { ...zone, tileLabel: TILE_LABEL[K.tile], subLabel: SUB_LABEL[K.sub], locLabel: LOC_LABEL[loc] }, K, steps: [], blockers: [], voids: [], checks: [], prereqs: [], joints: [], standards: [], notes: [], documents: [], alternatives: [], timeline: null, status: 'plan' };
  if (!sys) { plan.status = 'none'; plan.alternatives = alternativesFor(K, data, loc); return plan; }
  plan.system = { slug: sys[0], title: sys[1] };
  { const w = K.where || {}; if (w.floorAssumed) plan.notes.push({ k: 'assume', text: 'You did not say floor or wall. A room such as a hallway is a floor, so this is the floor system.' }); else if (!w.pool && !w.floor && !w.wall && (w.wet || w.external)) plan.notes.push({ k: 'assume', text: 'You did not say floor or wall, so the floor and the wall systems are both shown.' }); }
  const porous = POROUS.has(K.sub) ? true : NONPOROUS.has(K.sub) ? false : null; const axis = axisOf(loc); const lcl = locClass(loc);
  const ctx = { axis, porous };
  // the steps, with the options that survive the customer's constraints
  const byRole = {};
  for (const [role, stated, ids] of sys[2]) {
    const keep = [], out = [];
    for (const id of ids) {
      const m = data.rules[id]; if (!m) { keep.push(id); continue; }
      const hits = rowsOf(data, id, 'no').filter((r) => ruleApplies(r[1].tags, K, zone, r[1], r[2]));
      if (hits.length) out.push({ id, rule: cite(id, hits[0], m), more: hits.slice(1).map((h) => cite(id, h, m)) }); else keep.push(id);
    }
    byRole[role] = { role, stated: !!stated, ids, keep, out };
  }
  // timber: the published system is for the over-sheeted floor; the sheets that rule out fixing directly onto timber are quoted
  if (K.sub === 'timber-floor') {
    const direct = []; for (const [, , ids] of sys[2]) for (const id of ids) for (const r of rowsOf(data, id, 'no')) if (r[1].tags.substrate && r[1].tags.substrate.includes('timber')) direct.push(cite(id, r, data.rules[id]));
    plan.notes.push({ k: 'timber', text: 'The published timber system is for a timber or particleboard floor that has been over-sheeted. Tiling directly onto timber is ruled out by the data sheets quoted here.', cites: direct.slice(0, 3) });
    if (K.flags.direct && direct.length) plan.blockers.push({ why: 'Fixing tiles directly onto timber is ruled out by the data sheets of this system.', rules: direct.slice(0, 4), role: 'adhesive' });
  }
  for (const role of ROLE_ORDER) {
    const b = byRole[role]; if (!b) continue;
    const main = b.keep[0] || null; const mm = main ? data.rules[main] : null;
    plan.steps.push({ role, label: KIND_OF_ROLE[role], stated: b.stated, main: main ? { id: main, name: mm ? mm.m[0] : main, page: mm ? mm.m[1] : '', pds: mm ? mm.m[2] : '', sds: mm ? mm.m[3] : '', ed: mm ? mm.m[4] : '' } : null,
      alts: b.keep.slice(1).map((id) => ({ id, name: data.rules[id] ? data.rules[id].m[0] : id })), excluded: b.out, wait: null, waitSteps: [] });
  }
  // blockers: a step whose every named product is ruled out, or a rule that hits the whole job
  for (const st of plan.steps) {
    if (st.role === 'sealant' && st.stated && !st.main && st.excluded.length) { plan.notes.push({ k: 'sealant', text: 'Every sealant this system names is ruled out for your stone by its own data sheet. Ask Sika Technical Services which sealant to use.', cites: st.excluded.slice(0, 2).map((e) => e.rule) }); continue; }
    if (st.stated && !st.main && st.excluded.length) plan.blockers.push({ why: `Every product the published system names for "${st.label.toLowerCase()}" is ruled out by your conditions.`, rules: st.excluded.map((e) => e.rule), role: st.role });
  }
  // waits: the first option of each step whose own data sheet publishes every window the plan needs (the published order decides when several do)
  const stepOf = (r) => plan.steps.find((x) => x.role === r);
  const mainOf = (st) => (st && st.main ? st.main : null);
  const buildTl = () => {
    const tl = { parts: [], missing: [], coats: null };
    const need = (role, label, got, why) => { if (!got) tl.missing.push({ role, label, why }); return got; };
    const prime = stepOf('prime'), mem = stepOf('membrane'), adh = stepOf('adhesive'), grt = stepOf('grout'), sea = stepOf('sealant');
    for (const st of plan.steps) { st.wait = null; st.waitSteps = []; }
    if (mainOf(prime)) { prime.wait = pickWait(data, prime.main.id, ['cover', 'drying'], ctx); need('prime', 'Primer dry before the next layer (' + prime.main.name + ')', prime.wait, 'no waiting window is published for the primer'); if (prime.wait) tl.parts.push({ k: 'seq', label: 'Primer dry before the next layer', w: prime.wait, who: prime.main.name }); }
    if (mainOf(mem)) {
      const coats = rowsOf(data, mem.main.id, 'coats')[0]; const n = coats ? coats[1].min : null;
      const cw = pickWait(data, mem.main.id, ['coat'], ctx); const cv = pickWait(data, mem.main.id, ['cover'], ctx);
      mem.wait = cv; mem.waitSteps = [cw, cv].filter(Boolean);
      if (n == null) need('membrane', 'Number of membrane coats (' + mem.main.name + ')', null, 'the data sheet does not state a minimum number of coats');
      else { tl.coats = { n, ref: cite(mem.main.id, coats, data.rules[mem.main.id]) }; if (n > 1) { need('membrane', 'Wait between membrane coats (' + mem.main.name + ')', cw, 'no coat-to-coat window is published'); if (cw) tl.parts.push({ k: 'seq', label: 'Membrane wait between coats', w: cw, mult: n - 1, who: mem.main.name }); } }
      need('membrane', 'Membrane dry before tiling (' + mem.main.name + ')', cv, 'no ready-for-tiling window is published for the membrane'); if (cv) tl.parts.push({ k: 'seq', label: 'Membrane dry before tiling', w: cv, who: mem.main.name });
    }
    let aServ = null, gServ = null, gWait = null;
    if (mainOf(adh)) {
      gWait = need('adhesive', 'Adhesive set before grouting (' + adh.main.name + ')', pickWait(data, adh.main.id, ['grout'], ctx), 'no window before grouting is published for the adhesive'); adh.wait = gWait;
      const kinds = lcl === 'submerged' ? ['submerged'] : lcl === 'wet' ? ['wet'] : ['dry', 'service'];
      aServ = pickCold(data, adh.main.id, K, lcl) || pickWait(data, adh.main.id, kinds, ctx);
      need('adhesive', 'Adhesive return to ' + SVC[lcl] + ' service (' + adh.main.name + ')', aServ, 'the adhesive data sheet publishes no ' + SVC[lcl] + ' service window');
    }
    if (grt && !grt.main) need('grout', 'Grout (the published system names none for this combination)', null, 'no grout is named in the published system, so its cure window is not published');
    if (mainOf(grt)) {
      const own = pickWait(data, grt.main.id, ['grout'], ctx); // some grouts (epoxy) state their own wait before grouting; the longer of the two governs
      if (own && gWait && (own.min > gWait.min || own.max > gWait.max)) gWait = { ...gWait, min: Math.max(gWait.min, own.min), max: Math.max(gWait.max, own.max), raw: gWait.raw + ' / ' + own.raw, refs: [...gWait.refs, ...own.refs], distinct: true };
      const gk = lcl === 'submerged' ? ['submerged'] : lcl === 'wet' ? ['wet'] : ['dry', 'service', 'drying'];
      gServ = pickCold(data, grt.main.id, K, lcl) || pickWait(data, grt.main.id, gk, ctx);
      need('grout', 'Grout cure before ' + SVC[lcl] + ' service (' + grt.main.name + ')', gServ, 'the grout data sheet publishes no ' + SVC[lcl] + ' window');
      grt.wait = gServ;
    }
    if (mainOf(sea)) { const si = sealantInfo(data, sea.main.id); sea.wait = si ? { kind: 'skin', min: 0, max: 0, raw: '', refs: [si], info: true } : null; }
    if (aServ || gServ) tl.parts.push({ k: 'final', label: 'Return to ' + SVC[lcl] + ' service', a: aServ, g: gServ, gwait: gWait, who: [mainOf(adh) && adh.main.name, mainOf(grt) && grt.main.name].filter(Boolean).join(' and ') });
    return tl;
  };
  let tl = buildTl();
  for (const role of ['prime', 'membrane', 'adhesive', 'grout']) {
    const st = stepOf(role); if (!st || !st.main || !st.alts.length) continue;
    let best = { n: tl.missing.filter((m) => m.role === role).length, main: st.main, alts: st.alts };
    if (!best.n) continue;
    const opts = [st.main, ...st.alts.map((a) => ({ id: a.id, name: a.name, page: data.rules[a.id] ? data.rules[a.id].m[1] : '', pds: data.rules[a.id] ? data.rules[a.id].m[2] : '', sds: data.rules[a.id] ? data.rules[a.id].m[3] : '', ed: data.rules[a.id] ? data.rules[a.id].m[4] : '' }))];
    for (const o of opts.slice(1)) {
      st.main = o; st.alts = opts.filter((x) => x.id !== o.id).map((x) => ({ id: x.id, name: x.name }));
      const t2 = buildTl(); const n2 = t2.missing.filter((m) => m.role === role).length;
      if (n2 < best.n) { best = { n: n2, main: o, alts: st.alts }; if (!n2) break; }
    }
    st.main = best.main; st.alts = best.alts; tl = buildTl();
  }
  for (const r of ['prime', 'membrane']) { const st = stepOf(r); if (st && !st.main && !st.stated) plan.notes.push({ k: r === 'prime' ? 'noprime' : 'nomem', text: r === 'prime' ? 'The published system names no primer for this combination. The adhesive and membrane data sheets set the priming rules per substrate; the substrate requirements below quote them.' : 'The published system sheet names no waterproofing membrane for this combination. It does not say whether one is needed; ask Technical Services before you start.' }); }
  plan.timeline = scheduleOf(tl, K);
  // the lower-temperature note
  if (K.temp != null) {
    const seen = new Set(); const all = ['prime', 'membrane', 'adhesive', 'grout'].map(stepOf).filter((s) => s && s.main);
    for (const st of all) for (const r of rowsOf(data, st.main.id, 'tempnote')) { if (!seen.has(st.main.id)) { seen.add(st.main.id); plan.notes.push({ k: 'tempnote', cite: cite(st.main.id, r, data.rules[st.main.id]), text: `${st.main.name}: the data sheet says waiting times change with temperature.` }); } }
  }
  conditionsOf(plan, K, data, ctx, zone);
  return plan;
}

/** the timeline arithmetic. parts = [{ k:'seq', w, mult }, { k:'final', a, g, gwait }]. A total exists only when nothing is missing. */
export function scheduleOf(tl, K) {
  const out = { ok: false, min: null, max: null, plus: false, parts: [], missing: tl.missing, coats: tl.coats, basis: null };
  let sMin = 0, sMax = 0, plus = false;
  for (const p of tl.parts) {
    if (p.k === 'seq') { const m = p.mult || 1; sMin += p.w.min * m; sMax += p.w.max * m; plus = plus || !!p.w.plus; out.parts.push({ k: 'seq', label: p.label, who: p.who, min: p.w.min * m, max: p.w.max * m, plus: !!p.w.plus, raw: p.w.raw, mult: m, refs: p.w.refs, distinct: p.w.distinct }); }
    else if (p.k === 'final') {
      const a = p.a, g = p.g, gw = p.gwait;
      const gMin = g && gw ? gw.min + g.min : null, gMax = g && gw ? gw.max + g.max : null;
      const fin = { k: 'final', label: p.label, who: p.who, a, g, gwait: gw, refs: [...(a ? a.refs : []), ...(g ? g.refs : [])] };
      if (a && g && gw) { fin.min = Math.max(a.min, gMin); fin.max = Math.max(a.max, gMax); fin.basis = a.min >= gMin ? 'adhesive' : 'grout'; fin.plus = !!((a.plus && a.max === fin.max) || (g.plus && gMax === fin.max)); }
      else { fin.min = null; fin.max = null; }
      out.parts.push(fin);
      if (fin.min != null) { sMin += fin.min; sMax += fin.max; plus = plus || fin.plus; out.basis = fin.basis; }
    }
  }
  if (!tl.missing.length && out.parts.some((p) => p.k === 'final' && p.min != null)) { out.ok = true; out.min = round(sMin); out.max = round(sMax); out.plus = plus; }
  if (K && K.budget && out.ok) { const b = K.budget.hours; out.budget = { hours: b, verdict: out.min > b ? 'over' : out.max <= b && !out.plus ? 'fits' : 'maybe' }; }
  return out;
}
const round = (x) => Math.round(x * 1e6) / 1e6;
export const r1 = (x) => Math.round(x * 10) / 10;
/** a duration in hours as words: "30 minutes", "6 hours", "7 days" */
export function fmtH(h) { if (h < 1) return Math.round(h * 60) + ' minutes'; if (h < 48) return r1(h) + ' hours'; return r1(h / 24) + ' days'; }

// ------------------------------------------------------------------ 5. conditions, prerequisites, joints, standards
function conditionsOf(plan, K, data, ctx, zone) {
  const all = plan.steps.filter((s) => s.main).map((s) => s.main);
  // temperature window: the tightest published low and high across the steps, with the product that sets each
  let lo = null, hi = null; const tcites = [];
  for (const m of all) for (const kind of ['temp_air', 'temp_sub']) for (const r of rowsOf(data, m.id, kind)) {
    const c = cite(m.id, r, data.rules[m.id]);
    if (r[1].min != null && (!lo || r[1].min > lo.v)) lo = { v: r[1].min, c, kind }; if (r[1].max != null && (!hi || r[1].max < hi.v)) hi = { v: r[1].max, c, kind };
    tcites.push(c);
  }
  plan.window = { lo, hi };
  if (lo) plan.voids.push({ id: 'temp-lo', text: `Do not proceed below ${lo.v} °C: ${lo.c.name} sets the tightest published lower limit.`, num: lo.v, rule: lo.c });
  if (hi) plan.voids.push({ id: 'temp-hi', text: `Do not proceed above ${hi.v} °C: ${hi.c.name} sets the tightest published upper limit.`, num: hi.v, rule: hi.c });
  let hum = null; for (const m of all) for (const r of rowsOf(data, m.id, 'humidity')) if (!hum || r[1].max < hum.v) hum = { v: r[1].max, c: cite(m.id, r, data.rules[m.id]) };
  if (hum) plan.voids.push({ id: 'rh', text: `Relative humidity above ${hum.v} % is outside the published limit for ${hum.c.name}.`, num: hum.v, rule: hum.c });
  let dew = null; for (const m of all) for (const r of rowsOf(data, m.id, 'dew')) if (!dew || r[1].margin > dew.v) dew = { v: r[1].margin, c: cite(m.id, r, data.rules[m.id]) };
  if (dew) plan.voids.push({ id: 'dew', text: `The substrate must be at least ${dew.v} °C above the dew point: ${dew.c.name}.`, num: dew.v, rule: dew.c });
  for (const m of all) for (const r of rowsOf(data, m.id, 'moisture')) plan.voids.push({ id: 'moisture', text: `${m.name}: a published moisture limit applies to the substrate.`, rule: cite(m.id, r, data.rules[m.id]) });
  for (const m of all) for (const r of rowsOf(data, m.id, 'maxopen')) { plan.voids.push({ id: 'maxopen-' + m.id, text: `${m.name}: a primed surface has a published limit on how long it may stand before the next layer.`, rule: cite(m.id, r, data.rules[m.id]) }); break; }
  for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (/freeze|frost/i.test(r[2]) && r[1].tags.cond && r[1].tags.cond.includes('frost')) { plan.voids.push({ id: 'frost-' + m.id, text: `${m.name}: do not let it freeze.`, rule: cite(m.id, r, data.rules[m.id]) }); break; }
  // your conditions against those limits
  if (K.temp != null) {
    if (lo && K.temp < lo.v) plan.checks.push({ id: 'temp-lo', bad: true, text: `${K.temp} °C is below the published lower limit of ${lo.v} °C for ${lo.c.name}.`, rule: lo.c });
    if (hi && K.temp > hi.v) plan.checks.push({ id: 'temp-hi', bad: true, text: `${K.temp} °C is above the published upper limit of ${hi.v} °C for ${hi.c.name}.`, rule: hi.c });
    // any single product's limit that the temperature breaks, when the tightest one is not the cause
    for (const m of all) for (const kind of ['temp_air', 'temp_sub']) for (const r of rowsOf(data, m.id, kind)) { if ((r[1].min != null && K.temp < r[1].min && (!lo || K.temp >= lo.v)) || (r[1].max != null && K.temp > r[1].max && (!hi || K.temp <= hi.v))) plan.checks.push({ id: 'temp-' + m.id, bad: true, text: `${K.temp} °C is outside the published range for ${m.name}.`, rule: cite(m.id, r, data.rules[m.id]) }); }
  }
  if (K.rh != null && hum && K.rh > hum.v) plan.checks.push({ id: 'rh', bad: true, text: `${K.rh} % relative humidity is above the published limit of ${hum.v} % for ${hum.c.name}.`, rule: hum.c });
  // new substrate: the longest published cure age among the products in the system, for the customer's substrate
  const subKey = { concrete: 'concrete', 'screed-render': ['screed', 'render'], masonry: 'masonry', aac: null }[K.sub];
  if (subKey) {
    const keys = [].concat(subKey); let top = null; const ages = [];
    for (const m of all) for (const r of rowsOf(data, m.id, 'age')) if (keys.includes(r[1].sub)) { const c = cite(m.id, r, data.rules[m.id]); ages.push(c); if (r[1].hours != null && (!top || r[1].hours > top.v)) top = { v: r[1].hours, c }; }
    if (ages.length && top) {
      plan.prereqs.push({ id: 'age', text: `New ${keys.includes('concrete') ? 'concrete' : keys.includes('masonry') ? 'brick or blockwork render' : 'screed or render'} must have cured before these products go on. The longest published age in this system is set by ${top.c.name}.`, rule: top.c, ages });
      if (K.age && K.flags.new !== false && K.age.hours < top.v) plan.checks.push({ id: 'age', bad: true, text: `Your substrate is ${K.age.value} ${K.age.unit.replace(/s$/, '')}${K.age.value === 1 ? '' : 's'} old, below the published minimum for ${top.c.name}.`, rule: top.c, said: K.age.hours, need: top.v });
    }
  }
  if (K.age && K.sub === 'timber-floor') { /* an age has no published meaning for a timber floor */ }
  // prerequisites quoted from the substrate preparation clauses: dry, clean, sound, falls, cracks
  const seen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'prep')) {
    const want = (K.flags.damp && r[1].tags.includes('dry')) || (K.flags.contaminated && r[1].tags.includes('clean')) || (K.flags.cracked && r[1].tags.includes('crack')) || (K.flags.uneven && r[1].tags.includes('flat')) || (/wet/.test(zone.loc) && r[1].tags.includes('falls')) || (!seen.size && r[1].tags.includes('dry') && r[1].tags.includes('clean'));
    if (!want) continue; const key = r[2].slice(0, 50); if (seen.has(key)) continue; seen.add(key);
    plan.prereqs.push({ id: 'prep', text: m.name + ' substrate requirement.', rule: cite(m.id, r, data.rules[m.id]) });
    if (plan.prereqs.length > 8) break;
  }
  if (K.flags.damp) { const r = all.map((m) => rowsOf(data, m.id, 'prep').find((x) => x[1].tags.includes('dry') && /dry/i.test(x[2])) && { m, r: rowsOf(data, m.id, 'prep').find((x) => x[1].tags.includes('dry')) }).find(Boolean); if (r) plan.checks.push({ id: 'damp', bad: true, text: `You describe the substrate as damp. ${r.m.name} requires it dry before it goes on.`, rule: cite(r.m.id, r.r, data.rules[r.m.id]) }); }
  if (K.flags.risingDamp) {
    const hits = []; for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (r[1].tags.cond && r[1].tags.cond.includes('hydrostatic')) hits.push(cite(m.id, r, data.rules[m.id]));
    if (hits.length) plan.blockers.push({ why: 'Rising damp or negative hydrostatic pressure is named as a no-go in the data sheets of this system.', rules: hits, role: 'membrane' });
  }
  if (K.flags.hotWindy) for (const m of all) { const r = rowsOf(data, m.id, 'no').find((x) => /windy/i.test(x[2])); if (r) { plan.checks.push({ id: 'hotwindy', bad: false, text: `${m.name} names hot windy conditions in its limitations.`, rule: cite(m.id, r, data.rules[m.id]) }); break; } }
  if (K.flags.heated) { const hits = []; for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (r[1].tags.cond && r[1].tags.cond.includes('heated')) hits.push(cite(m.id, r, data.rules[m.id])); if (hits.length) plan.checks.push({ id: 'heated', bad: true, text: 'A product in the published system is not suitable over heated substrates.', rule: hits[0] }); }
  if (K.size && K.size[0] >= 600 && K.size[1] > 600) { for (const m of all) { const lf = rowsOf(data, m.id, 'lf')[0]; if (lf) { plan.prereqs.push({ id: 'lf', text: `Tiles of this size are large format by the published wording. ${m.name} states the flatness the substrate needs.`, rule: cite(m.id, lf, data.rules[m.id]) }); break; } } }
  // movement joints and bond breaker, as the documents word them
  const jseen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'joint')) { const key = r[2].slice(0, 60); if (jseen.has(key)) continue; jseen.add(key); plan.joints.push(cite(m.id, r, data.rules[m.id])); }
  plan.joints = plan.joints.filter((j) => /movement|expansion|control|bond|backing|perimeter/i.test(j.q) && !/^(not suitable|do not (?:apply|use) \w+( \w+)* in movement)/i.test(j.q)).slice(0, 6);
  // standards, as the documents name them
  const sseen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'std')) { const key = r[1].name.replace(/\s+/g, '').toLowerCase(); if (!/^(as|as\/nz|as iso)/i.test(r[1].name)) continue; if (sseen.has(key)) continue; sseen.add(key); plan.standards.push(cite(m.id, r, data.rules[m.id])); }
  plan.standards = plan.standards.slice(0, 8);
  // trade-offs for the conflict outcome
  if (plan.checks.some((c) => c.bad) && plan.status === 'plan') plan.status = 'void';
  if (plan.blockers.length) plan.status = 'blocked';
  // documents to hand to the tiler
  const doc = new Map();
  doc.set('systems/' + plan.system.slug + '/', { label: 'System sheet: ' + plan.system.title, url: 'systems/' + plan.system.slug + '/' });
  for (const s of plan.steps) if (s.main) { if (s.main.pds) doc.set(s.main.pds, { label: 'Data sheet: ' + s.main.name, url: s.main.pds }); if (s.main.sds) doc.set(s.main.sds, { label: 'Safety data sheet: ' + s.main.name, url: s.main.sds }); }
  plan.documents = [...doc.values()];
}

/** Published alternatives when there is no system for the combination: same tile and location on another substrate, or same substrate and tile at another location. */
export function alternativesFor(K, data, loc) {
  const out = [];
  for (const key of Object.keys(data.sys.systems)) {
    const [t, s, l] = key.split('|');
    if (t === K.tile && l === loc && s !== K.sub) out.push({ key, via: 'substrate', slug: data.sys.systems[key][0], title: data.sys.systems[key][1] });
  }
  const same = out.length ? out : Object.keys(data.sys.systems).filter((key) => { const [t, s] = key.split('|'); return t === K.tile && s === K.sub; }).map((key) => ({ key, via: 'location', slug: data.sys.systems[key][0], title: data.sys.systems[key][1] }));
  return same.slice(0, 8);
}

// ------------------------------------------------------------------ 5b. the plan card (kept here, not in cards.js, so the actions chunk does not carry it)
// ---------------------------------------------------------------- lane D: the plan card (added; nothing above is changed)
// A "plan" card is the engineer's answer: an ordered table of steps with the product, the published wait and the page for each, then lines for the
// timeline, the conditions that void the plan, the prerequisites, the joints and the standards. Every line that states a rule is a published sentence
// (a fact); every derived number (a sum of waits, a time budget) is recomputable from card.plan.timeline, which props check independently.
//   card.plan = { v, mode:'plan'|'rule'|'refusal', status:'plan'|'void'|'blocked'|'none', zone, K (constraints read), steps:[{ role, label, product, wait }],
//                 timeline:{ ok, min, max, plus, parts:[{ k, raw, mult, min, max }], missing:[] , budget }, commit:{...} (what "Add the plan to my project" saves) }
const R1 = (x) => Math.round(x * 10) / 10;
export const fmtHours = (h) => (h < 1 ? Math.round(h * 60) + ' minutes' : h < 48 ? R1(h) + ' hours' : R1(h / 24) + ' days');
const cleanQ = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const clampN = (t, n = 270) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
/** a fact from a rule citation { name, ed, url, q, p, c } */
export const citeFact = (c) => fact({ source_url: c.url, page: c.p == null ? null : c.p, sentence: cleanQ(c.q), doc_type: 'PDS', doc_version: (c.ed || '') + (c.c ? ', clause ' + c.c : '') });
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
export function planCard(plan, { area = null } = {}) {
  const facts = []; const seen = new Map(); const names = new Set();
  const use = (c) => { if (!c || !c.q) return; names.add(c.name); const k = c.url + '|' + c.p + '|' + c.q; if (!seen.has(k)) { seen.set(k, facts.length); facts.push(citeFact(c)); } };
  const pageOf = (c) => (c && c.p != null ? ', page ' + c.p : '');
  const waitText = (w) => (w ? w.raw + (w.plus ? ' or more' : '') + (w.distinct ? ' (the sheets give more than one figure; the longer is used)' : '') : 'Not published');
  const rows = [], lines = []; const blocked = plan.status === 'blocked';
  const z = plan.zone; const K = plan.K; let n = 1;
  const nameList = (st) => st.main ? st.main.name + (st.alts.length ? '. Also named: ' + st.alts.map((a) => a.name).join(', ') : '') : (st.stated ? 'Every named product is ruled out' : 'Not in the published documentation');
  // 1 prepare
  const age = blocked ? null : plan.prereqs.find((p) => p.id === 'age');
  if (age) use(age.rule);
  rows.push([`${ORD[n++]}: Prepare the substrate`, 'See the requirements below', age ? clampN(age.rule.q, 120) : 'No waiting window is published for this step', age ? age.rule.name + pageOf(age.rule) : 'Data sheets of this system']);
  for (const st of blocked ? [] : plan.steps) {
    if (st.role === 'sealant') continue;
    if (st.role === 'adhesive') rows.push([`${ORD[n++]}: Mark out the movement joints and bond breaker`, 'Before the adhesive goes on', plan.joints.length ? 'See the joint statements below' : 'Not published for this system', plan.joints.length ? plan.joints[0].name + pageOf(plan.joints[0]) : 'Not published']);
    const refs = [];
    let wcell = 'Not published', src = 'Not published';
    if (st.role === 'membrane' && st.main) {
      const co = plan.timeline && plan.timeline.coats;
      const cw = st.waitSteps[0] && st.waitSteps.length === 2 ? st.waitSteps[0] : null;
      if (co) { use(co.ref); const nd = new RegExp('(^|[^0-9.])' + co.n + '([^0-9]|$)').test(co.ref.q) ? String(co.n) : WORDS[co.n] || String(co.n); wcell = nd + ' coats'; refs.push(co.ref); }
      if (cw) { wcell += (wcell ? '. ' : '') + 'Between coats: ' + waitText(cw); refs.push(...cw.refs); }
      if (st.wait) { wcell += (wcell ? '. ' : '') + 'Before tiling: ' + waitText(st.wait); refs.push(...st.wait.refs); }
      if (!cw && !st.wait) wcell = 'Not published';
    } else if (st.wait && !st.wait.info) { wcell = (st.role === 'prime' ? 'Dry before the next layer: ' : st.role === 'adhesive' ? 'Before grouting: ' : st.role === 'grout' ? 'Before service: ' : '') + waitText(st.wait); refs.push(...st.wait.refs); }
    if (st.role === 'adhesive' && plan.timeline) { const fin = plan.timeline.parts.find((p) => p.k === 'final'); if (fin && fin.a) { wcell += '. Return to service: ' + waitText(fin.a); refs.push(...fin.a.refs); } }
    if (st.role === 'grout' && plan.timeline) { const fin = plan.timeline.parts.find((p) => p.k === 'final'); if (fin && fin.g) { wcell = 'Cure: ' + waitText(fin.g); refs.length = 0; refs.push(...fin.g.refs); } }
    for (const r of refs) use(r);
    src = refs.length ? [...new Set(refs.map((r) => r.name + pageOf(r)))].slice(0, 2).join('; ') : (st.main ? 'Not published' : '');
    rows.push([`${ORD[n++]}: ${st.label}`, nameList(st), clampN(wcell, 250), clampN(src, 200)]);
    if (st.role === 'grout') {
      const sea = plan.steps.find((x) => x.role === 'sealant');
      if (sea) { const info = sea.wait && sea.wait.refs && sea.wait.refs[0]; if (info) use(info); rows.push([`${ORD[n++]}: Seal the movement joints and perimeters`, nameList(sea), info ? 'Published: ' + clampN(info.q, 110) : 'Not published', info ? info.name + pageOf(info) : 'Not published']); }
    }
  }
  for (const st of plan.steps) for (const ex of st.excluded) { use(ex.rule); lines.push({ label: 'Ruled out for this job: ' + (ex.rule.name), text: clampN(ex.rule.q, 250) }); }
  for (const b of plan.blockers) { for (const r of b.rules) use(r); lines.push({ label: 'Blocked', text: clampN(b.why + ' ' + b.rules.slice(0, 2).map((r) => r.name + pageOf(r)).join('; '), 270) }); }
  for (const c of plan.checks) { use(c.rule); lines.push({ label: 'Your conditions', text: clampN(c.text + ' ' + c.rule.name + pageOf(c.rule), 270) }); }
  for (const nt of plan.notes.filter((x, i, a) => x.k !== 'tempnote' || a.findIndex((y) => y.k === 'tempnote') === i)) { for (const cc of nt.cites || (nt.cite ? [nt.cite] : [])) use(cc); lines.push({ label: nt.k === 'timber' ? 'Timber' : nt.k === 'tempnote' ? 'Temperature and waiting times' : nt.k === 'assume' ? 'Assumption' : 'Note', text: clampN(nt.text + ((nt.cites || (nt.cite ? [nt.cite] : [])).length ? ' ' + (nt.cites || [nt.cite]).slice(0, 2).map((r) => r.name + pageOf(r)).join('; ') : ''), 270) }); }
  // timeline
  const tl = plan.timeline; const showTl = tl && plan.status !== 'blocked';
  if (showTl) {
    for (const p of tl.parts) for (const r of (p.refs || [])) use(r);
    if (tl.ok) {
      lines.push({ label: 'Earliest finish', text: `${tl.plus ? 'At least ' : ''}${fmtHours(tl.min)} after you start, adding the published windows in the table (in hours: ${R1(tl.min)}). The sheets measured these in the laboratory, so a cooler or more humid site is slower.` });
      if (tl.max !== tl.min) lines.push({ label: 'Latest published', text: `${tl.plus ? 'At least ' : ''}${fmtHours(tl.max)} (in hours: ${R1(tl.max)}), using the top of every published range.` });
      if (tl.basis) lines.push({ label: 'Longest path to service', text: tl.basis === 'adhesive' ? 'The adhesive return-to-service window governs the end of the job.' : 'The grout wait plus the grout cure governs the end of the job.' });
      if (tl.budget) lines.push({ label: 'Your time', text: `${fmtHours(tl.budget.hours)} available (in hours: ${R1(tl.budget.hours)}). ${tl.budget.verdict === 'over' ? 'The earliest published finish is longer than that, so it does not fit.' : tl.budget.verdict === 'fits' ? 'Even the longest published windows fit.' : 'The earliest published finish fits, the longest published windows may not.'}` });
    } else {
      lines.push({ label: 'Earliest finish', text: 'Not published, so there is no total. A total is shown only when every waiting window it needs is in the data sheets.' });
      for (const m of tl.missing.slice(0, 5)) lines.push({ label: 'Missing window', text: clampN(m.label + ': ' + m.why + '. Ask Sika Technical Services.', 270) });
    }
  }
  for (const v of blocked ? [] : plan.voids.slice(0, 6)) { use(v.rule); lines.push({ label: 'Plan is void if', text: clampN(v.id === 'moisture' || /^maxopen/.test(v.id) ? v.rule.name + ': ' + v.rule.q : v.text, 250) }); }
  for (const p of blocked ? [] : plan.prereqs) { if (p.id === 'age') { for (const a of (p.ages || []).slice(0, 4)) use(a); lines.push({ label: 'Cure age', text: clampN(p.text + ' ' + (p.ages || []).slice(0, 3).map((a) => a.name + pageOf(a)).join('; '), 270) }); } else { use(p.rule); lines.push({ label: 'Substrate', text: clampN(p.text + ' ' + p.rule.name + pageOf(p.rule), 270) }); } }
  for (const j of blocked ? [] : plan.joints.slice(0, 4)) { use(j); lines.push({ label: 'Joints: ' + j.name, text: clampN(j.q, 250) }); }
  for (const st of blocked ? [] : plan.standards.slice(0, 5)) { use(st); lines.push({ label: 'Standard named', text: clampN(`${st.v.name}, named in the ${st.name} data sheet${pageOf(st)}.`, 250) }); }
  if (plan.alternatives && plan.alternatives.length) lines.push({ label: 'Published alternatives', text: clampN(plan.alternatives.slice(0, 4).map((a) => a.title).join('; '), 270) });
  if (area && !blocked) lines.push({ label: 'Quantities', text: `For ${area} m2 the calculation cards below use each product's published rate. Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.` });
  if (blocked) {
    const way = plan.blockers.some((b) => /directly onto timber/.test(b.why)) ? 'The published timber system is for a floor that has been over-sheeted. Over-sheet it as the sheets describe and ask again.' : plan.alternatives && plan.alternatives.length ? 'The published systems linked below do exist.' : 'Please ask Sika Technical Services how to proceed.';
    lines.splice(0, lines.length, ...lines.filter((l) => /^(Blocked|Ruled out|Timber|Note|Your conditions|Published alternatives)/.test(l.label)), { label: 'Way forward', text: way });
    rows.length = 0;
  }
  const title = `Plan: ${z.tileLabel} on ${z.subLabel}, ${z.locLabel}`;
  const headline = plan.status === 'blocked' ? 'This job is blocked by the published rules below. I will not give a plan that the data sheets rule out.' : plan.status === 'void' ? 'As described, this plan is void: a published limit is broken. The steps are what the documents publish once that is put right.' : 'The published system as an ordered plan. Each step names its product, the published wait and the data sheet page it comes from.';
  const links = plan.documents.map((d) => ({ label: d.label, url: d.url }));
  const commit = { title: plan.system.title, slug: plan.system.slug, env: z.loc, tile: z.tile, substrate: z.sub, steps: Object.fromEntries(plan.steps.filter((s) => s.main).map((s) => [s.role, [s.main.id, ...s.alts.map((a) => a.id)]])), documents: links.filter((l) => /^https?:/.test(l.url)).map((l) => ({ title: l.label, url: l.url })), note: clampN(`Plan: ${z.tileLabel} on ${z.subLabel}, ${z.locLabel}. ` + (tl && tl.ok ? `Earliest finish ${fmtHours(tl.min)}.` : 'Earliest finish not published.'), 400) };
  const c = card({ type: 'plan', status: facts.length ? 'PUBLISHED' : 'UNKNOWN', title, headline, lines: lines.slice(0, 40), facts, table: rows.length ? { cols: ['Step', 'Product', 'Wait before the next step', 'Source'], rows } : null, chip: CHIPS.DATASHEET, links,
    followups: blocked ? (plan.blockers.some((b) => /directly onto timber/.test(b.why)) ? [`Plan for ${z.tileLabel} on an over-sheeted timber floor, ${z.locLabel}`] : ['Ask Technical Services']) : ['Add the plan to my project', ...(area ? [] : ['How much for 20 m2'])].slice(0, 3),
    handoff: facts.length ? null : { question: title, reason: 'No published rule row was found for this combination.', missing: ['plan'] } });
  c.plan = { v: 1, mode: 'plan', status: plan.status, names: [...names], zone: z, K: { ...K, raw: K.raw }, steps: plan.steps.map((s) => ({ role: s.role, label: s.label, product: s.main ? { id: s.main.id, name: s.main.name } : null, alts: s.alts, excluded: s.excluded.map((e) => ({ id: e.id, name: e.rule.name })) })), timeline: tl ? { ok: tl.ok, min: tl.min, max: tl.max, plus: tl.plus, basis: tl.basis, missing: tl.missing.map((m) => m.label), budget: tl.budget || null, coats: tl.coats ? tl.coats.n : null, parts: tl.parts.map((p) => p.k === 'seq' ? { k: 'seq', raw: p.raw, mult: p.mult, min: p.min, max: p.max, plus: p.plus } : { k: 'final', a: p.a ? { raw: p.a.raw, min: p.a.min, max: p.a.max, plus: p.a.plus } : null, g: p.g ? { raw: p.g.raw, min: p.g.min, max: p.g.max, plus: p.g.plus } : null, w: p.gwait ? { raw: p.gwait.raw, min: p.gwait.min, max: p.gwait.max } : null, min: p.min, max: p.max }) } : null, commit };
  return c;
}
/** A cited list card for rule answers and refusals: items = [{ label, text, cite }]; status UNKNOWN (with a hand-off) when no item carries a published sentence. */
export function rulesCard({ title, headline, items = [], links = [], followups = [], question = '', reason = '', plan = null, missing = [] }) {
  const facts = []; const seen = new Set(); const lines = [];
  const names = [];
  for (const it of items) { if (it.cite && it.cite.name) names.push(it.cite.name); if (it.cite && it.cite.q) { const k = it.cite.url + '|' + it.cite.p + '|' + it.cite.q; if (!seen.has(k)) { seen.add(k); facts.push(citeFact(it.cite)); } } lines.push({ label: it.label, text: clampN(it.text, 270) }); }
  const pub = facts.length > 0;
  const c = card({ type: 'plan', status: pub ? 'PUBLISHED' : 'UNKNOWN', title, headline, lines: lines.slice(0, 30), facts, chip: pub ? CHIPS.DATASHEET : CHIPS.UNKNOWN, links, followups, handoff: pub ? null : { question: question || title, reason: reason || NOT_KNOWN, missing } });
  if (!pub) c.headline = headline || NOT_KNOWN;
  c.plan = plan || { v: 1, mode: pub ? 'rule' : 'refusal', status: pub ? 'plan' : 'none', names: [...new Set(names)] };
  return c;
}

// ------------------------------------------------------------------ 6. refusals and referrals (the traps)
const COMPLY_RX = /\b(complian\w*|comply|complies|meets? (?:the |all )?(?:building )?(?:codes?|standards?|regulations?)|get certified|certif(?:y|ied|ication)|pass(?:es)? (?:the |an? |a )?(?:council )?(?:inspection|certification)|certifier|building (?:inspector|surveyor|permit|approval)|signed off|sign off|licen[cs]\w*|liab\w*|insur\w*|legal(?:ly)?|\bncc\b|\bbca\b|code of practice|council approval|engineer'?s? (?:certificate|sign))\b/;
const GUARANTEE_RX = /\b(guarantee\w*|definitely work|never (?:fail|leak)|promise|certain|for sure|10 years?|ten years?|lifetime|ensure me|make sure it|won't (?:crack|leak|fail|lift)|never (?:crack|lift|come off))\b|100 ?%/;
const STRUCT_RX = /\b(structural|load[- ]bearing|deflect\w*|span\b|joists?|bearers?|truss|beam|engineers?|engineer's|asbestos|lead paint|mould remediation|mold remediation|sagging|settlement)\b/;
const OFFTOPIC_RX = /\b(sauna|steam room|hammam|kiln|furnace|fireplace|hearth|freezer|cool ?room|cold ?room|commercial kitchen|abattoir|chemical plant|laboratory|nuclear|aquarium|fish tank|helipad|runway)\b/;
const PRICE_RX = /\b(price|prices|cost|costs|charge|charges|how much (?:is|does|will)|quote|cheapest|discount|stockist|in stock|warranty|labour|labor)\b/;
const TRAP_REASON = {
  comply: 'Whether a job meets a building code or passes an inspection is decided by the certifier and the licensed installer, not by a data sheet. I can show the standards the data sheets name and the rules they set. Please confirm compliance with Sika Technical Services and your certifier.',
  guarantee: 'I cannot promise that a job will work or give a guarantee. I can show what the published data sheets require and where a requirement is not published. Warranty terms are decided by Sika Australia.',
  struct: 'Structural questions, hazardous materials and the condition of the building are outside the published product documentation. Please ask a structural engineer or Sika Technical Services.',
  offtopic: 'The published tile system data does not cover this kind of space or exposure, so I will not guess a plan. Please ask Sika Technical Services.',
  unsupported: 'The published tile system data covers concrete, cement screed or render, brick or blockwork, fibre cement sheet, plasterboard, over-sheeted timber, existing tiles and AAC. This surface is not one of them, so I will not guess a plan. Please ask Sika Technical Services.',
};
function trap(q, K) {
  const s = lc(q);
  if (COMPLY_RX.test(s) && !/\bwhich standards?\b|\bwhat standards?\b|\bstandards? (?:does|do|is|are)\b|\bname[sd]? (?:in|by)\b/.test(s)) return 'comply';
  if (GUARANTEE_RX.test(s) && /\b(will|can you|guarantee|promise|sure|certain)\b/.test(s)) return 'guarantee';
  if (STRUCT_RX.test(s)) return 'struct';
  if (OFFTOPIC_RX.test(s) || K.flags.steam || K.where.commercialKitchen) return 'offtopic';
  if (K.unsupported && K.unsupported.length) return 'unsupported';
  return null;
}
const TOPIC_LABEL = { open: 'How long it may stand before the next layer', age: 'Cure age', temp: 'Temperature limits', humidity: 'Humidity and dew point', moisture: 'Substrate moisture', thickness: 'Thickness and coats', standard: 'Standards named', joint: 'Joints and bond breaker', primer: 'Primer by substrate', wait: 'Waiting windows', mix: 'Mixing', lf: 'Large format tiles' };
const KINDS_OF = { open: ['maxopen'], age: ['age'], temp: ['temp_air', 'temp_sub'], humidity: ['humidity', 'dew'], moisture: ['moisture'], thickness: ['layer', 'coats'], standard: ['std'], joint: ['joint'], primer: ['primer'], wait: ['wait'], mix: ['mix'], lf: ['lf'] };
const SUBWORD = { concrete: /concrete/i, 'screed-render': /screed|render/i, masonry: /brick|block|render/i, 'cement-board': /cement|fibre|sheet|board/i, plasterboard: /plaster/i, 'timber-floor': /timber|ply|particle/i, 'existing-tiles': /tile/i, aac: /aac|autoclaved/i };

/** rule rows of the products asked about (or of the system's products), for the topics asked about */
function ruleItems(topics, entries, K) {
  const items = [];
  for (const { id, e } of entries) {
    if (!e) continue; const meta = { m: e.m };
    for (const t of topics) {
      let rows = e.r.filter((r) => KINDS_OF[t].includes(r[0]));
      if (t === 'age' && K.sub && SUBWORD[K.sub]) { const keep = rows.filter((r) => (K.sub === 'concrete' ? r[1].sub === 'concrete' : K.sub === 'screed-render' ? ['screed', 'render'].includes(r[1].sub) : K.sub === 'masonry' ? ['masonry', 'render'].includes(r[1].sub) : true)); rows = keep; }
      if (t === 'primer' && K.sub && SUBWORD[K.sub]) { const keep = rows.filter((r) => SUBWORD[K.sub].test(r[1].sub)); if (keep.length) rows = keep; }
      if (t === 'standard') rows = rows.filter((r) => /^(as|as\/nz|as iso)/i.test(r[1].name));
      if (t === 'wait') { const kinds = []; const sq = lc(K.raw[K.raw.length - 1] || ''); if (/grout/.test(sq)) kinds.push('grout'); if (/tiling|tile\b/.test(sq) && /ready|before|wait/.test(sq)) kinds.push('cover'); if (/coat/.test(sq)) kinds.push('coat'); if (/wet area|wet/.test(sq)) kinds.push('wet'); if (/dry area/.test(sq)) kinds.push('dry'); if (/submerged|pool|fill/.test(sq)) kinds.push('submerged'); if (/flood/.test(sq)) kinds.push('flood'); if (/walk|foot|traffic/.test(sq)) kinds.push('light'); if (kinds.length) { const keep = rows.filter((r) => r[1].kinds.some((k) => kinds.includes(k))); if (keep.length) rows = keep; } rows = rows.filter((r) => !r[1].kinds.includes('cold')); }
      if (t === 'temp' && !rows.length) continue;
      const seen = new Set();
      for (const r of rows) { const key = t === 'standard' ? r[1].name : r[2].slice(0, 70); if (seen.has(key)) continue; seen.add(key); if (seen.size > (t === 'standard' ? 6 : 3)) break; items.push({ label: `${e.m[0]}: ${TOPIC_LABEL[t]}`, text: r[2], cite: cite(id, r, meta) }); }
    }
  }
  return items;
}

// ------------------------------------------------------------------ 7. the answer
export function createRules({ load }) {
  let sysP = null, tileP = null;
  const dataP = async () => {
    sysP = sysP || load.ruleShard('sys'); tileP = tileP || load.ruleShard('tile');
    const [sys, tile] = await Promise.all([sysP, tileP]); if (!sys || !tile) return null;
    return { sys, rules: tile.products };
  };
  const otherP = {};
  const entryOf = async (data, id) => {
    if (data.rules[id]) return data.rules[id];
    const idx = await load.ruleShard('idx'); if (!idx || idx.idx[id] == null) return null;
    const n = idx.idx[id]; otherP[n] = otherP[n] || load.ruleShard('o' + n); const sh = await otherP[n]; return sh && sh.products[id] ? sh.products[id] : null;
  };
  const ask = (K, q) => {
    const have = []; if (!K.tile) have.push(['tile', ['porcelain', 'ceramic', 'natural stone', 'glass or mosaic'], 'Which tile is it?']);
    if (!K.sub) have.push(['substrate', ['concrete', 'cement sheet', 'plasterboard', 'timber floor'], 'What are you tiling onto?']);
    if (!zonesOf(K).length) have.push(['location', ['an internal floor', 'a bathroom floor', 'an external floor', 'an internal wall'], 'Where is it, and is it a floor or a wall?']);
    const first = have[0];
    return { intent: 'plan', cards: [C.chooseCard(first[2], 'To give a cited plan I need ' + have.map((h) => h[0]).join(', ') + '. Pick one to continue, or type it.', first[1].map((o) => `${q.replace(/[?.!]+$/, '')} (${first[0]}: ${o})`), [], first[1])], state: { plan: K } };
  };
  async function plansFor(K, data) {
    const out = [];
    for (const loc of zonesOf(K)) out.push(assemblePlan(K, data, loc));
    return out;
  }
  /** Returns { intent, cards, state } or null when this message is not for this module. */
  async function handle(q, { state = null, productIds = [], hasProduct = false, text = null } = {}) {
    const t = text == null ? q : text;
    let prior = KEEP_OWN_STATE && state && state.plan ? state.plan : null;
    if (prior && dimsOf(parseConstraints(t)) >= 3) prior = null; // a whole new job starts fresh // text = the question with the product names cut out (a product name is not a constraint)
    const K = parseConstraints(t, prior);
    let kind = classifyAsk(t, K, { hasProduct, prior, own: prior ? parseConstraints(t) : null });
    const why = trap(t, K);
    if (!kind && why && dimsOf(K) >= 2) kind = 'plan';
    if (!kind && dimsOf(K) >= 2 && PRICE_RX.test(lc(t))) return { intent: 'price', cards: [C.unknown(q, null, 'Prices, labour rates, stock and warranty terms are not in the documentation I work from, and I will not guess them. Please ask Sika Australia or a stockist.', ['price, stock or warranty'])], state: { plan: K } };
    if (!kind) return null;
    if (why) return { intent: 'plan', cards: [C.unknown(q, null, TRAP_REASON[why], [why === 'comply' ? 'a compliance ruling' : why === 'guarantee' ? 'a guarantee' : why === 'struct' ? 'structural advice' : 'this surface or space'], { followups: ['What does the data sheet say about the substrate', 'Ask Technical Services'] })], state: { plan: K } };
    const data = await dataP(); if (!data) return null;
    // a rule question about named products
    if (kind === 'rule') {
      let topics = ruleTopics(t); if (topics.includes('standard') && /\bstandards?\b|\bas ?\d|\bcited?\b|\bnamed?\b/.test(lc(t))) topics = ['standard'];
      if (hasProduct && productIds.length) {
        const entries = []; for (const id of productIds.slice(0, 3)) entries.push({ id, e: await entryOf(data, id) });
        const items = ruleItems(topics.filter((t) => KINDS_OF[t]), entries, K);
        if (!items.length) return { intent: 'rule', cards: [C.unknown(q, null, 'The published specification of ' + entries.map((x) => (x.e ? x.e.m[0] : x.id)).join(' and ') + ' does not state this rule. I will not guess. Please ask Sika Technical Services.', ['published rule'])], state: { plan: K } };
        const docs = entries.filter((x) => x.e).map((x) => ({ label: 'Data sheet: ' + x.e.m[0], url: x.e.m[2] })).filter((d) => d.url);
        return { intent: 'rule', cards: [rulesCard({ title: 'What the data sheet says', headline: 'The published rule, quoted as the data sheet words it, with its data sheet edition and page.', items, links: docs, question: q })], state: { plan: K } };
      }
      if (!K.tile || !K.sub || !zonesOf(K).length) return ask(K, q);
      const plans = await plansFor(K, data); const pl = plans.find((p) => p.status !== 'none');
      if (!pl) return null;
      const entries = pl.steps.filter((x) => x.main).map((x) => ({ id: x.main.id, e: data.rules[x.main.id] }));
      const items = ruleItems(topics.filter((t) => KINDS_OF[t]), entries, K);
      if (!items.length) return { intent: 'rule', cards: [C.unknown(q, null, 'The published specification of the products in this system does not state this rule. I will not guess. Please ask Sika Technical Services.', ['published rule'])], state: { plan: K } };
      return { intent: 'rule', cards: [rulesCard({ title: `What the data sheets of this system say: ${pl.zone.tileLabel} on ${pl.zone.subLabel}, ${pl.zone.locLabel}`, headline: 'The published rule for each product the system names, quoted as the data sheet words it. Where two products differ, both are shown.', items, links: pl.documents, question: q })], state: { plan: K } };
    }
    // a plan
    if (!K.tile || !K.sub || !zonesOf(K).length) return ask(K, q);
    if (K.tile === 'moisture-sensitive-stone') {
      const items = []; for (const [id, e] of Object.entries(data.rules)) for (const r of e.r) if (r[0] === 'no' && r[1].tags.tile && r[1].tags.tile.includes('msstone') && items.length < 4 && !items.some((x) => x.cite.pid === id)) items.push({ label: e.m[0], text: r[2], cite: cite(id, r, e) });
      const c = rulesCard({ title: 'Moisture sensitive stone', headline: 'The published tile systems do not include moisture sensitive stone, and the data sheets below rule their adhesives out for it. Please ask Sika Technical Services for this job.', items, followups: ['Ask Technical Services'], question: q });
      c.plan = { ...c.plan, mode: 'refusal', status: 'blocked' };
      return { intent: 'plan', cards: [c], state: { plan: K } };
    }
    const plans = await plansFor(K, data); const cards = [];
    for (const pl of plans) {
      if (K.flags.vehicular) { const hits = []; for (const [id, e] of Object.entries(data.rules)) for (const r of e.r) if (r[0] === 'no' && r[1].tags.cond && r[1].tags.cond.includes('traffic')) hits.push(cite(id, r, e)); if (hits.length) { pl.blockers.push({ why: 'Vehicular and heavy duty traffic are named as outside the published system data.', rules: hits.slice(0, 3), role: 'adhesive' }); pl.status = 'blocked'; } }
      if (pl.status === 'none') {
        const alt = pl.alternatives;
        cards.push(C.unknown(q, null, `The published documentation has no system for ${TILE_LABEL[K.tile]} on ${SUB_LABEL[K.sub]}, ${LOC_LABEL[pl.zone.loc]}. ` + (alt.length ? 'Published systems that do exist are linked below. ' : '') + 'Please ask Sika Technical Services.', ['system for this combination'], { followups: alt.slice(0, 3).map((a) => 'What is the full system for ' + a.title) }));
        if (alt.length) cards[cards.length - 1].links = alt.slice(0, 6).map((a) => ({ label: 'Published system: ' + a.title, url: 'systems/' + a.slug + '/' }));
        continue;
      }
      cards.push(planCard(pl, { area: K.area }));
      if (K.area && pl.status !== 'blocked') {
        for (const st of pl.steps) {
          if (!st.main || cards.length >= 8) continue;
          const sh = await load.product(st.main.id); if (!sh) continue;
          const cc = C.calcCard(sh, K.area, q); if (cc.type === 'calculation') cards.push(cc);
        }
      }
    }
    if (!cards.length) return null;
    const first = plans.find((p) => p.status !== 'none');
    return { intent: 'plan', cards, state: { plan: K, lastPlan: first ? { slug: first.system.slug } : null } };
  }
  return { handle, data: dataP };
}

export { commitPlan } from './plansave.js';
// Lane D is loaded as a plain module on demand (brain.js never imports it). In the browser this line lets the injected module script hand its exports back.
if (typeof globalThis !== 'undefined') globalThis.__sikaRules = { createRules };
