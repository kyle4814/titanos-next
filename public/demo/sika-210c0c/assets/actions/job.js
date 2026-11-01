// Actions v2, JOB BUILDER: "bathroom 2.4 x 1.8, walls to 1.8 m, over concrete" -> the whole published system (primer, membrane, adhesive, grout, sealant)
// with a quantity and a pack count for every line, every line cited, one card, and "Add all to my project" through the shared project store.
// Plain code, no model. It REUSES the system finder's own model (lib/finder/model.js sheetModel, the same function the system sheets and the selector use),
// so a job line and a system sheet for the same inputs can never disagree. No waste allowance unless the visitor types one. No prices.
import { card, clarifyCard, unknownCard, src, plain, ESTIMATE_LINE } from './core.js';
import { sheetModel, resolve } from '../lib/finder/model.js';
import { fmt, fmtQty } from '../lib/finder/calc.js';
import { handoffBtn, afterBtns } from './shared.js';

const NUM = '(\\d+(?:\\.\\d+)?)';
const UNIT = '(mm|millimet(?:re|er)s?|cm|centimet(?:re|er)s?|m|met(?:re|er)s?|mtrs?)';
const SEP = '\\s*(?:x|\\*|\\bby\\b)\\s*';
const r2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ the room parser */
const unitM = (u) => (!u ? null : /^(mm|millimet)/.test(u) ? 0.001 : /^(cm|centimet)/.test(u) ? 0.01 : 1);
/** A length in metres from a number and an optional unit. No unit: a small number is metres, 100 and over is millimetres (900 x 900 shower), in between is not a length. */
function toMetres(v, u) {
  const f = unitM(u);
  if (f) return v * f;
  if (v <= 30) return v;
  if (v >= 100) return v / 1000;
  return null;
}
const inRange = (m, lo, hi) => m != null && m >= lo && m <= hi;

const SUBSTRATES = [
  ['existing-tiles', 'existing tiles', /existing (?:\w+ )?tiles?|old (?:\w+ )?tiles?|tile (?:on|over) tile|(?:over|on top of) (?:the )?tiles?|tiles? over tiles?/],
  ['aac', 'AAC', /\baac\b|autoclaved|hebel|aerated concrete/],
  ['cement-board', 'cement board', /cement (?:sheet|board)|fib(?:re|er)[ -]?cement|villaboard|hardie|compressed sheet/],
  ['plasterboard', 'plasterboard', /plaster ?board|gyprock|gypsum|drywall|\bgib\b/],
  ['timber-floor', 'timber', /timber|plywood|\bply\b|particle ?board|chip ?board|yellow ?tongue|wooden|\bwood\b/],
  ['masonry', 'brick or blockwork', /\bbrick|block ?work|concrete block|masonry|besser|\bblocks?\b/],
  ['screed-render', 'screed or render', /\bscreed|\brender(?:ed|ing)?\b/],
  ['concrete', 'concrete', /\bconcrete\b|\bslab\b|\bconc\b/],
];
const TILES = [
  ['moisture-sensitive-stone', /moisture[ -]sensitive|green marble/],
  ['engineered-stone', /engineered stone|agglomerate/],
  ['natural-stone', /natural stone|\bmarble\b|granite|limestone|travertine|bluestone|sandstone|\bslate\b/],
  ['quarry-terracotta', /quarry|terracotta/],
  ['large-format', /large[ -]format/],
  ['mosaic', /mosaic/],
  ['glass', /\bglass\b/],
  ['porcelain', /porcelain/],
  ['ceramic', /ceramic/],
];
const PLACE = [
  ['pool', /\bpool\b|\bspa\b|swimming/],
  ['external', /balcon|patio|terrace|outdoor|external|exterior|outside|\bdeck\b|verandah|veranda|courtyard|alfresco|pergola|driveway|carport/],
  ['wet', /bathroom|bath room|ensuite|en-suite|shower|laundry|wet room|wet area|powder room|toilet|\bwc\b|\bbath\b/],
  ['internal', /kitchen|living|lounge|bedroom|hallway|\bhall\b|dining|entry|internal|interior|indoor|\broom\b|study|office|pantry/],
];
const ROOM_WORD = /bathroom|bath room|ensuite|en-suite|shower|laundry|wet room|wet area|powder room|toilet|\bwc\b|kitchen|living|lounge|bedroom|hallway|\bhall\b|dining|entry|room|study|office|pantry|balcon|patio|terrace|deck|verandah|veranda|courtyard|alfresco|pool|\bspa\b|floor|walls?\b|splashback|\bjob\b|area/;

