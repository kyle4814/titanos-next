// Actions v2, handlers. Each handler is pure code over the injected data and returns ONE typed card (see core.js card()).
// Rules held by every handler: a figure is shown only beside the sentence it came from (phrase, page, URL); quantities only, never prices;
// the estimate-only line on every quantity card; where the published data is silent the card says so and offers the hand-off.
import SikaCalc from './sikacalc.js';
import { card, clarifyCard, unknownCard, src, plain, norm, findProducts, findProductsInOrder, ESTIMATE_LINE, NOT_PUBLISHED, cardCsv, cardText } from './core.js';
import { parseNumbers, parseFacets, envId, ioFromEnv } from './parse.js';
import { fmt, fmtQty } from '../lib/finder/calc.js';
import { resolve as resolveSystem } from '../lib/finder/model.js';
import { pickSds, safetyRows } from '../assistant/apply.js';
import { supplyClause, referencesLines, DRAFT_LABEL, STANDARDS_NOTE } from '../assistant/clause.js';
import { buildHandoff, uncoveredTerms } from '../assistant/handoff.js';
import { specText, FLAG as MISPRINT_FLAG } from '../lib/specs.js';
import { evidence as cuEvidence, exclusions as cuExclusions } from '../lib/finder/canuse.js';

import { page, srcLabel, srcOf, range, packLine, ENV_LABEL, SUBSTRATE_LABEL, TILE_LABEL, handoffBtn, afterBtns, pickProduct, noteProduct, askProduct, jobText, cap } from './shared.js';
export { ENV_LABEL, SUBSTRATE_LABEL, TILE_LABEL } from './shared.js';
/* ---------------------------------------------------------------- CALC */
const NEED_Q = {
  area: ['How big is the area, in m2?', []],
  length: ['How long is the run, in metres?', []],
  volume: ['What volume, in m3?', []],
  thickness: ['What thickness, in mm? The published rate is per mm of thickness.', []],
  notch: null, csp: null, dilution: null, application: null, coats: ['How many coats?', []],
  cementitious: ['How many kg of total cementitious material (cement plus any supplementary binder) in the mix? The dosage is published per 100 kg of it.', []],
};
/** The calculator's field names in plain words. */
export const human = (s) => String(s || '').replace(/notch_mm/g, 'trowel notch').replace(/thickness_mm/g, 'thickness (mm)').replace(/area_m2/g, 'area (m2)').replace(/length_m/g, 'length (m)').replace(/volume_m3/g, 'volume (m3)').replace(/cementitious_kg_per_m3/g, 'cementitious kg per m3').replace(/cementitious_kg/g, 'cementitious material (kg)').replace(/\bcsp\b/g, 'surface profile (CSP)');
function needOf(r) {
  if (r.needs) return r.needs === 'notch_mm' ? 'notch' : r.needs;
  const t = r.reason || '';
  if (/cementitious/.test(t)) return 'cementitious';
  if (/area_m2/.test(t)) return 'area';
  if (/length_m/.test(t)) return 'length';
  if (/volume_m3/.test(t)) return 'volume';
  if (/thickness_mm/.test(t)) return 'thickness';
  if (/coats/.test(t)) return 'coats';
  return null;
}
function jobFrom(f) {
  const j = {};
  if (f.area) j.area_m2 = f.area;
  if (f.length) j.length_m = f.length;
  if (f.volume) j.volume_m3 = f.volume;
  if (f.thickness) j.thickness_mm = f.thickness;
  if (f.coats) j.coats = f.coats;
  if (f.cementitious) j.cementitious_kg = f.cementitious;
  if (f.notch) j.notch_mm = f.notch;
  if (f.csp) j.csp = f.csp;
  if (f.dilution) j.dilution = f.dilution;
  if (f.application) j.application = f.application;
  if (f.allowance != null) j.waste_pct = f.allowance;
  return j;
}
function needQuestion(need, r) {
  if (need === 'notch') {
    const n = r.published_notch_mm;
    return clarifyCard('calc', `Which trowel notch will you use? This rate is published for a ${fmt(n)} mm notched trowel only. Or give the tile size, for example 600x600.`, n ? [{ label: `${fmt(n)} mm notch`, value: `${fmt(n)} mm notch` }] : [], 'notch');
  }
  if (need === 'csp') return clarifyCard('calc', `Which surface profile (CSP)? The rate is published for CSP ${r.published_csp}.`, r.published_csp ? [{ label: `CSP ${r.published_csp}`, value: `CSP ${r.published_csp}` }] : [], 'csp');
  if (need === 'dilution') return clarifyCard('calc', `Which dilution? The rate is published for ${r.published_dilution}.`, r.published_dilution ? [{ label: r.published_dilution, value: r.published_dilution }] : [], 'dilution');
  if (need === 'application') return clarifyCard('calc', `Which application? The rate is published for "${r.published_application}".`, r.published_application ? [{ label: r.published_application, value: r.published_application }] : [], 'application');
  const q = NEED_Q[need];
  return q ? clarifyCard('calc', q[0], q[1], need) : null;
}

