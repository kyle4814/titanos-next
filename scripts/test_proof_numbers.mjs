// W4 gate: every number the charts, loop orbit and proof wall display must be in lib/site-data/proof.json, and that file must be
// the generated one (no hand edits). Layers:
//   1. proof.json is current against a fresh generation from the baseline snapshot + efficiency data
//   2. component source: no digit-bearing string literal or JSX text outside layout values (so no hand-typed figure)
//   3. data integrity: labels valid, every star has source + date + method, loop receipts resolve, no internal paths or tool names
//   4. with --built <dir>: the rendered HTML of each W4 region contains only numbers found in the data file (run by postbuild)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const R = (p) => readFileSync(new URL(p, root), "utf8");
const data = JSON.parse(R("lib/site-data/proof.json"));

// 1
const g = spawnSync("node", ["scripts/gen_proof_data.mjs", "--check"], { cwd: root.pathname, encoding: "utf8" });
ok(g.status === 0, "proof.json equals a fresh generation from the baseline snapshot (no hand-typed numbers)");

// 3
const LABELS = Object.keys(data.labels);
ok(LABELS.join() === "MEASURED,REPRODUCED,MODELLED,ESTIMATE,FORECAST,EXAMPLE,UNKNOWN", "the seven claim labels are defined, in ladder order");
ok(data.stars.every((s) => LABELS.includes(s.label) && s.source && s.date && s.method && s.display && s.caption), "every star has label, source, date, method, display, caption");
ok(data.charts.every((c) => LABELS.includes(c.label) && c.source && c.date && c.method), "every chart has label, source, date, method");
ok(data.stars.some((s) => s.label === "UNKNOWN") && data.stars.some((s) => s.label === "MODELLED"), "the wall shows an UNKNOWN and a MODELLED star, not only wins");
const ids = new Set(data.stars.map((s) => s.id));
ok(ids.size === data.stars.length, "star ids are unique");
ok(data.loop.length >= 7 && data.loop.every((l) => ids.has(l.receipt)), "every loop node's receipt resolves to a star");
ok(!/\/home\/|~\/|\.py\b|\.jsonl\b|\.sh\b|bin\/|klinge|state\/|SOUL|LEXICON|CORE\.md/i.test(JSON.stringify(data.stars) + JSON.stringify(data.charts) + JSON.stringify(data.fleetCost)), "no internal path, tool name or doctrine term in star/chart data");
ok(data.charts.every((c) => c.beforePct <= 100 && c.afterPct <= 100 && Math.max(c.beforePct, c.afterPct) === 100), "bar widths are shares of the larger value");
ok(data.charts.some((c) => !c.improved) || data.fleetCost.after > data.fleetCost.before, "the page keeps a figure that went the wrong way (the fleet-wide cost per job)");

// 2: digit-bearing literals in the components
const FILES = ["components/charts/CostCurve.tsx", "components/charts/LoopOrbit.tsx", "components/charts/ProofWall.tsx", "components/charts/InView.tsx"];
const layoutOnly = /^[\d\s.,%+\-]+(px|s|ms|em|rem|vh|vw|%)?$|^(w4-|#|rgb|--|var\()|viewBox|^\d+(\.\d+)?$/;
let stray = [];
for (const f of FILES) {
  const src = R(f).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g)) {
    const t = m[2];
    if (/\d/.test(t) && !layoutOnly.test(t.trim()) && !/^(import|\.\/|@\/)/.test(t) && !/\$\{[^}]*\}/.test(t.replace(/\$\{[^}]*\}/g, ""))) stray.push(`${f}: "${t.slice(0, 50)}"`);
  }
  for (const m of src.matchAll(/>([^<>{}]*\d[^<>{}]*)</g)) stray.push(`${f}: text >${m[1].trim().slice(0, 50)}<`);
}
ok(stray.length === 0, "components hold no hand-typed figures" + (stray.length ? " :: " + stray.slice(0, 5).join(" | ") : ""));
ok(!/[–—]/.test(FILES.map(R).join("")) && !/[–—]/.test(JSON.stringify(data.stars)), "no em or en dashes in W4 components or star copy");

// 4
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const dir = process.argv[bi + 1];
  const pool = JSON.stringify(data).replace(/\\"/g, '"');
  const pages = [["index.html", ["cost-curve", "loop", "proof-wall"]], ["proof.html", ["proof-wall"]], ["learning-loop.html", ["loop"]]];
  for (const [file, regions] of pages) {
    const p = `${dir}/${file}`;
    if (!existsSync(p)) { ok(false, `${file} exists in build`); continue; }
    const html = readFileSync(p, "utf8");
    for (const id of regions) {
      const start = html.indexOf(`id="${id}"`);
      if (start < 0) { ok(false, `${file} has region #${id}`); continue; }
      // region runs from its id to its data-w4-end marker; strip tags, scripts and styles
      const rest = html.slice(html.indexOf(">", start) + 1, start + 120000).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
      const end = rest.indexOf(`data-w4-end="${id}"`);
      if (end < 0) { ok(false, `${file} #${id} has its end marker`); continue; }
      const text = rest.slice(0, end).replace(/<[^>]+>/g, " ");
      const nums = [...new Set(text.match(/\d[\d,]*(?:\.\d+)?/g) || [])];
      const inPool = (n) => new RegExp("(?<![\\d.,])" + n.replace(/[.,]/g, "\\$&") + "(?![\\d]|[.,]\\d)").test(pool);
      const missing = nums.filter((n) => !inPool(n));
      ok(nums.length > 0 && missing.length === 0, `${file} #${id}: ${nums.length} displayed numbers, all in proof.json` + (missing.length ? " :: missing " + missing.slice(0, 8).join(",") : ""));
    }
  }
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
