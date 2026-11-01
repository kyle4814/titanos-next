// rules_read.js: the engineer's reasoning layer, part 1 of 3 (split from rules.js, no behaviour change): the constraint model (what the customer said),
// what the question is, reading the published rule rows and matching "do not" rules to the constraints. Pure functions, no DOM, no network.

// ------------------------------------------------------------------ 1. the constraint model
export const lc = (s) => String(s == null ? '' : s).toLowerCase().replace(/[‘’]/g, "'").replace(/º/g, '°').replace(/m²/g, 'm2').replace(/\s+/g, ' ').trim();
export const TILE_LABEL = { porcelain: 'porcelain tiles', ceramic: 'ceramic tiles', mosaic: 'mosaic tiles', glass: 'glass tiles', 'natural-stone': 'natural stone', 'engineered-stone': 'engineered stone', 'quarry-terracotta': 'quarry, terracotta or slate tiles', 'large-format': 'large format tiles', 'moisture-sensitive-stone': 'moisture sensitive stone' };
export const SUB_LABEL = { concrete: 'concrete', 'screed-render': 'cement screed or render', masonry: 'brick or blockwork', 'cement-board': 'fibre cement sheet or cement board', plasterboard: 'plasterboard', 'timber-floor': 'timber or particleboard floor (over-sheeted)', 'existing-tiles': 'existing tiles', aac: 'autoclaved aerated concrete (AAC)' };
export const LOC_LABEL = { 'internal-floor': 'internal floor (dry area)', 'internal-wall': 'internal wall (dry area)', 'internal-wet-floor': 'internal wet area floor', 'internal-wet-wall': 'internal wet area wall', 'external-floor': 'external floor', 'external-wall': 'external wall', pool: 'swimming pool or spa' };
export const TILE_RX = [
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
export const SUB_RX = [
  ['existing-tiles', /existing (?:ceramic |porcelain )?tiles?|old tiles?|tile[- ]over[- ]tile|tiles? over (?:the )?(?:old |existing )?tiles?|over (?:the )?(?:old |existing )?tiles?|retil\w+ over|(?:tiling|tile) (?:on|onto) (?:top of )?(?:the )?(?:old |existing )?tiles?|previous tiles?|current tiles?/],
  ['timber-floor', /timber|plywood|\bply\b|particle ?board|chip ?board|floor ?boards?|\bmdf\b|masonite|wooden|\bt&g\b|tongue and groove/],
  ['plasterboard', /plasterboard|gyprock|dry ?wall|\bgyp\b|gypsum|plaster board|villa ?board lined/],
  ['cement-board', /cement (?:sheet|board)s?|fibre ?cement|fiber ?cement|\bfc sheet|villa ?board|hardie|fibro|compressed (?:fibre )?(?:cement )?sheet|tile underlay|\bcfc\b|scyon/],
  ['aac', /\baac\b|hebel|autoclaved|aerated concrete|\bprecast aerated/],
  ['masonry', /brick|block ?work|\bblocks?\b|masonry|besser|rendered (?:wall|brick)/],
  ['screed-render', /screed|render(?:ed|ing)?\b/],
  ['concrete', /concrete|\bslab\b|\bcrete\b/],
];
export const UNSUPPORTED_RX = /\b(steel|metal|aluminium|aluminum|galvanis\w+|vinyl|lino(?:leum)?|carpet|asphalt|bitumen|bitumous|laminate|polystyrene|foam board|fibreglass|fiberglass|acrylic sheet|gib ?board|magnesite|terrazzo|linoleum|cork|rubber|pvc|plastic|stainless)\b/;
export const NUMW = '(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)';
export const WORDN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
export const n2 = (s) => (WORDN[s] != null ? WORDN[s] : Number(s));
export const UNIT_H = { hour: 1, hours: 1, hr: 1, hrs: 1, day: 24, days: 24, week: 168, weeks: 168, month: 720, months: 720, minute: 1 / 60, minutes: 1 / 60 };

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
export const PLAN_RX = /\b(plan|method|steps?|step by step|steps? (?:to|for|in|i)|in what order|order of (?:work|works|operations|application)|what order|sequence|timeline|schedule|how long (?:until|before|will|would|does|do|is|should|in total|overall|all up)|total time|earliest|finish (?:by|in|within)|done (?:by|in|within)|ready (?:by|for|in|within)|when can|what (?:must|do i need|should i)|prerequisites?|before i start|build[- ]?up|walk me through|process|stages?|specification|spec for|method statement|how do i (?:tile|waterproof|prepare|prep|install|lay|fix)|how to (?:tile|waterproof|prepare|install|lay))\b/;
export const ASK_RX = /\b(can i|could i|is it ok|is it okay|will (?:it|that|this) work|is it possible|is it allowed|should i|am i allowed|does this work|would this work|is that ok|is that okay)\b/;
export const RULE_TOPICS = [
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

export const dimsOf = (K) => (K.tile ? 1 : 0) + (K.sub || (K.unsupported && K.unsupported.length) ? 1 : 0) + (zonesOf(K).length || K.where.wet || K.where.external || K.where.internal || K.where.pool || K.where.floor || K.where.wall || K.where.garage ? 1 : 0);
export const extraOf = (K) => Object.entries(K.flags || {}).some(([k, v]) => v && !['residential'].includes(k)) || K.age != null || K.temp != null || K.rh != null || K.budget != null || K.area != null || K.size != null;

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
export const KIND_OF_ROLE = { prime: 'Prepare and prime', membrane: 'Waterproofing membrane', adhesive: 'Tile adhesive', grout: 'Grout', sealant: 'Movement joints and perimeter sealant' };
export const ROLE_ORDER = ['prime', 'membrane', 'adhesive', 'grout', 'sealant'];
export const POROUS = new Set(['concrete', 'screed-render', 'masonry', 'aac']);
export const NONPOROUS = new Set(['cement-board', 'plasterboard', 'existing-tiles', 'timber-floor']);
export const locClass = (loc) => (loc === 'pool' ? 'submerged' : /wet|external/.test(loc) ? 'wet' : 'dry');
export const axisOf = (loc) => (/wall$/.test(loc) ? 'wall' : /floor$|pool/.test(loc) ? 'floor' : null);

/** a citation for one rule row of one product */
export function cite(pid, row, meta) {
  return { pid, name: meta ? meta.m[0] : pid, ed: meta ? meta.m[4] : '', url: meta ? meta.m[2] : '', k: row[0], v: row[1], q: row[2], c: row[3], p: row[4] };
}
export const rowsOf = (data, pid, kind) => ((data.rules[pid] && data.rules[pid].r) || []).filter((r) => r[0] === kind);

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
export const pickCold = (data, pid, K, locKind) => {
  if (K.temp == null) return null;
  const r = rowsOf(data, pid, 'wait').find((x) => x[1].kinds.includes('cold') && K.temp < x[1].below);
  if (!r) return null;
  const h = locKind === 'wet' ? r[1].wet : r[1].dry; if (h == null) return null;
  return { kind: 'cold', min: h, max: h, plus: false, raw: locKind === 'wet' ? r[1].wetRaw : r[1].dryRaw, refs: [cite(pid, r, data.rules[pid])], distinct: false, at: { c: r[1].below } };
};

// ------------------------------------------------------------------ 3. matching "do not" rules to the constraints
export const SUBTAG = { concrete: ['concrete'], 'screed-render': ['screed', 'render'], masonry: ['render'], 'cement-board': ['cement_board'], plasterboard: ['plasterboard'], 'timber-floor': ['cement_board'], 'existing-tiles': ['existing_tiles'], aac: ['aac'] };
export const TILETAG = { porcelain: ['porcelain'], 'natural-stone': ['stone'], 'moisture-sensitive-stone': ['msstone', 'stone'], glass: ['glass'], 'large-format': ['large'], mosaic: ['mosaic'] };
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

