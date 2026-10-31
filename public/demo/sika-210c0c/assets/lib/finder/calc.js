// Quantity maths for the system finder, the system sheet and the bill of materials. Pure functions, no DOM, no network.
// Rules: quantities only (no prices); round packs UP only; an allowance is applied only when the visitor types one (default 0);
// a rate that cannot be read safely is refused with the reason, never guessed. Rate shapes come from the data sheet text
// (data/finder/r/<id>.json and data/finder/systems.json), each with its source phrase.


import { ESTIMATE_LINE, DEMO_LINE, NO_RATE_TEXT, fmt, fmtQty, packText } from './qty.js';
export { ESTIMATE_LINE, DEMO_LINE, NO_RATE_TEXT, fmt, fmtQty, packText };

const EPS = 1e-9;
const MASS = { kg: 1, g: 0.001 };
const VOL = { L: 1, l: 1, mL: 0.001, ml: 0.001 };
const LEN = { m: 1 };
const COUNT = { bags: 1, bag: 1 };

/** Unit to base unit (kg or L). Returns null for anything else. */
export function toBase(amount, unit) {
  if (unit in MASS) return { amount: amount * MASS[unit], unit: 'kg', dim: 'mass' };
  if (unit in VOL) return { amount: amount * VOL[unit], unit: 'L', dim: 'volume' };
  if (unit in LEN) return { amount, unit: 'm', dim: 'length' };
  if (unit in COUNT) return { amount, unit: 'bags', dim: 'count' };
  return null;
}
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const rnd = (x, d = 4) => { const p = 10 ** d; return Math.round((x + 1e-12) * p) / p; };
const disp = (u) => (u === 'l' ? 'L' : u === 'ml' ? 'mL' : u);
const ceilEps = (x) => Math.ceil(x - 1e-9);

/* ------------------------------------------------------------------ dosage kinds
 * Admixtures, additives, curing aids and fibres are published as a DOSE, not a coverage. The phrase is read here, in plain code, no model:
 *   dose-per-mass  { lo, hi, unit, per (kg of the basis), basis: 'cement'|'mix' }   "400 ml - 2000 ml / 100 kg of total cementitious material"
 *   dose-pct       { lo, hi, unit: '%', basis: 'cement' }                              "0.5 to 2 % by weight of cement"
 *   per-m3         { lo, hi, unit }                                                    "4-8 kg/m3", "10 to 30 litre per cubic metre of concrete"
 *   dose-per-water { lo, hi, unit, perL }                                              "300 mL per 200 L of water"
 * Optional on any of them: limit ('max' for "up to", 'min' for "at least"), typical (the centre of a "350 ml +/- 100 ml" statement).
 * A threshold ("for doses higher than 400 ml/100kg") or a test condition ("@ 6 kg/m3" in a performance line) is refused, never turned into a dose.
 * Only the published figure is used: no midpoint is invented, a range stays a range.
 */
