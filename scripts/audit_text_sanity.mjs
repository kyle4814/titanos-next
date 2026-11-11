// C9 rendered-text sanity audit (f373). Usage: node scripts/audit_text_sanity.mjs [--out out] [--json report.json] [--md report.md] [--routes /a,/b]
// Serves the static export on 127.0.0.1 only; every route at 390 and 1280 px.
import fs from "node:fs";
import { sweep, listRoutes } from "./lib/text_sanity.mjs";
import { loadAllowlist, lintAllowlist, evaluate } from "./text_sanity_classify.mjs";
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = arg("--out", "out");
const routes = arg("--routes") ? arg("--routes").split(",") : listRoutes(root);
const al = loadAllowlist(); const lint = lintAllowlist(al);
if (lint.length) { console.error("allowlist lint:\n" + lint.join("\n")); process.exit(2); }
const sw = await sweep({ root, routes });
if (sw.skipped) { console.log("SKIP " + sw.skipped); process.exit(0); }
const ev = evaluate(sw.results, al);
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ routes: routes.length, ...ev }, null, 1));
const agg = new Map();
for (const r of ev.rows) { const k = `${r.class}|${r.rule || "-"}|${r.token}`; agg.set(k, (agg.get(k) || 0) + 1); }
const lines = [`routes ${routes.length}, renders ${sw.results.length}, errors ${ev.errors.length}`, "", "| class | rule | token | hits (390+1280) |", "|---|---|---|---|", ...[...agg].map(([k, n]) => `| ${k.split("|").join(" | ")} | ${n} |`),
  "", `CTA centre offsets above 2 px (centred heroes only): ${ev.ctaRows.length}`, ...ev.ctaRows.map((c) => `- ${c.route} @${c.width}: ${c.offset}px "${c.label}" [${c.class}]`),
  "", `DEFECT text hits: ${ev.defects.length}`, ...ev.defects.slice(0, 40).map((d) => `- ${d.route} @${d.width} ${d.token}: ${d.text}`)];
if (arg("--md")) fs.writeFileSync(arg("--md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(ev.defects.length || ev.ctaDefects.length || ev.overCap.length || ev.errors.length ? 1 : 0);
