// f332: the READ side of the retraction loop. Fixtures come from the f317 16-shelf set (c03 regrade-failed, c07 stale, c11 cluster-lost) built through the real
// runCatalogueBuild, so the sidecar is the exact file the build writes. SYNTHETIC labelled shelves. No network, no model, no D1.
import { readFileSync } from "node:fs";
import { createCatalogueReader, readRetractions, withdrawnLine } from "../lib/shop/catalogue_reader.ts";
import { runCatalogueBuild } from "../lib/shop/catalogue_build_entry.ts";
import { MemoryGradedStore } from "../lib/shop/graded_store.ts";
import { gradeAll } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const ids = Array.from({ length: 16 }, (_, i) => "c" + String(i).padStart(2, "0"));
const FAILER = "c03", STALE = "c07", LOST = "c11", GONE = [FAILER, STALE, LOST];
let clock = "2026-11-01T00:00:00Z";
const store = new MemoryGradedStore(() => clock);
const save = async (id, over = {}, at = "2026-11-01T00:00:00Z") => { clock = at; await store.saveGraded(id, gradeAll([shelf(id, over)])[0], id); };
for (const id of ids) await save(id, {}, id === STALE ? "2026-06-01T00:00:00Z" : "2026-11-01T00:00:00Z");
const o1 = await runCatalogueBuild(store, { now: "2026-11-02T00:00:00Z", maxAgeDays: 400 });
const liveStale = o1.files["shelf_catalogue.json"]; // the 16-shelf catalogue, as it sits on disk before the retracting build
await save(FAILER, { synthetic: true });
const o2 = await runCatalogueBuild(store, { now: "2026-11-09T00:00:00Z", base: JSON.parse(liveStale), activeClusterIds: ids.filter((i) => i !== LOST) });
const catNew = o2.files["shelf_catalogue.json"], side = o2.files["retractions.json"];
const rd = (cat, sc, fb = []) => createCatalogueReader(() => cat, fb, () => sc);
const slugs = (r) => r.listShelves().map((s) => s.slug);

