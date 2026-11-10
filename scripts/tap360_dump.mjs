// Throwaway-style helper (kept): dump 360px non-inline tap hits grouped by selector. Usage: node scripts/tap360_dump.mjs [--out out] [--json f.json]
import fs from "node:fs";
import { sweep, listRoutes } from "./lib/viewport_sweep.mjs";
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = arg("--out", "out");
const sw = await sweep({ root, routes: listRoutes(root), widths: [360] });
const g = new Map(); let total = 0;
for (const r of sw.results) for (const t of r.taps || []) { if (t.inline) continue; total++; const k = `${t.inFooter ? "footer " : t.inNav ? "nav " : ""}${t.sel} ${t.w >= 44 ? "wide" : "narrow"} h${t.h}`; const a = g.get(k) || { n: 0, routes: new Set(), ex: t.text }; a.n++; a.routes.add(r.route); g.set(k, a); }
console.log("TOTAL non-inline 360 hits", total);
for (const [k, a] of [...g].sort((x, y) => y[1].n - x[1].n).slice(0, 70)) console.log(String(a.n).padStart(4), k, `routes=${a.routes.size}`, JSON.stringify(a.ex.slice(0, 28)));
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify(sw.results));
