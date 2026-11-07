// C5 catalogue consumer tests. SYNTHETIC shelves only (invented, labelled; no model call, no network).
import { createCatalogueReader, readCatalogue } from "../lib/shop/catalogue_reader.ts";
import { promoteDrained, runFromGraded, MemoryGraderPort } from "../lib/shop/publish_gate.ts";
import { serialiseCatalogue } from "../lib/shop/build_catalogue.ts";
import { gradeAll } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e?.message ?? e)); } };
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: ["synthetic"], ...over,
});
// Build a real published catalogue text through the real gate + serialiser.
function catalogueText(ids, order = ids) {
  const shelves = order.map((i) => shelf(i));
  const graded = gradeAll(shelves);
  const port = new MemoryGraderPort(Object.fromEntries(graded.map((g, i) => [order[i], runFromGraded(g)])));
  const r = promoteDrained({ entries: [] }, shelves.map((s, i) => ({ cluster_id: order[i], label: order[i], shelf: s })), port);
  if (r.held.length) throw new Error("setup held " + JSON.stringify(r.held));
  return serialiseCatalogue(r.catalogue);
}
const FALLBACK = gradeAll([shelf("fallback-a"), shelf("fallback-b")]);
const ids = (xs) => xs.map((s) => s.slug).join();

// R1 present catalogue renders from it, not the fallback.
let rd = createCatalogueReader(() => catalogueText(["c", "a", "b"]), FALLBACK);
t("R1 from catalogue", rd.from === "catalogue" && ids(rd.listShelves()) === "a,b,c", ids(rd.listShelves()));
t("R1b fallback shelves absent", !rd.getShelf("fallback-a"));
// R2 absent file falls back; empty text and empty entries fall back too.
for (const [n, src] of [["absent", () => null], ["blank", () => "  \n"], ["empty entries", () => '{"entries":[]}']]) {
  let f; try { f = createCatalogueReader(src, FALLBACK); } catch (e) { t("R2 fallback on " + n, false, String(e.message)); continue; }
  t("R2 fallback on " + n, f.from === "fallback" && ids(f.listShelves()) === "fallback-a,fallback-b" && !!f.getShelf("fallback-a"));
}
// R3 ungraded entry throws naming its cluster_id.
const tampered = JSON.parse(catalogueText(["a", "b"]));
delete tampered.entries[1].shelf.grade;
t("R3 ungraded throws with cluster_id", throwsWith(() => createCatalogueReader(() => JSON.stringify(tampered), FALLBACK), /b: /), "");
const failed = JSON.parse(catalogueText(["a", "b"])); failed.entries[0].shelf.grade.pass = false;
t("R3b failed grade throws", throwsWith(() => createCatalogueReader(() => JSON.stringify(failed), FALLBACK), /a: /));
const edited = JSON.parse(catalogueText(["a", "b"])); edited.entries[0].shelf.name = "Edited after grading";
t("R3c edited-after-grade throws", throwsWith(() => createCatalogueReader(() => JSON.stringify(edited), FALLBACK), /a: hash mismatch/));
const two = JSON.parse(catalogueText(["a", "b", "c"])); delete two.entries[0].shelf.grade; delete two.entries[2].shelf.grade;
t("R3d every offender listed, no partial shelf", throwsWith(() => createCatalogueReader(() => JSON.stringify(two), FALLBACK), /a: .*c: /));
// R4 malformed fails loudly, never falls back.
t("R4 invalid JSON throws", throwsWith(() => createCatalogueReader(() => "{not json", FALLBACK), /not valid JSON/));
t("R4b wrong shape throws", throwsWith(() => createCatalogueReader(() => '{"shelves":[]}', FALLBACK), /entries array/));
t("R4c array root throws", throwsWith(() => createCatalogueReader(() => "[]", FALLBACK), /entries array/));
const dupS = JSON.parse(catalogueText(["a", "b"])); dupS.entries.push({ ...structuredClone(dupS.entries[0]), cluster_id: "z" }); // same graded shelf under a second cluster
t("R4d duplicate slug throws", throwsWith(() => createCatalogueReader(() => JSON.stringify(dupS), FALLBACK), /duplicate cluster_id or slug: z/));
const dupC = JSON.parse(catalogueText(["a", "b"])); dupC.entries.push(structuredClone(dupC.entries[0]));
t("R4e duplicate cluster_id throws", throwsWith(() => createCatalogueReader(() => JSON.stringify(dupC), FALLBACK), /duplicate cluster_id or slug/));
// R5 unknown slug => undefined (404 path); known slug returns the shelf.
rd = createCatalogueReader(() => catalogueText(["a", "b"]), FALLBACK);
t("R5 unknown slug undefined", rd.getShelf("nope") === undefined && rd.getShelf("") === undefined && rd.getShelf("__proto__") === undefined && rd.getShelf("constructor") === undefined);
t("R5b known slug", rd.getShelf("b")?.id === "generator:b");
// R6 order deterministic whatever the file order.
const a1 = createCatalogueReader(() => catalogueText(["a", "b", "c", "d"]), []).listShelves().map((s) => s.slug).join();
const rev = JSON.parse(catalogueText(["a", "b", "c", "d"])); rev.entries.reverse();
const a2 = createCatalogueReader(() => JSON.stringify(rev), []).listShelves().map((s) => s.slug).join();
t("R6 sorted by cluster_id regardless of file order", a1 === "a,b,c,d" && a2 === "a,b,c,d", a1 + " | " + a2);
t("R6b listShelves returns a copy", (() => { const l = rd.listShelves(); l.pop(); return rd.listShelves().length === 2; })());
// R7 search through the f85 index.
rd = createCatalogueReader(() => catalogueText(["roofing", "plumbing"]), FALLBACK);
t("R7 search finds shelf", ids(rd.searchShelves("roofing")) === "roofing", ids(rd.searchShelves("roofing")));
t("R7b search miss is empty", rd.searchShelves("zzzzqq").length === 0 && rd.searchShelves("").length === 0);
// R8 1,000 shelves live, 0 ungraded, under 200 ms.
const many = Array.from({ length: 1000 }, (_, i) => "s" + String(i).padStart(4, "0"));
const big = catalogueText(many, [...many].reverse());
let best = Infinity, br, list;
for (let k = 0; k < 3; k++) { // best of 3 so a loaded box does not flake the bound
  const c0 = process.cpuUsage(); // CPU time, not wall time, so a loaded box (load 27 on 12 cores) does not flake the bound
  br = createCatalogueReader(() => big, FALLBACK);
  list = br.listShelves();
  const c = process.cpuUsage(c0);
  best = Math.min(best, (c.user + c.system) / 1000);
}
t("R8 1000 listed", list.length === 1000 && br.from === "catalogue" && list.every((s) => s.grade?.pass === true) && list[0].slug === "s0000" && list[999].slug === "s0999");
t("R8b load + validate + list under 200 ms (best of 3 CPU ms: " + best.toFixed(0) + " ms)", best < 200, best.toFixed(0));
const t1 = performance.now(); br.listShelves(); br.getShelf("s0500");
t("R8c list + lookup after load under 200 ms", performance.now() - t1 < 200);
// R9 pure reads: source is not mutated and a second call is identical.
t("R9 deterministic", JSON.stringify(createCatalogueReader(() => big, []).listShelves()) === JSON.stringify(list));
t("R10 readCatalogue null on absent", readCatalogue(null) === null);

console.log(`catalogue reader: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
