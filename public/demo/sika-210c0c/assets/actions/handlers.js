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
import { evidence as cuEvidence, exclusions as cuExclusions } from '../lib/finder/canuse.js';

const page = (s) => (s && s.url ? s.url + (s.page && /\.pdf/i.test(s.url) ? '#page=' + s.page : '') : '');
const srcLabel = (s) => (s ? `${s.doc_type === 'SDS' ? 'Safety data sheet' : s.doc_type === 'PDS' ? 'Data sheet' : 'Product page'}${s.doc_version ? ', ' + plain(s.doc_version) : ''}${s.page ? ', page ' + s.page : ''}` : 'Source');
/** A source from a knowledge-lane fact or rule: { text, source:{url,page,doc_version,doc_type} }. */
const srcOf = (f) => (f && f.source ? src(page(f.source), srcLabel(f.source), f.text) : null);
const ROUND = (x) => Math.round(x * 100) / 100;
const range = (lo, hi, u) => (lo === hi ? fmtQty(lo, u) : `${fmtQty(lo, u)} to ${fmtQty(hi, u)}`);
const packLine = (p) => (p && p.combo && p.combo.length ? p.combo.map((c) => `${c.count} x ${fmt(c.amount)} ${c.unit}`).join(' + ') + ` (${fmtQty(p.total, p.unit)} supplied, ${fmtQty(p.over_supply, p.unit)} over)` : null);
const nameOf = (rec, id) => plain((rec && rec.name) || id);
export const ENV_LABEL = { internal_wall: 'internal wall (dry area)', internal_floor: 'internal floor (dry area)', wet_area: 'wet area', external_wall: 'external wall', external_floor: 'external floor, balcony or deck', pool: 'pool or submerged use' };
export const SUBSTRATE_LABEL = { concrete: 'concrete', cement_screed: 'cement screed', cement_render: 'cement render', brick_block: 'brick or blockwork', fibre_cement: 'fibre cement sheet', tile_underlay: 'tile underlay', plasterboard: 'plasterboard', existing_tiles: 'existing tiles', waterproofing_membrane: 'a waterproofing membrane', timber: 'timber or plywood', aac: 'autoclaved aerated concrete', underfloor_heating: 'an underfloor heated floor', self_levelling_underlayment: 'a self-levelling underlayment' };
export const TILE_LABEL = { ceramic: 'ceramic tiles', porcelain: 'porcelain tiles', mosaic: 'mosaic tiles', glass_tile: 'glass tiles', natural_stone: 'natural stone', moisture_sensitive_stone: 'moisture sensitive stone', large_format: 'large format tiles', terracotta: 'quarry or terracotta tiles', brick_slip: 'brick slips' };

const handoffBtn = { label: 'Ask Technical Services with this context', command: '/handoff' };
const afterBtns = (...extra) => [...extra, { label: 'Export CSV or print', command: '/export' }, { label: 'Save to my project', command: '/save' }];

/* ---------------------------------------------------------------- shared lookups */
async function pickProduct(ctx, { allowSession = true } = {}) {
  const hits = await findProducts(ctx.data, ctx.rest || ctx.text, 3);
  if (hits.length) return hits[0];
  const s = ctx.session;
  if (allowSession && s.product) return s.product;
  return null;
}
function noteProduct(session, p) {
  if (!p) return;
  session.product = { id: p.id, name: p.name };
  session.products = [session.product, ...(session.products || []).filter((x) => x.id !== p.id)].slice(0, 12);
}
const askProduct = (action, what) => clarifyCard(action, `Which product ${what}? Type its name, for example Davco Grey One Pot adhesive.`, [], 'product');

/* ---------------------------------------------------------------- CALC */
const NEED_Q = {
  area: ['How big is the area, in m2?', []],
  length: ['How long is the run, in metres?', []],
  volume: ['What volume, in m3?', []],
  thickness: ['What thickness, in mm? The published rate is per mm of thickness.', []],
  notch: null, csp: null, dilution: null, application: null, coats: ['How many coats?', []],
  cementitious: ['How many kg of total cementitious material (cement plus any supplementary binder) in the mix? The dosage is published per 100 kg of it.', []],
};
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
    out.failures.push(r);
  }
  out.ok = okRes.length > 0;
  out.results = okRes;
  return out;
}

