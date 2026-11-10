// C5 publish gate tests. SYNTHETIC shelves only (invented, labelled; no model call, no network).
import { promoteDrained, assertCatalogueAllGraded, contentHash, runFromGraded, MemoryGraderPort, REQUIRED_CHECKS } from "../lib/shop/publish_gate.ts";
import { gradeAll, gradeShelf } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const empty = () => ({ entries: [] });
// Grade shelves through the real grader and record a run per cluster (what a drained queue row would hold).
const setup = (ids, over = {}) => {
  const shelves = ids.map((i) => shelf(i, over));
  const graded = gradeAll(shelves);
  const port = new MemoryGraderPort(Object.fromEntries(graded.map((g, i) => [ids[i], runFromGraded(g)])));
  return { shelves, graded, port, drained: shelves.map((s, i) => ({ cluster_id: ids[i], label: ids[i], shelf: s })) };
};
const reason = (r, id) => r.held.find((h) => h.cluster_id === id)?.reason ?? "";

// G0 the required list matches what the real grader emits.
const emitted = gradeShelf(shelf("x")).checks.map((c) => c.id);
t("G0 REQUIRED_CHECKS are all emitted by gradeShelf", REQUIRED_CHECKS.every((id) => emitted.includes(id)), emitted.join());
t("G0b only generator-specific check is extra", emitted.filter((id) => !REQUIRED_CHECKS.includes(id)).join() === "fixture-proof");
// G1 pass.
let s = setup(["a", "b"]);
let r = promoteDrained(empty(), s.drained, s.port);
t("G1 both published", r.published.length === 2 && r.held.length === 0 && r.catalogue.entries.length === 2, JSON.stringify(r.held));
t("G1b published carry hash and label", r.published.every((e) => e.content_hash === contentHash(e.shelf) && e.label));
t("G1c catalogue passes assert", (() => { try { assertCatalogueAllGraded(r.catalogue); return true; } catch { return false; } })());
// G2 fail: a shelf that fails a check is held with the check name.
s = setup(["a", "bad"]);
s.drained[1].shelf = shelf("bad", { name: "Seamless pack" , synthetic: true });
s.port.runs.bad = runFromGraded(gradeAll([s.drained[1].shelf])[0]);
r = promoteDrained(empty(), s.drained, s.port);
t("G2 failing shelf held with check names", r.published.length === 1 && /failed checks: .*not-synthetic/.test(reason(r, "bad")) && /copy/.test(reason(r, "bad")), JSON.stringify(r.held));
// G3 stale hash: edit after grading.
s = setup(["a", "b"]);
s.drained[1].shelf = shelf("b", { bluf: "Edited after grading, but still a perfectly long enough one line answer." });
r = promoteDrained(empty(), s.drained, s.port);
t("G3 stale hash held", r.published.length === 1 && /stale grade/.test(reason(r, "b")), JSON.stringify(r.held));
// G3b same-content re-serialised (key order) is still fresh.
s = setup(["a"]);
const reordered = Object.fromEntries(Object.entries(s.drained[0].shelf).reverse());
t("G3b key order does not change hash", promoteDrained(empty(), [{ cluster_id: "a", label: "a", shelf: reordered }], s.port).published.length === 1);
// G4 missing label.
s = setup(["a", "b", "c"]);
s.drained[0].label = ""; s.drained[1].label = "   "; delete s.drained[2].label;
r = promoteDrained(empty(), s.drained, s.port);
t("G4 missing label held", r.published.length === 0 && r.held.length === 3 && r.held.every((h) => /missing label/.test(h.reason)), JSON.stringify(r.held));
// G5 empty input.
r = promoteDrained(empty(), [], new MemoryGraderPort());
t("G5 empty input", r.published.length === 0 && r.held.length === 0 && r.catalogue.entries.length === 0);
t("G5b empty catalogue asserts clean", (() => { assertCatalogueAllGraded(empty()); return true; })());
// G6 duplicate cluster id: both copies held.
s = setup(["a", "b"]);
r = promoteDrained(empty(), [...s.drained, { ...s.drained[0] }], s.port);
t("G6 duplicate id held (both copies)", r.published.length === 1 && r.held.filter((h) => h.cluster_id === "a" && /duplicate/.test(h.reason)).length === 2, JSON.stringify(r.held));
// G7 ungraded (no run) and partial (one check only) and partial-pass.
s = setup(["a", "b", "c"]);
delete s.port.runs.a;
s.port.runs.b = { ...s.port.runs.b, checks: s.port.runs.b.checks.slice(0, 1) };
s.port.runs.c = { ...s.port.runs.c, checks: s.port.runs.c.checks.map((c, i) => (i === 3 ? { ...c, ok: false } : c)), pass: true };
r = promoteDrained(empty(), s.drained, s.port);
t("G7 ungraded held", /ungraded/.test(reason(r, "a")));
t("G7b partial grade held", /partial grade/.test(reason(r, "b")));
t("G7c one failed check with pass flag true still held", /failed checks/.test(reason(r, "c")) && r.published.length === 0, JSON.stringify(r.held));
// G8 idempotent.
s = setup(["a", "b"]);
const r1 = promoteDrained(empty(), s.drained, s.port);
const r2 = promoteDrained(r1.catalogue, s.drained, s.port);
t("G8 second call publishes nothing, same catalogue", r2.published.length === 0 && r2.already.length === 2 && JSON.stringify(r2.catalogue) === JSON.stringify(r1.catalogue));
t("G8b same call twice equal", JSON.stringify(promoteDrained(empty(), s.drained, s.port)) === JSON.stringify(promoteDrained(empty(), s.drained, s.port)));
// G9 inputs not mutated (deep frozen, strict mode would throw).
s = setup(["a", "bad"]);
s.drained[1].shelf = shelf("bad", { synthetic: true }); s.port.runs.bad = runFromGraded(gradeAll([s.drained[1].shelf])[0]);
deepFreeze(s.drained); deepFreeze(s.port.runs);
const cat0 = deepFreeze(empty()); const before = JSON.stringify([s.drained, s.port.runs, cat0]);
let threw = false; try { r = promoteDrained(cat0, s.drained, s.port); } catch { threw = true; }
t("G9 frozen inputs ok, unchanged", !threw && JSON.stringify([s.drained, s.port.runs, cat0]) === before);
t("G9b published shelf is a copy, not the input", r.published[0].shelf !== s.drained[0].shelf);
// G10 assertCatalogueAllGraded lists every offender.
s = setup(["a", "b", "c", "d"]);
r = promoteDrained(empty(), s.drained, s.port);
const cat = structuredClone(r.catalogue);
cat.entries[1].shelf.bluf = "Edited after publish, long enough for the length check to pass cleanly.";
delete cat.entries[2].shelf.grade;
cat.entries[3].label = "";
let msg = ""; try { assertCatalogueAllGraded(cat); } catch (e) { msg = e.message; }
t("G10 throws listing all three offenders", /3 ungraded/.test(msg) && /b: hash mismatch/.test(msg) && /c: .*ungraded/.test(msg) && /d: missing label/.test(msg), msg);
// G11 edited-and-regraded shelf replaces the live entry.
s = setup(["a"]);
const live = promoteDrained(empty(), s.drained, s.port).catalogue;
const edited = shelf("a", { bluf: "A revised one line answer that is long enough and regraded afresh." });
const port2 = new MemoryGraderPort({ a: runFromGraded(gradeAll([edited])[0]) });
r = promoteDrained(live, [{ cluster_id: "a", label: "a", shelf: edited }], port2);
t("G11 regraded edit replaces entry", r.published.length === 1 && r.catalogue.entries.length === 1 && r.catalogue.entries[0].shelf.bluf === edited.bluf);
// G12 1,000-shelf synthetic run: 0 ungraded published.
const ids = Array.from({ length: 1000 }, (_, i) => "c" + String(i).padStart(4, "0"));
s = setup(ids);
// poison: 100 stale, 50 failing, 25 unlabelled, 25 ungraded
for (let i = 0; i < 100; i++) s.drained[i].shelf = shelf(ids[i], { bluf: "Edited after grading number " + i + ", long enough to be plausible text." });
for (let i = 100; i < 150; i++) { s.drained[i].shelf = shelf(ids[i], { synthetic: true }); s.port.runs[ids[i]] = runFromGraded(gradeAll([s.drained[i].shelf])[0]); }
for (let i = 150; i < 175; i++) s.drained[i].label = "";
for (let i = 175; i < 200; i++) delete s.port.runs[ids[i]];
r = promoteDrained(empty(), s.drained, s.port);
t("G12 800 published, 200 held", r.published.length === 800 && r.held.length === 200, r.published.length + "/" + r.held.length);
t("G12b zero ungraded published", (() => { assertCatalogueAllGraded(r.catalogue); return r.catalogue.entries.every((e) => gradeShelf(e.shelf).pass); })());
console.log(`publish gate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
