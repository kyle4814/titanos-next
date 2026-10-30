// T15: compares the knowledge lane's page-cited consumption facts with the assistant's own regex parse (assistant/rates.js productRates)
// and writes the mismatch log. Usage: node merge_facts.mjs <portal_dir> <mismatch_json_out>
import fs from 'node:fs';
import path from 'node:path';
import { productRates } from '../../public/demo/sika-210c0c/assets/assistant/rates.js';

const portal = process.argv[2]; const out = process.argv[3];
if (!portal || !out) { console.error('usage: merge_facts.mjs <portal_dir> <mismatch_json_out>'); process.exit(2); }
const rd = (f) => JSON.parse(fs.readFileSync(path.join(portal, 'data', f), 'utf8'));
const products = rd('products.json');
const near = (a, b) => Math.abs(a - b) <= 0.011 * Math.max(1, Math.abs(a), Math.abs(b));
// numbers a lane fact states, as the set of values the engine could legitimately hold (value or reciprocal)
function laneValues(f) {
  const p = f.parsed || {}; const vals = [];
  if (p.model === 'per_area') vals.push([p.base_min ?? p.min, p.base_max ?? p.max, p.unit, p.per === 'mm']);
  else if (p.model === 'pack_covers_area') vals.push([p.amount / p.area_max, p.amount / p.area_min, p.unit, false]);
  else if (p.model === 'area_per_unit') vals.push([p.min, p.max, p.unit, false], [1 / p.max, 1 / p.min, p.unit, false]);
  else return null;
  return vals;
}
const res = { generated: new Date().toISOString().slice(0, 10), compared: 0, match: 0, mismatch: 0, engine_missing: 0, not_comparable: 0, by_category: {}, mismatches: [], engine_missing_list: [] };
for (const p of products) {
  const kf = path.join(portal, 'data', 'k', p.id + '.json'); if (!fs.existsSync(kf)) continue;
  const k = JSON.parse(fs.readFileSync(kf, 'utf8'));
  const facts = (k.rates && k.rates.facts && k.rates.facts.consumption) || [];
  const eng = productRates(p);
  const cat = p.category.split('/').slice(0, 2).join('/');
  const slot = (res.by_category[cat] ||= { compared: 0, match: 0, mismatch: 0, engine_missing: 0, not_comparable: 0 });
  for (const f of facts) {
    if (!f.calc) continue;
    const lv = laneValues(f);
    if (!lv) { res.not_comparable++; slot.not_comparable++; continue; }
    res.compared++; slot.compared++;
    const ok = lv.some(([lo, hi, unit, perMm]) => eng.some((r) => {
      const rl = r.low, rh = r.high ?? r.low;
      if (r.kind === 'area_per_pack') return near(rl, lo) && near(rh, hi);
      return (r.unit || '').toLowerCase() === String(unit).toLowerCase() && !!r.perMm === !!perMm && near(rl, lo) && near(rh, hi);
    }));
    if (ok) { res.match++; slot.match++; }
    else if (!eng.length) { res.engine_missing++; slot.engine_missing++; res.engine_missing_list.push({ id: p.id, category: p.category, lane: f.text, s: f.s }); }
    else { res.mismatch++; slot.mismatch++; res.mismatches.push({ id: p.id, category: p.category, lane: f.text, laneParsed: f.parsed, engine: eng.map((r) => ({ kind: r.kind, unit: r.unit, low: r.low, high: r.high, perMm: r.perMm, text: r.text })), s: f.s }); }
  }
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
const ip = path.join(portal, 'data', 'k', '_index.json'); const idx = JSON.parse(fs.readFileSync(ip, 'utf8'));
idx.rate_mismatch = [...new Set(res.mismatches.map((m) => m.id))].sort();
fs.writeFileSync(ip, JSON.stringify(idx));
const tile = Object.entries(res.by_category).filter(([c]) => c.includes('tile-stone'));
console.log(JSON.stringify({ compared: res.compared, match: res.match, mismatch: res.mismatch, engine_missing: res.engine_missing, not_comparable: res.not_comparable, tile_and_stone: tile.map(([, v]) => v) }));