export function normaliseRoomText(text) {
  return ' ' + String(text || '').toLowerCase().replace(new RegExp('[×' + String.fromCharCode(0x2715) + ']', 'g'), ' x ').replace(/²/g, '2').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2').replace(/[‘’]/g, "'").replace(/\s+/g, ' ') + ' ';
}

/**
 * Everything a job sentence says about the room. Lengths in metres. Only what the text says: nothing is guessed here
 * (defaults and questions are the builder's business). dims = true when a length and a width were given.
 */
export function parseRoom(text) {
  const t = normaliseRoomText(text);
  const out = { dims: false, length: null, width: null, floorArea: null, perimeter: null, height: null, fullHeight: false, floorOnly: false, place: null, wet: false, floorSub: null, wallSub: null, sub: null, tile: null, allowance: null, mentionsFloor: false, mentionsWalls: false };
  // length x width (x height)
  const D = '(?:\\s*(?:wide|long|deep|across))?'; // "2.4 m wide by 1.8 m long"
  const pair = new RegExp(NUM + '\\s*' + UNIT + '?' + D + SEP + NUM + '\\s*' + UNIT + '?' + D + '(?:' + SEP + NUM + '\\s*' + UNIT + '?)?', 'g');
  let rest = t;
  for (const m of t.matchAll(pair)) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 30);
    const before = t.slice(Math.max(0, m.index - 22), m.index);
    // a tile size ("600 x 600 mm tiles", "tiles are 300x600") is not a room
    if (/^\s*(?:mm\s*)?(?:[a-z-]+\s+){0,2}tiles?\b/.test(after) || /tiles?\s*(?:size|are|is|of)?\s*(?:of|are|is|:)?\s*$/.test(before)) continue;
    let [, a, ua, b, ub, c, uc] = m;
    ua = ua || ub || null; ub = ub || ua || null; uc = uc || ub || null;
    const A = toMetres(parseFloat(a), ua), B = toMetres(parseFloat(b), ub), C = c ? toMetres(parseFloat(c), uc) : null;
    if (!inRange(A, 0.3, 60) || !inRange(B, 0.3, 60)) continue;
    out.dims = true; out.length = A; out.width = B; out.perimeter = r2(2 * (A + B)); out.floorArea = r2(A * B);
    if (C != null && inRange(C, 0.2, 6)) out.height = C;
    rest = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
    break;
  }
  if (!out.dims) {
    const am = new RegExp(NUM + '\\s*(?:m2|sqm|sq\\.? ?m|square met(?:re|er)s?)\\b').exec(t);
    if (am && parseFloat(am[1]) > 0 && parseFloat(am[1]) <= 3000) { out.floorArea = parseFloat(am[1]); rest = t.replace(am[0], ' '); }
  }
  // wall height
  if (out.height == null) {
    const hv = (v, u) => { const m = toMetres(parseFloat(v), u); return inRange(m, 0.2, 6) ? m : null; };
    const pats = [
      new RegExp('\\b' + NUM + '\\s*' + UNIT + '\\s*(?:high|tall|height)\\b'),
      new RegExp('\\bwalls?\\s*(?:are\\s+|is\\s+)?(?:tiled\\s+)?(?:height\\s*(?:of|is)?\\s*|high\\s*)?(?:up\\s+)?(?:to|at|of|=|:)?\\s*' + NUM + '\\s*' + UNIT + '?(?!\\s*(?:x|\\*|by\\b|\\d))'),
      new RegExp('\\b(?:tile|tiled|tiling|tiles)\\s+(?:the\\s+)?(?:walls?\\s+)?(?:up\\s+)?to\\s+(?:a\\s+height\\s+of\\s+)?' + NUM + '\\s*' + UNIT + '?'),
      new RegExp('\\b(?:height|high)\\s*(?:of|is|=|:)?\\s*' + NUM + '\\s*' + UNIT + '?'),
    ];
    for (const re of pats) { const m = re.exec(rest); if (m) { const v = hv(m[1], m[2]); if (v != null) { out.height = v; break; } } }
  }
  if (out.height == null && /full height|floor to ceiling|to (?:the )?ceiling|ceiling height|full wall/.test(t)) out.fullHeight = true;
  out.mentionsWalls = /\bwalls?\b|splashback|shower recess|\bhigh\b/.test(t) || out.height != null || out.fullHeight;
  out.mentionsFloor = /\bfloors?\b|flooring/.test(t);
  out.floorOnly = /\bfloors?\s+only\b|\bonly\s+(?:the\s+)?floors?\b|\bjust\s+(?:the\s+)?floors?\b|\bno\s+walls?\b|\bwithout\s+(?:the\s+)?walls?\b|\bfloor\s+tiling\s+only\b/.test(t) || (out.mentionsFloor && !/\bwalls?\b|splashback/.test(t) && out.height == null && !out.fullHeight);
  if (out.floorOnly) { out.height = null; out.fullHeight = false; }
  for (const [id, re] of PLACE) if (re.test(t)) { out.place = id; break; }
  out.wet = out.place === 'wet';
  for (const [id, re] of TILES) if (re.test(t)) { out.tile = id; break; }
  // substrates, each with the surface it was said about (a "concrete floor" and "plasterboard walls" are two different surfaces)
  const subRe = new RegExp(SUBSTRATES.map(([, , re], i) => '(?<s' + i + '>' + re.source + ')').join('|'), 'g');
  for (const m of t.matchAll(subRe)) {
    const idx = SUBSTRATES.findIndex((_, i) => m.groups['s' + i] != null); const id = SUBSTRATES[idx][0];
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14); const before = t.slice(Math.max(0, m.index - 16), m.index);
    const isFloor = /^\s*(?:floors?|flooring|slab)\b/.test(after) || /\bfloors?\s*(?:is|are|on|over|of|in)?\s*$/.test(before);
    const isWall = /^\s*(?:walls?)\b/.test(after) || /\bwalls?\s*(?:is|are|on|over|of|in)?\s*$/.test(before);
    if (isWall && !isFloor) out.wallSub = out.wallSub || id;
    else if (isFloor && !isWall) out.floorSub = out.floorSub || id;
    else out.sub = out.sub || id;
  }
  const al = new RegExp(NUM + '\\s*(?:%|percent|per cent)').exec(t);
  if (al && parseFloat(al[1]) > 0 && parseFloat(al[1]) <= 50) out.allowance = parseFloat(al[1]);
  return out;
}

