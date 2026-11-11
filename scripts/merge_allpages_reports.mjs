// f414_c10: merge --shard reports of an --all run into ONE json (pages_total / pages_swept / per-page defects).
// Usage: node scripts/merge_allpages_reports.mjs [--manifest scripts/export_pages.json] --out out --probe keyboard_focus --into merged.json shard0.json shard1.json ...
// The verdict is recomputed from a fresh walk of --out, never trusted from the shards: a missing shard shows up as NOT SWEPT pages.
// Exit 0 full coverage, 4 coverage gap. Defects do not change this exit code (they are listed, not hidden).
import fs from "node:fs";
import { coverage, writeReport, manifestRoutes, ManifestError, DEFAULT_ALLOWLIST, DEFAULT_MANIFEST } from "./lib/allpages.mjs";
const a = process.argv.slice(2);
const arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const files = []; for (let i = 0; i < a.length; i++) { if (a[i].startsWith("--")) { i++; continue; } files.push(a[i]); }
const out = arg("--out", "out"), probe = arg("--probe", "merged"), into = arg("--into", "merged.json"), allow = arg("--allowlist", DEFAULT_ALLOWLIST), manifest = arg("--manifest", DEFAULT_MANIFEST);
// f420_c10: the expected page list is the committed export manifest (routes_count semantics), fail closed (exit 4) like the probes.
let routes;
try { ({ routes } = manifestRoutes(out, manifest)); } catch (e) { if (!(e instanceof ManifestError)) throw e; console.error(`MERGE MANIFEST ${e.kind}: ${e.message}`); console.log(`ALLPAGES COVERAGE FAILED ${probe} (export manifest ${e.kind})`); process.exit(e.kind === "OUTDIR" ? 2 : 4); }
const byRoute = new Map();
for (const f of files) for (const p of JSON.parse(fs.readFileSync(f, "utf8")).pages) {
  const prev = byRoute.get(p.route);
  if (!prev || (!prev.swept && p.swept)) byRoute.set(p.route, p);
}
const perPage = [...byRoute.values()].sort((x, y) => x.route.localeCompare(y.route));
const cov = coverage({ outDir: out, swept: perPage.filter((p) => p.swept).map((p) => p.route), allowlistFile: allow, routes });
const doc = writeReport(into, { probe, cov, perPage });
console.log(`ALLPAGES ${probe} merged ${files.length} shards: pages_enumerated=${doc.pages_enumerated} allowlisted=${doc.pages_allowlisted} pages_total=${doc.pages_total} pages_swept=${doc.pages_swept} with_defects=${doc.pages_with_defects}`);
if (!cov.ok) { for (const p of cov.not_swept.slice(0, 20)) console.log("   NOT SWEPT " + p); for (const p of cov.problems) console.log("   PROBLEM " + p); console.log(`ALLPAGES COVERAGE FAILED ${probe} swept ${cov.pages_swept} of ${cov.pages_total}`); process.exit(4); }
