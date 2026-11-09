// f317: the build entry point ALWAYS retracts. SYNTHETIC labelled shelves, in-memory store, temp dir for the CLI. No model, no network, no D1, no deploy.
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runCatalogueBuild, exitCodeFor, DEFAULT_MAX_AGE_DAYS, StaticGradedStore } from "../lib/shop/catalogue_build_entry.ts";
import { MemoryGradedStore } from "../lib/shop/graded_store.ts";
import { assertCatalogueAllGraded } from "../lib/shop/publish_gate.ts";
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
const dir = mkdtempSync(join(tmpdir(), "f317-")); if (!dir.includes("f317-")) throw new Error("no scratch");
const ids = Array.from({ length: 16 }, (_, i) => "c" + String(i).padStart(2, "0"));
const FAILER = "c03", STALE = "c07", LOST = "c11";
const D_OLD = "2026-06-01T00:00:00Z", D_NEW = "2026-11-01T00:00:00Z", NOW1 = "2026-11-02T00:00:00Z", NOW2 = "2026-11-09T00:00:00Z";
// A store whose clock we steer per save, so each record carries the graded_at we want.
let clock = D_NEW;
const store = new MemoryGradedStore(() => clock);
const save = async (id, over = {}, at = D_NEW) => { clock = at; const g = gradeAll([shelf(id, over)])[0]; await store.saveGraded(id, g, id); };
for (const id of ids) await save(id, {}, id === STALE ? D_OLD : D_NEW);

// E1 first build: everything passes, the stale one is within a generous 400-day limit, so nothing is retracted; the sidecar is still written.
const o1 = await runCatalogueBuild(store, { now: NOW1, maxAgeDays: 400 });
t("E1 first build ok, 16 live", o1.ok && o1.result.catalogue.entries.length === 16, JSON.stringify(o1).slice(0, 200));
const side1 = JSON.parse(o1.files["retractions.json"]);
t("E1 retractions.json present with count 0 and the 400-day policy", side1.count === 0 && side1.policy.maxAgeDays === 400 && Array.isArray(side1.retractions));
const live1 = JSON.parse(o1.files["shelf_catalogue.json"]);
t("E1 catalogue file passes the assert and keeps full entries", (() => { try { assertCatalogueAllGraded(live1); return live1.entries.length === 16 && !!live1.entries[0].content_hash; } catch { return false; } })());

// Now: c03 is regraded and FAILS, c07 is stale (graded 161 days ago), c11 is dropped from the active cluster list.
await save(FAILER, { synthetic: true }, D_NEW);
const active = ids.filter((i) => i !== LOST);
const o2 = await runCatalogueBuild(store, { now: NOW2, base: live1, activeClusterIds: active });
t("E2 second build ok", o2.ok, JSON.stringify(o2).slice(0, 300));
const ids2 = o2.ok ? o2.result.catalogue.entries.map((e) => e.cluster_id) : [];
t("E2 catalogue is 13 entries without the three", ids2.length === 13 && ![FAILER, STALE, LOST].some((i) => ids2.includes(i)), ids2.join());
const side2 = o2.ok ? JSON.parse(o2.files["retractions.json"]) : { retractions: [] };
const why = Object.fromEntries(side2.retractions.map((r) => [r.id, r.reason]));
t("E2 retractions.json names each id with the right reason", side2.count === 3 && why[FAILER] === "regrade failed" && why[STALE] === "grade too old" && why[LOST] === "cluster removed", JSON.stringify(side2));
t("E2 every retraction carries a detail", side2.retractions.every((r) => typeof r.detail === "string" && r.detail.length > 3));
t("E2 default age limit is the named constant (90) and is in the sidecar policy", DEFAULT_MAX_AGE_DAYS === 90 && side2.policy.maxAgeDays === DEFAULT_MAX_AGE_DAYS);
t("E2 untouched entries are all still live", ids.filter((i) => ![FAILER, STALE, LOST].includes(i)).every((i) => ids2.includes(i)));
t("E2 exit code 0", exitCodeFor(o2) === 0);

