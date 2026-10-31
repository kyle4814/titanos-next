// Before/after on the full catalogue: how many products the product-page calculator can compute, base commit ca1528765 against now. usage: node measure.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as now from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'finder', 'r');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dose-measure-'));
fs.writeFileSync(path.join(dir, 'calc_base.mjs'), execFileSync('git', ['show', 'ca1528765:public/demo/sika-210c0c/assets/lib/finder/calc.js'], { cwd: HERE, encoding: 'utf8' }));
const base = await import(pathToFileURL(path.join(dir, 'calc_base.mjs')).href); fs.rmSync(path.join(dir, 'calc_base.mjs'));
const prods = fs.readdirSync(R).filter((f) => f !== 'index.json').map((f) => JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')));
const tally = (lib) => {
  let computes = 0, notWorked = 0, noFacts = 0, other = 0, areaBox = 0; const kinds = {}; const dose = new Set();
  for (const p of prods) {
    const ns = (p.consumption || []).map((x) => lib.normaliseFact(x));
    if (p.status !== 'published' || !ns.length) { noFacts++; continue; }
    if (ns.some((n) => n.ok)) { computes++; for (const n of ns) if (n.ok) kinds[n.kind] = (kinds[n.kind] || 0) + 1; if (ns.some((n) => n.ok && /^dose|per-m3/.test(n.kind))) dose.add(p.id); }
    else if (ns.some((n) => /not worked out here/.test(n.reason || ''))) notWorked++; else other++;
  }
  return { computes, notWorked, unreadable_other: other, noFacts, kinds, doseProducts: dose.size, ids: [...dose] };
};
const a = tally(base), b = tally(now);
const gained = b.ids.filter((id) => !a.ids.includes(id));
const lost = a.ids.filter((id) => !b.ids.includes(id)); console.log("LOST", JSON.stringify(lost));
console.log(JSON.stringify({ products: prods.length, before: { ...a, ids: undefined }, after: { ...b, ids: undefined }, gained: gained.length, gainedIds: gained }, null, 1));