// X1 absent sidecar is the ONLY fallback-to-catalogue case: the catalogue serves as it is.
const x1 = rd(liveStale, null);
t("X1 absent sidecar serves the whole catalogue", slugs(x1).length === 16 && !x1.closed && x1.retractionError === null && x1.retracted().length === 0);
t("X1 default (no third argument) behaves as absent", createCatalogueReader(() => liveStale, []).listShelves().length === 16);
// X2 the fresh pair: 13 served, 3 withdrawn with their reasons.
const x2 = rd(catNew, side);
t("X2 13 served, none of the three", slugs(x2).length === 13 && GONE.every((g) => !slugs(x2).includes(g)), slugs(x2).join());
const why = Object.fromEntries(x2.retracted().map((r) => [r.id, r.reason]));
t("X2 retracted() names each id with its reason", x2.retracted().length === 3 && why[FAILER] === "regrade failed" && why[STALE] === "grade too old" && why[LOST] === "cluster removed", JSON.stringify(why));
t("X2 every withdrawn entry keeps its detail", x2.retracted().every((r) => r.detail.length > 3));
// X3 STALE catalogue (partial deploy): the old 16-shelf file plus the new sidecar still drops all three.
const x3 = rd(liveStale, side);
t("X3 stale catalogue + sidecar still serves 13", slugs(x3).length === 13 && GONE.every((g) => !slugs(x3).includes(g)));
t("X3 getShelf of a retracted slug is undefined (not re-listed)", GONE.every((g) => x3.getShelf(g) === undefined));
t("X3 search never returns a retracted shelf", GONE.every((g) => x3.searchShelves("Synthetic " + g + " pack").every((s) => s.slug !== g)) && x3.searchShelves("synthetic pack", { limit: 50 }).every((s) => !GONE.includes(s.slug)));
t("X3 non-retracted shelves still resolve", x3.getShelf("c00")?.slug === "c00" && x3.getShelf("c15")?.slug === "c15");
// X4 withdrawn notice for direct shelf URLs, by cluster id, slug or shelf id, even when the catalogue is stale.
for (const g of GONE) t("X4 getWithdrawn(" + g + ") by id/slug", x3.getWithdrawn(g)?.reason === why[g]);
t("X4 getWithdrawn by shelf id", x3.getWithdrawn("generator:" + FAILER)?.reason === "regrade failed");
t("X4 a live shelf is not withdrawn, an unknown key is not withdrawn", x3.getWithdrawn("c00") === undefined && x3.getWithdrawn("zzz") === undefined && x3.getWithdrawn("__proto__") === undefined);
const line = withdrawnLine(x3.getWithdrawn(FAILER));
t("X4 withdrawn line is a labelled placeholder with the reason, no dashes", /^PLACEHOLDER/.test(line) && line.includes("regrade failed") && !/[–—]/.test(line) && !/ - /.test(line), line);
t("X4 retracted() hands out copies", (() => { const a = x3.retracted(); a[0].reason = "x"; a.pop(); return x3.retracted().length === 3 && x3.retracted()[0].reason !== "x"; })());
// X5 FAIL CLOSED: a present-but-bad sidecar serves nothing and says why.
const closedOk = (r, rx) => r.closed && typeof r.retractionError === "string" && rx.test(r.retractionError) && r.listShelves().length === 0 && r.getShelf("c00") === undefined && r.searchShelves("synthetic pack").length === 0 && r.retracted().length === 0 && r.getWithdrawn(FAILER) === undefined;
t("X5 malformed JSON fails closed", closedOk(rd(liveStale, "{not json"), /not valid JSON/));
t("X5 truncated sidecar fails closed", closedOk(rd(liveStale, side.slice(0, side.length >> 1)), /not valid JSON/));
t("X5 blank (zero-byte) sidecar is present, so it fails closed", closedOk(rd(liveStale, ""), /not valid JSON/) && closedOk(rd(liveStale, "  \n"), /not valid JSON/));
const j = JSON.parse(side);
const mod = (f) => { const c = JSON.parse(side); f(c); return JSON.stringify(c); };
t("X5 count lower than entries fails closed", closedOk(rd(liveStale, mod((c) => { c.count = 2; })), /count 2 disagrees with 3 entries/));
t("X5 count higher than entries fails closed", closedOk(rd(liveStale, mod((c) => { c.count = 4; })), /count 4 disagrees with 3 entries/));
t("X5 count missing fails closed", closedOk(rd(liveStale, mod((c) => { delete c.count; })), /integer count/));
t("X5 count not an integer fails closed", closedOk(rd(liveStale, mod((c) => { c.count = "3"; })), /integer count/) && closedOk(rd(liveStale, mod((c) => { c.count = 3.5; })), /integer count/));
t("X5 retractions not an array fails closed", closedOk(rd(liveStale, mod((c) => { c.retractions = {}; })), /no retractions array/));
t("X5 policy missing fails closed", closedOk(rd(liveStale, mod((c) => { delete c.policy; })), /no policy object/));
t("X5 JSON array / null / number fails closed", ["[]", "null", "7"].every((x) => closedOk(rd(liveStale, x), /JSON object/)));
t("X5 unknown reason fails closed", closedOk(rd(liveStale, mod((c) => { c.retractions[0].reason = "because"; })), /unknown reason/));
t("X5 entry with no id fails closed", closedOk(rd(liveStale, mod((c) => { c.retractions[0].id = ""; })), /no id/));
t("X5 entry with no detail fails closed", closedOk(rd(liveStale, mod((c) => { delete c.retractions[0].detail; })), /no detail/));
t("X5 duplicate id fails closed", closedOk(rd(liveStale, mod((c) => { c.retractions[1].id = c.retractions[0].id; })), /twice/));
t("X5 fail closed holds with the fresh catalogue too, and with a fallback list", closedOk(rd(catNew, "{"), /JSON/) && rd(null, "{", [shelf("fb1")]).listShelves().length === 0);
t("X5 readRetractions reports the error, never returns notes with it", (() => { const r = readRetractions("{"); return r.notes === null && !!r.error; })());
// X6 edge cases that are NOT errors.
const x6 = rd(liveStale, JSON.stringify({ generated_at: "2026-11-09T00:00:00Z", policy: { maxAgeDays: 90, maxRetractFraction: 0.2 }, count: 0, retractions: [] }));
t("X6 a valid empty sidecar (count 0) serves everything", slugs(x6).length === 16 && !x6.closed && x6.retracted().length === 0);
const x6b = rd(liveStale, JSON.stringify({ generated_at: "x", policy: {}, count: 1, retractions: [{ id: "c99", reason: "cluster removed", detail: "not in the catalogue any more" }] }));
t("X6 a retraction for an id the catalogue no longer carries is still listed as withdrawn", slugs(x6b).length === 16 && x6b.getWithdrawn("c99")?.reason === "cluster removed" && x6b.retracted().length === 1);
const x6c = rd(null, side, [shelf("fb1"), shelf("c03")]);
t("X6 sidecar over the fallback source filters it too", x6c.from === "fallback" && slugs(x6c).join() === "fb1" && x6c.getWithdrawn("c03")?.reason === "regrade failed");
t("X6 sidecar ids come back sorted", x3.retracted().map((r) => r.id).join() === [...GONE].sort().join());
// X7 the catalogue's own validation is untouched: a bad catalogue still throws, sidecar or not.
let threw = false; try { rd("{not json", side); } catch { threw = true; }
t("X7 malformed catalogue still throws at construction", threw);
// X8 site wiring reads the sidecar next to the catalogue and reports a closed reader.
const wire = readFileSync(new URL("../lib/shop/reader.ts", import.meta.url), "utf8");
t("X8 reader.ts wires retractions.json beside the catalogue and logs a closed reader", /RETRACTIONS_PATH = join\(process\.cwd\(\), "lib", "shop", "retractions\.json"\)/.test(wire) && /createCatalogueReader\(\s*\(\) =>[\s\S]*?SHOP\.shelves,\s*\(\) =>/.test(wire) && /retractionError/.test(wire));
console.log("retraction read: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
