// Actions v2, shared handler helpers: source builders, labels, product pick, buttons. Split out so every module stays under the 40 KB budget.
import { clarifyCard, src, plain, findProducts } from './core.js';
import { fmt, fmtQty } from '../lib/finder/calc.js';
export const page = (s) => (s && s.url ? s.url + (s.page && /\.pdf/i.test(s.url) ? '#page=' + s.page : '') : '');
export const srcLabel = (s) => (s ? `${s.doc_type === 'SDS' ? 'Safety data sheet' : s.doc_type === 'PDS' ? 'Data sheet' : 'Product page'}${s.doc_version ? ', ' + plain(s.doc_version) : ''}${s.page ? ', page ' + s.page : ''}` : 'Source');
/** A source from a knowledge-lane fact or rule: { text, source:{url,page,doc_version,doc_type} }. */
export const srcOf = (f) => (f && f.source ? src(page(f.source), srcLabel(f.source), f.text) : null);
export const ROUND = (x) => Math.round(x * 100) / 100;
export const range = (lo, hi, u) => (lo === hi ? fmtQty(lo, u) : `${fmtQty(lo, u)} to ${fmtQty(hi, u)}`);
export const packLine = (p) => (p && p.combo && p.combo.length ? p.combo.map((c) => `${c.count} x ${fmt(c.amount)} ${c.unit}`).join(' + ') + ` (${fmtQty(p.total, p.unit)} supplied, ${fmtQty(p.over_supply, p.unit)} over)` : null);
export const nameOf = (rec, id) => plain((rec && rec.name) || id);
export const ENV_LABEL = { internal_wall: 'internal wall (dry area)', internal_floor: 'internal floor (dry area)', wet_area: 'wet area', external_wall: 'external wall', external_floor: 'external floor, balcony or deck', pool: 'pool or submerged use' };
export const SUBSTRATE_LABEL = { concrete: 'concrete', cement_screed: 'cement screed', cement_render: 'cement render', brick_block: 'brick or blockwork', fibre_cement: 'fibre cement sheet', tile_underlay: 'tile underlay', plasterboard: 'plasterboard', existing_tiles: 'existing tiles', waterproofing_membrane: 'a waterproofing membrane', timber: 'timber or plywood', aac: 'autoclaved aerated concrete', underfloor_heating: 'an underfloor heated floor', self_levelling_underlayment: 'a self-levelling underlayment' };
export const TILE_LABEL = { ceramic: 'ceramic tiles', porcelain: 'porcelain tiles', mosaic: 'mosaic tiles', glass_tile: 'glass tiles', natural_stone: 'natural stone', moisture_sensitive_stone: 'moisture sensitive stone', large_format: 'large format tiles', terracotta: 'quarry or terracotta tiles', brick_slip: 'brick slips' };

export const handoffBtn = { label: 'Ask Technical Services with this context', command: '/handoff' };
export const afterBtns = (...extra) => [...extra, { label: 'Export CSV or print', command: '/export' }, { label: 'Save to my project', command: '/save' }];

/* ---------------------------------------------------------------- shared lookups */
export async function pickProduct(ctx, { allowSession = true } = {}) {
  const hits = await findProducts(ctx.data, ctx.rest || ctx.text, 3);
  if (hits.length) return hits[0];
  const s = ctx.session;
  if (allowSession && s.product) return s.product;
  return null;
}
export function noteProduct(session, p) {
  if (!p) return;
  session.product = { id: p.id, name: p.name };
  session.products = [session.product, ...(session.products || []).filter((x) => x.id !== p.id)].slice(0, 12);
}
export const askProduct = (action, what) => clarifyCard(action, `Which product ${what}? Type its name, for example Davco Grey One Pot adhesive.`, [], 'product');

export const jobText = (f) => [f.area ? `${fmt(f.area)} m2` : null, f.length ? `${fmt(f.length)} m` : null, f.volume ? `${fmt(f.volume)} m3` : null, f.thickness ? `${fmt(f.thickness)} mm thick` : null, f.coats ? `${fmt(f.coats)} coats` : null, f.cementitious ? `${fmt(f.cementitious)} kg cementitious` : null, f.mix ? `${fmt(f.mix)} kg mix` : null, f.water ? `${fmt(f.water)} L water` : null, f.notch ? `${fmt(f.notch)} mm notch` : null, f.tileSize ? `${fmt(f.tileSize[0])} x ${fmt(f.tileSize[1])} mm tiles` : null, f.csp ? `CSP ${f.csp}` : null, f.dilution || null, f.allowance != null ? `${fmt(f.allowance)}% allowance (yours)` : null].filter(Boolean).join(', ') || 'No size given';
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain labels for the facets collected so far (never raw ids such as underfloor_heating). */
export function selectionLines(session) {
  const f = session.facets || {}; const out = [];
  if (f.tile && TILE_LABEL[f.tile]) out.push(`Tiles: ${TILE_LABEL[f.tile]}`);
  if (f.substrate && SUBSTRATE_LABEL[f.substrate]) out.push(`Surface or condition: ${SUBSTRATE_LABEL[f.substrate]}`);
  if (f.io) out.push(`Place: ${({ internal: 'internal, dry area', wet: 'wet area', external: 'external', pool: 'pool or submerged' })[f.io] || f.io}${f.surface ? ' ' + f.surface : ''}`);
  if (f.area) out.push(`Area: ${fmt(f.area)} m2`);
  if (session.system) out.push(`System: ${session.system.title}`);
  return out;
}
/** One sentence naming what the quoted text does not mention; words already inside a longer one are dropped. */
export const dedupeWords = (words) => [...new Set(words || [])].filter((x, _, a) => !a.some((y) => y !== x && y.length > x.length && y.toLowerCase().includes(x.toLowerCase().slice(0, Math.max(4, x.length - 3)))));
export function silentReason(words) {
  const w = dedupeWords(words);
  return w.length ? `The published text I quoted does not mention ${w.join(', ')}.` : null;
}