const MISMATCH_NOTE = (n) => `The quantity workings for ${n} do not agree with the data sheet's own wording, so I will not give a pack count. The data sheet sentence is shown; please check it or ask Technical Services.`;
async function refusals(data) { const k = await data.kindex(); return { mismatch: new Set((k && k.rate_mismatch) || []), notReady: new Set((k && k.rate_not_calc_ready) || []) }; }

/** Quantity rows for one product record + job. Returns { rows, ok, need, failures, quantities } */
export function quantityRows(rec, job, { tileSize, mosaic, strategy } = {}) {
  const rows = []; const out = { ok: false, need: null, needRes: null, failures: [], results: [] };
  let results;
  if ((tileSize || mosaic) && job.area_m2) {
    const t = mosaic ? { mosaic: true } : { length_mm: tileSize[0], width_mm: tileSize[1] };
    const by = SikaCalc.calcByTile(rec, { ...job, tile: t }, { strategy });
    if (by.ok) { results = by.results; out.notch = by.notch; } else out.failures.push({ reason: by.reason, published_notch_mm: Array.isArray(by.published_notch_mm) ? by.published_notch_mm[0] : undefined, needs: by.published_notch_mm ? 'notch_mm' : undefined });
  }
  if (!results) results = SikaCalc.calcProduct(rec, job, { strategy }).options;
  const okRes = results.filter((r) => r.ok);
  for (const r of results.filter((x) => !x.ok)) {
    const n = needOf(r);
    if (n && !out.need) { out.need = n; out.needRes = r; }
    out.failures.push({ ...r, reason: human(r.reason) });
  }
  out.ok = okRes.length > 0;
  out.results = okRes;
  return out;
}

function resultRows(rec, r, job, packFact, f, noPacks) {
  const s = srcOf({ text: r.phrase, source: r.source });
  const rows = [];
  rows.push({ label: 'Published rate', value: plain(r.phrase), source: s, quote: true });
  rows.push({ label: 'Quantity needed', value: range(r.quantity.low, r.quantity.high, r.quantity.unit), source: s, derived: true });
  if (r.waste_pct) rows.push({ label: `With your ${fmt(r.waste_pct)}% allowance`, value: range(r.with_waste.low, r.with_waste.high, r.with_waste.unit), source: s, derived: true });
  const pl = noPacks ? null : packLine(r.packs);
  const ps = packFact ? src(page(packFact.source), srcLabel(packFact.source), packFact.text) : src(rec.product_url, 'Product page', '');
  if (noPacks) rows.push({ label: 'Whole packs', value: MISMATCH_NOTE(rec.name), source: s });
  else if (pl) rows.push({ label: 'Whole packs, rounded up', value: pl, source: ps, derived: true });
  else rows.push({ label: 'Whole packs', value: r.packs && r.packs.note ? 'No published pack size in the same unit as the rate, so no pack count is given.' : 'Pack sizes not in the published data.', source: null });
  for (const n of r.notes || []) { if (/No waste allowance applied/.test(n)) continue; rows.push({ label: 'Condition', value: plain(n), source: s, quote: false }); }
  for (const w of r.warnings || []) rows.push({ label: 'Check', value: plain(w), source: s });
  return rows;
}

