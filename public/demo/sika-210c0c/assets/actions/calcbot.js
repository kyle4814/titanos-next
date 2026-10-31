// The advisor as a calculator: every calculation kind that is not one product's area rate (arithmetic, conversions, perimeter, tile counts, grout and sealant
// volumes, beds, mixing water, timelines) answered through lib/finder/gencalc.js, each with its working, a citation and the estimate sentence, and each
// storable in the project (calculations[] in lib/projectstore.js). Plain code, no model. A missing input gets ONE question with a recommended chip.
import { card, clarifyCard, unknownCard, src, plain, findProducts, ESTIMATE_LINE } from './core.js';
import * as G from '../lib/finder/gencalc.js';
import { normaliseFact, packOptions, fmt, fmtQty } from '../lib/finder/calc.js';
import { srcOf } from './shared.js';

const nf = (n) => { const [i, d] = fmt(n).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); };
const ALLOWED_WITH_PRODUCT = new Set(['mixwater', 'timeline', 'sealant', 'grout']);
const NEED_ORDER = { grout: ['area', 'tile', 'joint', 'thickness'], tiles: ['area', 'tile'], sealant: ['length', 'width', 'depth'], bed: ['area', 'thickness'], perimeter: ['room'], mixwater: ['powder'] };
const ASK_EXTRA = { room: { question: 'What is the room length and width, in metres?', options: [{ label: '3.6 x 2.4 m (recommended to start)', value: 'perimeter of a 3.6 x 2.4 m room', recommended: true }, { label: '3 x 3 m', value: 'perimeter of a 3 x 3 m room' }, { label: '5 x 4 m', value: 'perimeter of a 5 x 4 m room' }] },
  thicknessBed: { question: 'How thick is the bed, in mm?', options: [{ label: '40 mm (a common screed depth, recommended)', value: '40 mm thick', recommended: true }, { label: '10 mm', value: '10 mm thick' }, { label: '20 mm', value: '20 mm thick' }, { label: '50 mm', value: '50 mm thick' }] } };

/** A bare number typed to answer our one question fills the first field that is still empty. */
function fillBare(kind, f, text, missing) {
  const m = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:mm|m|m2)?\s*$/.exec(String(text || '').toLowerCase()); if (!m || !missing) return f;
  const v = parseFloat(m[1].replace(',', '.')); const g = { ...f };
  const key = { thickness: 'thicknessMm', joint: 'jointMm', width: 'widthMm', depth: 'depthMm', length: 'lengthM', area: 'area' }[missing]; if (key && g[key] == null) g[key] = v;
  return g;
}
const askCard = (key, kind) => { const a = (kind === 'bed' && key === 'thickness') ? ASK_EXTRA.thicknessBed : ASK_EXTRA[key] || G.ASK[key]; return clarifyCard('calc', a.question, a.options, 'g_' + key); };
const missingKey = (kind, f) => {
  const has = { area: f.area != null || (f.length != null && f.width != null), tile: f.tileL != null && f.tileW != null, joint: f.jointMm != null && f.jointMm > 0, thickness: f.thicknessMm != null, length: f.lengthM != null, width: f.widthMm != null, depth: f.depthMm != null, room: f.length != null && f.width != null, powder: !!(f.bags || f.powderKg) };
  return (NEED_ORDER[kind] || []).find((k) => !has[k]) || null;
};

function record(ctx, kind, o) {
  return { kind, product: o.product || 'none', productName: o.productName || '', title: plain(o.title), question: plain(ctx.rest || ctx.text || ''), inputs: o.inputs || {}, normalised: o.normalised || {}, result: o.result || {}, summary: plain(o.summary || ''), answer: plain(G.resultText(kind, o.result)), formula: plain(o.formula || ''), citation: o.citation || null, estimate: ESTIMATE_LINE };
}
function finish(ctx, rec, rows, extra = {}) {
  const c = card('calc', 'quantity', rec.title, { estimate: true, ...extra });
  c.summary = rec.summary;
  c.rows.push({ label: 'Your numbers', value: Object.entries(rec.normalised).map(([k, v]) => `${k} ${v}`).join(', ') || 'As typed', input: true });
  c.rows.push(...rows);
  if (rec.formula) c.rows.push({ label: 'Working', value: plain(rec.formula), meta: true, source: null });
  const cit = rec.citation;
  c.rows.push({ label: 'Source', value: cit && cit.kind === 'worked' ? cit.text : cit ? cit.text : G.WORKED, meta: true, source: cit && cit.url ? src(cit.url, `Data sheet${cit.page ? ', page ' + cit.page : ''}`, cit.text) : null });
  c.calcRecord = rec; ctx.session.lastCalc = rec;
  c.buttons = [{ label: 'Save to project details', command: '/calcsave' }, ...(rec.product !== 'none' ? [{ label: 'Save and add to cart', command: '/calcsave cart' }] : []), { label: 'What is in my project', command: '/projects' }];
  return c;
}

