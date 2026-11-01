// build_rules.mjs: the rule shards of the plan engine (lane D). Reads the published specification clauses (data/specs/<id>.json, 15,212 clauses with
// their data sheet pages) and the system finder shard, extracts the published rules with scripts/sika-brain/rulex.mjs, and writes
//   data/brain/rules/sys.json    the 363 published systems (step roles and the products named for each)
//   data/brain/rules/tile.json   the extracted rules of every product that a system names (loaded when a plan is asked for)
//   data/brain/rules/o<n>.json   the extracted rules of every other product (loaded when a rule question names one), idx.json maps id -> n
// Product entry: { m: [name, product page, data sheet url, safety data sheet url, edition], r: [rule rows] }.
// Rule row: [kind, values, exact words, clause, page]. Nothing here is typed by hand: a number is read from the clause text.
// Run after build_brain.mjs:  node scripts/sika-brain/build_rules.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProduct, tagsOf, isLimit } from './rulex.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const D = path.join(PORTAL, 'data'); const OUT = path.join(D, 'brain', 'rules');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const s = JSON.stringify(o); fs.writeFileSync(f, s); return s.length; };

const cat = rd(path.join(D, 'brain', 'cat', 'construction__tile-stone-installationsystems.json'));
const systems = {}; const tileIds = new Set(); const names = {};
for (const [key, s] of Object.entries(cat.systems)) {
  systems[key] = [s.slug, s.title, s.steps.map((st) => [st.role, st.status === 'stated' ? 1 : 0, st.opt.map((o) => { tileIds.add(o.id); names[o.id] = [o.n, o.u]; return o.id; })])];
}
const spec = (id) => rd(path.join(D, 'specs', id + '.json'));
const pshard = (id) => { const f = path.join(D, 'brain', 'p', encodeURIComponent(id) + '.json'); return fs.existsSync(f) ? rd(f) : null; };
const lane = (id) => { const f = path.join(D, 'k', id + '.json'); return fs.existsSync(f) ? rd(f) : null; };

const prod = {}; const rulesOf = {}; const counts = {};
const ids = fs.readdirSync(path.join(D, 'specs')).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5)).sort();
for (const id of ids) {
  const sp = spec(id); const r = extractProduct(sp); const ps = pshard(id);
  // the standards, as the documents name them: the citing sentence and page come from the product shard's own list
  const stds = ps && ps.sp && ps.sp.std ? ps.sp.std : [];
  const rows = [];
  for (const x of r.rules) {
    if (x.k === 'std') { const hit = stds.find((s) => s.citation.toLowerCase() === x.v.name.toLowerCase()); rows.push(['std', { name: x.v.name, how: x.v.how }, hit ? hit.context : x.q, x.c, hit && hit.page != null ? hit.page : x.p]); continue; }
    if (x.v && x.v.label) delete x.v.label;
    rows.push([x.k, x.v, x.q, x.c, x.p]);
  }
  // the knowledge lane's own "no" statements (a restriction or a not-suitable clause) with their tags, when the clause sweep did not already hold the sentence
  const kl = lane(id);
  if (kl) for (const c of kl.compat || []) {
    if (c.pol !== 'no' || !c.text || c.text.length < 18 || !isLimit(c.text)) continue;
    if (rows.some((z) => z[0] === 'no' && z[2].slice(0, 40) === c.text.replace(/\s+/g, ' ').slice(0, 40))) continue;
    const tags = tagsOf(c.text); if (!Object.keys(tags).length) continue;
    rows.push(['no', { tags, lane: 1 }, c.text.replace(/\s+/g, ' ').slice(0, 280), null, c.s && c.s.p != null ? c.s.p : null]);
  }
  rulesOf[id] = rows;
  const docs = ps ? ps.dc || [] : [];
  const pds = docs.find((d) => d.ty === 'product_data_sheet' && d.ok); const sds = docs.filter((d) => d.ty === 'safety_data_sheet' && d.ok)[0];
  prod[id] = [sp.name, ps ? ps.u : (names[id] ? names[id][1] : ''), sp.ds && sp.ds.url || (pds ? pds.u : ''), sds ? sds.u : '', sp.ds && sp.ds.edition || ''];
  for (const x of rows) counts[x[0]] = (counts[x[0]] || 0) + 1;
}
const sizes = {};
const tile = {}; for (const id of ids) if (tileIds.has(id)) tile[id] = { m: prod[id], r: rulesOf[id] };
sizes['tile.json'] = wr(path.join(OUT, 'tile.json'), { v: 1, products: tile });
// every other product, in six alphabetical shards
const others = ids.filter((id) => !tileIds.has(id)); const N = 6; const idx = {};
for (let n = 0; n < N; n++) {
  const part = others.slice(Math.floor(n * others.length / N), Math.floor((n + 1) * others.length / N)); const o = {};
  for (const id of part) { o[id] = { m: prod[id], r: rulesOf[id] }; idx[id] = n; }
  sizes['o' + n + '.json'] = wr(path.join(OUT, 'o' + n + '.json'), { v: 1, products: o });
}
sizes['idx.json'] = wr(path.join(OUT, 'idx.json'), { v: 1, shards: N, idx });
const sysOut = { v: 1, tiles: cat.tileTypes.map((t) => [t.id, t.label, t.hasSystems ? 1 : 0]), subs: cat.substrates.map((t) => [t.id, t.label]), locs: cat.locations.map((t) => [t.id, t.label]), systems };
sizes['sys.json'] = wr(path.join(OUT, 'sys.json'), sysOut);
const total = Object.values(sizes).reduce((a, b) => a + b, 0);
const manifest = { v: 1, products: ids.length, tileProducts: tileIds.size, systems: Object.keys(systems).length, rules: Object.values(counts).reduce((a, b) => a + b, 0), counts, bytes: sizes, totalBytes: total };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(JSON.stringify(manifest, null, 1));