export async function calc(ctx) {
  const { data, session } = ctx;
  const f = session.facets;
  const named = (await findProducts(data, ctx.rest || ctx.text, 1))[0];
  if (!named && session.system && session.last && session.last.action === 'system') return system({ ...ctx, rest: '' });
  const p = named || session.product;
  if (!p) return askProduct('calc', 'is this for');
  const rec = await data.arate(p.id);
  noteProduct(session, p);
  const title = `Quantity for ${p.name}`;
  if (!rec || rec.rate_status !== 'published' || !(rec.facts.consumption || []).some((x) => x.calc_ready)) {
    const why = rec && rec.rate_note ? plain(rec.rate_note) : 'A usable consumption rate is not published for this product.';
    const c = unknownCard('calc', title, `${why} I will not guess a rate.`, { estimate: false });
    const pd = await data.product(p.id);
    c.rows.push({ label: 'Product page', value: p.name, name: true, source: src(pd && pd.url, 'Product page', '') });
    c.buttons = [handoffBtn];
    return c;
  }
  const R = await refusals(data);
  if (R.notReady.has(p.id)) {
    const c0 = unknownCard('calc', title, 'The data sheet statement does not say what the figure is per, or a condition is missing. I will not guess a quantity.', { estimate: false, buttons: [handoffBtn] });
    const f0 = (rec.facts.consumption || [])[0]; if (f0) c0.rows.push({ label: 'Published statement', value: plain(f0.text), quote: true, source: srcOf(f0) });
    return c0;
  }
  const job = jobFrom(f);
  if (!job.area_m2 && !job.length_m && !job.volume_m3) {
    const hasLen = (rec.facts.consumption || []).some((x) => x.parsed && x.parsed.model === 'per_length');
    const hasVol = (rec.facts.consumption || []).some((x) => x.parsed && /m3|cementitious/.test(x.parsed.model));
    return needQuestion(hasLen ? 'length' : hasVol ? 'volume' : 'area', {}) || askProduct('calc', 'size');
  }
  const q = quantityRows(rec, job, { tileSize: f.tileSize, mosaic: f.mosaic });
  if (!q.ok) {
    if (q.need && !ctx.noAsk) { const qc = needQuestion(q.need, q.needRes); if (qc) return qc; }
    const c = card('calc', 'quantity', title, { status: 'unknown', estimate: true, handoff: true, buttons: [handoffBtn] });
    const r0 = q.failures.find((x) => x.phrase) || q.failures[0] || {};
    c.rows.push({ label: 'Your job', value: jobText(f), input: true });
    c.notes.push(`I cannot work this out safely: ${plain(r0.reason || 'the published statement is not complete enough')}.`);
    if (r0.phrase) c.rows.push({ label: 'Published statement', value: plain(r0.phrase), quote: true, source: srcOf({ text: r0.phrase, source: r0.source || { url: rec.product_url, doc_type: 'WEB' } }) });
    return c;
  }
  const packFact = ((rec.facts.pack_sizes || [])[0]) || null;
  const c = card('calc', 'quantity', title, { estimate: true, buttons: afterBtns({ label: 'Make a project pack', command: '/pack' }) });
  c.summary = `Worked out from the published rate for ${p.name}. Packs are rounded up. No waste allowance is added unless you type one.`;
  c.rows.push({ label: 'Your job', value: jobText(f), input: true });
  if (q.notch) c.rows.push({ label: 'Trowel notch from the tile size table', value: plain(q.notch.phrase), quote: true, source: srcOf({ text: q.notch.phrase, source: q.notch.source }) });
  const shown = q.results.slice(0, 3);
  shown.forEach((r, i) => {
    const rr = resultRows(rec, r, job, packFact, f, R.mismatch.has(p.id));
    if (shown.length > 1) rr.forEach((x) => { x.label = `${x.label} (rate ${i + 1})`; });
    c.rows.push(...rr);
  });
  c.sources = [src(rec.product_url, 'Product page', ''), rec.datasheet ? src(rec.datasheet.url, `Data sheet, ${plain(rec.datasheet.doc_version)}`, '') : null].filter(Boolean);
  session.calcs[p.id] = { id: p.id, name: p.name, job: { ...job }, rows: shown.map((r) => ({ low: r.quantity.low, high: r.quantity.high, unit: r.quantity.unit, packs: R.mismatch.has(p.id) ? null : packLine(r.packs), phrase: plain(r.phrase), url: page(r.source) })) };
  return c;
}