const DN = '(\\d+(?:\\.\\d+)?)';
const DU = 'litres?|liters?|ltr|lt|mls|ml|gm|grams?|kgs|kg|bags?|g|l';
const D_AMT = '(?:' + DN + '\\s*(?:(' + DU + ')(?![a-z]))?\\s*(?:-|to|and)\\s*)?' + DN + '\\s*(' + DU + ')(?![a-z])';
const D_M3 = '(?:m3|cubic\\s*met(?:re|er)s?|cu\\.?\\s*m)(?![a-z0-9])';
const D_CONN = '(?:\\s*\\([^)]*\\))?\\s*(?:[^.;|]{0,45}?(?:per|\\/|for each|to each|for every)\\s*|\\s+)';
const RX_MASS = new RegExp(D_AMT + D_CONN + '(?:' + DN + '\\s*)?(kg|kgs|tonnes?|tons?)(?![a-z])\\s*(?:of\\s+)?(?:total\\s+)?(?:the\\s+)?(sand\\/cement mix|cementitious|cement|binder|dry mix|mix|powder)');
const RX_PCT = new RegExp('(?:' + DN + '\\s*%?\\s*(?:-|to|and)\\s*)?' + DN + '\\s*%\\s*[^.;|%]{0,40}?(?:by\\s+(?:weight|mass)\\s+of|of\\s+(?:the\\s+)?(?:weight|mass)\\s+of|of)\\s+(?:total\\s+)?(?:the\\s+)?(cementitious|cement|binder)');
const RX_M3 = new RegExp(D_AMT + '(?:\\s*\\([^)]*\\))?\\s*(?:per|\\/)\\s*(?:1\\s*)?' + D_M3);
const RX_WATER = new RegExp(D_AMT + '(?:\\s*\\([^)]*\\))?\\s*[^.;|]{0,45}?(?:per|for each|to each|for every)\\s*' + DN + '\\s*(?:litres?|liters?|l)(?![a-z])\\s*(?:of\\s+)?(?:clean\\s+|potable\\s+)?water');
const RX_PM = new RegExp(DN + '\\s*(' + DU + ')?\\s*(?:\\u00b1|\\+\\/-)\\s*' + DN + '\\s*(?:(' + DU + ')(?![a-z]))?');
const D_CANON = { ml: 'mL', mls: 'mL', l: 'L', lt: 'L', ltr: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L', g: 'g', gm: 'g', gram: 'g', grams: 'g', kg: 'kg', kgs: 'kg', bag: 'bags', bags: 'bags' };
const D_DIM = { mL: 'volume', L: 'volume', g: 'mass', kg: 'mass', bags: 'count' };
const D_SCALE = { mL: 1, L: 1000, g: 1, kg: 1000, bags: 1 };

function doseText(text) {
  return ' ' + String(text || '').toLowerCase()
    .replace(/[‐-―−]/g, '-').replace(/ /g, ' ').replace(/[®™*~]/g, ' ')
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ') + ' ';
}
/** Amounts to one unit (the smaller of two when they differ). Returns null when the units cannot be one dimension. */
function doseAmounts(g, i = 1) {
  const a = g[i] != null ? parseFloat(g[i]) : null, au = g[i + 1] ? D_CANON[g[i + 1]] : null;
  const b = parseFloat(g[i + 2]), bu = D_CANON[g[i + 3]];
  if (!bu || !(b >= 0)) return null;
  if (a == null) return { lo: b, hi: b, unit: bu, single: true };
  const u0 = au || bu;
  if (D_DIM[u0] !== D_DIM[bu]) return null;
  const small = D_SCALE[u0] <= D_SCALE[bu] ? u0 : bu;
  const conv = (x, u) => Math.round(x * D_SCALE[u] / D_SCALE[small] * 1e6) / 1e6;
  const lo = conv(a, u0), hi = conv(b, bu);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), unit: small, single: false };
}
function doseLimit(t, at) {
  const pre = t.slice(Math.max(0, at - 60), at);
  if (/\bminimum\s+(?:dose|dosage|rate)[^.;|]*$/.test(pre)) return 'min';
  if (/\bmaximum\s+(?:dose|dosage|rate)[^.;|]*$/.test(pre)) return 'max';
  if (/(?:higher|greater|more|above|over|exceeding|exceeds?|beyond)\s+(?:than\s+)?$/.test(pre)) return 'refuse';
  if (/(?:\bup\s*(?:to\s*)?|maximum\s*(?:of\s*)?|max\.?\s*|not\s+(?:more|greater)\s+than\s*|no\s+more\s+than\s*)$/.test(pre)) return 'max';
  if (/(?:minimum\s*(?:of\s*)?|min\.?\s*|at\s+least\s*|not\s+(?:less|lower)\s+than\s*)$/.test(pre)) return 'min';
  return null;
}
const REFUSE_COND = /\bjoules?\b|energy absorption|@/;
const REFUSE_TABLE = /^\s*per\s+\d+(?:\.\d+)?\s*(?:l|litres?|kg)\b[^|]*\|/;

/**
 * Read a dosage statement. Returns null when the text is not a dose, { refuse: reason } when it looks like one but must not be computed,
 * or a rate { kind, lo, hi, unit, ... }.
 */
