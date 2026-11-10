// C10 viewport overflow sweep (f385). Usage: node scripts/viewport_overflow_sweep.mjs [--out out] [--json r.json] [--md r.md] [--routes /a,/b] [--raw raw.json]
// Serves the static export on 127.0.0.1 only; every route at 360, 768, 1024 and 1440 px. Exit 1 on an unclassified defect, a cap breach or a render error.
import fs from "node:fs";
import { sweep, listRoutes, WIDTHS } from "./lib/viewport_sweep.mjs";
import { loadAllowlist, lintAllowlist, evaluate, capsRise, allowlistAt } from "./viewport_overflow_classify.mjs";
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = arg("--out", "out");
const routes = arg("--routes") ? arg("--routes").split(",") : listRoutes(root);
const al = loadAllowlist(); const lint = lintAllowlist(al);
if (lint.length) { console.error("allowlist lint:\n" + lint.join("\n")); process.exit(2); }
const prev = allowlistAt("HEAD"); const rise = prev ? capsRise(prev, al) : [];
if (rise.length) { console.error("caps may fall, never rise:\n" + rise.join("\n")); process.exit(2); }
const sw = await sweep({ root, routes });
if (sw.skipped) { console.log("SKIP " + sw.skipped); process.exit(0); }
if (arg("--raw")) fs.writeFileSync(arg("--raw"), JSON.stringify(sw));
const ev = evaluate(sw.results, al);
const fam = (r) => "/" + (r.split("/")[1] || "");
const table = new Map();
for (const row of ev.rows) { const k = `${fam(row.route)}|${row.width}`; const a = table.get(k) || { defect: 0, followup: 0, intended: 0 }; a[row.class]++; table.set(k, a); }
const fams = [...new Set(routes.map(fam))].sort();
const lines = [`routes ${routes.length}, renders ${sw.results.length}, errors ${ev.errors.length}, unclassified defects ${ev.defects.length}`, "",
  `| route family | routes | ${WIDTHS.map((w) => w + " px (defect/followup/intended)").join(" | ")} |`, `|---|---|${WIDTHS.map(() => "---").join("|")}|`,
  ...fams.map((f) => `| ${f} | ${routes.filter((r) => fam(r) === f).length} | ${WIDTHS.map((w) => { const a = table.get(`${f}|${w}`) || { defect: 0, followup: 0, intended: 0 }; return `${a.defect}/${a.followup}/${a.intended}`; }).join(" | ")} |`),
  "", "follow-up counts vs caps: " + JSON.stringify(ev.followupCounts) + (ev.overCap.length ? "\nOVER CAP: " + ev.overCap.join("; ") : ""),
  "", `DEFECTS: ${ev.defects.length}`, ...ev.defects.slice(0, 60).map((d) => `- ${d.route} @${d.width} [${d.metric}] ${d.detail}`)];
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ routes: routes.length, ...ev }, null, 1));
if (arg("--md")) fs.writeFileSync(arg("--md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(ev.defects.length || ev.overCap.length || ev.errors.length ? 1 : 0);