/* ---------------------------------------------------------------- SYSTEM */
const T2S_TILE = { ceramic: 'ceramic', porcelain: 'porcelain', mosaic: 'mosaic', glass_tile: 'glass', natural_stone: 'natural-stone', large_format: 'large-format', terracotta: 'quarry-terracotta', moisture_sensitive_stone: 'moisture-sensitive-stone' };
const T2S_SUB = { concrete: 'concrete', cement_screed: 'screed-render', cement_render: 'screed-render', brick_block: 'masonry', fibre_cement: 'cement-board', plasterboard: 'plasterboard', timber: 'timber-floor', existing_tiles: 'existing-tiles', aac: 'aac' };
const T2S_ENV = { internal_floor: 'internal-floor', internal_wall: 'internal-wall', wet_area: 'internal-wet-floor', external_floor: 'external-floor', external_wall: 'external-wall', pool: 'pool' };

function entryRows(ent, trees, kind, label, verbPartly) {
  const rows = [];
  const card_ = trees.cards[ent.product];
  const name = card_ ? plain(card_.name) : ent.product;
  const ev = (ent.evidence || []).map((id) => trees.rules[id]).filter(Boolean)[0];
  const evSrc = ev ? src(page({ url: ev.url, page: ev.page }), `Data sheet${ev.doc_version ? ', ' + plain(ev.doc_version) : ''}, page ${ev.page}`, ev.text) : src(card_ && card_.product_url, 'Product page', '');
  rows.push({ label, value: name, name: true, source: evSrc, productId: ent.product });
  if (ev) rows.push({ label: kind === 'partly' ? 'What the documentation says' : 'Why', value: plain(ev.text), quote: true, source: evSrc });
  if (kind === 'partly') {
    rows.push({ label: 'Status', value: `Partly documented, not endorsed.${ent.not_stated && ent.not_stated.length ? ' The documentation does not state: ' + ent.not_stated.join(', ') + '.' : ''}`, source: null });
  }
  for (const id of (ent.limits || []).slice(0, 2)) { const r = trees.rules[id]; if (r) rows.push({ label: 'Limit it states', value: plain(r.text), quote: true, source: src(page({ url: r.url, page: r.page }), `Data sheet, ${plain(r.doc_version || '')}, page ${r.page}`, r.text) }); }
  for (const id of (ent.cautions || []).slice(0, 1)) { const r = trees.rules[id]; if (r) rows.push({ label: 'Caution', value: plain(r.text), quote: true, source: src(page({ url: r.url, page: r.page }), `Data sheet, ${plain(r.doc_version || '')}, page ${r.page}`, r.text) }); }
  return rows;
}