/** Does this sentence describe a room-sized tiling job? (the router uses this; a tile size such as 600 x 600 mm tiles is not a room) */
export function looksLikeJob(text) {
  const r = parseRoom(text);
  if (!(r.dims || r.floorArea)) return false;
  const t = normaliseRoomText(text);
  return ROOM_WORD.test(t) && (r.dims || /tile|tiling|bathroom|ensuite|shower|laundry|balcon|waterproof|job|room/.test(t));
}

/* ------------------------------------------------------------------ the builder */
const LOC = { wet: ['internal-wet-floor', 'internal-wet-wall'], internal: ['internal-floor', 'internal-wall'], external: ['external-floor', 'external-wall'], pool: ['pool', null] };
const PLACE_LABEL = { wet: 'wet room', internal: 'room', external: 'outdoor area', pool: 'pool' };
const ROLE_NAME = { prime: 'Prepare and prime', membrane: 'Waterproofing membrane', adhesive: 'Tile adhesive', grout: 'Grout', sealant: 'Movement joint sealant' };
const ORDER = ['prime', 'membrane', 'adhesive', 'grout', 'sealant'];
export const ASK_TS = 'Ask Technical Services';
const lab = (list, id) => ((list || []).find((x) => x.id === id) || {}).label || id;
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const sents = t.split(/(?<=[.!?])\s+|\s+\|\s+/); const hit = sents.find((x) => /\d/.test(x) && /cover|m2|litre|\bl\b|kg|per/i.test(x) && x.length <= n); return hit || t.slice(0, n).replace(/\s+\S*$/, '') + '...'; };

