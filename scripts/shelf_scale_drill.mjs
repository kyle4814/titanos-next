// C5 SCALE DRILL (plan ch.6 C5 kill test "1,000 shelves live, 0 ungraded"). SYNTHETIC, labelled test data only; nothing is written to the repo,
// no model call, no network, no clock (now is fixed), no deploy. Runs N generator configs through the REAL grader, graded store, publish gate,
// retraction planner, build step and catalogue consumer, and checks three legs:
//   (a) every live shelf is graded (0 ungraded visible)          (b) a planted 50 ungraded shelves are ALL refused, at the gate, the build and the consumer
//   (c) retracting 100 live shelves leaves 0 stale entries in the catalogue file, the consumer list, getShelf and search.
// runDrill(n, deps) takes injectable deps so the test can swap in broken ones: a drill that passes with a broken gate is itself broken.
// CLI: node --experimental-strip-types scripts/shelf_scale_drill.mjs [n=1000]      (one size per process, so peak RSS is clean)
//      node --experimental-strip-types scripts/shelf_scale_drill.mjs --sweep 250,500,1000,2000,5000
import { execFileSync } from "node:child_process";
import { makeSynthetic } from "./gen_synthetic_shelf_configs.mjs";
import { shelfFromConfig } from "../lib/shop/catalogue.ts";
import { gradeAll, gradeShelf } from "../lib/shop/grader.ts";
import { contentHash, promoteDrained, runFromGraded, MemoryGraderPort, assertCatalogueAllGraded, REQUIRED_CHECKS } from "../lib/shop/publish_gate.ts";
import { MemoryGradedStore } from "../lib/shop/graded_store.ts";
import { runCatalogueBuild } from "../lib/shop/catalogue_build_entry.ts";
import { createCatalogueReader } from "../lib/shop/catalogue_reader.ts";

export const PLANT = 50, RETRACT = 100, NOW = "2026-11-10T00:00:00Z";
export const realDeps = {
  // The real grader refuses synthetic:true shelves ("not-synthetic"), by design. As in measure_shelf1000.mjs the flag is flipped IN MEMORY only, so the
  // 1,000 pass the same grader a real shelf would; the SYNTHETIC label stays in the name and bluf, and nothing is written anywhere.
  generate: (n) => makeSynthetic(n).map((c) => shelfFromConfig({ ...c, synthetic: false })),
  grade: gradeAll,
  promote: promoteDrained,
  build: runCatalogueBuild, // the ONE production build entry (f317): it owns the retraction policy
  makeReader: createCatalogueReader,
};
const cid = (i) => "syn-" + String(i).padStart(5, "0");
const ms = (a, b) => +(b - a).toFixed(1);

