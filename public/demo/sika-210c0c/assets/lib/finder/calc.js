// Quantity maths for the system finder, the system sheet and the bill of materials. Pure functions, no DOM, no network.
// Rules: quantities only (no prices); round packs UP only; an allowance is applied only when the visitor types one (default 0);
// a rate that cannot be read safely is refused with the reason, never guessed. Rate shapes come from the data sheet text
// (data/finder/r/<id>.json and data/finder/systems.json), each with its source phrase.

export const ESTIMATE_LINE = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
export const DEMO_LINE = 'Built from Sika Australia\'s public data sheets on 2026-10-30. Not an official Sika document. Technical Services decides suitability.';
export const NO_RATE_TEXT = 'Rate not published, ask Technical Services';

const EPS = 1e-9;
const MASS = { kg: 1, g: 0.001 };
const VOL = { L: 1, l: 1, mL: 0.001, ml: 0.001 };
const LEN = { m: 1 };

/** Unit to base unit (kg or L). Returns null for anything else. */
export function toBase(amount, unit) {
  if (unit in MASS) return { amount: amount * MASS[unit], unit: 'kg', dim: 'mass' };
  if (unit in VOL) return { amount: amount * VOL[unit], unit: 'L', dim: 'volume' };
  if (unit in LEN) return { amount, unit: 'm', dim: 'length' };
  return null;
}
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const rnd = (x, d = 4) => { const p = 10 ** d; return Math.round((x + 1e-12) * p) / p; };
const disp = (u) => (u === 'l' ? 'L' : u === 'ml' ? 'mL' : u);
const ceilEps = (x) => Math.ceil(x - 1e-9);

/** Number as text: up to 2 decimals, no trailing zeros. */
export function fmt(n) { return String(Math.round(n * 100) / 100); }
/** Quantity with unit; small amounts shown in the smaller unit. */
export function fmtQty(amount, unit) {
  if (unit === 'L' && amount < 1) return fmt(amount * 1000) + ' mL';
  if (unit === 'kg' && amount < 1) return fmt(amount * 1000) + ' g';
  return fmt(amount) + ' ' + unit;
}

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
  let lo, hi, u;
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
    default: return { ok: false, reason: 'Not worked out here. Read the phrase.' };
  }
  return { ok: true, low: rnd(lo), high: rnd(hi), unit: u, allowancePct: a, range: Math.abs(hi - lo) > 1e-6 };
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

/** One text line for a pack option, for example "3 x 10 L (30 L)". */
export function packText(o) { return o.count + ' x ' + fmt(o.size) + ' ' + o.unit + ' (' + fmtQty(o.total, o.unit === 'mL' ? 'L' : o.unit === 'g' ? 'kg' : o.unit) + ')'; }

/** Full result for one rate: quantity, pack options, and the basis. Convenience for the sheet and the calculator. */
export function work(rate, packs, job) {
  const q = quantity(rate, job);
  if (!q.ok) return q;
  const hiQ = { amount: q.high, unit: q.unit };
  if (q.unit === 'm') return { ...q, packs: { options: [], note: 'Quantity is per metre; see the data sheet for pack coverage.' } };
  return { ...q, packs: packOptions(packs, hiQ), packsFor: 'high' };
}