function resultRows(rec, r, job, packFact, f) {
  const s = srcOf({ text: r.phrase, source: r.source });
  const rows = [];
  rows.push({ label: 'Published rate', value: plain(r.phrase), source: s, quote: true });
  rows.push({ label: 'Quantity needed', value: range(r.quantity.low, r.quantity.high, r.quantity.unit), source: s, derived: true });
  if (r.waste_pct) rows.push({ label: `With your ${fmt(r.waste_pct)}% allowance`, value: range(r.with_waste.low, r.with_waste.high, r.with_waste.unit), source: s, derived: true });
  const pl = packLine(r.packs);
  const ps = packFact ? src(page(packFact.source), srcLabel(packFact.source), packFact.text) : src(rec.product_url, 'Product page', '');
  if (pl) rows.push({ label: 'Whole packs, rounded up', value: pl, source: ps, derived: true });
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
    const rr = resultRows(rec, r, job, packFact, f);
    if (shown.length > 1) rr.forEach((x) => { x.label = `${x.label} (rate ${i + 1})`; });
    c.rows.push(...rr);
  });
  c.sources = [src(rec.product_url, 'Product page', ''), rec.datasheet ? src(rec.datasheet.url, `Data sheet, ${plain(rec.datasheet.doc_version)}`, '') : null].filter(Boolean);
  session.calcs[p.id] = { id: p.id, name: p.name, job: { ...job }, rows: shown.map((r) => ({ low: r.quantity.low, high: r.quantity.high, unit: r.quantity.unit, packs: packLine(r.packs), phrase: plain(r.phrase), url: page(r.source) })) };
  return c;
}
const jobText = (f) => [f.area ? `${fmt(f.area)} m2` : null, f.length ? `${fmt(f.length)} m` : null, f.volume ? `${fmt(f.volume)} m3` : null, f.thickness ? `${fmt(f.thickness)} mm thick` : null, f.coats ? `${fmt(f.coats)} coats` : null, f.cementitious ? `${fmt(f.cementitious)} kg cementitious` : null, f.notch ? `${fmt(f.notch)} mm notch` : null, f.tileSize ? `${fmt(f.tileSize[0])} x ${fmt(f.tileSize[1])} mm tiles` : null, f.csp ? `CSP ${f.csp}` : null, f.dilution || null, f.allowance != null ? `${fmt(f.allowance)}% allowance (yours)` : null].filter(Boolean).join(', ') || 'No size given';

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
  // quantities when an area is known, for the first documented product of each step
  const f2 = session.facets; const job = jobFrom(f2);
  if (job.area_m2) {
    const qs = { title: 'Quantities (first documented product in each step)', rows: [] };
    for (const [role, ids] of Object.entries(st.steps)) {
      const id = ids[0]; if (!id) continue;
      const rec = await data.arate(id); const nm = (trees.cards[id] && plain(trees.cards[id].name)) || id;
      if (!rec) { qs.rows.push({ label: `${role}: ${nm}`, value: 'Rate not published. Ask Technical Services.', source: null }); continue; }
      const q = quantityRows(rec, job, { tileSize: f2.tileSize, mosaic: f2.mosaic });
      if (q.ok) {
        const r = q.results[0]; const s = srcOf({ text: r.phrase, source: r.source });
        qs.rows.push({ label: `${role}: ${nm}`, value: `${range(r.quantity.low, r.quantity.high, r.quantity.unit)}${packLine(r.packs) ? '; ' + packLine(r.packs) : ''}`, derived: true, source: s });
        session.calcs[id] = { id, name: nm, job: { ...job }, rows: [{ low: r.quantity.low, high: r.quantity.high, unit: r.quantity.unit, packs: packLine(r.packs), phrase: plain(r.phrase), url: page(r.source) }] };
      } else {
        const r0 = q.failures.find((x) => x.phrase) || q.failures[0] || {};
        qs.rows.push({ label: `${role}: ${nm}`, value: `Not worked out: ${plain(r0.reason || 'rate not published')}`, source: r0.phrase ? srcOf({ text: r0.phrase, source: r0.source || { url: rec.product_url, doc_type: 'WEB' } }) : null });
      }
    }
    c.sections.push(qs); c.estimate = true;
  } else c.notes.push('Give me an area (for example 20 m2) and I will work out quantities for each step.');
  if (slug) c.buttons.push({ label: 'Open the keepable system sheet', href: `systems/${slug}/` });
  c.buttons.push({ label: 'Work out quantities', command: job.area_m2 ? '/calc' : '/calc 20 m2' }, { label: 'Make a project pack', command: '/pack' }, ...afterBtns().slice(0, 2));
  c.sources = [];
  session.system = st; st.title = title; st.slug = slug;
  for (const ids of Object.values(st.steps)) for (const id of ids) noteProduct(session, { id, name: (trees.cards[id] && plain(trees.cards[id].name)) || id });
  return c;
}

