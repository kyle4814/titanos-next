// Per-route first-load JS (gzip) from the static export. Usage: node scripts/js_budget.mjs [outDir=out] [budgetKB=250]
// First load = every <script src> in the route html that a browser actually fetches. Next's polyfill-nomodule script
// (<script noModule>, ~39 KB gz) is skipped by every browser that runs this site (module support, Chrome 61+), so the
// budget is checked without it; the strict figure that counts it is printed as "strict" so nothing is hidden.
// Exit 1 if any route is over budget.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
const OUT = path.resolve(process.argv[2] || "out");
const BUDGET = Number(process.argv[3] || 250);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const cache = new Map();
const gz = (s) => { if (!cache.has(s)) cache.set(s, zlib.gzipSync(fs.readFileSync(path.join(OUT, s))).length); return cache.get(s); };
const rows = [];
for (const f of walk(OUT).filter((f) => f.endsWith(".html") && !/404|_not-found|\/og\//.test(f))) {
  const html = fs.readFileSync(f, "utf8");
  const tags = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].filter((m) => fs.existsSync(path.join(OUT, m[1].replace(/^\//, ""))));
  const mod = [...new Set(tags.filter((m) => !/noModule/i.test(m[0])).map((m) => m[1].replace(/^\//, "")))];
  const all = [...new Set(tags.map((m) => m[1].replace(/^\//, "")))];
  rows.push([("/" + path.relative(OUT, f)).replace(/\.html$/, ""), mod.reduce((a, s) => a + gz(s), 0) / 1024, mod.length, all.reduce((a, s) => a + gz(s), 0) / 1024]);
}
rows.sort((a, b) => b[1] - a[1]);
let over = 0;
for (const [r, kb, n, strict] of rows) { if (kb > BUDGET) over++; if (process.env.ALL || kb > BUDGET || rows.findIndex((x) => x[0] === r) < 8) console.log(kb.toFixed(1).padStart(7), "KB", String(n).padStart(3), "scripts", "strict", strict.toFixed(1), r); }
console.log(`routes ${rows.length} over ${BUDGET}KB: ${over} max ${rows[0][1].toFixed(1)}KB min ${rows[rows.length - 1][1].toFixed(1)}KB (strict, noModule counted: max ${Math.max(...rows.map((x) => x[3])).toFixed(1)}KB)`);
process.exit(over ? 1 : 0);