const mixText = (calc) => {
  const p = calc.packs; if (!p) return { text: '', count: null };
  if (p.suggested && p.suggested.mix.length) {
    const unit = calc.unit; const s = p.suggested;
    return { text: `${s.mix.map((c) => `${c.count} x ${fmt(c.size)} ${c.unit}`).join(' + ')} (${fmtQty(s.total, unit)} supplied, ${fmtQty(s.over, unit)} over)`, count: s.mix.reduce((a, c) => a + c.count, 0) };
  }
  return { text: '', count: null, note: p.note || '' };
};

/** One line of a job from one row of the system finder's sheet model. */
function lineFrom(row, sysId, sysTitle) {
  const base = { role: row.role, label: ROLE_NAME[row.role] || row.label, system: sysId, systemTitle: sysTitle };
  if (row.empty || !row.product) return { ...base, status: 'ask', name: null, productId: null, reason: row.note || 'No matching product is listed in the published system documentation.' };
  const calc = row.calc; const rate = row.rate && row.rate.url ? { text: plain(row.rate.text), url: row.rate.url, basis: row.rate.basis || '' } : null;
  const why = row.why && row.why.url ? { quote: plain(row.why.quote || row.why.reason || ''), url: row.why.url } : null;
  const common = { ...base, productId: row.product.id, name: plain(row.product.name), url: row.product.url || '', pds: row.product.pds || null, why, alternatives: (row.others || []).map(plain) };
  if (!calc || !calc.ok || !rate) return { ...common, status: 'ask', reason: calc && !calc.ok ? plain(calc.reason || 'Rate not published') : 'Rate not published', rate };
  const mix = mixText(calc);
  const qtyText = calc.range ? `${fmtQty(calc.low, calc.unit)} to ${fmtQty(calc.high, calc.unit)}` : fmtQty(calc.high, calc.unit);
  return { ...common, status: 'worked', rate, low: calc.low, high: calc.high, unit: calc.unit, qtyText, packs: mix.text, count: mix.count, packNote: mix.note || '' };
}

/**
 * Work out a job. S = the system finder data (data.systems()). room = parseRoom() output plus the chosen defaults.
 * Returns { ok, systems:[{id, sel, slug, title, area, length, model, lines}], lines, notes, skipped:[] }.
 */
