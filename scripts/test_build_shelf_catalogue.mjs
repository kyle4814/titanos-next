// C5 build step tests. SYNTHETIC shelves only (invented, labelled; no model call, no network). D1 is a FAKE (node:sqlite in memory, real migration SQL).
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { buildCatalogue, formatFailure, MemoryDrainedStore, D1DrainedStore, serialiseCatalogue } from "../lib/shop/build_catalogue.ts";
import { runFromGraded, assertCatalogueAllGraded } from "../lib/shop/publish_gate.ts";
import { gradeAll } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const ROOT = new URL("..", import.meta.url).pathname;
const CLI = join(ROOT, "scripts/build_shelf_catalogue.mjs");
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const batchOf = (ids, over = {}) => {
  const shelves = ids.map((i) => shelf(i, over)), graded = gradeAll(shelves);
  return { shelves: ids.map((i, k) => ({ cluster_id: i, label: i, shelf: shelves[k] })), runs: Object.fromEntries(graded.map((g, k) => [ids[k], runFromGraded(g)])) };
};
const dir = mkdtempSync(join(tmpdir(), "f305-")); if (!dir.includes("f305-")) throw new Error("no scratch");
let seq = 0;
const cli = (batch, outName, extra = []) => {
  const src = join(dir, "src" + (++seq) + ".json"); writeFileSync(src, JSON.stringify(batch));
  const out = join(dir, outName);
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, "--source", "file:" + src, "--out", out, ...extra], { encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, out, text: existsSync(out) ? readFileSync(out, "utf8") : null };
};

// B1 all graded: passes and writes.
let b = batchOf(["a", "b", "c"]);
let r = cli(b, "b1.json");
t("B1 exit 0", r.code === 0, r.stderr);
t("B1 catalogue written with 3 sorted entries", r.text && JSON.parse(r.text).entries.map((e) => e.cluster_id).join() === "a,b,c", String(r.text).slice(0, 80));
t("B1 stdout says OK", /BUILD OK: 3 shelves live/.test(r.stdout), r.stdout);
t("B1 written catalogue passes the assert", (() => { try { assertCatalogueAllGraded(JSON.parse(r.text)); return true; } catch { return false; } })());
// B2 one ungraded shelf: non-zero, id listed, nothing written.
b = batchOf(["a", "b", "ghost"]); delete b.runs.ghost;
r = cli(b, "b2.json");
t("B2 exit non-zero", r.code === 1, String(r.code));
t("B2 ghost id listed with reason", /OFFENDER ghost: ungraded/.test(r.stderr), r.stderr);
t("B2 nothing written", r.text === null);
t("B2 good shelves are not listed", !/OFFENDER a:|OFFENDER b:/.test(r.stderr));
// B3 stale hash: shelf edited after grading.
b = batchOf(["a", "b"]); b.shelves[1].shelf.name = "Synthetic b pack, edited after grading";
r = cli(b, "b3.json");
t("B3 stale shelf blocked", r.code === 1 && /OFFENDER b: stale grade/.test(r.stderr) && r.text === null, r.stderr);
// B4 every offender listed at once.
b = batchOf(["a", "x1", "x2", "x3"]); delete b.runs.x1; b.shelves[2].shelf.name = "edited"; b.shelves[3].label = "";
r = cli(b, "b4.json");
t("B4 all three offenders listed", ["x1", "x2", "x3"].every((id) => new RegExp("OFFENDER " + id + ":").test(r.stderr)) && r.code === 1, r.stderr);
t("B4 summary count", /3 shelf\(s\) held/.test(r.stderr));
// B5 a failing shelf (synthetic:true) is held and named.
b = batchOf(["a", "bad"]); b.shelves[1].shelf.synthetic = true; b.runs.bad = runFromGraded(gradeAll([b.shelves[1].shelf])[0]);
r = cli(b, "b5.json");
t("B5 failing shelf blocks the build", r.code === 1 && /OFFENDER bad: failed checks/.test(r.stderr), r.stderr);
// B6 tampered EXISTING catalogue on disk: the assert catches it even with an empty drain.
r = cli(batchOf(["a", "b"]), "b6.json");
const tampered = JSON.parse(r.text); tampered.entries[0].shelf.name = "tampered after publish"; writeFileSync(r.out, JSON.stringify(tampered));
const before = readFileSync(r.out, "utf8");
const r6 = cli({ shelves: [], runs: {} }, "b6.json");
t("B6 tampered existing entry fails the build", r6.code === 1 && /ASSERT catalogue has 1 ungraded/.test(r6.stderr) && r6.stderr.includes("a: hash mismatch"), r6.stderr);
t("B6 file left as it was", readFileSync(r.out, "utf8") === before);
// B7 idempotent rerun: byte identical, and unchanged count reported.
b = batchOf(["a", "b", "c"]);
const r7a = cli(b, "b7.json"), r7b = cli(b, "b7.json");
t("B7 rerun exit 0 and byte-identical", r7a.code === 0 && r7b.code === 0 && r7a.text === r7b.text && r7a.text.length > 100);
t("B7 rerun reports 0 new, 3 unchanged", /0 new, 3 unchanged/.test(r7b.stdout), r7b.stdout);
// B8 deterministic regardless of input order and of key order.
const rev = { shelves: [...b.shelves].reverse().map((s) => ({ label: s.label, shelf: Object.fromEntries(Object.entries(s.shelf).reverse()), cluster_id: s.cluster_id })), runs: b.runs };
const r8 = cli(rev, "b8.json");
t("B8 shuffled input gives the same bytes", r8.code === 0 && r8.text === r7a.text);
// B9 memory default writes an empty, valid catalogue.
const out9 = join(dir, "b9.json");
const r9 = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, "--out", out9], { encoding: "utf8" });
t("B9 default memory source: exit 0, empty catalogue", r9.status === 0 && JSON.parse(readFileSync(out9, "utf8")).entries.length === 0, r9.stderr);
// B10 bad source / unreadable input exit 1.
const r10 = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, "--source", "file:" + join(dir, "nope.json"), "--out", join(dir, "b10.json")], { encoding: "utf8" });
t("B10 unreadable source exits 1 and writes nothing", r10.status === 1 && !existsSync(join(dir, "b10.json")));
// B11 regrade of an edited shelf replaces the live entry (new run + new hash).
const r11a = cli(batchOf(["a"]), "b11.json");
const edited = batchOf(["a"], { name: "Synthetic a pack, v2" });
const r11b = cli(edited, "b11.json");
t("B11 edited and re-graded shelf replaces the entry", r11b.code === 0 && /1 new, 0 unchanged/.test(r11b.stdout) && JSON.parse(r11b.text).entries[0].shelf.name.endsWith("v2"), r11b.stdout + r11b.stderr);