const clipAt = (s, n) => { const t = String(s || ''); if (t.length <= n) return t; const cut = t.slice(0, n); return cut.replace(/\s+\S*$/, '') || cut; };
/** The chat card is a summary: at most two products per step, one why each; everything else goes in a collapsed "more detail" block. */
function compactSections(c) {
  for (const sec of c.sections) {
    const rows = sec.rows; const groups = [];
    for (const r of rows) { if (r.productId) groups.push([r]); else if (groups.length) groups[groups.length - 1].push(r); }
    const fit = groups.filter((g) => /^(Documented fit|Primer named|Product)$/.test(g[0].label));
    const pick = (fit.length ? fit : groups.filter((g) => g[0].label === 'Partly documented')).slice(0, 2);
    const partlyOnly = !fit.length;
    sec.more = rows;
    sec.rows = pick.map((g) => { const why = g.find((x) => x.quote && x !== g[0]) || g[0]; return { label: g[0].value, value: (partlyOnly ? 'Partly documented, not endorsed. ' : '') + clipAt(why === g[0] ? '' : why.value, 150), productId: g[0].productId, quote: !partlyOnly, source: why.source || g[0].source }; });
    if (!sec.rows.length) sec.rows = rows.slice(0, 2);
  }
}

export async function system(ctx) {
  const { data, session } = ctx; const f = session.facets;
  const needSub = !f.substrate, needIo = !f.io;
  if (needSub && !ctx.noAsk) {
    const opts = ['concrete', 'cement_screed', 'plasterboard', 'fibre_cement', 'timber', 'existing_tiles'].map((id) => ({ label: SUBSTRATE_LABEL[id], value: SUBSTRATE_LABEL[id] + (needIo ? '' : '') }));
    return clarifyCard('system', needIo ? 'What is the surface underneath, and is the job inside or outside? For example: concrete, inside.' : 'What is the surface underneath?', opts, needIo ? 'substrate+io' : 'substrate');
  }
  if (needIo && !ctx.noAsk) return clarifyCard('system', 'Is the job inside (dry area), a wet area such as a bathroom, or outside?', [{ label: 'Inside, dry area', value: 'inside' }, { label: 'Wet area', value: 'wet area' }, { label: 'Outside', value: 'outside' }], 'io');
  if (!f.substrate) return unknownCard('system', 'Build a system', 'I need to know the surface underneath before I can name a system.');
  const assumptions = [];
  const io = f.io || 'internal'; if (!f.io) assumptions.push('Inside or outside was not given, so this is shown for an internal dry area.');
  const surface = f.surface || (io === 'pool' ? null : 'floor'); if (!f.surface && io !== 'wet' && io !== 'pool') assumptions.push('Floor or wall was not given, so this is shown for a floor.');
  const tile = f.tile || 'ceramic'; if (!f.tile) assumptions.push('Tile type was not given, so this is shown for ceramic tiles. Say porcelain, mosaic, natural stone and so on to change it.');
  const env = envId(io, surface);
  const trees = await data.trees();
  if (!trees) return unknownCard('system', 'Build a system', 'The system data is not available in this build.');
  const aKey = `${env}|${tile}|${f.substrate}`, mKey = `${env === 'internal_wall' || env === 'internal_floor' ? env : env}|${f.substrate}`;
  const aLeaf = trees.adhesive.leaves[aKey];
  const title = `System: ${TILE_LABEL[tile] || tile} on ${SUBSTRATE_LABEL[f.substrate] || f.substrate}, ${ENV_LABEL[env] || env}`;
  if (!aLeaf || (!aLeaf.documented_fit.length && !aLeaf.partly_documented.length)) {
    const ex = aLeaf && aLeaf.excluded[0];
    const c = unknownCard('system', title, 'The published documentation does not support a complete system for this combination. Contact Sika Technical Services.', { handoff: true, buttons: [handoffBtn] });
    if (ex) { const r = trees.rules[(ex.because || [])[0]]; if (r) c.rows.push({ label: 'Ruled out', value: plain(r.text), quote: true, source: src(page({ url: r.url, page: r.page }), `Data sheet, page ${r.page}`, r.text) }); }
    return c;
  }
  const c = card('system', 'system', title, { estimate: false, buttons: [] });
  c.summary = 'Ordered from preparation to finish, from the published documentation. Products listed as partly documented are shown for information and are not endorsed for this job.';
  c.assumptions = assumptions;
  c.sections = [];
  const st = { env, tile, substrate: f.substrate, steps: {} };
  // 1 primer
  const primers = new Map();
  for (const e of aLeaf.documented_fit) for (const pr of e.primers || []) for (const pid of pr.products) if (!primers.has(pid)) primers.set(pid, pr);
  if (primers.size) {
    const sec = { title: '1. Prepare and prime', rows: [] };
    for (const [pid, pr] of [...primers].slice(0, 3)) {
      const r = trees.rules[pr.rule]; const cd = trees.cards[pid];
      const s = r ? src(page({ url: r.url, page: r.page }), `Data sheet, ${plain(r.doc_version || '')}, page ${r.page}`, r.text) : src(cd && cd.product_url, 'Product page', '');
      sec.rows.push({ label: 'Primer named', value: cd ? plain(cd.name) : pid, name: true, productId: pid, source: s });
      if (r) sec.rows.push({ label: 'Why', value: plain(r.text), quote: true, source: s });
    }
    c.sections.push(sec); st.steps.primer = [...primers.keys()].slice(0, 3);
  }
  // 2 membrane
  const mLeaf = trees.membrane.leaves[mKey];
  if (mLeaf && (mLeaf.documented_fit.length || mLeaf.partly_documented.length)) {
    const sec = { title: `${c.sections.length + 1}. Waterproofing membrane`, rows: [] };
    mLeaf.documented_fit.slice(0, 3).forEach((e) => sec.rows.push(...entryRows(e, trees, 'fit', 'Documented fit')));
    mLeaf.partly_documented.slice(0, 2).forEach((e) => sec.rows.push(...entryRows(e, trees, 'partly', 'Partly documented')));
    c.sections.push(sec); st.steps.membrane = mLeaf.documented_fit.slice(0, 3).map((e) => e.product);
  } else if (mLeaf === undefined) c.notes.push('No waterproofing membrane step is listed in the documentation for this surface and place.');
  // 3 adhesive
  {
    const sec = { title: `${c.sections.length + 1}. Tile adhesive`, rows: [] };
    aLeaf.documented_fit.slice(0, 3).forEach((e) => sec.rows.push(...entryRows(e, trees, 'fit', 'Documented fit')));
    aLeaf.partly_documented.slice(0, 2).forEach((e) => sec.rows.push(...entryRows(e, trees, 'partly', 'Partly documented')));
    for (const ex of aLeaf.excluded.slice(0, 2)) {
      const r = trees.rules[(ex.because || [])[0]]; const cd = trees.cards[ex.product];
      if (r) sec.rows.push({ label: `Not for this job: ${cd ? plain(cd.name) : ex.product}`, value: plain(r.text), quote: true, source: src(page({ url: r.url, page: r.page }), `Data sheet, ${plain(r.doc_version || '')}, page ${r.page}`, r.text) });
    }
    c.sections.push(sec); st.steps.adhesive = aLeaf.documented_fit.slice(0, 3).map((e) => e.product);
  }
  // 4 grout and joints from the system finder (same published documentation), when that combination exists
  const S = await data.systems(); const sel = await data.selector();
  const sTile = T2S_TILE[tile], sSub = T2S_SUB[f.substrate], sLoc = T2S_ENV[env] && (env === 'wet_area' && surface === 'wall' ? 'internal-wet-wall' : T2S_ENV[env]);
  let slug = null;
  if (S && sel && sTile && sSub && sLoc) {
    slug = sel.slugs[`${sTile}|${sSub}|${sLoc}`] || null;
    const rs = resolveSystem(S, { tile: sTile, sub: sSub, loc: sLoc });
    if (rs.ok) for (const stp of rs.steps.filter((x) => x.role === 'grout' || x.role === 'sealant')) {
      if (!stp.options.length) continue;
      const sec = { title: `${c.sections.length + 1}. ${stp.label}`, rows: [] };
      for (const o of stp.options.slice(0, 3)) {
        const ev0 = o.evidence[0]; const s = ev0 ? src(ev0.url, 'Product page', ev0.sentence) : src(o.url, 'Product page', '');
        sec.rows.push({ label: 'Product', value: plain(o.name), name: true, productId: o.productId, source: s });
        if (ev0) sec.rows.push({ label: 'Why', value: plain(ev0.sentence), quote: true, source: s });
      }
      c.sections.push(sec); st.steps[stp.role] = stp.options.slice(0, 3).map((o) => o.productId);
    }
  }
  if (!st.steps.grout) c.notes.push('Grout and movement joint products are not listed for this exact combination in the system finder. Ask Technical Services.');
  compactSections(c);
  // quantities when an area is known, for the first documented product of each step
  const f2 = session.facets; const job = jobFrom(f2);
  if (job.area_m2) {
    const R = await refusals(data);
    const qs = { title: 'Quantities (first documented product in each step)', rows: [] };
    for (const [role, ids] of Object.entries(st.steps)) {
      const id = ids[0]; if (!id) continue;
      const rec = await data.arate(id); const nm = (trees.cards[id] && plain(trees.cards[id].name)) || id;
      if (!rec) { qs.rows.push({ label: `${role}: ${nm}`, value: 'Rate not published. Ask Technical Services.', source: null }); continue; }
      const q = quantityRows(rec, job, { tileSize: f2.tileSize, mosaic: f2.mosaic });
      if (q.ok) {
        const r = q.results[0]; const s = srcOf({ text: r.phrase, source: r.source }); const np = R.mismatch.has(id) || R.notReady.has(id);
        qs.rows.push({ label: `${role}: ${nm}`, value: `${range(r.quantity.low, r.quantity.high, r.quantity.unit)}${!np && packLine(r.packs) ? '; ' + packLine(r.packs) : '; no pack count (the workings do not agree with the data sheet wording)'}`, derived: true, source: s });
        session.calcs[id] = { id, name: nm, job: { ...job }, rows: [{ low: r.quantity.low, high: r.quantity.high, unit: r.quantity.unit, packs: np ? null : packLine(r.packs), phrase: plain(r.phrase), url: page(r.source) }] };
      } else {
        const r0 = q.failures.find((x) => x.phrase) || q.failures[0] || {};
        qs.rows.push({ label: `${role}: ${nm}`, value: `Not worked out: ${plain(r0.reason || 'rate not published')}`, source: r0.phrase ? srcOf({ text: r0.phrase, source: r0.source || { url: rec.product_url, doc_type: 'WEB' } }) : null });
      }
    }
    c.sections.push(qs); c.estimate = true;
  } else c.notes.push('Give me an area (for example 20 m2) and I will work out quantities for each step.');
  if (slug) c.topButtons = [{ label: 'Open the keepable system sheet', href: `systems/${slug}/` }];
  c.buttons.push({ label: 'Work out quantities', command: job.area_m2 ? '/calc' : '/calc 20 m2' }, { label: 'Make a project pack', command: '/pack' }, ...afterBtns().slice(0, 2));
  c.sources = [];
  session.system = st; st.title = title; st.slug = slug;
  for (const ids of Object.values(st.steps)) for (const id of ids) noteProduct(session, { id, name: (trees.cards[id] && plain(trees.cards[id].name)) || id });
  return c;
}