export function buildJob(S, room, { tile, floorSub, wallSub, walls }) {
  const place = room.place || 'internal';
  const [fl, wl] = LOC[place];
  const floorArea = room.floorArea; const perim = room.perimeter;
  const wallArea = walls && perim ? r2(perim * room.height) : null;
  const allow = room.allowance || 0;
  const specs = [];
  if (place === 'pool') {
    const area = r2(floorArea + (wallArea || 0));
    specs.push({ id: 'pool', kind: 'pool', loc: fl, sub: floorSub, area, length: perim || null, what: wallArea ? 'Pool floor and walls' : 'Pool floor' });
  } else {
    specs.push({ id: 'floor', kind: 'floor', loc: fl, sub: floorSub, area: floorArea, length: perim || null, what: 'Floor' });
    if (wallArea) specs.push({ id: 'wall', kind: 'wall', loc: wl, sub: wallSub, area: wallArea, length: r2(4 * room.height), what: 'Walls' });
  }
  const systems = []; const skipped = [];
  for (const sp of specs) {
    const sel = { tile, sub: sp.sub, loc: sp.loc };
    const job = { area: sp.area, length: sp.length || undefined, allowancePct: allow };
    const model = sheetModel(S, sel, job);
    if (!model.ok) { skipped.push({ ...sp, sel, reason: plain(model.message || 'The published documentation does not support a complete system for this combination.') }); continue; }
    const low = (x) => x.replace(/\s*\(.*?\)/g, '').toLowerCase(); const title = `${sp.what}: ${low(lab(S.tileTypes, tile))} on ${low(lab(S.substrates, sp.sub))}, ${low(lab(S.locations, sp.loc))}`;
    const lines = ORDER.map((role) => model.rows.find((r) => r.role === role)).filter(Boolean).map((r) => lineFrom(r, sp.id, title));
    systems.push({ ...sp, sel, title, slug: resolve(S, sel).slug, model, lines, job });
  }
  return { ok: systems.length > 0, systems, skipped, floorArea, wallArea, allowance: allow };
}

/** Lines merged by product for the cart: a product used on the floor and on the walls is ONE line worked out on the summed area and length. */
export function cartLines(S, built, tile) {
  const out = []; const used = new Set();
  const all = built.systems.flatMap((s) => s.lines.map((l) => ({ l, s })));
  for (const { l, s } of all) {
    if (!l.productId) continue;
    const key = l.role + '|' + l.productId; if (used.has(key)) continue; used.add(key);
    const same = all.filter((x) => x.l.role === l.role && x.l.productId === l.productId);
    if (same.length === 1) { out.push({ ...l, area: s.area, length: s.length || null }); continue; }
    const area = r2(same.reduce((a, x) => a + (x.s.area || 0), 0)); const len = r2(same.reduce((a, x) => a + (x.s.length || 0), 0));
    const m = sheetModel(S, s.sel, { area, length: len || undefined, allowancePct: built.allowance }, { [l.role]: l.productId });
    const row = m.ok && m.rows.find((r) => r.role === l.role);
    out.push({ ...(row ? lineFrom(row, 'both', same.map((x) => x.s.title).join(' and ')) : l), area, length: len || null, merged: true });
  }
  for (const { l } of all) if (!l.productId) out.push(l);
  return out;
}

const qtyRows = (l) => [{ low: l.low, high: l.high, unit: l.unit, packs: l.packs || '', phrase: clip(l.rate.text, 380), url: l.rate.url }];
const fmtDim = (m) => `${fmt(m)} m`;

/* ------------------------------------------------------------------ questions */
const H_CHIPS = [['Walls to 1.2 m', 'walls to 1.2 m'], ['Walls to 1.8 m', 'walls to 1.8 m'], ['Walls to 2.1 m', 'walls to 2.1 m'], ['Walls to 2.4 m', 'walls to 2.4 m'], ['Floor only', 'floor only']].map(([label, value]) => ({ label, value }));
const S_CHIPS = [['Concrete', 'over concrete'], ['Cement screed or render', 'over cement screed'], ['Plasterboard', 'over plasterboard'], ['Cement board', 'over fibre cement sheet'], ['Timber floor', 'over timber'], ['Existing tiles', 'over existing tiles']].map(([label, value]) => ({ label, value }));
const B_CHIPS = [['Concrete, walls to 1.8 m', 'over concrete, walls to 1.8 m'], ['Concrete, floor only', 'over concrete, floor only'], ['Screed, walls to 1.8 m', 'over cement screed, walls to 1.8 m'], ['Screed, floor only', 'over cement screed, floor only']].map(([label, value]) => ({ label, value }));