export function detectDosage(text) {
  let t = doseText(text);
  if (REFUSE_TABLE.test(t.trim())) return { refuse: 'The figures sit in unlabelled table columns. Read the phrase.' };
  let typical = null;
  const pm = RX_PM.exec(t);
  if (pm) {
    const c = parseFloat(pm[1]), d = parseFloat(pm[3]), u = pm[2] || pm[4];
    if (u && D_CANON[u]) { t = t.slice(0, pm.index) + ' ' + (Math.round((c - d) * 1e6) / 1e6) + '-' + (Math.round((c + d) * 1e6) / 1e6) + ' ' + u + ' ' + t.slice(pm.index + pm[0].length); typical = { amount: c, unit: u }; }
  }
  // "1.0 kg/m3 and 2.0 kg/m3" is one range
  t = t.replace(new RegExp(DN + '\\s*(' + DU + ')\\s*(?:\\/|per)\\s*' + D_M3 + '\\s*(?:and|to|-)\\s*' + DN + '\\s*(?:' + DU + ')\\s*(?:\\/|per)\\s*' + D_M3), ' $1-$3 $2/m3 ');
  const tryRx = (rx) => { const g = rx.exec(t); return g ? { g, at: g.index } : null; };
  const finish = (rate, hit, base) => {
    const lim = doseLimit(t, hit.at);
    if (lim === 'refuse') return { refuse: 'This is a threshold, not a dose. Read the phrase.' };
    if (REFUSE_COND.test(t)) return { refuse: 'This is a test condition, not a dose. Read the phrase.' };
    if (lim) rate.limit = lim;
    if (typical) { const ut = D_CANON[typical.unit]; const f = D_SCALE[ut] / D_SCALE[rate.unit]; if (ut === rate.unit || D_DIM[ut] === D_DIM[rate.unit]) rate.typical = Math.round(typical.amount * f * 1e6) / 1e6; }
    return Object.assign(rate, base || {});
  };
  let h = tryRx(RX_MASS);
  if (h) {
    const a = doseAmounts(h.g); const n = h.g.length;
    if (a && D_DIM[a.unit] !== 'count') {
      const cnt = h.g[5] != null ? parseFloat(h.g[5]) : 1; const mu = h.g[6]; const basisW = h.g[7];
      const per = cnt * (/^ton/.test(mu) ? 1000 : 1);
      if (per > 0) return finish({ kind: 'dose-per-mass', lo: a.lo, hi: a.hi, unit: a.unit, per, basis: /mix|powder|sand/.test(basisW) ? 'mix' : 'cement' }, h);
    }
  }
  h = tryRx(RX_PCT);
  if (h) {
    const g = h.g; const hi = parseFloat(g[2]); const lo = g[1] != null ? parseFloat(g[1]) : hi;
    if (hi > 0 && hi <= 100) return finish({ kind: 'dose-pct', lo: Math.min(lo, hi), hi: Math.max(lo, hi), unit: '%', basis: 'cement' }, h);
  }
  h = tryRx(RX_M3);
  if (h) { const a = doseAmounts(h.g); if (a) return finish({ kind: 'per-m3', lo: a.lo, hi: a.hi, unit: a.unit }, h); }
  h = tryRx(RX_WATER);
  if (h) {
    const a = doseAmounts(h.g); const perL = parseFloat(h.g[5]);
    if (a && D_DIM[a.unit] !== 'count' && perL > 0) return finish({ kind: 'dose-per-water', lo: a.lo, hi: a.hi, unit: a.unit, perL }, h);
  }
  return REFUSE_TABLE.test(t) ? { refuse: 'The figures sit in table columns. Read the phrase.' } : null;
}

const NON_DOSE_MODELS = new Set(['per_area', 'area_per_unit', 'pack_covers_area', 'per_length', 'grout_kg_per_m2', 'grout_area_per_pack', 'joint_length_per_pack', 'yield_per_pack', 'coverage_by_condition', 'length_per_pack_by_section', 'published_bags_per_m3']);

/** The normal form for a dosage fact, or null when the fact is not a dose (the area, length and coverage kinds are never touched). */
function dosageRate(fact) {
  if (!fact) return null;
  const m = fact.parsed;
  if (m && NON_DOSE_MODELS.has(m.model)) return null;
  const d = detectDosage(fact.text);
  if (d && d.refuse) return { ok: false, reason: d.refuse };
  if (d) return { ok: true, ...d };
  return null;
}

/** Which input a rate needs: area | length | volume | cement | mix | water. */
export function inputFor(rate) {
  if (!rate || !rate.ok) return null;
  switch (rate.kind) {
    case 'per-m2': case 'm2-per-unit': case 'pack-covers': return 'area';
    case 'per-m': return 'length';
    case 'per-m3': return 'volume';
    case 'dose-per-mass': case 'dose-pct': return rate.basis === 'mix' ? 'mix' : 'cement';
    case 'dose-per-water': return 'water';
    default: return null;
  }
}
export const DOSE_KINDS = ['dose-per-mass', 'dose-pct', 'dose-per-water', 'per-m3'];

