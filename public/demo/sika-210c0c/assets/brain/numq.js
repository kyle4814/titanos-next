// numq.js: quantity questions with no product named ("how much adhesive for 15 m2 of 600x600 tiles", "how many bags of leveller for 100 m2 at 5 mm").
// The products come from advisor.recommendForJob (the same entry point "recommend me one" uses), the maths from lib/finder/calc.js (quantity, packOptions),
// the rates from the published data sheet facts (area rates in the product shard, thickness rates in data/brain/num). One compact 'calculation' card:
// a ranked list, the quantity per candidate with its cited sentence, packs rounded up, the estimate sentence (added by the UI for calculation cards) and the cart actions.
// No price, no waste allowance unless typed, a product with no usable published rate is left out and named. No model.
import { card, fact, CHIPS } from './schema.js';
import { computeQuantity, parsePacks, chooseCard, unknown } from './cards.js';
import { quantity, packOptions, fmt } from '../lib/finder/calc.js';
import { tableAsk } from './grid.js';

// TODO(w2-dosage): per-100-kg, percent-of-cement and per-m3 dosage kinds plug in here once calc.js exports them (they are another lane's change to calc.js).
export const thicknessOf = (n) => { const s = String(n).replace(/\b\d+(?:\.\d+)? ?(?:mm)? ?(?:x|by|\*) ?\d+(?:\.\d+)? ?(?:mm|millimet(?:er|re)s?)?\b(?: (?:tiles?|format|sheets?|pavers?|slabs?|joints?))?/g, ' ').replace(/\b\d+(?:\.\d+)? ?(?:mm|millimet(?:er|re)s?) (?:tiles?|pavers?|mosaics?|format|joints?|gaps?|wide|deep|joint width)\b/g, ' '); const m = s.match(/(?:^|[^\d.x])(\d+(?:\.\d+)?)\s*(?:mm|millimet(?:er|re)s?)\b/); return m ? Number(m[1]) : null; };
/** a thickness over 50 mm is almost always a tile size or a joint read as a layer: the quantity path asks instead of computing */
export const THICK_MAX = 50;
const THICK_KINDS = new Set(['screed', 'level_primer', 'ramp_patch', 'repair_mortar', 'grout_precision']);
const LINE = (label, text) => ({ label, text });
const wherePds = (s) => (s && s.t === 'WEB' ? 'product page' : 'data sheet') + (s && s.p ? ', page ' + s.p : '');

/** One candidate's quantity: { ok, qty:{low,high,unit}, packs, fact, basis } or { ok:false, why }. */
export function candidateQuantity({ sh, numShard, area, thickness }) {
  const packs = parsePacks(sh);
  // 1. thickness rates (kg per m2 per mm) from the num shard
  for (const r of (numShard && numShard.qr) || []) {
    if (!(thickness > 0)) return { ok: false, needThickness: true, why: 'its published rate is per millimetre of thickness' };
    const lay = numShard.f && numShard.f.layer && numShard.f.layer[0] && numShard.f.layer[0].v.items && numShard.f.layer[0].v.items[0];
    if (lay && (thickness < lay.mm_lo || thickness > lay.mm_hi)) return { ok: false, why: 'the thickness you asked for is outside its published layer thickness range', outside: true };
    const rate = { ok: true, kind: 'per-m2', lo: r.exact != null ? r.exact : r.lo, hi: r.exact != null ? r.exact : r.hi, unit: r.unit, perMm: true, mmFactor: 1 };
    const q = quantity(rate, { area, thickness });
    if (!q.ok) return { ok: false, why: q.reason };
    const po = packOptions(packs.map((p) => ({ amount: p.amount, unit: p.unit })), { amount: q.high, unit: q.unit });
    return { ok: true, qty: q, packs: po, basis: { k: 'per_m2_mm', per_mm_lo: r.lo, per_mm_hi: r.hi, unit: r.unit, derived: r.derived || null }, sentence: r.t, s: r.s, factId: r.fact, thickness };
  }
  // 2. area rates from the product shard (pack covers, area per unit, kg per m2); per-mm facts need the thickness
  for (const f of (sh.r && sh.r.facts && sh.r.facts.consumption) || []) {
    const q = computeQuantity(f, area, thickness); if (!q) continue;
    const po = packOptions(packs.map((p) => ({ amount: p.amount, unit: p.unit })), { amount: q.need_max, unit: q.unit });
    return { ok: true, qty: { low: q.need_min, high: q.need_max, unit: q.unit, range: Math.abs(q.need_max - q.need_min) > 1e-9 }, packs: po, basis: { k: q.basis }, sentence: f.text, s: f.s, factId: f.id, thickness: q.thickness_mm || null };
  }
  return { ok: false, why: 'no usable published rate' };
}

