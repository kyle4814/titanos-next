// Measures the search box (suggest, top 6) and the finder free text (search rows) against queries.json.
// usage: node measure.mjs [--json]   env PORTAL=<portal dir> to measure another tree (the BEFORE baseline runs it on the pre-change tree)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PORTAL, HERE } from './_env.mjs';
const rd = (f) => JSON.parse(fs.readFileSync(path.join(PORTAL, f), 'utf8'));
const { queries } = JSON.parse(fs.readFileSync(path.join(HERE, 'queries.json'), 'utf8'));
const index = rd('data/index.json'), categories = rd('data/categories.json'), catById = new Map(categories.map((c) => [c.id, c]));
const mod = await import(pathToFileURL(path.join(PORTAL, 'assets/lib/search.js')).href);
let aliasData = null; try { aliasData = rd('data/brain/alias.json'); } catch { /* the pre-change tree has none */ }
const s = mod.buildSearch(index, catById, aliasData ? { aliases: aliasData } : undefined);
const byId = new Map(index.map((p) => [p.id, p]));
export const isHit = (qq, p) => !!p && ((qq.ids || []).includes(p.id) || (qq.idPrefix && p.id.startsWith(qq.idPrefix)) || (qq.cat && p.c.startsWith(qq.cat)));
const rank = (qq, rows) => { const i = rows.findIndex((p) => isHit(qq, p)); return i < 0 ? 0 : i + 1; };
const rows = queries.map((qq) => ({ q: qq.q, kind: qq.kind, box: rank(qq, s.suggest(qq.q, 6)), finder: rank(qq, s.search({ q: qq.q }).rows.slice(0, 6)) }));
const pct = (n) => (100 * n / rows.length).toFixed(1) + '%';
const sum = (k) => ({ top1: rows.filter((r) => r[k] === 1).length, top3: rows.filter((r) => r[k] >= 1 && r[k] <= 3).length, top6: rows.filter((r) => r[k] >= 1).length });
const out = { n: rows.length, box: sum('box'), finder: sum('finder'), byKind: {} };
for (const kind of [...new Set(rows.map((r) => r.kind))]) { const k = rows.filter((r) => r.kind === kind); out.byKind[kind] = { n: k.length, boxTop3: k.filter((r) => r.box >= 1 && r.box <= 3).length, finderTop3: k.filter((r) => r.finder >= 1 && r.finder <= 3).length }; }
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...out, rows }));
else {
  console.log(`SEARCH MEASURE n=${out.n}  box top1 ${out.box.top1} (${pct(out.box.top1)}) top3 ${out.box.top3} (${pct(out.box.top3)}) top6 ${out.box.top6} (${pct(out.box.top6)})  finder top1 ${out.finder.top1} (${pct(out.finder.top1)}) top3 ${out.finder.top3} (${pct(out.finder.top3)}) top6 ${out.finder.top6} (${pct(out.finder.top6)})`);
  for (const [k, v] of Object.entries(out.byKind)) console.log(`  ${k.padEnd(9)} n=${v.n} box top3 ${v.boxTop3}  finder top3 ${v.finderTop3}`);
  for (const r of rows) if (!(r.box >= 1 && r.box <= 3) || !(r.finder >= 1 && r.finder <= 3)) console.log(`  miss [${r.kind}] "${r.q}" box rank ${r.box || '-'} finder rank ${r.finder || '-'}`);
}
