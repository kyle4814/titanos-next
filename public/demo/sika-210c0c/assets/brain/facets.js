// facets.js: constraints parsed from the question: substrate, application area, interior or exterior, wet area, heated floor, tile type, area in m2.
// Tag ids are the ones the knowledge lane uses in compatibility.json and decision_trees.json.
import { normalise, tokens, stem } from './text.js';
const T = (s) => normalise(s).split(' ').map(stem);
const mk = (o) => Object.entries(o).map(([id, terms]) => ({ id, terms: terms.map((t) => ({ raw: t, toks: T(t) })) }));
export const SUBSTRATE = mk({
  concrete: ['concrete', 'slab', 'concrete slab', 'cured concrete'],
  cement_screed: ['cement screed', 'screed', 'sand cement screed'],
  cement_render: ['cement render', 'render', 'rendered wall', 'rendered'],
  brick_block: ['brick', 'brickwork', 'blockwork', 'block wall', 'masonry'],
  fibre_cement: ['fibre cement', 'fiber cement', 'cement sheet', 'cement board', 'villaboard', 'compressed sheet', 'cfc'],
  tile_underlay: ['tile underlay', 'ceramic tile underlay'],
  plasterboard: ['plasterboard', 'gyprock', 'drywall', 'gypsum board'],
  existing_tiles: ['existing tile', 'existing ceramic tile', 'old ceramic tile', 'old tile', 'tile over tile', 'tiling over tile', 'over tile', 'on top of tile', 'over existing tile'],
  waterproofing_membrane: ['over membrane', 'over a membrane', 'on membrane', 'onto membrane', 'over waterproofing', 'over a waterproofing membrane', 'waterproofing membrane'],
  timber: ['timber', 'plywood', 'wood', 'chipboard', 'particleboard', 'wooden floor'],
  aac: ['aac', 'autoclaved aerated concrete', 'hebel', 'aerated concrete'],
  underfloor_heating: ['underfloor heating', 'under floor heating', 'heated floor', 'in floor heating', 'radiant heating', 'hydronic', 'heated slab', 'floor heating'],
  self_levelling_underlayment: ['self levelling underlayment', 'over self levelling', 'on self levelling'],
  metal: ['metal', 'steel', 'aluminium', 'aluminum', 'galvanised'],
  asphalt: ['asphalt', 'bitumen'],
  painted_surface: ['painted surface', 'painted wall', 'over paint', 'painted'],
  epoxy_coating: ['epoxy coating', 'epoxy floor', 'over epoxy'],
  glass: ['on glass', 'to glass', 'glass substrate'],
});
export const ENVIRONMENT = mk({
  wet_area: ['wet area', 'wet wall', 'wet floor', 'wet', 'bathroom', 'shower', 'laundry', 'ensuite', 'bath'],
  internal: ['internal', 'interior', 'indoor', 'inside'],
  external: ['external', 'exterior', 'outdoor', 'outside'],
  floor: ['floor', 'flooring'],
  wall: ['wall'],
  submerged: ['pool', 'spa', 'submerged', 'swimming pool', 'underwater', 'water feature'],
  balcony_deck: ['balcony', 'deck', 'terrace', 'podium'],
  commercial: ['commercial'],
  domestic: ['domestic', 'residential', 'house', 'home'],
  freeze_thaw: ['freeze thaw', 'frost', 'freezing'],
});
export const TILE = mk({
  ceramic: ['ceramic', 'ceramic tile'], porcelain: ['porcelain'], mosaic: ['mosaic'], glass_tile: ['glass tile', 'glass mosaic'],
  moisture_sensitive_stone: ['moisture sensitive stone', 'green marble'], natural_stone: ['natural stone', 'marble', 'granite', 'travertine', 'limestone', 'slate', 'sandstone'],
  large_format: ['large format', 'large tile'], terracotta: ['terracotta'], brick_slip: ['brick slip'],
});
function find(list, toks, n) {
  const hit = [];
  for (const f of list) {
    for (const t of f.terms) {
      const k = t.toks.length; let ok = false;
      for (let i = 0; i + k <= toks.length && !ok; i++) { ok = true; for (let j = 0; j < k; j++) if (toks[i + j] !== t.toks[j]) { ok = false; break; } }
      if (ok) { hit.push({ id: f.id, term: t.raw }); break; }
    }
  }
  return hit;
}
/** human label for a tag id */
export const LABEL = { cement_screed: 'cement screed', cement_render: 'cement render', brick_block: 'brick or blockwork', fibre_cement: 'fibre cement sheet', tile_underlay: 'tile underlay', existing_tiles: 'existing tiles', waterproofing_membrane: 'a waterproofing membrane', underfloor_heating: 'underfloor heating', wet_area: 'wet areas', balcony_deck: 'a balcony or deck', submerged: 'a pool or submerged use', natural_stone: 'natural stone', moisture_sensitive_stone: 'moisture sensitive stone', large_format: 'large format tiles', glass_tile: 'glass tiles', self_levelling_underlayment: 'a self levelling underlayment', epoxy_coating: 'an epoxy coating', painted_surface: 'a painted surface', brick_slip: 'brick slips' };
export const labelOf = (id) => LABEL[id] || id.replace(/_/g, ' ');