// E3 omitting the policy is impossible: the config type has no retract field, a smuggled one is ignored, and retraction still happens.
const o3 = await runCatalogueBuild(store, { now: NOW2, base: live1, activeClusterIds: active, retract: undefined });
t("E3 smuggled retract:undefined is ignored, retraction still applied", o3.ok && o3.result.retractions.length === 3 && o3.files["retractions.json"].includes("grade too old"));
const o3b = await runCatalogueBuild(store, { now: NOW2, base: live1, activeClusterIds: active, retract: false });
t("E3 smuggled retract:false is ignored too", o3b.ok && o3b.result.retractions.length === 3);
const src = readFileSync(join(ROOT, "lib/shop/catalogue_build_entry.ts"), "utf8");
const cliSrc = readFileSync(CLI, "utf8");
t("E3 entry always builds a retract policy with an explicit maxAgeDays", /retract:\s*\{\s*now: cfg\.now, maxAgeDays,/.test(src) && !/retract\?:/.test(src.split("export async function runCatalogueBuild")[0].split("export type CatalogueBuildConfig")[1].split("};")[0]));
t("E3 the CLI never calls the store builders directly (only runCatalogueBuild)", !/buildCatalogueFromStore\(|[^a-zA-Z]buildCatalogue\(/.test(cliSrc) && /runCatalogueBuild\(/.test(cliSrc));
let threw = 0;
for (const bad of [0, -5, NaN, Infinity, "90"]) { try { await runCatalogueBuild(store, { now: NOW2, maxAgeDays: bad }); } catch { threw++; } }
t("E3 maxAgeDays 0, negative, NaN, Infinity or a string throws (ageing cannot be switched off)", threw === 5, String(threw));
let threwNow = 0;
for (const bad of [undefined, "", "not a date"]) { try { await runCatalogueBuild(store, { now: bad }); } catch { threwNow++; } }
t("E3 missing or invalid now throws", threwNow === 3);

// E4 cap: a fourth retraction (25% of 16) trips it; the override lets it through.
await save("c13", { synthetic: true }, D_NEW);
const o4 = await runCatalogueBuild(store, { now: NOW2, base: live1, activeClusterIds: active });
t("E4 four of sixteen retractions trips the 20% cap (kind cap, exit 2)", !o4.ok && o4.kind === "cap" && exitCodeFor(o4) === 2, JSON.stringify(o4).slice(0, 200));
const o4b = await runCatalogueBuild(store, { now: NOW2, base: live1, activeClusterIds: active, maxRetractFraction: 0.3 });
t("E4 override 0.3 allows it", o4b.ok && o4b.result.retractions.length === 4);

// E5 would-empty-shelf: 5 live, all five regraded fail. Cap override alone is not enough; allowEmptyShelf is the second key.
const s5 = new MemoryGradedStore(() => D_NEW);
const five = ["z1", "z2", "z3", "z4", "z5"];
for (const id of five) await s5.saveGraded(id, gradeAll([shelf(id)])[0], id);
const base5 = (await runCatalogueBuild(s5, { now: NOW1 })).result.catalogue;
for (const id of five) await s5.saveGraded(id, gradeAll([shelf(id, { synthetic: true })])[0], id);
const o5a = await runCatalogueBuild(s5, { now: NOW2, base: base5 });
t("E5 at the default cap the empty-out is refused by the cap", !o5a.ok && o5a.kind === "cap");
const o5b = await runCatalogueBuild(s5, { now: NOW2, base: base5, maxRetractFraction: 1 });
t("E5 cap raised to 1 still refused: would empty the live shelf (kind empty-shelf, exit 3), every id named", !o5b.ok && o5b.kind === "empty-shelf" && exitCodeFor(o5b) === 3 && five.every((i) => o5b.offenders.some((o) => o.cluster_id === i)), JSON.stringify(o5b).slice(0, 200));
const o5c = await runCatalogueBuild(s5, { now: NOW2, base: base5, maxRetractFraction: 1, allowEmptyShelf: true });
t("E5 allowEmptyShelf lets it through to an empty catalogue with 5 retractions", o5c.ok && o5c.result.catalogue.entries.length === 0 && o5c.result.retractions.length === 5);
const o5d = await runCatalogueBuild(new MemoryGradedStore(), { now: NOW2 });
t("E5 an already-empty shelf with nothing to retract is fine", o5d.ok && o5d.result.retractions.length === 0);

// E5e nothing was live before (empty base): a store full of aged records retracting to zero empties nothing, so it is not an empty-shelf refusal.
const s5e = new MemoryGradedStore(() => D_OLD);
for (const id of ["y1", "y2"]) await s5e.saveGraded(id, gradeAll([shelf(id)])[0], id);
const o5e = await runCatalogueBuild(s5e, { now: NOW2, maxRetractFraction: 1 });
t("E5 empty base + all aged out is allowed (no live shelf was emptied)", o5e.ok && o5e.result.catalogue.entries.length === 0 && o5e.result.retractions.length === 2, JSON.stringify(o5e).slice(0, 200));

// E6 blocked: an expected id with no stored run is an offender (kind blocked, exit 1) and names it.
const o6 = await runCatalogueBuild(store, { now: NOW2, base: live1, expectIds: ["ghost"] });
t("E6 expected id with no run blocks the build and is named", !o6.ok && o6.kind === "blocked" && exitCodeFor(o6) === 1 && o6.offenders.some((o) => o.cluster_id === "ghost" && /ungraded/.test(o.reason)));

// E7 CLI end to end, same fixture. Records come from the store, the existing catalogue is the first build's file.
const records = await store.loadAll();
const recs2 = records.filter((r) => r.cluster_id !== "c13").concat([]); // c13 re-saved passing below
const goodC13 = await (async () => { const s = new MemoryGradedStore(() => D_NEW); await s.saveGraded("c13", gradeAll([shelf("c13")])[0], "c13"); return (await s.loadAll())[0]; })();
const srcPath = join(dir, "records.json"); writeFileSync(srcPath, JSON.stringify({ records: recs2.concat([goodC13]) }));
const out = join(dir, "site", "shelf_catalogue.json"); const side = join(dir, "site", "retractions.json");
spawnSync("mkdir", ["-p", join(dir, "site")]); writeFileSync(out, o1.files["shelf_catalogue.json"]);
const run = (extra) => { const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, "--source", "file:" + srcPath, "--out", out, "--now", NOW2, "--active-clusters", active.join(","), ...extra], { encoding: "utf8" }); return { code: r.status, stdout: r.stdout, stderr: r.stderr }; };
const baseText = readFileSync(out, "utf8");
const c1 = run([]);
t("E7 CLI exit 0", c1.code === 0, c1.stderr + c1.stdout);
const catOut = JSON.parse(readFileSync(out, "utf8")).entries.map((e) => e.cluster_id);
t("E7 CLI catalogue lacks the three and keeps 13", catOut.length === 13 && ![FAILER, STALE, LOST].some((i) => catOut.includes(i)), catOut.join());
t("E7 retractions.json is written NEXT TO the catalogue, naming each reason", existsSync(side) && (() => { const s = JSON.parse(readFileSync(side, "utf8")); const w = Object.fromEntries(s.retractions.map((r) => [r.id, r.reason])); return s.count === 3 && w[FAILER] === "regrade failed" && w[STALE] === "grade too old" && w[LOST] === "cluster removed" && s.policy.maxAgeDays === 90; })());
t("E7 CLI stdout lists each RETRACTED line", [FAILER, STALE, LOST].every((i) => new RegExp("RETRACTED " + i + ":").test(c1.stdout)), c1.stdout);
t("E7 no temp files left behind", !existsSync(out + ".tmp") && !existsSync(side + ".tmp"));
const afterText = readFileSync(out, "utf8");
const c1b = run([]);
t("E7 rerun is byte-identical on the catalogue", c1b.code === 0 && readFileSync(out, "utf8") === afterText, c1b.stderr);
// E8 CLI --max-age-days is honoured: 1000 days keeps the stale one live.
writeFileSync(out, baseText);
const c2 = run(["--max-age-days", "1000"]);
t("E8 --max-age-days 1000 keeps the stale entry (only 2 retractions)", c2.code === 0 && JSON.parse(readFileSync(out, "utf8")).entries.some((e) => e.cluster_id === STALE) && JSON.parse(readFileSync(side, "utf8")).count === 2, c2.stderr);
const c2b = run(["--max-age-days", "banana"]);
t("E8 --max-age-days banana fails closed", c2b.code === 1 && /not a number/.test(c2b.stderr));
// E9 CLI cap: records now 4 failing; nothing written, exit 2.
writeFileSync(out, baseText); writeFileSync(side, "SENTINEL");
writeFileSync(srcPath, JSON.stringify({ records: records })); // c13 failing too
const c3 = run([]);
t("E9 CLI cap trip exits 2 and writes nothing (catalogue and sidecar untouched)", c3.code === 2 && /\(cap\)/.test(c3.stderr) && readFileSync(out, "utf8") === baseText && readFileSync(side, "utf8") === "SENTINEL", c3.stderr);
// E10 CLI empty shelf.
const five5 = await s5.loadAll(); const out5 = join(dir, "five", "shelf_catalogue.json"); spawnSync("mkdir", ["-p", join(dir, "five")]);
writeFileSync(out5, JSON.stringify(base5)); const src5 = join(dir, "five.json"); writeFileSync(src5, JSON.stringify({ records: five5 }));
const run5 = (extra) => { const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", CLI, "--source", "file:" + src5, "--out", out5, "--now", NOW2, ...extra], { encoding: "utf8" }); return { code: r.status, stderr: r.stderr, stdout: r.stdout }; };
const before5 = readFileSync(out5, "utf8");
const e1 = run5(["--max-retract-fraction", "1"]);
t("E10 CLI would-empty-shelf exits 3 without the override, writes nothing", e1.code === 3 && /empty-shelf/.test(e1.stderr) && readFileSync(out5, "utf8") === before5 && !existsSync(join(dir, "five", "retractions.json")), e1.stderr);
const e2 = run5(["--max-retract-fraction", "1", "--allow-empty-shelf"]);
t("E10 --allow-empty-shelf lets it through", e2.code === 0 && JSON.parse(readFileSync(out5, "utf8")).entries.length === 0 && JSON.parse(readFileSync(join(dir, "five", "retractions.json"), "utf8")).count === 5, e2.stderr);
// E11 static store is read-only.
let ro = false; try { await new StaticGradedStore([]).saveGraded("x", {}, "x"); } catch { ro = true; }
t("E11 StaticGradedStore refuses writes", ro);
console.log(`catalogue build entry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
