// C5 retraction tests. SYNTHETIC labelled shelves and an in-memory store only: no model, no network, no clock (now is injected), no D1.
import { gradeAll } from "../lib/shop/grader.ts";
import { contentHash } from "../lib/shop/publish_gate.ts";
import { MemoryGradedStore, buildCatalogueFromStore } from "../lib/shop/graded_store.ts";
import { planRetractions, assertRetractionCap, DEFAULT_MAX_RETRACT_FRACTION } from "../lib/shop/retraction.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const throws = async (f) => { try { await f(); return null; } catch (e) { return String(e.message); } };
const NOW = "2026-11-09T00:00:00Z";
const daysAgo = (d) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const graded = (id, over = {}) => gradeAll([shelf(id, over)])[0];
const ids = (n) => Array.from({ length: n }, (_, i) => "c" + String(i).padStart(2, "0"));
async function storeOf(list, at = NOW) { const s = new MemoryGradedStore(() => at); for (const id of list) await s.saveGraded(id, graded(id), id.toUpperCase()); return s; }
const POL = { maxAgeDays: 30 };

// R1 fresh passing entries are never retracted, and the sidecar still exists (empty)
{ const s = await storeOf(ids(10)); const r = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL } });
  t("R1 no retraction of fresh passing entries", r.retractions.length === 0 && r.catalogue.entries.length === 10);
  const side = JSON.parse(r.files["retractions.json"]);
  t("R1 sidecar emitted when empty", side.count === 0 && Array.isArray(side.retractions) && side.generated_at === NOW);
  t("R1 catalogue file lists 10 shelves", JSON.parse(r.files["shelf_catalogue.json"]).entries.length === 10);
  t("R1 plan on the clean catalogue is empty", planRetractions(await s.loadAll(), NOW, POL, r.catalogue).length === 0); }

// R2 regrade failed: a live entry whose latest stored regrade fails is removed and listed
{ const s = await storeOf(ids(10)); const first = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL } });
  await s.saveGraded("c03", graded("c03", { synthetic: true, name: "Synthetic c03 pack v2" }), "C03"); // regrade after an edit, now failing
  const r = await buildCatalogueFromStore(s, { base: first.catalogue, retract: { now: NOW, ...POL } });
  t("R2 failed regrade retracted", r.retractions.length === 1 && r.retractions[0].id === "c03" && r.retractions[0].reason === "regrade failed", JSON.stringify(r.retractions));
  t("R2 removed from shelf_catalogue.json", !JSON.parse(r.files["shelf_catalogue.json"]).entries.some((e) => e.slug === "c03") && r.catalogue.entries.length === 9);
  const side = JSON.parse(r.files["retractions.json"]);
  t("R2 listed in sidecar with reason, not silently dropped", side.count === 1 && side.retractions[0].id === "c03" && side.retractions[0].reason === "regrade failed" && /not-synthetic/.test(side.retractions[0].detail), JSON.stringify(side)); }

// R3 content_hash mismatch: a live entry edited after grading is retracted instead of failing the whole build
{ const s = await storeOf(ids(10)); const first = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL } });
  const base = structuredClone(first.catalogue); base.entries[4].shelf.name = "Edited after grading"; const victim = base.entries[4].cluster_id;
  const bare = await throws(() => buildCatalogueFromStore(s, { base }));
  t("R3 without a retract policy the stale entry still blocks the build", bare && /mismatch/.test(bare), String(bare));
  const r = await buildCatalogueFromStore(s, { base, retract: { now: NOW, ...POL } });
  t("R3 mismatch retracted", r.retractions.length === 1 && r.retractions[0].id === victim && r.retractions[0].reason === "content_hash mismatch", JSON.stringify(r.retractions));
  t("R3 others kept", r.catalogue.entries.length === 9 && !r.catalogue.entries.some((e) => e.cluster_id === victim));
  const recs = await s.loadAll(); recs[0].shelf.name = "Tampered"; // stored shelf no longer matches its recorded hash
  const p = planRetractions(recs, NOW, POL, first.catalogue);
  t("R3b stored-shelf mismatch planned", p.length === 1 && p[0].id === recs[0].cluster_id && p[0].reason === "content_hash mismatch", JSON.stringify(p)); }

// R4 grade older than policy.maxAgeDays
{ const old = new MemoryGradedStore(() => daysAgo(45)); await old.saveGraded("c00", graded("c00"), "C00");
  const edge = new MemoryGradedStore(() => daysAgo(30)); await edge.saveGraded("c01", graded("c01"), "C01");
  const young = new MemoryGradedStore(() => daysAgo(29)); for (const id of ids(10).slice(2)) await young.saveGraded(id, graded(id), id.toUpperCase());
  const recs = [...(await old.loadAll()), ...(await edge.loadAll()), ...(await young.loadAll())];
  const cat = { entries: recs.map((r) => ({ cluster_id: r.cluster_id, label: r.label, content_hash: r.content_hash, shelf: r.shelf })) };
  const p = planRetractions(recs, NOW, POL, cat);
  t("R4 45-day-old grade retracted, exactly 30 days kept, 29 kept", p.length === 1 && p[0].id === "c00" && p[0].reason === "grade too old", JSON.stringify(p));
  t("R4 no maxAgeDays means no age limit", planRetractions(recs, NOW, {}, cat).length === 0);
  const s = await storeOf(ids(10), daysAgo(45));
  const e = await throws(() => buildCatalogueFromStore(s, { retract: { now: NOW, ...POL } }));
  t("R4 build with every grade stale trips the cap, never publishes an empty shelf quietly", e && /retraction cap/.test(e), String(e)); }