const qtyText = (q) => (Math.abs(q.high - q.low) > 1e-9 ? `${fmt(q.low)} to ${fmt(q.high)} ${q.unit}` : `${fmt(q.high)} ${q.unit}`);
const packText = (po) => {
  if (!po || !po.options || !po.options.length) return 'pack size not published in the same unit';
  return po.options.slice(0, 2).map((o) => `${o.count} x ${fmt(o.size)} ${o.unit}${/bag|pail|cartridge|kit/.test(o.container || '') ? '' : ''}`).join(' or ');
};
const cartName = (n) => String(n).replace(/\s+/g, ' ');

/**
 * Answer a product-less quantity question. Returns { cards, state } or null when this is not a quantity-by-kind question the data can serve.
 * job: { area, thickness, kindId, n (normalised question), excludeIds }. advisor: createAdvisor(); load: shard loader.
 */
export async function quantityByKind({ q, n, area, thickness, advisor, load, rel, excludeIds = [], kindId = null, pick = 3 }) {
  let kid = kindId || advisor.kindOf(n); if (!kid) return null;
  // "adhesive for a 12 m2 bathroom floor" names a tiling job even without the word tile: try the tile adhesives first
  if (kid === 'construction_adhesive' && /\b(floor|floors|bathroom|shower|kitchen|laundry|wall|walls|splashback|room|balcony)\b/.test(n)) kid = 'tile_adhesive';
  const rec = await advisor.recommendForJob({ kindId: kid, question: n, rel, excludeIds, limit: 30 });
  if (!rec.picks.length) return null;
  const rows = []; const left = []; const tabular = []; let needThick = false;
  const work = async (pk, flag) => {
    const sh = await load.product(pk.id); if (!sh) return;
    { const ask = tableAsk((sh.r && sh.r.facts && sh.r.facts.consumption) || []); if (ask && !flag) tabular.push({ pk, ask }); }
    const numShard = load.num ? await load.num(pk.id) : null;
    const cq = candidateQuantity({ sh, numShard, area, thickness });
    if (cq.ok) rows.push({ pk: flag ? { ...pk, name: pk.name, flag: true } : pk, sh, cq }); else { if (cq.needThickness) needThick = true; left.push({ pk, why: cq.why, outside: !!cq.outside }); }
  };
  for (const pk of rec.picks) await work(pk, false);
  // too few documented-fit products with a usable rate: add the rest of the group, marked as "fit not documented", never as a recommendation
  if (rows.length < 2 && rec.ordered) {
    const seen = new Set(rec.picks.map((p) => p.id));
    const rec2 = await advisor.recommendForJob({ kindId: kid, question: '', excludeIds: [...excludeIds, ...seen], limit: 30 });
    for (const pk of rec2.picks) { if (rows.length >= 3) break; await work(pk, true); }
  }
  if (!rows.length && needThick && !(thickness > 0)) return { cards: [chooseCard(`How much ${rec.label}?`, `Those products are rated per millimetre of thickness, so the quantity depends on how thick you pour or apply. How thick, in mm?`, [3, 5, 10].map((t) => `${q.replace(/\s+at\s+\d+\s*mm/i, '')} at ${t} mm`))], state: { advice: { n, ids: rec.picks.map((p) => p.id) }, job: { kindId: kid, area, thickness: null, n } } };
  // a group with products whose published table needs one more thing from the visitor (grout: tile size and joint width; adhesive: notched trowel): ask WHICH product, with a chip for each product whose table can be worked out
  const tabChips = (tabular.length && !(thickness > 0)) ? tabular.map((t) => `How much ${cartName(t.pk.name)} for ${fmt(area)} m2`) : [];
  const tabAsk = [...new Set(tabular.map((t) => t.ask))].join(' or ');
  if (tabChips.length && !rows.length) {
    return { cards: [chooseCard(`How much ${rec.label} for ${fmt(area)} m2?`, `Which product? These are the ${rec.label} whose published tables I can work out a quantity from. They depend on your ${tabAsk}, so I will ask for that next. Pick one.`, tabChips)], state: { advice: { n, ids: tabular.map((t) => t.pk.id) }, job: { kindId: kid, area, thickness: null, n, ids: tabular.map((t) => t.pk.id) } } };
  }
  if (!rows.length) return null;
  const top = rows.slice(0, pick);
  const facts = top.map(({ cq }) => fact({ source_url: cq.s.u, page: cq.s.p == null ? null : cq.s.p, sentence: cq.sentence, doc_type: cq.s.t, doc_version: cq.s.v || '' }));
  const tableRows = top.map(({ pk, cq }) => [pk.flag ? pk.name + ' (fit to your job not documented in its text)' : pk.name, qtyText(cq.qty), packText(cq.packs), `${cq.sentence} (${wherePds(cq.s)})`]);
  const lines = [LINE('Area you asked about', `${fmt(area)} m2`)];
  if (thickness > 0) lines.push(LINE('Thickness you asked about', `${fmt(thickness)} mm`));
  lines.push(LINE('Order of the list', rec.ordered ? `Products whose own published text documents a fit${rec.conds.length ? ' (' + rec.conds.join(', ') + ')' : ''}, best documented fit first. Not a claim that one is the best.` : 'No condition was named, so this is the documented range, not a ranking. Tell me the place or surface and I will order it.'));
  if (tabChips.length) lines.push(LINE('Which product', `${tabular.length > 1 ? 'These products each publish' : 'This product publishes'} a table that depends on your ${tabAsk}. Pick ${tabular.length > 1 ? 'one' : 'it'} below and I will ask for that and work it out.`));
  const leftOut = left.filter((l) => !tabular.some((t) => t.pk.id === l.pk.id));
  if (leftOut.length) lines.push(LINE('Left out', leftOut.slice(0, 4).map((l) => `${l.pk.name} (${l.why})`).join('; ')));
  lines.push(LINE('Waste', 'Not included. The data sheet figures are theoretical; add your own allowance.'));
  const cartFollow = top.map(({ pk, cq }) => { const o = cq.packs && cq.packs.options && cq.packs.options[0]; return o ? `Add ${o.count} x ${fmt(o.size)} ${o.unit} of ${cartName(pk.name)} to my project` : `Add ${cartName(pk.name)} to my project`; });
  const c = card({
    type: 'calculation', title: `How much ${rec.label} for ${fmt(area)} m2${thickness > 0 ? ' at ' + fmt(thickness) + ' mm' : ''}`, product: null,
    headline: pick === 1 ? 'This is the best documented fit for the job so far, with the quantity worked out from its published rate. Quantities only, no prices. Not a claim that it is the best product.' : 'No product was named, so this lists the products whose own published text documents a fit, with the quantity worked out from each one\'s published rate. Quantities only, no prices.',
    lines, facts, source: facts[0], chip: CHIPS.DERIVED,
    links: top.map(({ pk }) => ({ label: pk.name, url: pk.url })), table: { cols: ['Product', 'Quantity (higher figure covers it)', 'Packs, rounded up', 'Published rate (source)'], rows: tableRows },
    calc: { derived: true, inputs: { area_m2: area, ...(thickness > 0 ? { thickness_mm: thickness } : {}), rows: top.map(({ pk, cq }) => ({ id: pk.id, fact: cq.factId, basis: cq.basis, sentence: cq.sentence })) }, outputs: top.map(({ cq }) => ({ unit: cq.qty.unit, need_min: cq.qty.low, need_max: cq.qty.high, basis: cq.basis.k })), plan: top.map(({ cq }) => (cq.packs && cq.packs.options ? cq.packs.options.map((o) => ({ size: o.size, unit: o.unit, count: o.count })) : [])) },
    followups: [...tabChips, ...cartFollow, ...top.slice(0, 1).map(({ pk }) => `Data sheet for ${pk.name}`)],
  });
  return { cards: [c], state: { advice: { n, ids: rows.map((r) => r.pk.id) }, job: { kindId: kid, area, thickness: thickness || null, n, ids: top.map((r) => r.pk.id) } } };
}