/* ------------------------------------------------------------------ the action */
export async function job(ctx) {
  const { data, session } = ctx;
  const text = ctx.rest || ctx.text;
  const room = parseRoom(text);
  if (!room.floorArea) {
    if (ctx.noAsk) return unknownCard('job', 'Build a job', 'I need the size of the room before I can list the products. Give the length and width, for example 2.4 x 1.8 m.');
    return clarifyCard('job', 'How big is the room? Give the length and width, for example 2.4 x 1.8 m.', [], 'dims');
  }
  const wantsWallsUnknown = room.wet && !room.floorOnly && room.height == null && room.dims;
  const needFloorSub = !(room.floorSub || room.sub);
  if (!ctx.noAsk) {
    if (wantsWallsUnknown && needFloorSub) return clarifyCard('job', 'Two things so I list the right products: what is the surface underneath, and how high will you tile the walls (or floor only)?', B_CHIPS, 'height+substrate');
    if (wantsWallsUnknown) return clarifyCard('job', 'How high will you tile the walls? Or is it the floor only?', H_CHIPS, 'height');
    if (needFloorSub) return clarifyCard('job', 'What is the surface underneath the tiles?', S_CHIPS, 'substrate');
  }
  if (needFloorSub) return unknownCard('job', 'Build a job', 'I still need the surface underneath (concrete, cement screed, plasterboard, cement board, timber, existing tiles). Include it in your next request and I will list the products.');
  const S = await data.systems();
  if (!S) return unknownCard('job', 'Build a job', 'The system data is not available in this build.');
  const assumptions = []; const notes = [];
  const tile = room.tile || 'ceramic'; if (!room.tile) assumptions.push('Tile type was not given, so this is shown for ceramic tiles. Say porcelain, mosaic, natural stone and so on to change it.');
  if (tile === 'moisture-sensitive-stone') return unknownCard('job', 'Build a job', 'The published documentation has no complete system for moisture sensitive stone. Ask Technical Services.', { handoff: true, buttons: [handoffBtn] });
  const place = room.place || 'internal'; if (!room.place) assumptions.push('Inside or outside was not given, so this is shown for an inside, dry room.');
  const floorSub = room.floorSub || room.sub; const wallSub = room.wallSub || room.sub || floorSub;
  const walls = room.height != null && !room.floorOnly && room.dims;
  if (room.fullHeight && !walls) notes.push('"Full height" was not a measurement, so the walls are not included. Give the height in metres and I will add them.');
  if (!room.dims) notes.push('Only an area was given, so the walls and the sealant runs cannot be worked out. Give the length and width to include them.');
  else if (room.wet && !walls && !room.floorOnly) notes.push('Wall height was not given, so this list is for the floor only. Tell me how high the walls go to add them.');
  if (place === 'external' && room.height != null && !room.floorOnly) assumptions.push('Wall height was read as an outdoor wall to be tiled.');
  const built = buildJob(S, room, { tile, floorSub, wallSub, walls });
  const label = PLACE_LABEL[place];
  const title = `Job list: ${room.dims ? `${fmt(room.length)} x ${fmt(room.width)} m ` : `${fmt(room.floorArea)} m2 `}${label}`;
  if (!built.ok) {
    const c = unknownCard('job', title, 'The published system documentation does not support a complete system for this combination. Ask Technical Services.', { handoff: true, buttons: [handoffBtn] });
    for (const s of built.skipped) c.notes.push(`${s.what}: ${s.reason}`);
    return c;
  }
  const c = card('job', 'job', title, { estimate: true, buttons: [] });
  c.rows.push({ label: 'Your room', value: `Floor ${fmt(built.floorArea)} m2${room.dims ? ` (${fmt(room.length)} x ${fmt(room.width)} m, ${fmt(room.perimeter)} m around)` : ''}`, input: true, source: null });
  if (built.wallArea) c.rows.push({ label: 'Walls', value: `${fmt(built.wallArea)} m2 (${fmt(room.perimeter)} m around x ${fmt(room.height)} m high). Door and window openings are not taken off.`, input: true, source: null });
  if (built.allowance) c.rows.push({ label: 'Your allowance', value: `${fmt(built.allowance)}% added`, input: true, source: null });
  c.summary = `Quantities come from each product's published coverage, packs are rounded up, and no waste allowance is added${built.allowance ? ' except the one you typed' : ' unless you type one'}.`;
  c.assumptions = assumptions;
  c.notes.push(...notes);
  for (const s of built.skipped) c.notes.push(`${s.what} (${lab(S.substrates, s.sel.sub)}, ${lab(S.locations, s.sel.loc)}): ${s.reason}`);
  c.sections = [];
  for (const sy of built.systems) {
    const sec = { title: `${sy.title} (${fmt(sy.area)} m2)`, rows: [], more: [], compact: true, jobSystem: sy.id };
    for (const l of sy.lines) {
      if (!l.productId) { sec.rows.push({ label: l.label, value: `${ASK_TS}. ${l.reason}`, source: null, status: 'ask', line: l }); continue; }
      const cov = l.rate ? src(l.rate.url, 'Published coverage', clip(l.rate.text, 380)) : null;
      const how = l.status === 'worked' ? `${l.qtyText}${l.packs ? '; ' + l.packs : l.packNote ? '; ' + l.packNote : ''}` : `${ASK_TS}. ${l.reason}`;
      sec.rows.push({ label: l.name, productId: l.productId, value: `${l.label}: ${how}`, derived: l.status === 'worked', source: cov || (l.why ? src(l.why.url, 'Product page', l.why.quote) : null), status: l.status, line: l });
      if (l.why) sec.more.push({ label: `Why ${l.name}`, value: clip(l.why.quote, 220), quote: true, source: src(l.why.url, 'Product page', l.why.quote) });
      if (l.alternatives.length) sec.more.push({ label: `Other documented choices for ${l.label.toLowerCase()}`, value: l.alternatives.join(', '), meta: true, source: null });
    }
    c.sections.push(sec);
  }
  // the bond breaker for movement joints: named in the membrane's own data sheet, but no product or quantity is listed in the system, so it ships as a question
  if (built.systems.some((s) => s.lines.some((l) => l.role === 'sealant'))) {
    const mem = built.systems[0].lines.find((l) => l.role === 'membrane' && l.productId);
    let cite = null;
    if (mem && data.shard) { const sh = await data.shard(mem.productId); const pool = sh ? [...(sh.d.us || []), ...(sh.d.a || []), ...(sh.d.sec || []).map((x) => x.t)].filter(Boolean) : []; for (const p of pool) { const sent = String(p).split(/(?<=[.!?])\s+/).find((x) => /bond breaker/i.test(x)); if (sent) { cite = src(sh.u, 'Product page', clip(sent, 300)); break; } } }
    const sec = { title: 'Movement joints', rows: [{ label: 'Bond breaker', value: `${ASK_TS}. ${cite ? 'The membrane documentation says a bond breaker is needed at movement joints, but the system does not list a product or a quantity.' : 'The system documentation does not list a bond breaker product or a quantity.'}`, source: cite, status: 'ask', line: { role: 'bondbreaker', label: 'Bond breaker', status: 'ask', productId: null, reason: 'No product or quantity is listed.', cited: !!cite } }], more: [], compact: true };
    c.sections.push(sec);
  }
  if (built.systems.some((s) => s.length)) c.rows.push({ label: 'Sealant runs', value: `${built.systems.map((s) => `${s.what.toLowerCase()} ${fmt(s.length || 0)} m${s.id === 'wall' ? ' (the four upright corners)' : ' (all round the floor edge)'}`).join(', ')}. Doors, windows and fittings are not included.`, input: true, source: null });
  c.notes.push('Movement joints, falls to the waste and the condition of your surface are not decided by this list. Confirm with Technical Services.');
  const merged = cartLines(S, built, tile);
  c.job = { tile, place, room: { length: room.dims ? room.length : null, width: room.dims ? room.width : null, floorArea: built.floorArea, wallArea: built.wallArea, height: walls ? room.height : null, perimeter: room.perimeter }, allowance: built.allowance, systems: built.systems.map((s) => ({ id: s.id, title: s.title, slug: s.slug, sel: s.sel, area: s.area, length: s.length || null, lines: s.lines })), cart: merged, question: String(session.lastQuestion || text).slice(0, 300) };
  c.topButtons = built.systems.map((s) => ({ label: `Open the ${s.what.toLowerCase()} system sheet`, href: `systems/${s.slug}/` }));
  c.buttons = [{ label: 'Add all to my project', command: '/jobadd' }, ...afterBtns().slice(0, 1)];
  session.job = c.job;
  for (const l of merged) if (l.productId) { session.products = [{ id: l.productId, name: l.name }, ...(session.products || []).filter((x) => x.id !== l.productId)].slice(0, 12); }
  return c;
}