/**
 * Turn a stored rate into a normal form.
 *  { kind:'per-m2', lo, hi, unit, perMm, perCoat }       quantity of product per m2
 *  { kind:'m2-per-unit', lo, hi, unit, perCoat }          coverage in m2 for one unit of product
 *  { kind:'pack-covers', amount, unit, lo, hi }           one pack of `amount unit` covers lo..hi m2
 *  { kind:'per-m', lo, hi, unit } / { kind:'per-m3', lo, hi, unit }
 * Returns { ok:false, reason } when the shape cannot be used safely.
 */
export function normaliseFact(fact) {
  const m = fact && fact.parsed;
  const dose = dosageRate(fact);
  if (dose) return dose;
  if (!m) return { ok: false, reason: 'The statement could not be read as a rate. Read the phrase.' };
  if (fact.calc_ready === false) return { ok: false, reason: 'The statement does not say what the figure is per. Read the phrase.' };
  const perCoat = m.per === 'coat' || m.per === 'layer';
  switch (m.model) {
    case 'per_area':
      if (m.coats_min || m.coats_max) return { ok: false, reason: 'The statement gives a figure for several layers. Read the phrase.' };
      return { ok: true, kind: 'per-m2', lo: m.min, hi: m.max, unit: m.unit, perMm: m.per === 'mm' || m.per === 'cm', mmFactor: m.per === 'cm' ? 0.1 : 1, perCoat };
    case 'area_per_unit': return { ok: true, kind: 'm2-per-unit', lo: m.min, hi: m.max, unit: m.unit, perCoat };
    case 'pack_covers_area': return { ok: true, kind: 'pack-covers', amount: m.amount, unit: m.unit, lo: m.area_min, hi: m.area_max };
    case 'per_length': return { ok: true, kind: 'per-m', lo: m.min, hi: m.max, unit: m.unit };
    case 'dosage_per_m3': return { ok: true, kind: 'per-m3', lo: m.min, hi: m.max, unit: m.unit };
    default: return { ok: false, reason: 'This kind of figure is not worked out here. Read the phrase in the data sheet.' };
  }
}

/** The same normal form from a system finder rate ({ low, high, unit, per:'m2'|'m2-per-pack', ratePack }). */
export function normaliseSystemRate(r) {
  if (!r || !num(r.low) || !num(r.high)) return { ok: false, reason: NO_RATE_TEXT };
  if (r.per === 'm2-per-pack' && r.ratePack) return { ok: true, kind: 'pack-covers', amount: r.ratePack.size, unit: r.ratePack.unit, lo: r.low, hi: r.high };
  if (r.per === 'm2') return { ok: true, kind: 'per-m2', lo: r.low, hi: r.high, unit: r.unit, perMm: false, perCoat: false };
  return { ok: false, reason: 'The statement could not be read as a rate. Read the phrase.' };
}

/**
 * Quantity for a job. job = { area, length, volume, thickness, coats, allowancePct }.
 * The allowance (percent) is added to the measured size; it is 0 unless the visitor sets it.
 * Returns { ok, low, high, unit (kg|L|m), allowancePct } or { ok:false, reason, need }.
 */
