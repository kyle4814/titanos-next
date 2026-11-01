// The calculator kinds that are not one product's published rate: plain arithmetic, unit conversion, room perimeter, tile counts, grout and sealant volumes,
// beds (screed, leveller, mortar), mixing water from a published ratio and cure/recoat timelines from published windows.
// Pure functions, no DOM, no network, no model. Every result carries its formula, its inputs as normalised and a citation:
//  - a figure that comes from a data sheet cites that line (text, url, page);
//  - a figure worked only from the sizes the visitor typed cites "worked from the numbers you typed" and shows the formula.
// Rules held by every kind: nothing is assumed silently (a missing size is asked, with a recommended default offered as a chip), an allowance for cuts or
// waste is applied only when the visitor gives one, packs are rounded UP, and every output carries the estimate sentence.
import { ESTIMATE_LINE, fmt } from './qty.js';

export { ESTIMATE_LINE };
export const GEN_KINDS = ['arithmetic', 'convert', 'perimeter', 'tiles', 'grout', 'sealant', 'bed', 'mixwater', 'timeline'];
export const KIND_LABEL = { arithmetic: 'Arithmetic', convert: 'Unit conversion', perimeter: 'Perimeter', tiles: 'Tile count', grout: 'Grout volume', sealant: 'Joint sealant', bed: 'Bed volume', mixwater: 'Mixing water', timeline: 'Time until the next step', product: 'Product quantity' };
export const WORKED = 'Worked from the numbers you typed; no data sheet figure is involved.';

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const rnd = (x, d = 4) => { const p = 10 ** d; return Math.round((x + 1e-12) * p) / p; };
const ceil = (x) => Math.ceil(x - 1e-9);
const typed = (s) => ({ text: WORKED, url: '', page: null, kind: 'worked', formula: s });
const out = (o) => ({ ok: true, estimate: ESTIMATE_LINE, ...o });
const fail = (reason, need) => ({ ok: false, reason, ...(need ? { need } : {}) });