/** "Add all to my project": every line (and each system) into the shared project store, one product once, with its worked quantity. */
export function jobAdd(ctx) {
  const { memory, session } = ctx;
  const last = session.last && session.last.job ? session.last.job : session.job;
  const mem = (title, o) => card('memory', 'memory', title, { estimate: false, ...o });
  if (!last) { const c = mem('No job list yet'); c.notes.push('Describe the room first, for example "bathroom 2.4 x 1.8, walls to 1.8 m, over concrete", then add all of it to your project.'); return c; }
  const c = mem('Job list added to my project');
  const q = String(last.question || '').slice(0, 300);
  let worked = 0, asked = 0;
  for (const l of last.cart) {
    if (!l.productId) continue;
    const sys = last.systems.find((s) => s.lines.some((x) => x.productId === l.productId));
    const base = { id: l.productId, name: l.name, from: 'bot', question: q, systemTitle: l.merged ? '' : (sys ? sys.title : ''), systemSlug: sys ? sys.slug : '' };
    if (l.status === 'worked') {
      const jobObj = { area_m2: l.area }; if (l.length) jobObj.length_m = l.length; if (last.allowance) jobObj.waste_pct = last.allowance;
      memory.saveQuantity({ productId: l.productId, name: l.name, job: jobObj, rows: qtyRows(l) }, q);
      const cur = memory.getItem(l.productId) || {};
      const f = { ...base, qty: cur.qty, unit: cur.unit };
      memory.addItem(f); worked++;
      c.rows.push({ label: l.name, value: `${l.label}: ${l.qtyText}${l.packs ? '; ' + l.packs : ''}`, productId: l.productId, derived: true, source: l.rate ? src(l.rate.url, 'Published coverage', clip(l.rate.text, 380)) : null });
    } else {
      memory.addItem({ ...base, qty: 1, unit: 'pack', note: `Quantity: ${ASK_TS}. ${l.reason || ''}`.slice(0, 400), need: '', packs: '' });
      asked++;
      c.rows.push({ label: l.name, value: `${l.label}: in as 1 pack. ${ASK_TS} for the quantity.`, productId: l.productId, meta: true, source: l.why ? src(l.why.url, 'Product page', l.why.quote) : null });
    }
  }
  for (const s of last.systems) {
    const steps = {}; for (const l of s.lines) if (l.productId) steps[l.role] = [l.productId];
    memory.saveSystem({ title: s.title, slug: s.slug, env: s.sel.loc, tile: s.sel.tile, substrate: s.sel.sub, steps });
  }
  c.rows.unshift({ label: 'Project', value: memory.current(), meta: true, source: null });
  c.summary = `${worked} ${worked === 1 ? 'product' : 'products'} with a worked quantity${asked ? `, ${asked} to confirm with Technical Services` : ''}, and ${last.systems.length === 1 ? 'the system' : 'both systems'} saved.`;
  if (!memory.persistent()) c.notes.push('This browser blocked local storage, so it is kept for this tab only.');
  c.buttons = [{ label: 'What is in my project', command: '/cart' }, { label: 'Job pack: print, CSV, data sheets', command: '/jobpack' }]; c.cartLinks = true;
  return c;
}

export { ESTIMATE_LINE };