export async function runDrill(n = 1000, deps = {}) {
  const D = { ...realDeps, ...deps };
  const bad = [], T = {};
  const must = (name, ok, x = "") => { if (!ok) bad.push(name + (x ? " " + x : "")); };
  let t = performance.now();
  const lap = (k) => { const u = performance.now(); T[k] = ms(t, u); t = u; };

  // ---- stage 0: generate + grade. The count is checked against the REQUEST, not against what the loop happened to produce.
  const shelves = D.generate(n);
  lap("generate_ms");
  must("generated count", shelves.length === n, `${shelves.length} of ${n}`);
  must("generated ids unique", new Set(shelves.map((s) => s.id)).size === shelves.length);
  must("generated all labelled SYNTHETIC in name and bluf", shelves.every((s) => /SYNTHETIC/.test(s.name) && /SYNTHETIC/.test(s.bluf)));
  const graded = D.grade(shelves);
  lap("grade_ms");
  must("graded count", graded.length === n);
  must("every graded shelf carries all 12 checks", graded.every((g) => g.grade && REQUIRED_CHECKS.every((id) => g.grade.checks.some((c) => c.id === id))));
  must("every graded shelf passes", graded.every((g) => g.grade && g.grade.pass === true));
  const store = new MemoryGradedStore(() => NOW);
  for (let i = 0; i < graded.length; i++) await store.saveGraded(cid(i), graded[i], "SYNTHETIC " + cid(i));
  lap("store_save_ms");
  must("store writes equal n (a skipped loop cannot fake this)", store.writes === n, `${store.writes}`);

  // ---- leg (a): build the live catalogue, hand the two files to the consumer, check what it exposes.
  const expectIds = graded.map((_, i) => cid(i));
  const active = expectIds.slice();
  const o1 = await D.build(store, { now: NOW, expectIds, maxAgeDays: 30, activeClusterIds: active });
  lap("build1_ms");
  must("(a) clean build is ok", o1.ok === true, o1.ok ? "" : o1.kind + ": " + String(o1.message).slice(0, 120));
  if (!o1.ok) return finish();
  const b1 = { ...o1.result, files: o1.files };
  must("(a) published count", b1.catalogue.entries.length === n, `${b1.catalogue.entries.length}`);
  must("(a) nothing held", b1.held.length === 0, `${b1.held.length}`);
  must("(a) no retraction on a clean build", b1.retractions.length === 0);
  const src1 = () => b1.files["shelf_catalogue.json"], rsrc1 = () => b1.files["retractions.json"];
  const r1 = D.makeReader(src1, [], rsrc1);
  lap("reader1_ms");
  const live = r1.listShelves();
  must("(a) consumer lists n shelves", live.length === n, `${live.length}`);
  must("(a) consumer id set equals the generated id set", new Set(live.map((s) => s.id)).size === n && setEq(live.map((s) => s.id), shelves.map((s) => s.id)));
  let ungradedVisible = 0;
  for (const s of live) {
    const g = s.grade;
    if (!g || g.pass !== true || !REQUIRED_CHECKS.every((id) => g.checks.some((c) => c.id === id && c.ok === true))) ungradedVisible++;
    else if (!gradeShelf({ ...s, grade: undefined }).pass) ungradedVisible++; // independent re-grade of what the consumer serves
  }
  lap("regrade_visible_ms");
  must("(a) 0 ungraded visible", ungradedVisible === 0, `${ungradedVisible}`);
  try { assertCatalogueAllGraded(b1.catalogue); } catch (e) { must("(a) assertCatalogueAllGraded clean", false, String(e.message).slice(0, 120)); }

  // ---- leg (b): plant 50 ungraded shelves in three kinds. Each must be refused at the gate, the build and the consumer.
  const plantedIds = [], drained = [], runs = {};
  for (let k = 0; k < PLANT; k++) {
    const id = "plant-" + String(k).padStart(3, "0");
    const raw = D.generate(1)[0];
    const sh = { ...raw, id: "generator:" + id, slug: id, href: "/shop/" + id };
    plantedIds.push(id);
    drained.push({ cluster_id: id, label: "SYNTHETIC PLANT " + id, shelf: sh });
    const kind = k % 3;
    if (kind === 1) runs[id] = { content_hash: contentHash(sh), pass: true, checks: [] };            // run with no checks
    else if (kind === 2) { const g = D.grade([sh])[0]; runs[id] = { ...runFromGraded(g), content_hash: "0".repeat(64) }; } // stale hash
    // kind 0: no run at all
  }
  must("(b) planted exactly 50", plantedIds.length === PLANT && new Set(plantedIds).size === PLANT);
  const gate = D.promote(b1.catalogue, drained, new MemoryGraderPort(runs));
  lap("plant_gate_ms");
  must("(b) gate refused all 50", gate.held.length === PLANT, `${gate.held.length}`);
  must("(b) gate published none of them", gate.published.length === 0 && gate.catalogue.entries.length === n, `${gate.published.length}/${gate.catalogue.entries.length}`);
  must("(b) refused ids are exactly the planted ids", setEq(gate.held.map((h) => h.cluster_id), plantedIds));
  const ob = await D.build(store, { now: NOW, expectIds: [...expectIds, ...plantedIds], maxAgeDays: 30, activeClusterIds: active });
  lap("plant_build_ms");
  must("(b) build refuses to run with 50 ungraded expected shelves", ob.ok === false && ob.kind === "blocked", ob.ok ? "built anyway" : ob.kind);
  must("(b) build lists all 50 offenders", ob.ok === false && setEq(ob.offenders.map((o) => o.cluster_id), plantedIds));
  const tampered = JSON.stringify({ entries: [...b1.catalogue.entries, ...drained.map((d) => ({ cluster_id: d.cluster_id, label: d.label, content_hash: contentHash(d.shelf), shelf: d.shelf }))] });
  let readErr = null;
  try { D.makeReader(() => tampered, [], () => null).listShelves(); } catch (e) { readErr = e; }
  lap("plant_consumer_ms");
  must("(b) consumer refuses a catalogue carrying 50 ungraded entries", !!readErr);
  must("(b) consumer error names all 50", !!readErr && plantedIds.every((id) => String(readErr.message).includes(id)));

  // ---- leg (c): retract 100 live shelves two ways (cluster removed; regrade failed). 0 stale entries may remain anywhere.
  const cap = Math.ceil(n * 0.2);
  must("(c) retraction batch is under the 20% cap for this n", RETRACT <= cap, `n=${n}`);
  for (const mode of ["cluster removed", "regrade failed"]) {
    const gone = Array.from({ length: RETRACT }, (_, k) => expectIds[k * Math.floor(n / RETRACT)]); // evenly spread across the catalogue
    must(`(c:${mode}) retract set is exactly ${RETRACT}`, gone.length === RETRACT && new Set(gone).size === RETRACT);
    let st = store, cfg = { now: NOW, maxAgeDays: 30, activeClusterIds: active };
    if (mode === "cluster removed") cfg = { ...cfg, activeClusterIds: active.filter((id) => !gone.includes(id)) };
    else {
      st = new MemoryGradedStore(() => NOW);
      const goneSet = new Set(gone);
      for (let i = 0; i < graded.length; i++) {
        let g = graded[i];
        if (goneSet.has(cid(i))) g = { ...g, grade: { pass: false, checks: g.grade.checks.map((c, j) => (j === 0 ? { ...c, ok: false } : c)) } };
        await st.saveGraded(cid(i), g, "SYNTHETIC " + cid(i));
      }
    }
    // base = the live catalogue READ BACK from the previous build's file, exactly as the production CLI does.
    const o2 = await D.build(st, { ...cfg, base: JSON.parse(b1.files["shelf_catalogue.json"]), expectIds });
    must(`(c:${mode}) retraction build is ok`, o2.ok === true, o2.ok ? "" : o2.kind + ": " + String(o2.message).slice(0, 120));
    if (!o2.ok) continue;
    const b2 = { ...o2.result, files: o2.files };
    must(`(c:${mode}) retractions listed = 100`, b2.retractions.length === RETRACT && b2.retractions.every((r) => r.reason === mode), `${b2.retractions.length}`);
    must(`(c:${mode}) retraction ids exact`, setEq(b2.retractions.map((r) => r.id), gone));
    must(`(c:${mode}) catalogue shrank by exactly 100`, b2.catalogue.entries.length === n - RETRACT, `${b2.catalogue.entries.length}`);
    const file = JSON.parse(b2.files["shelf_catalogue.json"]);
    const goneSlugs = new Set(gone.map((id) => graded[Number(id.slice(4))].slug));
    const stale = file.entries.filter((s) => goneSlugs.has(s.slug)).length;
    const r2 = D.makeReader(() => b2.files["shelf_catalogue.json"], [], () => b2.files["retractions.json"]);
    const list2 = r2.listShelves();
    const staleList = list2.filter((s) => goneSlugs.has(s.slug)).length;
    const staleGet = [...goneSlugs].filter((sl) => r2.getShelf(sl)).length;
    const staleSearch = [...goneSlugs].slice(0, 20).filter((sl) => r2.searchShelves(graded.find((g) => g.slug === sl).name).some((s) => s.slug === sl)).length;
    const withdrawn = gone.filter((id) => r2.getWithdrawn(id)).length;
    must(`(c:${mode}) 0 stale in the catalogue file`, stale === 0, `${stale}`);
    must(`(c:${mode}) 0 stale in the consumer list`, staleList === 0 && list2.length === n - RETRACT, `${staleList}/${list2.length}`);
    must(`(c:${mode}) 0 stale via getShelf`, staleGet === 0, `${staleGet}`);
    must(`(c:${mode}) 0 stale via search`, staleSearch === 0, `${staleSearch}`);
    must(`(c:${mode}) all 100 answer as withdrawn`, withdrawn === RETRACT, `${withdrawn}`);
    must(`(c:${mode}) consumer open (not failed closed)`, r2.closed === false);
    lap("retract_" + mode.split(" ")[0] + "_ms");
  }
  return finish();
  function finish() {
  const mem = process.resourceUsage().maxRSS / 1024;
  return {
    label: "SYNTHETIC test data, never public", n, planted: PLANT, retracted: RETRACT, ok: bad.length === 0, failures: bad, timings_ms: T,
    total_ms: +Object.values(T).reduce((a, b) => a + b, 0).toFixed(1), peak_rss_mb: +mem.toFixed(1), heap_used_mb: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
  };
  }
}
function setEq(a, b) { if (a.length !== b.length) return false; const s = new Set(a); return b.every((x) => s.has(x)) && s.size === new Set(b).size; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === "--sweep") {
    const sizes = (process.argv[3] || "500,1000,2000,5000,10000").split(",").map(Number);
    const rows = [];
    for (const n of sizes) {
      let out;
      try { out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", process.argv[1], String(n), "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
      catch (e) { out = e.stdout; } // a failing drill still prints its JSON row; a crash prints nothing and is reported as a failure
      try { rows.push(JSON.parse(out)); } catch { rows.push({ n, ok: false, total_ms: null, peak_rss_mb: null, timings_ms: {}, failures: ["child crashed: no JSON"] }); }
    }
    console.log(JSON.stringify({ load: process.env.LOADAVG ?? null, rows: rows.map((r) => ({ n: r.n, ok: r.ok, total_ms: r.total_ms, peak_rss_mb: r.peak_rss_mb, timings_ms: r.timings_ms, failures: r.failures })) }, null, 1));
    process.exit(rows.every((r) => r.ok) ? 0 : 1);
  }
  const r = await runDrill(Number(arg || 1000));
  console.log(process.argv.includes("--json") ? JSON.stringify(r) : JSON.stringify(r, null, 1));
  if (!process.argv.includes("--json")) console.log(r.ok ? "SHELFDRILL OK" : "SHELFDRILL FAILED");
  process.exit(r.ok ? 0 : 1);
}
