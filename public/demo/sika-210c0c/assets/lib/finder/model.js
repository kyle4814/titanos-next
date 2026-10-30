// System finder model: pure functions over data/finder/systems.json (no DOM, no network). Shared by the app views, the node tests and the
// static page builder, so a page, a sheet and a test can never disagree.
import { normaliseSystemRate, work, NO_RATE_TEXT } from './calc.js';

export const ROLE_LABEL = { prime: 'Prepare and prime', membrane: 'Waterproofing membrane', adhesive: 'Tile adhesive', grout: 'Grout', sealant: 'Movement joint sealant', care: 'Care and maintenance' };
export const ROLE_ORDER = ['prime', 'membrane', 'adhesive', 'grout', 'sealant', 'care'];
const SUB_FACETS = { 'concrete': ['concrete'], 'screed-render': ['screed', 'render-brick'], 'masonry': ['render-brick'], 'cement-board': ['fibre-cement'], 'plasterboard': ['plasterboard'], 'timber-floor': ['timber'], 'existing-tiles': ['existing-tiles'], 'aac': ['aac'] };
/** The status chip words for a source: a PDF is a published data sheet, anything else is the published product page. Never "approved" or "signed". */
export const chipFor = (url) => (/\.pdf(\?|$)/i.test(url || '') ? 'From a published data sheet' : 'From the published product page');
export const NO_MATCH = 'I do not have a matching product in the published pages.';

export const keyOf = (sel) => `${sel.tile}|${sel.sub}|${sel.loc}`;
const label = (list, id) => ((list || []).find((x) => x.id === id) || {}).label || id;
const locFacets = (loc) => (/^external/.test(loc) ? ['external'] : /^internal|^pool/.test(loc) ? (loc === 'pool' ? [] : ['internal']) : []);

const rolesCache = new WeakMap();
function rolesOf(S) {
  if (rolesCache.has(S)) return rolesCache.get(S);
  const m = new Map();
  for (const st of S.stepPool) for (const o of st.options) { if (!m.has(o.productId)) m.set(o.productId, new Set()); m.get(o.productId).add(st.role); }
  rolesCache.set(S, m); return m;
}

/** Expand one stored combination into steps with options, the quoted evidence, and the ruled out list. */
export function resolve(S, sel) {
  const key = keyOf(sel); const sys = S.systems[key];
  const tileLabel = label(S.tileTypes, sel.tile), subLabel = label(S.substrates, sel.sub), locLabel = label(S.locations, sel.loc);
  if (!sys) return { ok: false, key, tileLabel, subLabel, locLabel, message: 'The published documentation does not support a complete system for this combination. Contact Sika Australia technical services.' };
  const q = (i) => S.quotes[i];
  const steps = sys.steps.map((si) => {
    const st = S.stepPool[si];
    const options = st.options.map((o) => {
      const prod = S.products[o.productId] || {};
      return {
        productId: o.productId, name: prod.name || o.productId, brand: prod.brand || '', url: prod.url || null, what: prod.what || '',
        reason: S.reasons[o.reason] || '', via: o.via || null,
        evidence: (o.ev || []).map((i) => ({ sentence: q(i).sentence, url: q(i).url, what: q(i).what, context: q(i).context || null })),
        cautions: (o.cautions || []).map((i) => ({ sentence: q(i).sentence, url: q(i).url })),
        rate: prod.rate || null, packs: prod.packs || [], docs: prod.docs || {},
      };
    });
    return { role: st.role, label: ROLE_LABEL[st.role] || st.role, status: st.status, note: st.note || '', options, quotes: (st.quotes || []).map((i) => ({ sentence: q(i).sentence, url: q(i).url, productId: q(i).productId })) };
  });
  // products the published text rules out for this combination (their own sentence, quoted)
  const facets = [sel.tile, ...(SUB_FACETS[sel.sub] || []), ...locFacets(sel.loc)];
  const chosen = new Set(steps.flatMap((s) => s.options.map((o) => o.productId)));
  const roles = rolesOf(S); const ruledOut = [];
  for (const [pid, ex] of Object.entries(S.excl || {})) {
    if (chosen.has(pid)) continue;
    const hit = facets.find((f) => ex.e[f]);
    if (!hit) continue;
    const role = ROLE_ORDER.find((r) => (roles.get(pid) || new Set()).has(r)) || null;
    if (!role) continue;
    ruledOut.push({ productId: pid, name: (S.products[pid] || {}).name || pid, role, roleLabel: ROLE_LABEL[role], facet: hit, quote: ex.e[hit].quote, url: ex.u });
  }
  ruledOut.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  return { ok: true, key, slug: sys.slug, title: sys.title, tileLabel, subLabel, locLabel, steps, ruledOut, notes: sys.notes || [] };
}