export function quantity(rate, job) {
  if (!rate || !rate.ok) return { ok: false, reason: (rate && rate.reason) || NO_RATE_TEXT };
  const a = num(job.allowancePct) && job.allowancePct > 0 ? job.allowancePct : 0;
  const k = 1 + a / 100;
  const need = (key, label) => ({ ok: false, need: key, reason: 'Enter ' + label + ' to work this out.' });
  let lo, hi, u, typical = null;
  switch (rate.kind) {
    case 'per-m2': {
      if (!num(job.area) || job.area <= 0) return need('area', 'an area in m2');
      let mult = 1;
      if (rate.perMm) { if (!num(job.thickness) || job.thickness <= 0) return need('thickness', 'a thickness in mm (the published rate is per mm)'); mult = job.thickness * (rate.mmFactor || 1); }
      if (rate.perCoat) mult *= num(job.coats) && job.coats > 0 ? job.coats : 1;
      const b1 = toBase(rate.lo, rate.unit), b2 = toBase(rate.hi, rate.unit);
      if (!b1 || !b2) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      lo = b1.amount * job.area * k * mult; hi = b2.amount * job.area * k * mult; u = b1.unit; break;
    }
    case 'm2-per-unit': {
      if (!num(job.area) || job.area <= 0) return need('area', 'an area in m2');
      const bu = toBase(1, rate.unit);
      if (!bu) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      const mult = rate.perCoat ? (num(job.coats) && job.coats > 0 ? job.coats : 1) : 1;
      lo = job.area * k / rate.hi * mult * bu.amount; hi = job.area * k / rate.lo * mult * bu.amount; u = bu.unit; break;
    }
    case 'pack-covers': {
      if (!num(job.area) || job.area <= 0) return need('area', 'an area in m2');
      const bp = toBase(rate.amount, rate.unit);
      if (!bp) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      lo = job.area * k / rate.hi * bp.amount; hi = job.area * k / rate.lo * bp.amount; u = bp.unit; break;
    }
    case 'per-m': {
      if (!num(job.length) || job.length <= 0) return need('length', 'a length in metres');
      const b1 = toBase(rate.lo, rate.unit), b2 = toBase(rate.hi, rate.unit);
      if (!b1 || !b2) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      lo = b1.amount * job.length * k; hi = b2.amount * job.length * k; u = b1.unit; break;
    }
    case 'per-m3': {
      if (!num(job.volume) || job.volume <= 0) return need('volume', 'a volume in m3');
      const b1 = toBase(rate.lo, rate.unit), b2 = toBase(rate.hi, rate.unit);
      if (!b1 || !b2) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      lo = b1.amount * job.volume * k; hi = b2.amount * job.volume * k; u = b1.unit; break;
    }
    case 'dose-per-mass': case 'dose-pct': case 'dose-per-water': {
      const key = inputFor(rate);
      const size = key === 'cement' ? job.cementKg : key === 'mix' ? job.mixKg : job.waterL;
      if (!num(size) || size <= 0) return need(key, key === 'cement' ? 'the mass of cement or binder in kg (1 tonne is 1000 kg)' : key === 'mix' ? 'the mass of the mix in kg' : 'the volume of water in litres');
      const b1 = rate.kind === 'dose-pct' ? { amount: rate.lo / 100, unit: 'kg' } : toBase(rate.lo, rate.unit), b2 = rate.kind === 'dose-pct' ? { amount: rate.hi / 100, unit: 'kg' } : toBase(rate.hi, rate.unit);
      if (!b1 || !b2) return { ok: false, reason: 'Unit not supported. Read the phrase.' };
      const f = rate.kind === 'dose-pct' ? size : size / (rate.kind === 'dose-per-water' ? rate.perL : rate.per);
      lo = b1.amount * f * k; hi = b2.amount * f * k; u = b1.unit;
      if (rate.typical != null) { const bt = rate.kind === 'dose-pct' ? { amount: rate.typical / 100, unit: 'kg' } : toBase(rate.typical, rate.unit); if (bt) typical = rnd(bt.amount * f * k); }
      break;
    }
    default: return { ok: false, reason: 'Not worked out here. Read the phrase.' };
  }
  const out = { ok: true, low: rnd(lo), high: rnd(hi), unit: u, allowancePct: a, range: Math.abs(hi - lo) > 1e-6 };
  if (rate.limit) { out.limit = rate.limit; out.range = false; }
  if (typical != null) out.typical = typical;
  return out;
}

/**
 * Whole packs, rounded UP, in each published pack size. packs = [{ amount, unit }]; qty = { amount, unit } in kg or L.
 * Returns { options: [{ size, unit, count, total }] (largest pack first), suggested } or { options: [], note } when no pack is in the same
 * unit family (a rate in kg and packs in litres cannot be converted without a density, and none is assumed).
 */
export function packOptions(packs, qty) {
  const dim = qty.unit === 'kg' ? 'mass' : qty.unit === 'L' ? 'volume' : null;
  const sizes = [];
  const seen = new Set();
  for (const p of packs || []) {
    const b = toBase(p.amount, p.unit);
    if (!b || b.dim !== dim || !(b.amount > 0)) continue;
    const key = rnd(b.amount, 6);
    if (seen.has(key)) continue;
    seen.add(key); sizes.push({ base: b.amount, size: p.amount, unit: p.unit });
  }
  sizes.sort((x, y) => y.base - x.base);
  if (!sizes.length) return { options: [], note: (packs && packs.length) ? 'The pack sizes are in a different unit from the rate, and no density is published to convert. Check the data sheet.' : 'No pack size is published for this product.' };
  const options = sizes.map((s) => { const count = ceilEps(qty.amount / s.base); return { size: s.size, unit: disp(s.unit), count, total: rnd(count * s.base) }; });
  return { options, suggested: suggest(sizes, qty.amount) };
}