// L1 library: formatFailure lists every id.
const lb = batchOf(["p", "q"]); delete lb.runs.p; delete lb.runs.q;
const lres = await buildCatalogue(new MemoryDrainedStore(lb));
t("L1 library fails and lists both", !lres.ok && formatFailure(lres).includes("OFFENDER p:") && formatFailure(lres).includes("OFFENDER q:"));
t("L1b store input not mutated by build", JSON.stringify(lb) === JSON.stringify((await new MemoryDrainedStore(lb).load())));

// D1 round trip over a fake D1.
const MIG = new URL("../portal-api/migrations/", import.meta.url);
const migFile = readdirSync(MIG).find((f) => /^\d{4}_generator_shelves\.sql$/.test(f));
function fakeD1() {
  const db = new DatabaseSync(":memory:"); db.exec(readFileSync(new URL(migFile, MIG), "utf8")); const log = [];
  return { db, log, prepare(sql) { let a = []; const st = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return st; },
    async all() { log.push(sql); return { results: db.prepare(sql).all(...a) }; },
    async run() { log.push(sql); db.prepare(sql).run(...a); return {}; } }; return st; } };
}
t("D0 migration file exists", !!migFile);
const d1 = fakeD1(); const store = new D1DrainedStore(d1);
const gb = batchOf(["m", "n", "o"]);
const saved = await store.saveGraded(gb.shelves.map((s) => ({ cluster_id: s.cluster_id, label: s.label, graded: gradeAll([s.shelf])[0] })));
t("D1 saved 3 rows", saved === 3 && d1.db.prepare("SELECT COUNT(*) c FROM generator_shelves").get().c === 3);
const loaded = await store.load();
t("D2 round trip: 3 shelves and 3 runs back", loaded.shelves.length === 3 && Object.keys(loaded.runs).length === 3);
const dres = await buildCatalogue(store);
t("D3 D1 store builds a clean catalogue", dres.ok && dres.catalogue.entries.length === 3, JSON.stringify(dres.offenders ?? ""));
t("D3b same bytes as the memory store", dres.ok && dres.text === (await buildCatalogue(new MemoryDrainedStore(gb))).text);
await store.saveGraded(gb.shelves.slice(0, 1).map((s) => ({ cluster_id: s.cluster_id, label: s.label, graded: gradeAll([s.shelf])[0] })));
t("D4 UPSERT: second save leaves one row per cluster", d1.db.prepare("SELECT COUNT(*) c FROM generator_shelves").get().c === 3);
{ const m2 = shelf("m", { name: "Synthetic m pack, re-graded v2" });
  await store.saveGraded([{ cluster_id: "m", label: "m", graded: gradeAll([m2])[0] }]);
  t("D4b UPSERT updates the existing row in place", JSON.parse(d1.db.prepare("SELECT shelf_json FROM generator_shelves WHERE cluster_id='m'").get().shelf_json).name.endsWith("v2") && d1.db.prepare("SELECT COUNT(*) c FROM generator_shelves").get().c === 3);
  await store.saveGraded([{ cluster_id: "m", label: "m", graded: gradeAll([shelf("m")])[0] }]); } // restore m for the checks below