/** Everything the keepable sheet shows, as data. job = { area, allowancePct, length }; pick = { role: productId }. */
export function sheetModel(S, sel, job, pick = {}) {
  const r = resolve(S, sel);
  if (!r.ok) return r;
  const rows = []; const notCovered = []; const sources = new Map();
  const src = (url, text) => { if (url && !sources.has(url)) sources.set(url, text); };
  for (const st of r.steps) {
    if (!st.options.length) {
      rows.push({ role: st.role, label: st.label, empty: true, text: NO_MATCH, note: st.note });
      notCovered.push(st.label + ': ' + (st.note || NO_MATCH));
      continue;
    }
    const o = st.options.find((x) => x.productId === pick[st.role]) || st.options[0];
    const rate = o.rate ? normaliseSystemRate(o.rate) : { ok: false, reason: NO_RATE_TEXT };
    const calc = work(rate, (o.packs || []).map((p) => ({ amount: p.size, unit: p.unit })), job);
    const ev = o.evidence[0] || null;
    const why = ev ? { reason: o.reason, quote: ev.sentence, url: ev.url } : { reason: o.reason, quote: null, url: o.url };
    src(o.url, o.name + ' product page');
    if (o.docs.pds) src(o.docs.pds, o.name + ' data sheet (PDS)');
    if (o.docs.sds) src(o.docs.sds, o.name + ' safety data sheet (SDS)');
    if (ev) src(ev.url, o.name + ' product page');
    if (!calc.ok && calc.need === undefined) notCovered.push(st.label + ' (' + o.name + '): ' + (calc.reason || NO_RATE_TEXT));
    else if (!calc.ok) notCovered.push(st.label + ' (' + o.name + '): ' + calc.reason);
    if (calc.ok && calc.packs && calc.packs.note) notCovered.push(st.label + ' (' + o.name + '): ' + calc.packs.note);
    rows.push({
      role: st.role, label: st.label, status: st.status, product: { id: o.productId, name: o.name, url: o.url, pds: o.docs.pds || null, sds: o.docs.sds || null },
      why, rate: o.rate ? { text: o.rate.text, url: o.rate.sourceUrl, basis: o.rate.basis || null } : null, calc,
      others: st.options.filter((x) => x !== o).map((x) => x.name), cautions: o.cautions.slice(0, 1),
    });
  }
  notCovered.push('The condition of your surface, the tile size and the trowel or notch you choose are not decided by this sheet.');
  return { ok: true, sel, job, title: r.title, tileLabel: r.tileLabel, subLabel: r.subLabel, locLabel: r.locLabel, rows, notCovered, sources: [...sources].map(([url, text]) => ({ url, text })), ruledOut: r.ruledOut };
}

/** Parse the hash parameters of a sheet or finder link into { sel, job, pick }. */
export function parseParams(params) {
  const g = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]) || '';
  const n = (k) => { const v = parseFloat(g(k)); return Number.isFinite(v) && v > 0 && v < 1e7 ? v : null; };
  const al = parseFloat(g('allow'));
  const pick = {};
  for (const part of g('pick').split(',')) { const [r, p] = part.split(':'); if (r && p) pick[r] = p; }
  return { sel: { tile: g('tile'), sub: g('sub'), loc: g('loc') }, job: { area: n('m2'), length: n('len'), allowancePct: Number.isFinite(al) && al > 0 && al < 1000 ? al : 0 }, pick };
}
export function toParams({ sel, job, pick }) {
  const o = { tile: sel.tile, sub: sel.sub, loc: sel.loc };
  if (job && job.area) o.m2 = String(job.area);
  if (job && job.allowancePct) o.allow = String(job.allowancePct);
  if (job && job.length) o.len = String(job.length);
  const pk = Object.entries(pick || {}).map(([r, p]) => r + ':' + p).join(',');
  if (pk) o.pick = pk;
  return o;
}