const packsMl = (packs) => (packs || []).filter((p) => ['mL', 'L', 'ml', 'l'].includes(p.unit)).map((p) => ({ amount: p.amount, unit: p.unit }));

/** The calculator. Returns a card, or null when this is not a calculator question (then the product flows run as before). */
export async function genCalc(ctx, named) {
  const { data, session } = ctx;
  const text = ctx.rest || ctx.text || '';
  const u = G.understand(text);
  if (!u) return null;
  if (named && !ALLOWED_WITH_PRODUCT.has(u.kind)) return null;
  let { kind, f } = u;
  // an answer to our one question ("10 mm thick") arrives joined to the first question, so the same reader sees both
  const miss0 = missingKey(kind, f);
  if (ctx.noAsk && miss0) f = fillBare(kind, f, text, miss0);
  const p = named || null;
  const base = { product: p ? p.id : 'none', productName: p ? plain(p.name) : '' };

  if (kind === 'arithmetic') {
    const r = G.evalArithmetic(f.expr); if (!r.ok) return unknownCard('calc', 'Sum', r.reason, { estimate: false });
    const rec = record(ctx, kind, { title: `${r.expression} = ${nf(r.value)}`, summary: 'Plain arithmetic on the numbers you typed.', inputs: { expression: f.expr }, normalised: { expression: r.expression }, result: { value: r.value }, formula: `${r.expression} = ${nf(r.value)}`, citation: r.citation });
    return finish(ctx, rec, [{ label: 'Answer', value: nf(r.value), derived: true, source: null }]);
  }
  if (kind === 'convert') {
    const r = G.convert(f.value, f.from, f.to); if (!r.ok) return unknownCard('calc', 'Unit conversion', r.reason, { estimate: false });
    const rec = record(ctx, kind, { title: `${nf(f.value)} ${G.unitShow(f.from)} in ${G.unitShow(f.to)}`, summary: 'A straight unit conversion.', inputs: f, normalised: { value: f.value, from: G.unitShow(f.from), to: G.unitShow(f.to) }, result: { value: r.value, unit: r.unit }, formula: r.formula, citation: r.citation });
    return finish(ctx, rec, [{ label: 'Answer', value: `${nf(r.value)} ${r.unit}`, derived: true, source: null }]);
  }
  const miss = missingKey(kind, f);
  if (miss && kind !== 'timeline') { if (ctx.noAsk && !named && kind !== 'mixwater') { /* asked once already: do not loop */ } return askCard(miss, kind); }

  if (kind === 'perimeter') {
    const r = G.perimeter(f); if (!r.ok) return askCard('room', kind);
    const rec = record(ctx, kind, { title: `Perimeter of a ${nf(f.length)} x ${nf(f.width)} m room`, summary: 'Wall run for skirting, joints or sealant. Openings are not taken off unless you give a length.', inputs: f, normalised: { length_m: f.length, width_m: f.width }, result: { value: r.value, unit: 'm', area_m2: r.area }, formula: r.formula, citation: r.citation });
    return finish(ctx, rec, [{ label: 'Perimeter', value: `${nf(r.value)} m`, derived: true, source: null }, { label: 'Floor area', value: `${nf(r.area)} m2`, derived: true, source: null }]);
  }
  if (kind === 'tiles') {
    const r = G.tiles(f); if (!r.ok) return askCard(r.need === 'tile' ? 'tile' : 'area', kind);
    const rec = record(ctx, kind, { title: `Tiles for ${nf(r.area)} m2 of ${nf(f.tileL)} x ${nf(f.tileW)} mm`, summary: r.cutsPct ? `Includes your ${nf(r.cutsPct)}% for cuts.` : 'No allowance for cuts is added unless you give one.', inputs: f, normalised: { area_m2: r.area, tile_mm: `${f.tileL} x ${f.tileW}`, joint_mm: f.jointMm || 0, cuts_pct: r.cutsPct }, result: { count: r.count, before_cuts: r.countBeforeCuts, exact: r.exact }, formula: r.formula, citation: r.citation });
    const rows = [{ label: 'Tiles needed', value: `${nf(r.count)} tiles`, derived: true, source: null }];
    if (r.cutsPct) rows.push({ label: 'Before your cuts allowance', value: `${nf(r.countBeforeCuts)} tiles`, derived: true, source: null });
    if (r.box) rows.push({ label: 'Boxes', value: `${nf(r.box.boxes)} boxes of ${nf(r.box.perBox)}`, derived: true, source: null });
    const c = finish(ctx, rec, rows);
    if (!r.cutsPct) c.notes.push('No cuts allowance is added. Tell me one, for example "10% cuts", and I will include it.');
    return c;
  }
  if (kind === 'grout') {
    const r = G.groutVolume(f); if (!r.ok) return askCard(r.need, kind);
    let published = null; const rows = [{ label: 'Grout volume', value: `${nf(r.litres)} L (${nf(r.litresPerM2)} L per m2)`, derived: true, source: null }];
    let citation = r.citation; let result = { litres: r.litres, litres_per_m2: r.litresPerM2 };
    if (p) {
      const fr = await data.rate(p.id).catch(() => null);
      for (const fact of (fr && fr.consumption) || []) {
        const m = fact.parsed; if (!m) continue; const ts = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?/.exec(String(m.tile_size || '').replace(/\s/g, '').replace(/mm$/, ''));
        if (!ts) continue; const same = (a, b) => Math.abs(a - b) < 1e-6; const tl = +ts[1], tw = +ts[2];
        if (!((same(tl, f.tileL) && same(tw, f.tileW)) || (same(tl, f.tileW) && same(tw, f.tileL)))) continue; if (ts[3] && !same(+ts[3], f.thicknessMm)) continue; if (m.joint_width_mm == null || !same(m.joint_width_mm, f.jointMm)) continue;
        const s = srcOf({ text: fact.text, source: { url: fact.source.url, page: fact.source.page, doc_type: fact.source.docType, doc_version: fact.source.version } });
        if (m.model === 'grout_kg_per_m2') { published = { kg: m.kg_per_m2 * f.area, perM2: m.kg_per_m2, text: fact.text, fact }; rows.push({ label: `Published for this product (${m.kg_per_m2} kg per m2)`, value: `${nf(m.kg_per_m2 * f.area)} kg for ${nf(f.area)} m2`, derived: true, source: s }); result.kg = m.kg_per_m2 * f.area; }
        if (m.model === 'grout_area_per_pack' && m.area_m2 > 0 && m.pack) { const n = Math.ceil(f.area / m.area_m2 - 1e-9); rows.push({ label: `Published pack coverage (${m.area_m2} m2 per ${m.pack.amount} ${m.pack.unit})`, value: `${n} x ${m.pack.amount} ${m.pack.unit}`, derived: true, source: s }); result.packs = `${n} x ${m.pack.amount} ${m.pack.unit}`; published = published || { fact }; }
        if (published && published.fact) citation = { text: fact.text, url: fact.source.url, page: fact.source.page, kind: 'datasheet' };
      }
      if (!published) rows.push({ label: 'Published table', value: `${plain(p.name)} has no published grout row for ${nf(f.tileL)} x ${nf(f.tileW)} mm tiles with a ${nf(f.jointMm)} mm joint, so I give the volume only.`, meta: true, source: null });
    }
    const rec = record(ctx, kind, { ...base, title: `Grout for ${nf(f.area)} m2 of ${nf(f.tileL)} x ${nf(f.tileW)} mm tiles`, summary: r.note, inputs: f, normalised: { area_m2: f.area, tile_mm: `${f.tileL} x ${f.tileW}`, joint_mm: f.jointMm, tile_thickness_mm: f.thicknessMm, allowance_pct: r.allowancePct }, result, formula: r.formula, citation });
    return finish(ctx, rec, rows);
  }
  if (kind === 'sealant') {
    let packMl = f.packMl; let packs = null;
    if (p && !packMl) { const fr = await data.rate(p.id).catch(() => null); packs = packsMl((fr && fr.packs) || []); }
    const r = G.sealantVolume({ ...f, packMl }); if (!r.ok) return askCard(r.need, kind);
    const rows = [{ label: 'Sealant volume', value: `${nf(r.ml)} mL (${nf(r.litres)} L)`, derived: true, source: null }];
    let citation = r.citation; const result = { ml: r.ml, litres: r.litres };
    if (r.packs) { rows.push({ label: `In ${nf(r.packs.size)} mL packs, rounded up`, value: `${r.packs.count} packs`, derived: true, source: null }); result.packs = `${r.packs.count} x ${r.packs.size} mL`; }
    if (p) {
      const fr = await data.rate(p.id).catch(() => null);
      const pubs = ((fr && fr.consumption) || []).find((x) => x.parsed && x.parsed.model === 'joint_length_per_pack' && x.parsed.joint_width_mm === f.widthMm && x.parsed.joint_depth_mm === f.depthMm);
      if (pubs) { const m = pubs.parsed; const n = Math.ceil(f.lengthM / m.length_m_per_pack - 1e-9); const s = srcOf({ text: pubs.text, source: { url: pubs.source.url, page: pubs.source.page, doc_type: pubs.source.docType, doc_version: pubs.source.version } }); rows.push({ label: `Published: ${m.length_m_per_pack} m of ${f.widthMm} x ${f.depthMm} mm joint per ${m.pack.amount} ${m.pack.unit} pack`, value: `${n} x ${m.pack.amount} ${m.pack.unit}`, derived: true, source: s }); result.packs = `${n} x ${m.pack.amount} ${m.pack.unit}`; citation = { text: pubs.text, url: pubs.source.url, page: pubs.source.page, kind: 'datasheet' }; }
      else if (packs && packs.length) { const po = packOptions(packs, { amount: r.litres, unit: 'L' }); if (po.options.length) { rows.push({ label: 'Published pack sizes, rounded up', value: po.options.map((o) => `${o.count} x ${nf(o.size)} ${o.unit}`).join('; '), derived: true, source: null }); result.packs = po.options.map((o) => `${o.count} x ${nf(o.size)} ${o.unit}`).join('; '); } }
    }
    const rec = record(ctx, kind, { ...base, title: `Sealant for ${nf(f.lengthM)} m of ${nf(f.widthMm)} x ${nf(f.depthMm)} mm joint`, summary: 'Volume of the bead. Backer rod and tooling waste are not added unless you give an allowance.', inputs: f, normalised: { length_m: f.lengthM, width_mm: f.widthMm, depth_mm: f.depthMm, allowance_pct: r.allowancePct }, result, formula: r.formula, citation });
    const c = finish(ctx, rec, rows);
    if (!r.packs && !result.packs) c.notes.push('Tell me the cartridge size, for example "300 ml cartridges", or name the product, and I will give a pack count.');
    return c;
  }
  if (kind === 'bed') {
    const r = G.bedVolume(f); if (!r.ok) return askCard(r.need, kind);
    const rec = record(ctx, kind, { title: `Bed of ${nf(f.thicknessMm)} mm over ${nf(f.area)} m2`, summary: r.note, inputs: f, normalised: { area_m2: f.area, thickness_mm: f.thicknessMm, allowance_pct: r.allowancePct }, result: { m3: r.m3, litres: r.litres }, formula: r.formula, citation: r.citation });
    return finish(ctx, rec, [{ label: 'Wet volume', value: `${nf(r.m3)} m3 (${nf(r.litres)} L)`, derived: true, source: null }]);
  }
  if (kind === 'mixwater') {
    if (!p) return clarifyCard('calc', 'Which product is the water for? Name it, for example "water for 2 bags of SikaTile-510 MegaLite".', [], 'g_product');
    const sh = await data.shard(p.id).catch(() => null);
    const facts = (sh && sh.r && sh.r.facts && sh.r.facts.mix_ratio) || [];
    let fact = null; let ratio = null; for (const x of facts) { const rr = G.waterRatio({ text: x.text, parsed: x.parsed }); if (rr) { fact = x; ratio = rr; break; } }
    if (!ratio) { const c = unknownCard('calc', `Mixing water for ${plain(p.name)}`, 'No mixing water ratio per mass of powder is published for this product, so I will not guess one.'); return c; }
    if (!(f.bags || f.powderKg)) return askCard('powder', kind);
    const r = G.mixWater(ratio, { powderKg: f.powderKg, bags: f.bags }); if (!r.ok) return askCard('powder', kind);
    const s = src(fact.s.u, `Data sheet${fact.s.p ? ', page ' + fact.s.p : ''}`, fact.text);
    const w = r.range ? `${nf(r.lowL)} L to ${nf(r.highL)} L` : `${nf(r.lowL)} L`;
    const cit = { text: fact.text, url: fact.s.u, page: fact.s.p, kind: 'datasheet' };
    const rec = record(ctx, kind, { ...base, title: `Mixing water for ${plain(p.name)}`, summary: 'Worked from the published water ratio. The range stays a range.', inputs: f, normalised: { powder_kg: r.powderKg, bags: r.bags }, result: { low_l: r.lowL, high_l: r.highL, unit: 'L' }, formula: r.formula, citation: cit });
    return finish(ctx, rec, [{ label: 'Published ratio', value: plain(fact.text), quote: true, source: s }, { label: 'Water needed', value: w, derived: true, source: s }]);
  }
  if (kind === 'timeline') return timelineCard(ctx, f, named, base);
  return null;
}