export function parseFacets(q) {
  const n = normalise(q);
  const toks = n.split(' ').map(stem);
  const area = (() => { const m = n.match(/(\d+(?:\.\d+)?) ?(?:m2|square met(?:er|re)s?|sq ?m)\b/); return m ? Number(m[1]) : null; })();
  const substrate = find(SUBSTRATE, toks);
  // "floor" next to "heated" is the substrate facet, not a plain floor location
  const environment = find(ENVIRONMENT, toks);
  let tile_type = find(TILE, toks);
  // "ceramic tile underlay" names a substrate, not the tile being laid
  if (substrate.some((s) => /tile/.test(s.term))) tile_type = tile_type.filter((t) => !substrate.some((s) => s.term.split(' ').includes(t.term.split(' ')[0]) && /tile/.test(s.term)));
  const ids = { substrate: substrate.map((x) => x.id), environment: environment.map((x) => x.id), tile_type: tile_type.map((x) => x.id) };
  // a dose is sized by the mass of cement, the mix, the water or the concrete volume, never by an area
  const dose = (() => {
    const d = {}; const num = (x) => Number(x);
    let m = n.match(/(\d+(?:\.\d+)?) ?(tonnes?|tons?|t|kg) (?:of )?(?:total )?(?:cement|cementitious|binder)/); if (m) d.cementKg = num(m[1]) * (m[2] === 'kg' ? 1 : 1000);
    m = n.match(/(\d+(?:\.\d+)?) ?kg (?:of )?(?:(?:sand )?cement )?(?:dry )?mix\b/); if (m) d.mixKg = num(m[1]);
    m = n.match(/(\d+(?:\.\d+)?) ?(?:l|litres?|liters?) (?:of )?water\b/); if (m) d.waterL = num(m[1]);
    m = n.match(/(\d+(?:\.\d+)?) ?(?:m3|cubic met(?:er|re)s?)\b/); if (m) d.volume = num(m[1]);
    return Object.keys(d).length ? d : null;
  })();
  return { area, dose, ...ids, hits: [...substrate, ...environment, ...tile_type], any: !!(substrate.length || environment.length || tile_type.length) };
}
/** the location id the system finder uses, from parsed environment tags (null when not decidable) */
export function systemLocation(env) {
  const has = (x) => env.includes(x);
  if (has('submerged')) return 'pool';
  const where = has('floor') || has('balcony_deck') ? 'floor' : has('wall') ? 'wall' : null; if (!where) return null;
  if (has('wet_area')) return 'internal-wet-' + where;
  if (has('external') || has('balcony_deck')) return 'external-' + where;
  if (has('internal') || has('domestic')) return 'internal-' + where;
  return null;
}
export function adhesiveEnvironment(env) {
  const has = (x) => env.includes(x);
  if (has('submerged')) return 'pool'; if (has('wet_area')) return 'wet_area';
  const where = has('floor') || has('balcony_deck') ? 'floor' : has('wall') ? 'wall' : null; if (!where) return null;
  if (has('external') || has('balcony_deck')) return 'external_' + where;
  if (has('internal') || has('domestic')) return 'internal_' + where;
  return null;
}
export { tokens };