/* ---------------------------------------------------------------- COMPARE */
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
  const cell = (value, source) => (value ? { value: plain(value), source: source || null } : { value: NOT_PUBLISHED, source: null });
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
  const ds = (r) => (r && r.datasheet ? { value: `Data sheet, ${plain(r.datasheet.doc_version)}`, source: src(r.datasheet.url, `Data sheet, ${plain(r.datasheet.doc_version)}`, `Data sheet, ${plain(r.datasheet.doc_version)}`) } : cell(null));
  line('Data sheet', ds(ra), ds(rb));
  [A, B].forEach((x) => noteProduct(session, x));
  session.compare = [A.id, B.id];
  c.buttons = afterBtns();
  return c;
}

/* ---------------------------------------------------------------- COMPAT */
const TAGMAP = { // our facet -> compatibility tags in that dimension
  substrate: (v) => ['substrate:' + v],
  tile: (v) => ['tile_type:' + v],
};
function envTags(io, surface) {
  const t = [];
  if (io === 'internal') t.push('environment:internal'); else if (io === 'wet') t.push('environment:wet_area'); else if (io === 'external') t.push('environment:external', 'environment:balcony_deck'); else if (io === 'pool') t.push('environment:submerged');
  if (surface) t.push('environment:' + surface);
  return t;
}
const tagsOfRule = (r) => Object.entries(r.tags || {}).flatMap(([d, vs]) => [].concat(vs).map((v) => d + ':' + v));