const TM_KEYS = [[/\b(recoat|overcoat|over-coat|re-coat|second coat|next coat)\b/, 'recoat_times', 'Wait to overcoat'], [/\b(open time)\b/, 'open_time', 'Open time'], [/\b(pot life)\b/, 'pot_life', 'Pot life'], [/\b(grout|grouting|walk|foot traffic|traffic|cure|cured|curing|ready|use)\b/, 'cure_times', 'Cure or wait time']];
async function timelineCard(ctx, f, named, base) {
  const { data, session } = ctx; const text = String(ctx.rest || ctx.text || '').toLowerCase();
  // segments: "X then Y" is two products in order; one product with several step words is several steps in order
  const hits = await findProducts(data, ctx.rest || ctx.text, 4);
  const prods = hits.length ? hits : (session.product ? [session.product] : []);
  if (!prods.length) return clarifyCard('calc', 'Which product is it for? Name it, for example "when can I recoat Sikafloor-161".', [], 'g_product');
  const wanted = []; for (const [rx, key, label] of TM_KEYS) if (rx.test(text) && !wanted.some((w) => w[0] === key)) wanted.push([key, label]);
  if (!wanted.length) wanted.push(['cure_times', 'Cure or wait time']);
  const steps = []; const used = [];
  const pairs = prods.length > 1 ? prods.map((pr, i) => [pr, wanted[Math.min(i, wanted.length - 1)]]) : wanted.map((w) => [prods[0], w]);
  for (const [pr, [key, label]] of pairs) {
    const sh = await data.shard(pr.id).catch(() => null); const rows = ((sh && sh.tm && sh.tm[key]) || []).filter((r) => r.parsed && ((r.parsed.columns && r.parsed.columns[0]) || r.parsed.min != null));
    if (!rows.length) return unknownCard('calc', 'Time until the next step', `${plain(pr.name)} has no published ${label.toLowerCase()} figure, so I cannot add it up.`);
    const temps = [...new Set(rows.map((r) => r.parsed.at_c).filter((x) => x != null))];
    let pick;
    if (f.atC != null && temps.length) { const best = temps.reduce((a, b) => (Math.abs(b - f.atC) < Math.abs(a - f.atC) ? b : a)); if (Math.abs(best - f.atC) > 0.01) { used.push(`${pr.name}: nearest published temperature is ${best} C, not ${f.atC} C`); } pick = rows.find((r) => r.parsed.at_c === best); }
    else if (temps.length > 1) return clarifyCard('calc', G.ASK.temperature.question, G.ASK.temperature.options.map((o) => ({ ...o })), 'g_temperature');
    else pick = rows[0];
    const col = pick.parsed.columns ? pick.parsed.columns[0] : { min: pick.parsed.min, max: pick.parsed.max, unit: pick.parsed.unit };
    const w = G.windowHours(col); if (!w) return unknownCard('calc', 'Time until the next step', `The published ${label.toLowerCase()} for ${plain(pr.name)} is not a plain time window, so I will not add it. Read: ${plain(pick.text)}`);
    steps.push({ label: `${plain(pr.name)} ${label.toLowerCase()}`, product: pr.id, lo: w.lo, hi: w.hi, text: plain(pick.text), url: pick.s.u, page: pick.s.p, condition: plain(pick.parsed.condition || '') });
  }
  const r = G.timeline(steps); if (!r.ok) return unknownCard('calc', 'Time until the next step', r.reason);
  const total = r.range ? `${G.hoursText(r.lowH)} to ${G.hoursText(r.highH)}` : G.hoursText(r.lowH);
  const cit = { text: steps.map((s) => s.text).join(' + '), url: steps[0].url, page: steps[0].page, kind: 'datasheet' };
  const rec = record(ctx, 'timeline', { ...base, product: steps.length === 1 ? steps[0].product : 'none', productName: prods.map((x) => plain(x.name)).join(' then '), title: `Time until the next step: ${steps.map((s) => s.label).join(', then ')}`, summary: 'Sum of the published windows, in order. Slower in the cold; the data sheet governs.', inputs: { temperature_c: f.atC ?? null, steps: steps.map((s) => s.label) }, normalised: { temperature_c: f.atC ?? 'as published' }, result: { low_h: r.lowH, high_h: r.highH, low_days: r.lowDays, high_days: r.highDays, unit: 'h' }, formula: r.formula, citation: cit });
  const rows = steps.map((s) => ({ label: s.label, value: plain(s.text) + (s.condition ? ` (${s.condition})` : ''), quote: true, source: src(s.url, `Data sheet${s.page ? ', page ' + s.page : ''}`, s.text) }));
  rows.push({ label: 'Total wait', value: `${total}${r.highH >= 24 ? ` (about ${nf(r.lowDays)}${r.range ? ' to ' + nf(r.highDays) : ''} days)` : ''}`, derived: true, source: src(steps[0].url, 'Data sheet', steps[0].text) });
  const c = finish(ctx, rec, rows);
  for (const n of used) c.notes.push(n);
  return c;
}

