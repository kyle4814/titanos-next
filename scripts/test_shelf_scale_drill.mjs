// Tests for the C5 scale drill. SYNTHETIC labelled shelves, in memory. The drill must PASS on the real code at 1,000 and FAIL on every broken dep.
import { runDrill, realDeps, PLANT, RETRACT } from "./shelf_scale_drill.mjs";
import { promoteDrained, assertCatalogueAllGraded } from "../lib/shop/publish_gate.ts";
import { createCatalogueReader } from "../lib/shop/catalogue_reader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };

const real = await runDrill(1000);
t("S1 real code passes at 1,000", real.ok === true, real.failures.join(" | "));
t("S2 constants: 50 planted, 100 retracted", PLANT === 50 && RETRACT === 100 && real.planted === 50 && real.retracted === 100);
t("S3 every phase timed", ["generate_ms", "grade_ms", "build1_ms", "plant_gate_ms", "plant_build_ms", "plant_consumer_ms", "retract_cluster_ms", "retract_regrade_ms"].every((k) => typeof real.timings_ms[k] === "number"));
t("S4 peak memory recorded", real.peak_rss_mb > 0);

// The drill must FAIL when a piece is broken (a drill that passes with a broken gate proves nothing).
const mutants = {
  "M1 skipped loop (half the shelves generated)": { generate: (n) => realDeps.generate(Math.floor(n / 2)) },
  "M2 gate publishes ungraded shelves": { promote: (cat, drained) => ({ published: [], held: [], already: [], catalogue: cat }) },
  "M3 consumer skips the graded check": { makeReader: (src, fb, rs) => ({ listShelves: () => JSON.parse(src()).entries.map((e) => e.shelf), getShelf: () => undefined, searchShelves: () => [], getWithdrawn: () => undefined, closed: false }) },
  "M4 build ignores expectIds": { build: (s, cfg) => realDeps.build(s, { ...cfg, expectIds: undefined }) },
  "M5 build drops the retraction policy": { build: (s, cfg) => realDeps.build(s, { ...cfg, activeClusterIds: undefined, maxAgeDays: 1e9 }) },
  "M6 consumer ignores the retractions sidecar": { makeReader: (src, fb) => createCatalogueReader(src, fb, () => null) },
  "M7 grader marks nothing as passing": { grade: (sh) => realDeps.grade(sh).map((g) => ({ ...g, grade: { pass: false, checks: g.grade.checks } })) },
  "M8 grader emits no checks": { grade: (sh) => realDeps.grade(sh).map((g) => ({ ...g, grade: { pass: true, checks: [] } })) },
  "M9 generator repeats one id": { generate: (n) => { const one = realDeps.generate(1)[0]; return Array.from({ length: n }, () => ({ ...one })); } },
  "M10 gate holds but still lists the planted": { promote: (cat, drained, port) => { const r = promoteDrained(cat, drained, port); return { ...r, published: drained.map((d) => ({ cluster_id: d.cluster_id })) }; } },
};
for (const [name, deps] of Object.entries(mutants)) {
  let r;
  try { r = await runDrill(1000, deps); } catch (e) { r = { ok: false, failures: ["threw " + e.message.slice(0, 60)] }; }
  t(name + " is caught", r.ok === false, "drill still passed");
}

// A planted ungraded shelf that slips through the real consumer would be an ungraded visible shelf: prove the independent check sees it.
const slip = JSON.parse((await realDeps.build(await (async () => { const { MemoryGradedStore } = await import("../lib/shop/graded_store.ts"); const s = new MemoryGradedStore(() => "2026-11-10T00:00:00Z"); const g = realDeps.grade(realDeps.generate(3)); for (let i = 0; i < 3; i++) await s.saveGraded("c" + i, g[i], "L" + i); return s; })(), { now: "2026-11-10T00:00:00Z", maxAgeDays: 30 })).files["shelf_catalogue.json"]);
const doped = { entries: [...slip.entries, { ...slip.entries[0], cluster_id: "slipped", shelf: (({ grade, ...r }) => r)(slip.entries[0].shelf) }] };
let threw = false; try { assertCatalogueAllGraded(doped); } catch { threw = true; }
t("S5 the real assert refuses a slipped ungraded entry", threw);
let rthrew = false; try { createCatalogueReader(() => JSON.stringify(doped), []); } catch { rthrew = true; }
t("S6 the real consumer refuses a slipped ungraded entry", rthrew);

// 5,000 leg: the count cannot be faked (store.writes === n is inside the drill).
const big = await runDrill(5000);
t("S7 real code passes at 5,000", big.ok === true, big.failures.join(" | "));
t("S8 5,000 cost is not wildly superlinear (under 12x the 1,000 total; load-tolerant bound)", big.total_ms < real.total_ms * 12, `${big.total_ms} vs ${real.total_ms}`);
console.log(`shelf scale drill: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