/** The advice card for recommendForJob when no area is known yet: the picks, each with the sentence that documents the fit, or an honest decline. */
export function recommendCard(rec, q) {
  if (!rec.picks.length) return unknown(q, null, rec.honest || 'No product in that group states a fit for what you asked in its published text, so I will not name one.', ['a documented fit']);
  const facts = rec.picks.map((p) => fact({ source_url: p.url, sentence: p.why[0] || '', doc_type: 'WEB' })).filter((f) => f.sentence);
  if (!facts.length) return unknown(q, null, 'The products in that group have no published sentence that documents a fit for the job, so I will not name one.', ['a documented fit']);
  return card({ type: 'advice', status: 'PUBLISHED', title: `${rec.label.charAt(0).toUpperCase() + rec.label.slice(1)}: the best documented fit so far`, headline: rec.honest || 'Ordered by how many of your conditions each product\'s own published text mentions. Not a claim that one is the best.',
    lines: rec.picks.map((p, i) => ({ label: p.name, text: facts[i] ? facts[i].sentence : '' })).filter((l) => l.text), facts, source: facts[0], chip: CHIPS.ADVICE, links: rec.picks.map((p) => ({ label: p.name, url: p.url })),
    handoff: { question: q, product: '', reason: 'The data sheets cannot see your site, substrate or conditions, so Technical Services should confirm the fit before you order.', missing: [] }, followups: rec.picks.slice(0, 3).map((p) => `Data sheet for ${p.name}`) });
}