// R5 cluster removed
{ const s = await storeOf(ids(10)); const active = ids(10).filter((i) => i !== "c07");
  const r = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL, activeClusterIds: active } });
  t("R5 removed cluster retracted", r.retractions.length === 1 && r.retractions[0].id === "c07" && r.retractions[0].reason === "cluster removed", JSON.stringify(r.retractions));
  t("R5 absent activeClusterIds means no cluster check", (await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL } })).retractions.length === 0); }

// R6 safety cap (default 0.2, strictly above throws)
{ t("R6 default cap is 0.2", DEFAULT_MAX_RETRACT_FRACTION === 0.2);
  const s = await storeOf(ids(10));
  const two = ids(10).slice(2); const three = ids(10).slice(3);
  const ok = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL, activeClusterIds: two } });
  t("R6 exactly 20% (2 of 10) is allowed", ok.retractions.length === 2 && ok.catalogue.entries.length === 8);
  const e = await throws(() => buildCatalogueFromStore(s, { retract: { now: NOW, ...POL, activeClusterIds: three } }));
  t("R6 30% throws instead of mass-deleting", e && /retraction cap: 3 of 10/.test(e), String(e));
  const e2 = await buildCatalogueFromStore(s, { retract: { now: NOW, ...POL, activeClusterIds: three, maxRetractFraction: 0.5 } });
  t("R6 policy can raise the cap", e2.retractions.length === 3);
  t("R6 cap 0 refuses any retraction", (await throws(() => buildCatalogueFromStore(s, { retract: { now: NOW, activeClusterIds: two, maxRetractFraction: 0 } }))) !== null);
  t("R6 assertRetractionCap on empty catalogue does not divide by zero", (await throws(async () => assertRetractionCap(0, 0, {}))) === null); }

// R7 idempotency and purity
{ const s = await storeOf(ids(10), daysAgo(10)); await s.saveGraded("c02", graded("c02", { synthetic: true }), "C02");
  const first = await buildCatalogueFromStore(await storeOf(ids(10), daysAgo(10)), { retract: { now: NOW, ...POL } });
  const opts = { base: first.catalogue, retract: { now: NOW, ...POL } };
  const a = await buildCatalogueFromStore(s, opts), b = await buildCatalogueFromStore(s, opts);
  t("R7 same inputs, byte-identical output", a.files["shelf_catalogue.json"] === b.files["shelf_catalogue.json"] && a.files["retractions.json"] === b.files["retractions.json"]);
  const c = await buildCatalogueFromStore(s, { base: a.catalogue, retract: { now: NOW, ...POL } });
  t("R7 rebuilding from a retracted catalogue changes nothing", JSON.stringify(c.catalogue) === JSON.stringify(a.catalogue));
  // age case: store re-promotes the aged record, retraction removes it again, same sidecar both times
  const aged = await storeOf(ids(10).slice(0, 9), NOW); await aged.saveGraded("c09", graded("c09"), "C09"); // fresh
  const old = new MemoryGradedStore(() => daysAgo(60)); await old.saveGraded("zz", graded("zz"), "ZZ");
  const mixed = { loadAll: async () => [...(await aged.loadAll()), ...(await old.loadAll())], saveGraded: async () => {} };
  const m1 = await buildCatalogueFromStore(mixed, { retract: { now: NOW, ...POL } });
  const m2 = await buildCatalogueFromStore(mixed, { base: m1.catalogue, retract: { now: NOW, ...POL } });
  t("R7 aged record stays retracted across rebuilds", m1.retractions.length === 1 && m2.retractions.length === 1 && m1.files["retractions.json"] === m2.files["retractions.json"] && m2.catalogue.entries.length === 10);
  t("R7b a retracted record is not reported as published", !m1.published.some((e) => e.cluster_id === "zz") && m1.published.length === 10, String(m1.published.length));
  const recs = await s.loadAll(), snap = JSON.stringify(recs), cat = JSON.stringify(first.catalogue);
  const p1 = planRetractions(recs, NOW, POL, first.catalogue), p2 = planRetractions(recs, NOW, POL, first.catalogue);
  t("R7 planRetractions pure: inputs unmutated, equal outputs", JSON.stringify(recs) === snap && JSON.stringify(first.catalogue) === cat && JSON.stringify(p1) === JSON.stringify(p2));
  t("R7 invalid now throws", (await throws(async () => planRetractions(recs, "not a time", POL, first.catalogue))) !== null); }

// R8 one reason per id, sorted; no retract option leaves old behaviour untouched
{ const s = await storeOf(ids(10)); const r = await buildCatalogueFromStore(s);
  t("R8 without opts.retract: no retractions, no files, same catalogue", r.retractions.length === 0 && r.files === null && r.catalogue.entries.length === 10);
  const recs = await s.loadAll(); recs[5].pass = false; recs[1].pass = false;
  const p = planRetractions(recs, NOW, { activeClusterIds: ids(10).filter((i) => i !== "c05") }, r.catalogue);
  t("R8 priority: removed beats failed, sorted by id", p.length === 2 && p[0].id === "c01" && p[0].reason === "regrade failed" && p[1].id === "c05" && p[1].reason === "cluster removed", JSON.stringify(p)); }

console.log(`retraction: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
