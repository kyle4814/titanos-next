// C5 INDEPENDENT VERIFIER (f398). SYNTHETIC data only; writes nothing, no network, no model call, no clock.
// The primary C5 proof (test_graded_store.mjs, test_shelves_fetch_budget.mjs) tests the store and the fetch budget. The f386 drill
// (shelf_scale_drill.mjs) reports "0 ungraded visible" from its OWN consumer + REQUIRED_CHECKS. This script does not trust either:
//   1. builds n synthetic shelves through the production build entry and takes the RAW shelf_catalogue.json text;
//   2. recomputes "ungraded" from that text with its own parser and its OWN literal list of the 12 check ids
//      (no lib reader, no assertCatalogueAllGraded, no REQUIRED_CHECKS import for the verdict);
//   3. cross-checks its literal list against the lib's REQUIRED_CHECKS (drift = disagreement);
//   4. runs the f386 drill as a child process, parses its JSON, and fails on ANY disagreement with the recompute.
// exit 0 agree and 0 ungraded; 1 disagreement or ungraded found; 2 unusable input.
// CLI: node --experimental-strip-types --no-warnings scripts/c5_ungraded_verify.mjs [n=1000] [--catalogue-file F] [--primary-json F]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const OWN_CHECKS = ["types", "no-unknown-fields", "price-type", "slug", "name", "bluf", "source", "copy", "not-synthetic", "price-honest", "availability-true", "content"];
const HEX64 = /^[0-9a-f]{64}$/;

// Pure: raw catalogue text -> counts. An entry is ungraded unless it carries grade.pass === true AND every one of the 12 checks, each ok === true.
export function recompute(text, expectN, ownChecks = OWN_CHECKS) {
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error("unusable: catalogue is not JSON: " + e.message); }
  if (!j || !Array.isArray(j.entries)) throw new Error("unusable: no entries array");
  const ids = new Map(), ungraded = [];
  for (const e of j.entries) {
    const id = e && e.cluster_id;
    ids.set(id, (ids.get(id) || 0) + 1);
    const g = e && e.shelf && e.shelf.grade;
    const checks = g && Array.isArray(g.checks) ? g.checks : null;
    let why = null;
    if (!g) why = "no grade";
    else if (g.pass !== true) why = "pass not true";
    else if (!checks || checks.length === 0) why = "no checks";
    else {
      const missing = ownChecks.filter((c) => !checks.some((k) => k && k.id === c && k.ok === true));
      if (missing.length) why = "missing/failed " + missing.join(",");
    }
    if (!why && !HEX64.test(String(e.content_hash || ""))) why = "bad content_hash";
    if (!why && !/SYNTHETIC/.test(String((e.shelf && e.shelf.name) || "") + String((e.shelf && e.shelf.bluf) || ""))) why = "not labelled SYNTHETIC";
    if (why) ungraded.push({ cluster_id: id, why });
  }
  const dup = [...ids].filter(([, c]) => c > 1).map(([k]) => k);
  return { entries: j.entries.length, unique_ids: ids.size, duplicates: dup, ungraded: ungraded.length, ungraded_detail: ungraded.slice(0, 5), count_ok: expectN == null ? true : j.entries.length === expectN };
}

// Pure: decide agreement between the recompute and the primary drill's parsed JSON.
export function compare(rc, primary, n, libChecks) {
  const bad = [];
  if (JSON.stringify([...libChecks]) !== JSON.stringify(OWN_CHECKS)) bad.push("check-id list drift: lib " + JSON.stringify(libChecks));
  if (!rc.count_ok) bad.push(`entries ${rc.entries} != requested ${n}`);
  if (rc.unique_ids !== rc.entries || rc.duplicates.length) bad.push("duplicate cluster ids " + rc.duplicates.slice(0, 3));
  if (rc.ungraded !== 0) bad.push(`recompute found ${rc.ungraded} ungraded: ` + JSON.stringify(rc.ungraded_detail));
  if (!primary || primary.n !== n) bad.push("primary drill n " + (primary && primary.n) + " != " + n);
  else if (primary.ok !== true || (primary.failures || []).length) bad.push("primary drill not ok: " + JSON.stringify((primary.failures || []).slice(0, 3)));
  return bad;
}

export async function buildRawCatalogue(n) {
  const { makeSynthetic } = await import("./gen_synthetic_shelf_configs.mjs");
  const { shelfFromConfig } = await import("../lib/shop/catalogue.ts");
  const { gradeAll } = await import("../lib/shop/grader.ts");
  const { MemoryGradedStore } = await import("../lib/shop/graded_store.ts");
  const { runCatalogueBuild } = await import("../lib/shop/catalogue_build_entry.ts");
  const NOW = "2026-11-10T00:00:00Z";
  const graded = gradeAll(makeSynthetic(n).map((c) => shelfFromConfig({ ...c, synthetic: false }))); // flag flipped in memory only, as the drill does
  const store = new MemoryGradedStore(() => NOW);
  const ids = graded.map((_, i) => "v-" + String(i).padStart(5, "0"));
  for (let i = 0; i < graded.length; i++) await store.saveGraded(ids[i], graded[i], "SYNTHETIC " + ids[i]);
  const o = await runCatalogueBuild(store, { now: NOW, expectIds: ids, maxAgeDays: 30, activeClusterIds: ids });
  if (!o.ok) throw new Error("unusable: production build refused a clean synthetic set: " + o.kind);
  return o.files["shelf_catalogue.json"];
}

function runPrimary(n) {
  const drill = join(dirname(fileURLToPath(import.meta.url)), "shelf_scale_drill.mjs");
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", drill, String(n), "--json"], { encoding: "utf8", maxBuffer: 1 << 26 });
  return JSON.parse(out.trim().split("\n").pop());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const n = Number(args.find((a) => /^\d+$/.test(a)) || 1000);
  try {
    const text = opt("--catalogue-file") ? readFileSync(opt("--catalogue-file"), "utf8") : await buildRawCatalogue(n);
    const primary = opt("--primary-json") ? JSON.parse(readFileSync(opt("--primary-json"), "utf8")) : runPrimary(n);
    const { REQUIRED_CHECKS } = await import("../lib/shop/publish_gate.ts");
    const rc = recompute(text, n);
    const bad = compare(rc, primary, n, REQUIRED_CHECKS);
    console.log(JSON.stringify({ label: "SYNTHETIC test data, never public", n, recompute: rc, primary: { n: primary.n, ok: primary.ok, failures: primary.failures }, disagreements: bad }));
    console.log(bad.length ? "C5VERIFY DISAGREE " + bad.join("; ") : `C5VERIFY AGREE n=${n} entries=${rc.entries} ungraded=0 (recomputed from raw catalogue text; primary drill ok)`);
    process.exit(bad.length ? 1 : 0);
  } catch (e) {
    console.error("C5VERIFY UNUSABLE " + e.message);
    process.exit(2);
  }
}