export async function compat(ctx) {
  const { data, session } = ctx;
  const hits = await findProductsInOrder(data, ctx.rest || ctx.text, 2);
  const p = hits[0] || session.product;
  if (!p) return askProduct('compat', 'do you want to check');
  const rec = await data.compat(p.id);
  noteProduct(session, p);
  // text left once the product's own name is removed, so a name cannot be read as a surface
  let rest = norm(ctx.rest || ctx.text); for (const h of hits) rest = rest.replace(norm(h.name), ' ');
  const pf = parseFacets(rest);
  const wants = []; // {label, tags}
  if (pf.substrate) wants.push({ label: SUBSTRATE_LABEL[pf.substrate], tags: TAGMAP.substrate(pf.substrate), kind: 'substrate' });
  if (pf.tile) wants.push({ label: TILE_LABEL[pf.tile], tags: TAGMAP.tile(pf.tile), kind: 'tile' });
  if (pf.io) wants.push({ label: ENV_LABEL[envId(pf.io, pf.surface)] || pf.io, tags: envTags(pf.io, pf.surface), kind: 'environment' });
  // product to product: "can I use A with B"
  const other = hits[1];
  if (!wants.length && !other) {
    if (ctx.noAsk) return unknownCard('compat', `Can I use ${p.name}?`, 'I need to know what it is going on or over. Name a surface such as concrete, existing tiles or plasterboard.');
    return clarifyCard('compat', `What do you want to use ${p.name} on or over? For example concrete, existing tiles or plasterboard.`, ['concrete', 'existing_tiles', 'plasterboard', 'timber', 'waterproofing_membrane'].map((id) => ({ label: SUBSTRATE_LABEL[id], value: `Can I use ${p.name} on ${SUBSTRATE_LABEL[id]}` })), 'surface');
  }
  const c = card('compat', 'compat', `Can I use ${p.name}?`, { estimate: false, buttons: [handoffBtn] });
  const rules = (rec && rec.rules) || [];
  const rs = (r) => src(page({ url: r.source.url, page: r.source.page }), srcLabel(r.source), r.text);
  let anyNo = false, anyYes = false, anyCond = false, anyUnstated = false; const quotes = [];
  if (other) {
    const ro = rules.filter((r) => (r.mentions || []).includes(other.id) || norm(r.text).includes(norm(other.name)));
    if (ro.length) for (const r of ro.slice(0, 3)) { quotes.push(r.text); c.rows.push({ label: `${p.name} with ${other.name}`, value: `${r.polarity === 'no' ? 'No.' : r.polarity === 'yes' && !r.conditional ? 'Yes.' : 'Conditional.'} ${plain(r.text)}`, quote: true, source: rs(r) }); if (r.polarity === 'no') anyNo = true; else if (r.conditional) anyCond = true; else anyYes = true; }
    else { c.rows.push({ label: `${p.name} with ${other.name}`, value: `${NOT_PUBLISHED}. The published text of ${p.name} does not mention ${other.name}.`, source: null }); anyUnstated = true; }
  }
  for (const w of wants) {
    const m = rules.filter((r) => tagsOfRule(r).some((t) => w.tags.includes(t)) && ['suitability', 'restriction', 'compatibility'].includes(r.type));
    const no = m.find((r) => r.polarity === 'no' && !r.conditional) || m.find((r) => r.polarity === 'no');
    const yes = m.find((r) => r.polarity === 'yes' && !r.conditional);
    const cond = m.find((r) => r.conditional || r.polarity === 'conditional');
    const pick = no || yes || cond;
    if (!pick) { c.rows.push({ label: cap(w.label), value: `${NOT_PUBLISHED}. The published text of ${p.name} does not mention ${w.label}. I will not guess.`, source: null }); anyUnstated = true; (c.silent ||= []).push(w.label); continue; }
    quotes.push(pick.text);
    const verdict = no ? 'No.' : yes ? 'Yes.' : 'Only under a condition.';
    if (no) anyNo = true; else if (yes) anyYes = true; else anyCond = true;
    c.rows.push({ label: cap(w.label), value: `${verdict} ${plain(pick.text)}`, quote: true, verdict: no ? 'no' : yes ? 'yes' : 'conditional', source: rs(pick) });
  }
  // a Yes may only be said when the quoted sentences cover every word of the visitor's condition (owner fix, Monday script beat 4)
  const silent = uncoveredTerms(ctx.rest || ctx.text, [p.name, ...(other ? [other.name] : [])], [{ type: 'text', text: quotes.join(' ') }]);
  let overall;
  if (anyNo) overall = 'No. The published text says it is not suitable.';
  else if (silent.length && (anyYes || anyCond)) { overall = `The published text I quoted does not mention: ${silent.join(', ')}. I will not guess.`; c.silent = silent; anyUnstated = true; }
  else if (anyYes && !anyUnstated && !anyCond) overall = 'Yes, the published text says so.';
  else if (anyCond && !anyUnstated) overall = 'Only under the condition the published text states.';
  else overall = `${NOT_PUBLISHED}. I will not guess.`;
  c.rows.unshift({ label: 'Answer', value: overall, source: null, verdict: anyNo ? 'no' : (silent.length || anyUnstated || !(anyYes || anyCond)) ? 'unknown' : anyYes && !anyCond ? 'yes' : 'conditional' });
  c.status = c.rows[0].verdict === 'unknown' ? 'unknown' : 'published';
  if (c.status === 'unknown') c.handoff = true;
  c.silentWords = [...new Set([...(c.silent || []), ...silent])]; delete c.silent;
  return c;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------------------------------------------------------- SAFETY */
export function sdsAgeYears(dateStr, now) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const d = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return (now.getTime() - d) / (365.25 * 24 * 3600 * 1000);
}
export async function safety(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('safety', 'do you want safety information for');
  noteProduct(session, p);
  const rec = await data.safety(p.id);
  const sds = rec && pickSds({ safety: { sds: rec.sds } });
  const c = card('safety', 'safety', `Safety data sheet statements for ${p.name}`, { estimate: false, buttons: afterBtns() });
  if (!sds) { c.status = 'unknown'; c.handoff = true; c.notes.push('No safety data sheet for this product is listed in the published data I hold. Check the Sika Australia website or ask Technical Services.'); c.buttons = [handoffBtn]; return c; }
  const q = plain(ctx.rest || ctx.text).toLowerCase();
  let rows = safetyRows(sds, q); if (!rows.length) rows = safetyRows(sds, 'ppe hazard storage transport');
  const ver = `Revision ${plain(sds.revision_date)}, version ${plain(sds.version)}`;
  c.summary = `Quoted from the safety data sheet dated ${plain(sds.revision_date)} (${plain(sds.version) ? 'version ' + plain(sds.version) : ''}). Check the current SDS before use.`;
  for (const r of rows) c.rows.push({ label: r.label, value: r.value, quote: !r.missing, source: r.src ? src(r.src.u + (r.src.p ? '#page=' + r.src.p : ''), `SDS ${plain(sds.revision_date)}, page ${r.src.p}`, r.value) : null });
  c.rows.unshift({ label: 'Revision date', value: `${plain(sds.revision_date)}, ${ver.replace(/^Revision [^,]*, /, '')}`, source: src(sds.url, `Safety data sheet, ${ver}`, `Revision ${plain(sds.revision_date)}`) });
  const age = sdsAgeYears(sds.revision_date, ctx.now || new Date());
  if (age != null && age > 3) { c.notes.push('This safety data sheet revision is more than 3 years old. Ask Sika for the current one before you rely on it.'); c.old = true; }
  c.sources = [src(sds.url, `Safety data sheet, ${ver}`, '')];
  return c;
}