/** Least over-supply from a mix of published sizes, then fewest packs. Bounded search, at most 4 sizes. */
function suggest(sizes, q) {
  const S = sizes.slice(0, 4);
  const memo = new Map();
  const best = (rem, i) => {
    const key = i + ':' + rnd(rem, 6);
    if (memo.has(key)) return memo.get(key);
    const s = S[i]; let res;
    if (i === S.length - 1) { const n = rem <= EPS ? 0 : ceilEps(rem / s.base); res = { total: n * s.base, count: n, counts: [n] }; }
    else {
      const maxN = rem <= EPS ? 0 : ceilEps(rem / s.base);
      for (let n = 0; n <= maxN; n++) {
        const sub = best(Math.max(0, rem - n * s.base), i + 1);
        const total = n * s.base + sub.total, count = n + sub.count;
        if (!res || total < res.total - EPS || (Math.abs(total - res.total) <= EPS && count < res.count)) res = { total, count, counts: [n, ...sub.counts] };
      }
    }
    memo.set(key, res); return res;
  };
  if (q > 5e4) return null;
  const r = best(q, 0);
  return { mix: r.counts.map((n, i) => n > 0 ? { size: S[i].size, unit: disp(S[i].unit), count: n } : null).filter(Boolean), total: rnd(r.total), over: rnd(r.total - q) };
}


/**
 * Whole packs for a LOW to HIGH quantity, rounded up, per published pack size (largest first).
 * options: [{ size, unit, countLow, countHigh, totalLow, totalHigh }]. A single figure gives countLow = countHigh.
 * A rate in kg with packs in L (or the reverse) cannot be converted without a density, and none is assumed.
 */
export function packRange(packs, qty) {
  const lowQ = { amount: qty.low, unit: qty.unit }, highQ = { amount: qty.high, unit: qty.unit };
  const hi = packOptions(packs, highQ);
  if (!hi.options.length) return { options: [], note: hi.note };
  const lo = packOptions(packs, lowQ);
  const options = hi.options.map((o, i) => ({ size: o.size, unit: o.unit, countLow: lo.options[i].count, countHigh: o.count, totalLow: lo.options[i].total, totalHigh: o.total }));
  return { options };
}
/** One text line for a pack range, for example "1 to 2 x 10 L". */
export function packRangeText(o, limit) {
  const size = fmt(o.size) + ' ' + o.unit;
  if (limit === 'max') return 'up to ' + o.countHigh + ' x ' + size;
  if (limit === 'min') return 'at least ' + o.countLow + ' x ' + size;
  return (o.countLow === o.countHigh ? o.countHigh : o.countLow + ' to ' + o.countHigh) + ' x ' + size;
}
/** The published range as the page prints it: "400 mL to 2,000 mL per 100 kg of cement or binder". */
export function fmtK(n) { const [i, d] = fmt(n).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); }
export function doseBasisText(rate) {
  if (!rate || !rate.ok) return '';
  const u = rate.unit;
  const sp = u === '%' ? '' : ' ';
  const one = (x) => fmtK(x) + sp + u;
  const range = rate.lo === rate.hi ? one(rate.lo) : one(rate.lo) + ' to ' + one(rate.hi);
  const lead = rate.limit === 'max' ? 'up to ' : rate.limit === 'min' ? 'at least ' : '';
  const per = rate.kind === 'dose-per-mass' ? ' per ' + fmtK(rate.per) + ' kg of ' + (rate.basis === 'mix' ? 'mix' : 'cement or binder')
    : rate.kind === 'dose-pct' ? ' by weight of cement or binder'
    : rate.kind === 'dose-per-water' ? ' per ' + fmtK(rate.perL) + ' L of water'
    : rate.kind === 'per-m3' ? ' per m3 of concrete or mix' : '';
  return lead + (rate.limit ? one(rate.hi) : range) + per;
}

/** Full result for one rate: quantity, pack options, and the basis. Convenience for the sheet and the calculator. */
export function work(rate, packs, job) {
  const q = quantity(rate, job);
  if (!q.ok) return q;
  const hiQ = { amount: q.high, unit: q.unit };
  if (q.unit === 'm') return { ...q, packs: { options: [], note: 'Quantity is per metre; see the data sheet for pack coverage.' } };
  if (q.unit === 'bags') return { ...q, packs: { options: [], note: 'The figure is already in bags.' } };
  const out = { ...q, packs: packOptions(packs, hiQ), packsFor: 'high' };
  if (DOSE_KINDS.includes(rate.kind)) out.packRange = packRange(packs, q);
  return out;
}