/* ---------------------------------------------------------------- COMPARE */
/** Only the phrase that matched: stop where the next data sheet section heading (a run of capitals) or the first full sentence ends, and at 170 characters. */
export function clampPhrase(text, n = 170) {
  let t = plain(text).replace(/\s+/g, ' ');
  const head = /\s(?=[A-Z]{3,}(?:\s+[A-Z&]{2,})+\b)/.exec(t); if (head) t = t.slice(0, head.index);
  const sent = /^(.{20,}?[a-z0-9)%][.!?])\s+[A-Z]/.exec(t); if (sent) t = sent[1];
  return clipAt(t.trim(), n);
}
export async function compare(ctx) {
  const { data, session } = ctx;
  let hits = await findProductsInOrder(data, ctx.rest || ctx.text, 2);
  if (hits.length === 1 && session.product && session.product.id !== hits[0].id) hits = [session.product, hits[0]].map((x) => ({ id: x.id, name: x.name }));
  if (hits.length < 2) {
    if (ctx.noAsk) return unknownCard('compare', 'Compare two products', 'I need two product names to compare, for example Davco Easy Grout versus SikaCeram-690 Elite.');
    return clarifyCard('compare', 'Which two products? Type both names, for example Davco Easy Grout versus SikaCeram-690 Elite.', [], 'products');
  }
  const [A, B] = hits;
  const [pa, pb, ra, rb, ka, kb] = await Promise.all([data.product(A.id), data.product(B.id), data.arate(A.id), data.arate(B.id), data.compat(A.id), data.compat(B.id)]);
  const c = card('compare', 'compare', `${A.name} compared with ${B.name}`, { estimate: false });
  c.summary = 'Side by side, each cell is the published wording with its source. A blank means the published data does not say.';
  c.table = { head: ['', A.name, B.name], rows: [] };
  const cell = (value, source) => (value ? { value: clampPhrase(value), source: source || null } : { value: NOT_PUBLISHED, source: null });
  const line = (label, fa, fb) => c.table.rows.push({ label, cells: [fa, fb] });
  const sum = (p) => cell(p && (p.summary || p.tagline), p && src(p.url, 'Product page', p.summary || p.tagline));
  line('What it is', sum(pa), sum(pb));
  const catOf = (p) => cell(p && p.categoryPath && p.categoryPath.slice(-1)[0].replace(/-/g, ' '), p && src(p.url, 'Product page', p.categoryPath && p.categoryPath.slice(-1)[0].replace(/-/g, ' ')));
  line('Category', catOf(pa), catOf(pb));
  const pk = (r, p) => { const f = r && (r.facts.pack_sizes || [])[0]; return f ? cell(f.text, srcOf(f)) : cell(p && p.packaging, p && p.packaging && src(p.url, 'Product page', p.packaging)); };
  line('Pack sizes', pk(ra, pa), pk(rb, pb));
  const rt = (r) => { const f = r && (r.facts.consumption || [])[0]; return f ? cell(f.text, srcOf(f)) : cell(null); };
  line('Published consumption', rt(ra), rt(rb));
  const tm = (r) => { const f = r && ((r.facts.open_time || [])[0] || (r.facts.cure_times || [])[0] || (r.facts.pot_life || [])[0]); return f ? cell(f.text, srcOf(f)) : cell(null); };
  line('Open, cure or pot life time', tm(ra), tm(rb));
  const ex = (k, p) => { const r = k && k.rules.find((x) => x.polarity === 'no' && !x.conditional); return r ? cell(r.text, src(page({ url: r.source.url, page: r.source.page }), srcLabel(r.source), r.text)) : cell(null); };
  line('A stated exclusion', ex(ka, pa), ex(kb, pb));
  const ds = (r) => { if (!(r && r.datasheet)) return cell(null); const v = r.datasheet.doc_version ? `Data sheet, ${plain(r.datasheet.doc_version)}` : 'Data sheet'; return { value: v, source: src(r.datasheet.url, v, v) }; };
  line('Data sheet', ds(ra), ds(rb));
  [A, B].forEach((x) => noteProduct(session, x));
  session.compare = [A.id, B.id];
  c.buttons = afterBtns();
  return c;
}

export * from './handlers2.js';