/* ---------------------------------------------------------------- TIME */
const TIME_KINDS = [['open_time', 'Open time', /open time|working time|open/], ['adjustability_time', 'Adjustability time', /adjust/], ['pot_life', 'Pot life', /pot ?life|working life/], ['skin_tack_times', 'Skin and tack-free time', /skin|tack/], ['cure_times', 'Cure and return to service', /cure|curing|service|traffic|walk|grout|dry|wait|set/], ['recoat_times', 'Wait before the next coat', /re-?coat|over-?coat|next coat|wait/]];
export async function time(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('time', 'do you want times for');
  noteProduct(session, p);
  const rec = await data.arate(p.id);
  const c = card('time', 'time', `Published times for ${p.name}`, { estimate: false, buttons: afterBtns() });
  const q = plain(ctx.rest || ctx.text).toLowerCase();
  let kinds = TIME_KINDS.filter(([k, , re]) => rec && rec.facts[k] && re.test(q));
  if (!kinds.length) kinds = TIME_KINDS.filter(([k]) => rec && rec.facts[k]);
  for (const [k, label] of kinds) for (const f of rec.facts[k].slice(0, 4)) {
    c.rows.push({ label: f.label && f.label !== label ? `${label}: ${plain(f.label)}` : label, value: plain(f.text) + (f.context ? ` (${plain(f.context)})` : ''), quote: true, source: srcOf(f) });
  }
  if (!c.rows.length) { c.status = 'unknown'; c.handoff = true; c.notes.push(`Time not published for ${p.name} in the data I hold. Check the data sheet or ask Technical Services.`); c.buttons = [handoffBtn]; return c; }
  c.notes.push('Published times are a guide. Conditions such as temperature and humidity apply; each line shows the data sheet sentence it comes from.');
  return c;
}

/* ---------------------------------------------------------------- SPEC */
function clauseRows(sp, limit = 6) {
  const rows = [];
  for (const sec of sp.sections || []) for (const cl of sec.cl || []) {
    if (cl.k !== 'datasheet') continue;
    const text = cl.x || (cl.s || []).join(' ');
    if (!text) continue;
    rows.push({ label: `${cl.no} ${plain(cl.t || sec.h)}`, value: plain(text).slice(0, 420), quote: true, source: src(sp.ds.url + (cl.p ? '#page=' + cl.p : ''), `Data sheet, ${plain(sp.ds.edition)}${cl.p ? ', page ' + cl.p : ''}`, plain(text)) });
    if (rows.length >= limit) return rows;
  }
  return rows;
}
export async function spec(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('spec', 'do you want a specification clause for');
  noteProduct(session, p);
  const sp = await data.spec(p.id);
  const c = card('spec', 'spec', `Draft specification clause for ${p.name}`, { estimate: false, buttons: afterBtns() });
  if (!sp || !sp.ds) { c.status = 'unknown'; c.handoff = true; c.notes.push('No data sheet edition is held for this product, so I cannot draft a clause that cites one.'); c.buttons = [handoffBtn]; return c; }
  const sub = session.system && session.system.substrate ? SUBSTRATE_LABEL[session.system.substrate] : '';
  const clause = supplyClause({ product: p.name, substrate: sub, title: `${p.name} Product Data Sheet`, version: sp.ds.edition });
  c.copyText = `${clause}\n\n${DRAFT_LABEL}`;
  c.rows.push({ label: 'Draft clause', value: clause, source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, `Data sheet ${plain(sp.ds.edition)}`), draft: true });
  c.rows.push(...clauseRows(sp));
  const refs = referencesLines(sp.standards);
  refs.slice(0, 4).forEach((r) => c.rows.push({ label: 'Standard cited', value: r, source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, r) }));
  c.notes.push(DRAFT_LABEL, STANDARDS_NOTE);
  c.sources = [src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, '')];
  return c;
}