d1.db.prepare("UPDATE generator_shelves SET run_json = NULL WHERE cluster_id = 'n'").run();
const d5 = await buildCatalogue(store);
t("D5 row with no run is ungraded and fails the build", !d5.ok && d5.offenders.some((o) => o.cluster_id === "n" && /ungraded/.test(o.reason)));
d1.db.prepare("UPDATE generator_shelves SET run_json = '{not json' WHERE cluster_id = 'n'").run();
t("D6 corrupt run_json reads as ungraded, no crash", !(await buildCatalogue(store)).ok);
d1.db.prepare("UPDATE generator_shelves SET run_json = ? WHERE cluster_id = 'n'").run(JSON.stringify(loaded.runs.n));
d1.db.prepare("UPDATE generator_shelves SET shelf_json = REPLACE(shelf_json, 'Synthetic o pack', 'Edited o pack') WHERE cluster_id = 'o'").run();
const d7 = await buildCatalogue(store);
t("D7 shelf edited in D1 after grading is stale", !d7.ok && d7.offenders.some((o) => o.cluster_id === "o" && /stale/.test(o.reason)));

// S 1,000-shelf synthetic run: 0 ungraded published.
const ids = Array.from({ length: 1000 }, (_, i) => "s" + String(i).padStart(4, "0"));
const big = batchOf(ids);
const t0 = Date.now();
const bigRes = await buildCatalogue(new MemoryDrainedStore(big));
t("S1 1,000 shelves all graded: build ok, 1000 live", bigRes.ok && bigRes.catalogue.entries.length === 1000);
t("S1b every live shelf re-passes the assert", (() => { try { assertCatalogueAllGraded(bigRes.catalogue); return true; } catch { return false; } })());
t("S1c 1,000-shelf run is fast and deterministic", Date.now() - t0 < 20000 && bigRes.ok && bigRes.text === (await buildCatalogue(new MemoryDrainedStore({ shelves: [...big.shelves].reverse(), runs: big.runs }))).text);
const poisoned = batchOf(ids); for (const i of [3, 77, 500, 999]) delete poisoned.runs[ids[i]];
const pres = await buildCatalogue(new MemoryDrainedStore(poisoned));
t("S2 1,000 shelves with 4 ungraded: build fails, exactly those 4 listed, 0 published", !pres.ok && pres.offenders.map((o) => o.cluster_id).sort().join() === [3, 77, 500, 999].map((i) => ids[i]).join());
t("S3 serialise is sorted", (() => { const c = bigRes.catalogue; const s = serialiseCatalogue({ entries: [...c.entries].reverse() }); return s === bigRes.text; })());

rmSync(dir, { recursive: true, force: true });
console.log(`build shelf catalogue: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