/* ------------------------------------------------------------------ arithmetic */
/** "2.4 x 1.8", "40 / 1.2", "(12 + 3) * 2". Digits, + - * / x and brackets only; anything else is refused. */
export function evalArithmetic(text) {
  let s = String(text || '').toLowerCase().replace(/[×]/g, 'x').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/(\d)\s*x\s*(?=[\d(.])/g, '$1*').replace(/\s+/g, '');
  if (!s || !/^[\d.+\-*/()]+$/.test(s) || !/[+\-*/]/.test(s.replace(/^-/, ''))) return fail('That is not a sum I can read.');
  const toks = s.match(/\d+(?:\.\d+)?|[+\-*/()]/g); if (!toks || toks.join('') !== s) return fail('That is not a sum I can read.');
  let i = 0;
  const peek = () => toks[i];
  const prim = () => { const t = toks[i++]; if (t === '(') { const v = expr(); if (toks[i++] !== ')') throw new Error('bracket'); return v; } if (t === '-') return -prim(); if (t === undefined || !/^\d/.test(t)) throw new Error('syntax'); return parseFloat(t); };
  const term = () => { let v = prim(); while (peek() === '*' || peek() === '/') { const o = toks[i++]; const r = prim(); if (o === '/' && r === 0) throw new Error('zero'); v = o === '*' ? v * r : v / r; } return v; };
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = toks[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
  try { const v = expr(); if (i !== toks.length || !Number.isFinite(v)) return fail('That is not a sum I can read.'); return out({ kind: 'arithmetic', value: rnd(v, 6), expression: s.replace(/\*/g, ' x ').replace(/\//g, ' / '), citation: typed('arithmetic') }); }
  catch (e) { return fail(e.message === 'zero' ? 'That divides by zero.' : 'That is not a sum I can read.'); }
}

/* ------------------------------------------------------------------ units */
const DIMS = {
  length: { base: 'm', u: { mm: 0.001, cm: 0.01, m: 1, km: 1000 } },
  area: { base: 'm2', u: { mm2: 1e-6, cm2: 1e-4, m2: 1 } },
  volume: { base: 'm3', u: { ml: 1e-6, l: 1e-3, m3: 1 } },
  mass: { base: 'kg', u: { g: 0.001, kg: 1, t: 1000 } },
};
const ALIAS = { millimetre: 'mm', millimetres: 'mm', millimeter: 'mm', millimeters: 'mm', centimetre: 'cm', centimetres: 'cm', centimeter: 'cm', centimeters: 'cm', metre: 'm', metres: 'm', meter: 'm', meters: 'm', kilometre: 'km', kilometres: 'km', mtr: 'm', mtrs: 'm',
  sqm: 'm2', 'sq m': 'm2', 'm^2': 'm2', 'square metre': 'm2', 'square metres': 'm2', 'square meter': 'm2', 'square meters': 'm2', 'sq metres': 'm2', 'sq. m': 'm2', 'cm^2': 'cm2', 'mm^2': 'mm2', 'square centimetres': 'cm2', 'square millimetres': 'mm2',
  'm^3': 'm3', 'cubic metre': 'm3', 'cubic metres': 'm3', 'cubic meter': 'm3', 'cubic meters': 'm3', cum: 'm3', litre: 'l', litres: 'l', liter: 'l', liters: 'l', ltr: 'l', ltrs: 'l', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml', mls: 'ml',
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg', tonne: 't', tonnes: 't', ton: 't', tons: 't' };
export const canonUnit = (w) => { const k = String(w || '').toLowerCase().replace(/\.$/, '').replace(/²/g, '2').replace(/³/g, '3').trim(); const a = ALIAS[k] || k; return Object.values(DIMS).some((d) => a in d.u) ? a : ''; };
export const dimOf = (u) => Object.keys(DIMS).find((k) => u in DIMS[k].u) || '';
const SHOW = { m2: 'm2', m3: 'm3', l: 'L', ml: 'mL', mm2: 'mm2', cm2: 'cm2' };
export const unitShow = (u) => SHOW[u] || u;
/** Convert between units of the same kind. Returns { value, unit } or a refusal. Bags and pails are NOT units here: they need a published pack size. */
export function convert(value, from, to) {
  const f = canonUnit(from), t = canonUnit(to);
  if (!num(value)) return fail('Give me a number to convert.');
  if (!f || !t) return fail('I convert mm, cm, m, km, m2, cm2, mm2, mL, L, m3, g, kg and tonnes. Bags and pails depend on a product\'s published pack size, so name the product.');
  if (dimOf(f) !== dimOf(t)) return fail(`${unitShow(f)} and ${unitShow(t)} measure different things, so I cannot convert one to the other.`);
  const d = DIMS[dimOf(f)];
  const v = value * d.u[f] / d.u[t];
  return out({ kind: 'convert', value: rnd(v, 6), unit: unitShow(t), from: { value, unit: unitShow(f) }, formula: `${fmt(value)} ${unitShow(f)} = ${fmt(rnd(v, 6))} ${unitShow(t)}`, citation: typed('unit conversion') });
}

/* ------------------------------------------------------------------ room and tiles */
export function perimeter({ length, width, deduct = 0 }) {
  if (!num(length) || length <= 0) return fail('Enter the room length in metres.', 'length');
  if (!num(width) || width <= 0) return fail('Enter the room width in metres.', 'width');
  const d = num(deduct) && deduct > 0 ? deduct : 0;
  const p = 2 * (length + width) - d;
  return out({ kind: 'perimeter', value: rnd(p), unit: 'm', area: rnd(length * width), formula: `2 x (${fmt(length)} + ${fmt(width)} m)${d ? ' - ' + fmt(d) + ' m for openings you gave' : ''} = ${fmt(rnd(p))} m`, deduct: d, citation: typed('perimeter') });
}
/** Tiles for an area (or room) and a tile size. A joint widens the tile pitch only when given. Cuts allowance only when the visitor gives it. */
export function tiles({ area, length, width, tileL, tileW, jointMm = 0, cutsPct = 0, perBox = 0 }) {
  let a = area; if (!num(a) && num(length) && num(width)) a = length * width;
  if (!num(a) || a <= 0) return fail('Enter the area in m2, or the room length and width.', 'area');
  if (!num(tileL) || !num(tileW) || tileL <= 0 || tileW <= 0) return fail('Enter the tile size, for example 600 x 600 mm.', 'tile');
  const j = num(jointMm) && jointMm > 0 ? jointMm : 0;
  const pitchA = ((tileL + j) * (tileW + j)) / 1e6;
  const raw = a / pitchA; const base = ceil(raw);
  const c = num(cutsPct) && cutsPct > 0 ? cutsPct : 0;
  const withCuts = c ? ceil(raw * (1 + c / 100)) : base;
  const box = num(perBox) && perBox > 0 ? { perBox, boxes: ceil(withCuts / perBox), tilesInBoxes: ceil(withCuts / perBox) * perBox } : null;
  return out({ kind: 'tiles', area: rnd(a), count: withCuts, countBeforeCuts: base, cutsPct: c, exact: rnd(raw, 3), box, tile: { l: tileL, w: tileW, joint: j },
    formula: `${fmt(rnd(a))} m2 / (${fmt(tileL + j)} x ${fmt(tileW + j)} mm per tile${j ? ' including the ' + fmt(j) + ' mm joint' : ''}) = ${fmt(rnd(raw, 2))}, rounded up to ${base}${c ? ', plus your ' + fmt(c) + '% for cuts = ' + withCuts : ''}`, citation: typed('tile count') });
}

/* ------------------------------------------------------------------ volumes */
/** Grout needed to fill the joints: litres = area x (L + W) / (L x W) x joint width x tile thickness (all sizes in mm, area in m2, 1 mm over 1 m2 = 1 L). */
export function groutVolume({ area, tileL, tileW, jointMm, thicknessMm, allowancePct = 0 }) {
  if (!num(area) || area <= 0) return fail('Enter the area in m2.', 'area');
  if (!num(tileL) || !num(tileW) || tileL <= 0 || tileW <= 0) return fail('Enter the tile size, for example 600 x 600 mm.', 'tile');
  if (!num(jointMm) || jointMm <= 0) return fail('Enter the joint width in mm.', 'joint');
  if (!num(thicknessMm) || thicknessMm <= 0) return fail('Enter the tile thickness in mm. It sets how deep the joint is.', 'thickness');
  const perM2 = (tileL + tileW) / (tileL * tileW) * jointMm * thicknessMm;
  const k = 1 + (num(allowancePct) && allowancePct > 0 ? allowancePct / 100 : 0);
  const litres = area * perM2 * k;
  return out({ kind: 'grout', litres: rnd(litres), litresPerM2: rnd(perM2), allowancePct: k > 1 ? (k - 1) * 100 : 0, unit: 'L',
    formula: `${fmt(area)} m2 x (${fmt(tileL)} + ${fmt(tileW)}) / (${fmt(tileL)} x ${fmt(tileW)}) x ${fmt(jointMm)} mm joint x ${fmt(thicknessMm)} mm deep = ${fmt(rnd(litres, 2))} L of grout${k > 1 ? ' including your ' + fmt((k - 1) * 100) + '% allowance' : ''}`,
    note: 'Volume only. A weight needs the grout\'s density and no density is assumed. Name a grout product and I will use its published table when it has a row for this tile size and joint.', citation: typed('grout volume') });
}
/** Sealant in a joint: mL = length (m) x width (mm) x depth (mm). 1 mm x 1 mm x 1 m = 1 mL. */
export function sealantVolume({ lengthM, widthMm, depthMm, packMl = 0, allowancePct = 0 }) {
  if (!num(lengthM) || lengthM <= 0) return fail('Enter the length of joint in metres, or the room size for its perimeter.', 'length');
  if (!num(widthMm) || widthMm <= 0) return fail('Enter the joint width in mm.', 'width');
  if (!num(depthMm) || depthMm <= 0) return fail('Enter the joint depth (the bead depth) in mm.', 'depth');
  const k = 1 + (num(allowancePct) && allowancePct > 0 ? allowancePct / 100 : 0);
  const ml = lengthM * widthMm * depthMm * k;
  const packs = num(packMl) && packMl > 0 ? { size: packMl, count: ceil(ml / packMl) } : null;
  return out({ kind: 'sealant', ml: rnd(ml), litres: rnd(ml / 1000), packs, allowancePct: k > 1 ? (k - 1) * 100 : 0,
    formula: `${fmt(lengthM)} m x ${fmt(widthMm)} mm x ${fmt(depthMm)} mm = ${fmt(rnd(ml, 1))} mL${packs ? ', in ' + fmt(packMl) + ' mL packs = ' + packs.count : ''}`, citation: typed('joint volume') });
}
/** A bed of screed, leveller or mortar: area x thickness. No density or waste is assumed. */
export function bedVolume({ area, thicknessMm, allowancePct = 0 }) {
  if (!num(area) || area <= 0) return fail('Enter the area in m2.', 'area');
  if (!num(thicknessMm) || thicknessMm <= 0) return fail('Enter the bed thickness in mm.', 'thickness');
  const k = 1 + (num(allowancePct) && allowancePct > 0 ? allowancePct / 100 : 0);
  const m3 = area * thicknessMm / 1000 * k;
  return out({ kind: 'bed', m3: rnd(m3, 5), litres: rnd(m3 * 1000, 2), allowancePct: k > 1 ? (k - 1) * 100 : 0,
    formula: `${fmt(area)} m2 x ${fmt(thicknessMm)} mm = ${fmt(rnd(m3, 4))} m3 (${fmt(rnd(m3 * 1000, 1))} L)${k > 1 ? ', including your ' + fmt((k - 1) * 100) + '% allowance' : ''}`,
    note: 'Wet volume of the bed. A product quantity needs its published rate per mm of thickness (name the product).', citation: typed('bed volume') });
}

/* ------------------------------------------------------------------ published ratios and windows */
const NUMR = '(\\d+(?:[.,]\\d+)?)';
/** Water per powder from a stored mix_ratio fact: { parsed: water_per_powder } or the sentence "6.5 - 7 Litres of clean water per 20kg bag". */
export function waterRatio(fact) {
  if (!fact) return null;
  const p = fact.parsed;
  if (p && p.model === 'water_per_powder' && num(p.water_l_min) && num(p.water_l_max) && num(p.powder_amount) && p.powder_unit === 'kg') return { lo: p.water_l_min, hi: p.water_l_max, perKg: p.powder_amount };
  const t = String(fact.text || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  const m = new RegExp(NUMR + '\\s*(?:-|to|\u2013|and)?\\s*' + NUMR + '?\\s*(?:litres?|liters?|l)\\s*(?:of\\s+)?(?:[a-z,]+\\s+){0,4}?water\\s*(?:per|for each|to each|\\/)\\s*' + NUMR + '\\s*kg').exec(t);
  if (m) return { lo: parseFloat(m[1]), hi: m[2] ? parseFloat(m[2]) : parseFloat(m[1]), perKg: parseFloat(m[3]) };
  return null;
}
/** Mixing water for a mass of powder (kg) or a number of bags of the published size. Range stays a range. */
export function mixWater(ratio, { powderKg, bags }) {
  if (!ratio) return fail('No mixing water ratio is published for this product.');
  const kg = num(powderKg) && powderKg > 0 ? powderKg : num(bags) && bags > 0 ? bags * ratio.perKg : null;
  if (kg == null) return fail('Enter the powder as a mass in kg or a number of bags.', 'powder');
  const lo = ratio.lo * kg / ratio.perKg, hi = ratio.hi * kg / ratio.perKg;
  return out({ kind: 'mixwater', lowL: rnd(lo), highL: rnd(hi), powderKg: rnd(kg), bags: rnd(kg / ratio.perKg, 3), range: Math.abs(hi - lo) > 1e-9,
    formula: `${fmt(ratio.lo)}${ratio.hi !== ratio.lo ? ' to ' + fmt(ratio.hi) : ''} L per ${fmt(ratio.perKg)} kg x ${fmt(rnd(kg))} kg / ${fmt(ratio.perKg)} kg`, citation: null });
}
const HOURS = { min: 1 / 60, h: 1, d: 24, day: 24, days: 24, hour: 1, hours: 1, minutes: 1 / 60, minute: 1 / 60, week: 168, weeks: 168 };
/** A published time window as hours. column = { min, max, unit } from a stored time row. */
export function windowHours(col) { const k = HOURS[String(col && col.unit || '').toLowerCase()]; if (!k || !num(col.min) || !num(col.max)) return null; return { lo: col.min * k, hi: col.max * k }; }
export const hoursText = (h) => (h >= 48 ? `${fmt(rnd(h / 24, 1))} days` : h >= 1 ? `${fmt(rnd(h, 2))} hours` : `${fmt(Math.round(h * 60))} minutes`);
/** Sum of published windows, in order: [{ label, product, lo, hi (hours), text, url, page, condition }]. Returns the total as a range. */
export function timeline(steps) {
  if (!Array.isArray(steps) || !steps.length) return fail('Name the product and the step, for example "recoat time for SikaTile-400 EVO PRO".');
  const lo = steps.reduce((s, x) => s + x.lo, 0), hi = steps.reduce((s, x) => s + x.hi, 0);
  return out({ kind: 'timeline', lowH: rnd(lo, 3), highH: rnd(hi, 3), lowDays: rnd(lo / 24, 2), highDays: rnd(hi / 24, 2), range: Math.abs(hi - lo) > 1e-9, steps,
    formula: steps.map((s) => `${s.label} ${s.lo === s.hi ? hoursText(s.lo) : hoursText(s.lo) + ' to ' + hoursText(s.hi)}`).join(' + '), citation: null });
}

/* ------------------------------------------------------------------ reading the question */
const N = '(\\d+(?:[.,]\\d+)?)';
const nz = (s) => parseFloat(String(s).replace(',', '.'));
const clean = (text) => ' ' + String(text || '').toLowerCase().replace(/[×]/g, 'x').replace(/²/g, '2').replace(/³/g, '3').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/\s+/g, ' ') + ' ';
/** "600x600" or "600 x 600 mm" (both sides >= 50 so a room in metres is not a tile). Returns [l, w] in mm or null. */
export function tileSizeIn(t) {
  const m = new RegExp('(?<![\\d.])' + N + '\\s*(?:mm)?\\s*x\\s*' + N + '\\s*(mm|cm)?(?!\\s*x\\s*\\d)', 'g'); let r;
  for (const x of t.matchAll(m)) { let l = nz(x[1]), w = nz(x[2]); if (x[3] === 'cm') { l *= 10; w *= 10; } if (l >= 50 && w >= 50 && l <= 3000 && w <= 3000 && !/m\b|metres?/.test((x[3] || ''))) { r = [l, w]; break; } }
  return r || null;
}
const roomIn = (t) => { const m = new RegExp('(?<![\\d.])' + N + '\\s*x\\s*' + N + '\\s*(?:m|metres?|meters?)?\\s*(?:room|bathroom|kitchen|laundry|ensuite|toilet|wc|garage|balcony|patio|floor)(?![a-z])').exec(t) || new RegExp('(?<![\\d.])' + N + '\\s*(m|metres?|meters?)?\\s*x\\s*' + N + '\\s*(m|metres?|meters?)(?![a-z0-9])').exec(t) || new RegExp('(?:room|bathroom|kitchen|laundry|floor|ensuite|toilet|wc|garage|balcony|patio)\\D{0,25}?' + N + '\\s*x\\s*' + N + '(?![\\d]|\\s*mm|\\s*cm)').exec(t); if (!m) return null; const a = nz(m[1]), b = nz(m[m.length === 5 ? 3 : 2]); return a > 0 && a < 100 && b > 0 && b < 100 ? [a, b] : null; };
const areaIn = (t) => { const m = new RegExp(N + '\\s*(?:m2|sqm|sq\\.? ?m|square met(?:re|er)s?)(?![a-z0-9])').exec(t); return m ? nz(m[1]) : null; };
const mmAfter = (t, re) => { const m = re.exec(t); return m ? nz(m[1]) : null; };
const pctIn = (t, words) => { const m = new RegExp(N + '\\s*%\\s*(?:' + words + ')').exec(t) || new RegExp('(?:' + words + ')\\D{0,12}' + N + '\\s*%').exec(t); return m ? nz(m[1]) : null; };

/** What kind of question is this, and what did the visitor give? Returns { kind, f } or null. Product kinds (area rates, doses) are not decided here. */
export function understand(text) {
  const t = clean(text); const q = t.trim();
  if (!q) return null;
  // pure arithmetic: "2.4 x 1.8", "40 / 1.2", "what is 12 + 3 * 2"
  const arith = q.replace(/^(?:what(?:'s| is)|whats|calc(?:ulate)?|work out|how much is|=)\s*/, '').replace(/\?$/, '').trim();
  if (/^[\d.,\s+\-*/()x]+$/.test(arith) && /\d/.test(arith) && /[+\-*/x]/.test(arith.replace(/^-/, ''))) return { kind: 'arithmetic', f: { expr: arith } };
  // conversion
  let m = new RegExp('(?:convert\\s+)?' + N + '\\s*([a-z0-9^. ]{1,18}?)\\s+(?:to|in|into|as|=)\\s+([a-z0-9^.]+(?: [a-z]+)?)\\s*\\??$').exec(q);
  if (m && canonUnit(m[2]) && canonUnit(m[3].trim())) return { kind: 'convert', f: { value: nz(m[1]), from: canonUnit(m[2]), to: canonUnit(m[3].trim()) } };
  m = new RegExp('how many\\s+([a-z0-9^. ]{1,18}?)\\s+(?:are |is )?(?:there )?in\\s+(?:a |an |one )?' + N + '?\\s*([a-z0-9^. ]{1,18}?)\\s*\\??$').exec(q);
  if (m && canonUnit(m[1]) && canonUnit(m[3])) return { kind: 'convert', f: { value: m[2] ? nz(m[2]) : 1, from: canonUnit(m[3]), to: canonUnit(m[1]) } };
  const area = areaIn(t), room = roomIn(t), tile = tileSizeIn(t);
  const joint = mmAfter(t, new RegExp(N + '\\s*mm\\s*(?:wide\\s*)?(?:grout\\s*)?(?:joints?|gaps?|grout lines?)')) ?? mmAfter(t, new RegExp('(?:joints?|gaps?)\\s*(?:of|at|width)?\\s*' + N + '\\s*mm'));
  const sealWords = /\b(sealant|silicone|caulk|caulking|bead|cartridges?|sausages?|movement joints?|expansion joints?|backer rod)\b/.test(t);
  if (!sealWords && /\bperimeter\b|\bskirting\b/.test(t) && room) return { kind: 'perimeter', f: { length: room[0], width: room[1], deduct: mmAfter(t, new RegExp('(?:minus|less|deduct|take off|without)\\s*' + N + '\\s*m\\b')) || 0 } };
  if (!sealWords && /\bperimeter\b/.test(t)) return { kind: 'perimeter', f: {} };
  const thick = mmAfter(t, new RegExp(N + '\\s*mm\\s*(?:thick|thickness|deep|depth|tiles? thickness)')) ?? mmAfter(t, new RegExp('(?:thickness|thick|depth|deep)\\D{0,10}?' + N + '\\s*mm')) ?? (tile && (m = new RegExp('(?<![\\d.])' + N + '\\s*x\\s*' + N + '\\s*x\\s*' + N + '\\s*(?:mm)?').exec(t)) ? nz(m[3]) : null);
  const cuts = pctIn(t, 'cuts?|waste|wastage|breakage|extra|allowance|spare|overage');
  if (/\bgrout(?:ing)?\b/.test(t) && /\b(how much|how many|litres?|volume|quantity|need|work out|calculate)\b/.test(t) && (area || room) && tile) return { kind: 'grout', f: { area: area ?? room[0] * room[1], tileL: tile[0], tileW: tile[1], jointMm: joint, thicknessMm: thick, allowancePct: cuts || 0 } };
  if (/\b(how many|number of|count of|how much)\b[^?]*\btiles?\b|\btiles?\b[^?]*\b(do i need|are needed|needed|to buy|to order)\b/.test(t) && tile && (area || room)) {
    return { kind: 'tiles', f: { area, length: room && !area ? room[0] : null, width: room && !area ? room[1] : null, tileL: tile[0], tileW: tile[1], jointMm: joint || 0, cutsPct: cuts || 0, perBox: mmAfter(t, new RegExp(N + '\\s*(?:tiles?\\s*)?(?:per|a|in a)\\s*box')) || 0 } };
  }
  const lenM = mmAfter(t, new RegExp(N + '\\s*(?:lm|linear met(?:re|er)s?|lineal met(?:re|er)s?|met(?:re|er)s?|m)(?![a-z0-9])'));
  const wd = (() => { const x = new RegExp('(?<![\\d.])' + N + '\\s*(?:mm)?\\s*x\\s*' + N + '\\s*mm').exec(t); return x ? [nz(x[1]), nz(x[2])] : null; })();
  if (/\b(sealant|silicone|caulk|caulking|bead|cartridges?|sausages?|movement joints?|expansion joints?|backer rod)\b/.test(t) && /\b(how much|how many|litres?|volume|quantity|need|work out|calculate)\b/.test(t) && (lenM || room || /perimeter/.test(t))) {
    return { kind: 'sealant', f: { lengthM: (/\bperimeter\b/.test(t) && room) ? 2 * (room[0] + room[1]) : (lenM ?? (room ? 2 * (room[0] + room[1]) : null)), widthMm: wd ? wd[0] : mmAfter(t, new RegExp(N + '\\s*mm\\s*wide')), depthMm: wd ? wd[1] : mmAfter(t, new RegExp(N + '\\s*mm\\s*(?:deep|depth)')), packMl: mmAfter(t, new RegExp(N + '\\s*ml\\s*(?:cartridges?|sausages?|tubes?|packs?)')) || 0, allowancePct: cuts || 0 } };
  }
  if (/\b(screed|leveller|leveler|levelling|leveling|mortar bed|bedding|topping|slab|render|bed)\b/.test(t) && /\b(how much|litres?|volume|m3|cubic|quantity|work out|calculate|need)\b/.test(t) && area && thick) return { kind: 'bed', f: { area, thicknessMm: thick, allowancePct: cuts || 0 } };
  if (/\b(screed|leveller|leveler|levelling|leveling|mortar bed|bedding|topping)\b/.test(t) && /\b(how much|how many|volume|cubic|m3|litres?)\b/.test(t) && area) return { kind: 'bed', f: { area, thicknessMm: thick, allowancePct: cuts || 0 } };
  if (/\b(water)\b/.test(t) && /\b(how much|how many litres|mix(?:ing)?|add)\b/.test(t) && /\b(bags?|kg|kilos?)\b/.test(t)) {
    const bags = mmAfter(t, new RegExp(N + '\\s*(?:x\\s*)?bags?')); const kg = mmAfter(t, new RegExp(N + '\\s*(?:kg|kilos?)(?!\\s*bag)'));
    return { kind: 'mixwater', f: { bags: bags || 0, powderKg: kg || 0 } };
  }
  if (/\b(how long|when can|how many days|days until|wait(?:ing)?|until|before|then|after)\b/.test(t) && /\b(recoat|overcoat|over-coat|re-coat|cure|cured|curing|grout|grouting|walk|foot traffic|traffic|open time|pot life|dry|ready|second coat|next coat|tile)\b/.test(t)) return { kind: 'timeline', f: { atC: mmAfter(t, new RegExp(N + '\\s*(?:°\\s*c?|deg(?:rees)?\\s*c?|c)(?![a-z])')) } };
  return null;
}

/** The clarifying question for a missing field: one question, a recommended default chip first, other sensible chips after. value is a phrase the reader above understands. */
export const ASK = {
  thickness: { question: 'How thick is the tile? It sets how deep the grout joint is.', options: [{ label: '10 mm (typical porcelain, recommended)', value: '10 mm thick', recommended: true }, { label: '6 mm', value: '6 mm thick' }, { label: '8 mm', value: '8 mm thick' }, { label: '12 mm', value: '12 mm thick' }] },
  joint: { question: 'What joint width will you use?', options: [{ label: '3 mm (common for rectified tiles, recommended)', value: '3 mm joints', recommended: true }, { label: '2 mm', value: '2 mm joints' }, { label: '5 mm', value: '5 mm joints' }, { label: '10 mm', value: '10 mm joints' }] },
  tile: { question: 'What size is the tile, length x width in mm?', options: [{ label: '600 x 600 mm (recommended)', value: '600x600 tiles', recommended: true }, { label: '300 x 300 mm', value: '300x300 tiles' }, { label: '600 x 300 mm', value: '600x300 tiles' }, { label: '1200 x 600 mm', value: '1200x600 tiles' }] },
  area: { question: 'How big is the area, in m2?', options: [{ label: '10 m2 (recommended to start)', value: '10 m2', recommended: true }, { label: '20 m2', value: '20 m2' }, { label: '50 m2', value: '50 m2' }] },
  width: { question: 'What joint width is it, in mm?', options: [{ label: '10 mm (typical movement joint, recommended)', value: '10 mm wide', recommended: true }, { label: '6 mm', value: '6 mm wide' }, { label: '20 mm', value: '20 mm wide' }] },
  depth: { question: 'How deep will the bead be, in mm? A common rule is about half the width.', options: [{ label: '5 mm (half of a 10 mm joint, recommended)', value: '5 mm deep', recommended: true }, { label: '10 mm', value: '10 mm deep' }, { label: '6 mm', value: '6 mm deep' }] },
  length: { question: 'How many metres of joint, or what room size (length x width in metres)?', options: [{ label: '12 m of joint (recommended to start)', value: '12 m', recommended: true }, { label: '20 m', value: '20 m' }, { label: 'A 3.6 x 2.4 m room perimeter', value: 'perimeter of a 3.6 x 2.4 m room' }] },
  powder: { question: 'How many bags, or how many kg of powder?', options: [{ label: '1 bag (recommended)', value: '1 bag', recommended: true }, { label: '2 bags', value: '2 bags' }, { label: '5 bags', value: '5 bags' }] },
  temperature: { question: 'What temperature will it be at? The published windows change with temperature.', options: [{ label: '23 C (the usual test condition, recommended)', value: 'at 23 C', recommended: true }, { label: '10 C', value: 'at 10 C' }, { label: '30 C', value: 'at 30 C' }] },
};

/* ------------------------------------------------------------------ showing and re-running a stored calculation */
const grp = (n) => { const [i, d] = fmt(n).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); };
/** The answer line of a stored calculation, from its result. */
export function resultText(kind, r) {
  r = r || {};
  switch (kind) {
    case 'arithmetic': return num(r.value) ? grp(r.value) : '';
    case 'convert': return num(r.value) ? `${grp(r.value)} ${r.unit || ''}`.trim() : '';
    case 'perimeter': return num(r.value) ? `${grp(r.value)} m` : '';
    case 'tiles': return num(r.count) ? `${grp(r.count)} tiles` : '';
    case 'grout': return num(r.litres) ? `${grp(r.litres)} L of grout${r.packs ? ', ' + r.packs : ''}` : '';
    case 'sealant': return num(r.ml) ? `${grp(r.ml)} mL${r.packs ? ', ' + r.packs : ''}` : '';
    case 'bed': return num(r.m3) ? `${grp(r.m3)} m3 (${grp(r.litres)} L)` : '';
    case 'mixwater': return num(r.low_l) ? (r.low_l === r.high_l ? `${grp(r.low_l)} L` : `${grp(r.low_l)} L to ${grp(r.high_l)} L`) : '';
    case 'timeline': return num(r.low_h) ? (r.low_h === r.high_h ? hoursText(r.low_h) : `${hoursText(r.low_h)} to ${hoursText(r.high_h)}`) : '';
    case 'product': return (r.rows || []).map((x) => `${x.low === x.high ? grp(x.low) : grp(x.low) + ' to ' + grp(x.high)} ${x.unit}${x.packs ? ', ' + x.packs : ''}`).join('; ');
    default: return '';
  }
}
/** Kinds that need only their inputs (no data sheet) can be re-run anywhere, including on the project page. Returns { ok, result, normalised, formula, citation } or a refusal. */
export const RERUNNABLE = ['arithmetic', 'convert', 'perimeter', 'tiles', 'grout', 'sealant', 'bed'];
export function rerun(kind, f) {
  f = f || {}; let r;
  switch (kind) {
    case 'arithmetic': r = evalArithmetic(f.expression); return r.ok ? { ok: true, result: { value: r.value }, normalised: { expression: r.expression }, formula: `${r.expression} = ${grp(r.value)}`, citation: r.citation } : r;
    case 'convert': r = convert(f.value, f.from, f.to); return r.ok ? { ok: true, result: { value: r.value, unit: r.unit }, normalised: { value: f.value, from: unitShow(f.from), to: unitShow(f.to) }, formula: r.formula, citation: r.citation } : r;
    case 'perimeter': r = perimeter(f); return r.ok ? { ok: true, result: { value: r.value, unit: 'm', area_m2: r.area }, normalised: { length_m: f.length, width_m: f.width }, formula: r.formula, citation: r.citation } : r;
    case 'tiles': r = tiles(f); return r.ok ? { ok: true, result: { count: r.count, before_cuts: r.countBeforeCuts, exact: r.exact }, normalised: { area_m2: r.area, tile_mm: `${f.tileL} x ${f.tileW}`, joint_mm: f.jointMm || 0, cuts_pct: r.cutsPct }, formula: r.formula, citation: r.citation } : r;
    case 'grout': r = groutVolume(f); return r.ok ? { ok: true, result: { litres: r.litres, litres_per_m2: r.litresPerM2 }, normalised: { area_m2: f.area, tile_mm: `${f.tileL} x ${f.tileW}`, joint_mm: f.jointMm, tile_thickness_mm: f.thicknessMm, allowance_pct: r.allowancePct }, formula: r.formula, citation: r.citation } : r;
    case 'sealant': r = sealantVolume(f); return r.ok ? { ok: true, result: { ml: r.ml, litres: r.litres, ...(r.packs ? { packs: `${r.packs.count} x ${r.packs.size} mL` } : {}) }, normalised: { length_m: f.lengthM, width_mm: f.widthMm, depth_mm: f.depthMm, allowance_pct: r.allowancePct }, formula: r.formula, citation: r.citation } : r;
    case 'bed': r = bedVolume(f); return r.ok ? { ok: true, result: { m3: r.m3, litres: r.litres }, normalised: { area_m2: f.area, thickness_mm: f.thicknessMm, allowance_pct: r.allowancePct }, formula: r.formula, citation: r.citation } : r;
    default: return fail('This kind needs a data sheet, so ask the advisor to run it again.');
  }
}