/* ---------------------------------------------------------------- PACK */
export async function pack(ctx) {
  const { data, session, memory } = ctx;
  let items = [];
  const named = await findProductsInOrder(data, ctx.rest || ctx.text, 6);
  if (named.length) items = named;
  else if (session.system) items = Object.values(session.system.steps).flatMap((ids) => ids.slice(0, 1)).map((id) => ({ id, name: (session.products.find((x) => x.id === id) || {}).name || id }));
  else if (session.compare) items = session.compare.map((id) => session.products.find((x) => x.id === id) || { id, name: id });
  else if (session.product) items = [session.product];
  else if (memory && memory.currentProject()) items = memory.productsOf(memory.currentProject());
  if (!items.length) return ctx.noAsk ? unknownCard('pack', 'Project pack', 'Nothing to put in a pack yet. Ask for a system or a quantity first.') : clarifyCard('pack', 'What goes in the pack? Ask for a system first (for example /system porcelain on concrete, inside), or name the products.', [], 'products');
  items = items.filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 8);
  const docs = await data.docs();
  const c = card('pack', 'pack', `Project pack: ${(session.system && session.system.title) || items.map((x) => x.name).join(', ')}`, { estimate: false, print: true });
  c.summary = 'Chosen products, their documents and the specification wording on one printable page.';
  c.sections = [];
  let anyQty = false;
  for (const it of items) {
    const [pd, sp] = await Promise.all([data.product(it.id), data.spec(it.id)]);
    const sec = { title: plain(it.name), productId: it.id, rows: [] };
    sec.rows.push({ label: 'Product page', value: plain(it.name), name: true, source: src(pd && pd.url, 'Product page', '') });
    const qd = session.calcs[it.id];
    if (qd) { anyQty = true; qd.rows.slice(0, 1).forEach((r) => { sec.rows.push({ label: 'Quantity', value: `${range(r.low, r.high, r.unit)}${r.packs ? '; ' + r.packs : ''}`, derived: true, source: src(r.url, 'Published rate', r.phrase) }); }); sec.rows.push({ label: 'Job', value: jobText(qdFacets(qd.job)), input: true }); }
    const dl = ((pd && pd.docs) || []).filter((d) => !d.http || d.http.status === 200).filter((d) => d.type === 'product_data_sheet' || d.type === 'safety_data_sheet').slice(0, 4);
    for (const d of dl) sec.rows.push({ label: d.type === 'safety_data_sheet' ? 'Safety data sheet' : 'Product data sheet', value: plain(d.title) + (d.version ? ` (${plain(d.version)})` : ''), source: src(d.url, `${d.typeLabel}${d.http ? ', link checked ' + String(d.http.checked || '').slice(0, 10) : ''}`, plain(d.title)), doc: true });
    if (sp && sp.ds) {
      sec.rows.push({ label: 'Specification clause (draft)', value: supplyClause({ product: it.name, substrate: session.system ? SUBSTRATE_LABEL[session.system.substrate] : '', title: `${it.name} Product Data Sheet`, version: sp.ds.edition }), source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, `Data sheet ${plain(sp.ds.edition)}`), draft: true });
      sec.rows.push(...clauseRows(sp, 3));
    } else sec.rows.push({ label: 'Specification clause', value: `${NOT_PUBLISHED}: no data sheet edition is held for this product.`, source: null });
    c.sections.push(sec);
  }
  c.estimate = anyQty;
  c.notes.push(DRAFT_LABEL);
  c.buttons = [{ label: 'Print this pack', print: true }, { label: 'Export CSV', command: '/export' }, { label: 'Save to my project', command: '/save' }, handoffBtn];
  return c;
}
const qdFacets = (j) => ({ area: j.area_m2, length: j.length_m, volume: j.volume_m3, thickness: j.thickness_mm, coats: j.coats, notch: j.notch_mm, csp: j.csp, dilution: j.dilution, allowance: j.waste_pct });

