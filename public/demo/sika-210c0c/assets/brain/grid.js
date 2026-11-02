// grid.js: quantity from a published coverage GRID (tile size down the side, joint width across the top) whose table states what the figure is per.
// Two shapes are computed, both only when the data sheet's own basis line says what the number is per:
//   grout_area_per_pack  "Grout coverage based on 2 Litre pail": 14 m2 per 2 L pail at 1.5 mm
//   grout_kg_per_m2      "Quantity of grout required kg/m2": 0.6 kg per m2 at 3 mm
// A table whose header does not name the pack (notched trowel tables with "Approximate coverage" only) is NOT here: it stays an honest refusal.
// Pure functions: no I/O, nothing invented. Every number shown is a table cell, the visitor's own number, or the arithmetic on them.
export const GRID_MODELS = new Set(['grout_area_per_pack', 'grout_kg_per_m2']);
const fmt = (x) => (Math.round((x + 1e-9) * 100) / 100).toString();
const DIM = '(\\d{2,4}(?:\\.\\d+)?)';
const TILE_RX = new RegExp(DIM + '\\s*(?:mm)?\\s*(?:x|\\u00d7|by)\\s*' + DIM + '(?:\\s*(?:mm)?\\s*(?:x|\\u00d7|by)\\s*(\\d{1,3}(?:\\.\\d+)?))?', 'i');

/** One cell per (tile size, joint width): the facts are stored one per cell. Only facts whose table states its basis. */
export function gridCells(facts) {
  const seen = new Set(), cells = [];
  for (const f of facts || []) {
    const p = f.parsed; if (!p || !GRID_MODELS.has(p.model) || !p.basis_stated || !p.tile_size || !(p.joint_width_mm > 0)) continue;
    if (seen.has(f.id)) continue; seen.add(f.id);
    const d = String(p.tile_size).match(TILE_RX); if (!d) continue;
    cells.push({ f, p, tile: p.tile_size, dims: [Number(d[1]), Number(d[2]), d[3] == null ? null : Number(d[3])], joint: p.joint_width_mm });
  }
  return cells;
}
/** Tile size and joint width the visitor gave, if any. The tile text is cut out first so its last number is never read as a joint. */
export function parseTileJoint(question) {
  const q = String(question || '');
  const m = q.match(TILE_RX); const tile = m ? [Number(m[1]), Number(m[2]), m[3] == null ? null : Number(m[3])] : null;
  const rest = m ? q.replace(m[0], ' ') : q;
  const j = rest.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:wide\s*)?(?:grout\s*)?(?:joints?|lines?|gaps?|spacing|spacers?)\b/i) || rest.match(/\b(?:joints?|grout lines?|gaps?)(?:\s*(?:width|size))?\s*(?:of|is|at|=|:)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  return { tile, joint: j ? Number(j[1]) : null };
}
const sameTile = (want, d) => {
  const a = [want[0], want[1]].sort((x, y) => x - y), b = [d[0], d[1]].sort((x, y) => x - y);
  return a[0] === b[0] && a[1] === b[1] && (want[2] == null || d[2] == null || want[2] === d[2]);
};
export const tileRows = (cells) => { const seen = new Set(); return cells.filter((c) => { if (seen.has(c.tile)) return false; seen.add(c.tile); return true; }).map((c) => c.tile); };
export const jointCols = (cells) => [...new Set(cells.map((c) => c.joint))].sort((a, b) => a - b);

/** What one cell needs for an area. area_per_pack: area / m2-per-pack, in packs of the table's own pack. kg_per_m2: area x kg/m2. Returns null when the cell cannot be trusted (calc flag false). */
export function cellNeed(cell, area, containerWord) {
  const { p, f } = cell;
  if (p.model === 'grout_area_per_pack') {
    if (!(p.area_m2 > 0) || !p.pack || !(p.pack.amount > 0)) return null;
    const exact = area / p.area_m2, amount = exact * p.pack.amount, word = containerWord || 'pack';
    return { unit: p.pack.unit, amount, basisPacks: Math.ceil(exact - 1e-9), working: `${fmt(area)} m2 / ${fmt(p.area_m2)} m2 per ${fmt(p.pack.amount)} ${p.pack.unit} ${word} = ${fmt(exact)}, rounded up to ${Math.ceil(exact - 1e-9)}`, basisSize: p.pack.amount };
  }
  if (p.model === 'grout_kg_per_m2') {
    if (!f.calc || !(p.kg_per_m2 > 0)) return null;
    return { unit: 'kg', amount: area * p.kg_per_m2, working: `${fmt(area)} m2 x ${fmt(p.kg_per_m2)} kg per m2 = ${fmt(area * p.kg_per_m2)} kg`, basisSize: null };
  }
  return null;
}
/** Whole packs of every published pack size in the same unit (smallest first), for a needed amount. */
export function packPlan(need, packs) {
  const same = (packs || []).filter((x) => x.unit === need.unit);
  return same.map((x) => ({ size: x.amount, unit: x.unit, container: x.container || '', count: Math.max(1, Math.ceil(need.amount / x.amount - 1e-9)) }));
}
export const planText = (plan, limit = 4) => plan.slice(0, limit).map((x) => `${x.count} x ${fmt(x.size)} ${x.unit}${x.container ? ' ' + x.container.replace(/s$/, '') : ''}`).join(' or ');

/** Pick the cells for a question. Returns { mode, cells, tile, joint } where mode is:
 *  'exact' (one cell) | 'joints' (tile known, joint not given: one cell per joint) | 'tiles' (joint known, tile not given)
 *  | 'ask-tile' (neither given) | 'bad-tile' | 'bad-joint' (given, but not in the published table) | null (no grid in this product). */
export function selectCells(cells, question) {
  if (!cells.length) return null;
  const { tile, joint } = parseTileJoint(question);
  const cols = jointCols(cells);
  let tileCells = cells;
  if (tile) { tileCells = cells.filter((c) => sameTile(tile, c.dims)); if (!tileCells.length) return { mode: 'bad-tile', cells, tile, joint }; if (new Set(tileCells.map((c) => c.tile)).size > 1) return { mode: 'ask-tile', cells: tileCells, tile, joint }; }
  if (joint != null && !cols.includes(joint)) return { mode: 'bad-joint', cells, tile, joint };
  if (tile && joint != null) return { mode: 'exact', cells: tileCells.filter((c) => c.joint === joint), tile, joint };
  if (tile) return { mode: 'joints', cells: tileCells, tile, joint };
  if (joint != null) return { mode: 'tiles', cells: cells.filter((c) => c.joint === joint), tile, joint };
  return { mode: 'ask-tile', cells, tile, joint };
}