/** "/calcsave" saves the last calculation to the current project; "/calcsave cart" also adds its product to the cart. */
export function calcSave(ctx) {
  const { session, memory } = ctx; const rec = session.lastCalc;
  const c = card('memory', 'memory', 'Saved to project details', { estimate: false });
  if (!memory) { c.status = 'unknown'; c.notes.push('Project memory is not available in this browser.'); return c; }
  if (!rec) { c.title = 'Nothing to save yet'; c.notes.push('Work something out first, for example "how much grout for 20 m2 of 600x600 tiles with 3 mm joints", then save it.'); return c; }
  const res = memory.addCalculation(rec);
  if (!res.ok) { c.status = 'unknown'; c.notes.push(res.error); return c; }
  c.rows.push({ label: 'Project', value: res.project, meta: true, source: null }, { label: 'Saved calculation', value: res.calculation.title, meta: true, source: null });
  if (res.duplicate) c.notes.push('It was already saved in this project.');
  if (/\bcart\b/.test(ctx.rest || ctx.text || '') && rec.product !== 'none') {
    const pk = rec.result && rec.result.packs; const m = /^(\d+)\s*x/.exec(String(pk || ''));
    const add = memory.addItem({ id: rec.product, name: rec.productName, qty: m ? +m[1] : 1, unit: 'pack', packs: pk || '', need: rec.summary.slice(0, 80), basis: rec.formula, url: rec.citation && rec.citation.url, phrase: rec.citation && rec.citation.text, question: rec.question, estimate: ESTIMATE_LINE });
    if (add.ok) { memory.markCalculationUsed(res.calculation.id, { type: 'cart', ref: rec.product }); c.rows.push({ label: 'Cart', value: `${rec.productName} added`, meta: true, source: null }); }
  }
  if (!memory.persistent()) c.notes.push('This browser blocked local storage, so it is kept for this tab only.');
  c.buttons = [{ label: 'My projects', command: '/projects' }];
  return c;
}

/** A saved product quantity (the area rate and dose cards) as a stored calculation, so every kind lands in the same list. */
export function productCalcRecord(q, question) {
  const r0 = (q.rows && q.rows[0]) || {};
  const qty = (q.rows || []).map((r) => `${r.low === r.high ? fmtQty(r.low, r.unit) : fmtQty(r.low, r.unit) + ' to ' + fmtQty(r.high, r.unit)}${r.packs ? ', ' + r.packs : ''}`).join('; ');
  return { kind: 'product', product: q.id, productName: q.name, title: `${q.name}: ${qty}`, question, inputs: q.job || {}, normalised: q.job || {}, result: { rows: (q.rows || []).map((r) => ({ low: r.low, high: r.high, unit: r.unit, packs: r.packs || '' })) }, summary: qty, answer: qty, formula: '', citation: r0.url || r0.phrase ? { text: r0.phrase || '', url: r0.url || '', page: null, kind: 'datasheet' } : null, estimate: ESTIMATE_LINE };
}