/* ---------------------------------------------------------------- EXPORT */
export async function exportAction(ctx) {
  const last = ctx.session.last;
  if (!last) return unknownCard('export', 'Export', 'Nothing to export yet. Ask me for a quantity, a system or a comparison first.', { handoff: false });
  const c = card('export', 'export', `Export: ${last.title}`, { estimate: false });
  const slug = norm(last.title).replace(/ /g, '-').slice(0, 40) || 'result';
  c.exports = [
    { label: 'Download CSV', filename: `${slug}.csv`, mime: 'text/csv;charset=utf-8', text: cardCsv(last) },
    { label: 'Download text', filename: `${slug}.txt`, mime: 'text/plain;charset=utf-8', text: cardText(last) },
  ];
  c.buttons = [{ label: 'Print this result', printLast: true }];
  c.summary = last.estimate ? 'The CSV ends with the estimate-only line.' : 'Every row keeps its source sentence and link.';
  return c;
}

/* ---------------------------------------------------------------- LINK */
export async function link(ctx) {
  const { data, session } = ctx;
  const docs = await data.docs();
  const url = /https?:\/\/\S+/.exec(ctx.rest || ctx.text);
  const c = card('link', 'link', 'Document link health', { estimate: false });
  c.notes.push('These are the results recorded when the demo data was built. A browser cannot check another site\'s link live, so this does not call the Sika site.');
  const row = (d) => {
    const h = d.http;
    const ok = h && h.status === 200;
    const sentence = h ? `HTTP ${h.status} checked ${String(h.checked || '').slice(0, 10)} (${plain(h.via || 'recorded check')})` : 'Not checked';
    c.rows.push({ label: `${d.typeLabel || 'Document'}: ${plain(d.title)}`, value: h ? (ok ? `Link working. ${sentence}` : `Link unavailable. ${sentence}`) : 'Not checked', source: h ? src(d.url, plain(d.title), sentence) : null, ok });
  };
  if (url) {
    const u = url[0].replace(/[).,]+$/, '');
    const d = docs.list.find((x) => x.url === u || (x.http && x.http.url === u));
    if (!d) { c.status = 'unknown'; c.notes.push('That link is not in the published document list I hold.'); return c; }
    row(d); return c;
  }
  const p = await pickProduct(ctx);
  if (!p) return askProduct('link', 'do you want the document links checked for');
  noteProduct(session, p);
  const pd = await data.product(p.id);
  const list = ((pd && pd.docs) || []).slice(0, 12);
  c.title = `Document link health for ${p.name}`;
  if (!list.length) { c.status = 'unknown'; c.notes.push('No documents are listed for this product.'); return c; }
  list.forEach(row);
  const bad = c.rows.filter((r) => r.ok === false).length;
  c.summary = bad ? 'Some links are unavailable and should not be relied on.' : 'Every listed link responded when it was last checked.';
  return c;
}

/* ---------------------------------------------------------------- HANDOFF */
export async function handoff(ctx) {
  const { session } = ctx;
  const products = (session.products || []).slice(0, 3).map((x) => ({ id: x.id, name: x.name }));
  const sel = Object.entries(session.facets).filter(([, v]) => v != null && v !== '' && !Array.isArray(v)).map(([k, v]) => `${k}: ${v}`);
  if (session.system) sel.push(`system: ${session.system.title}`);
  const b = buildHandoff({ query: session.lastQuestion || ctx.text, products, sel, reason: session.last && session.last.silentWords && session.last.silentWords.length ? `The published text I quoted does not mention: ${session.last.silentWords.join(', ')}.` : 'You asked to speak to Technical Services. The context so far is included.', config: ctx.config });
  const c = card('handoff', 'handoff', 'Ask Technical Services', { estimate: false, handoffBlock: b });
  return c;
}

/* ---------------------------------------------------------------- HELP */
export function help(ctx) {
  const c = card('help', 'help', 'What I can do', { estimate: false });
  c.summary = 'Type a slash command or just ask in plain English. Everything here is plain code running in your browser: no AI model, no tracking.';
  (ctx.commands || []).forEach(([cmd, , desc]) => c.rows.push({ label: cmd, value: desc, command: cmd }));
  c.notes.push('Voice input appears as a microphone button only if this browser has a built-in speech API. If you do not see one, type instead.');
  return c;
}
