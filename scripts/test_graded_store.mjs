// C5 graded run store tests. SYNTHETIC queue rows and shelves only (labelled fixtures). The D1 is a FAKE (node:sqlite in memory, real migration SQL applied).
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { drainQueue, MemoryDrainQueue } from "../lib/shop/drain.ts";
import { D1DrainQueue } from "../lib/shop/drain_d1.ts";
import { SyntheticShelfGenerator } from "../lib/shop/shelf_generator.ts";
import { gradeAll } from "../lib/shop/grader.ts";
import { runFromGraded, contentHash } from "../lib/shop/publish_gate.ts";
import { MemoryGradedStore, D1GradedStore, persistDrained, buildCatalogueFromStore, GRADED_UPSERT_SQL } from "../lib/shop/graded_store.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const MIG = new URL("../portal-api/migrations/", import.meta.url);
const migs = readdirSync(MIG).filter((f) => /^\d{4}_(generator_queue_drain|graded_run_store)\.sql$/.test(f)).sort();

function fakeD1(db = new DatabaseSync(":memory:")) {
  for (const f of migs) db.exec(readFileSync(new URL(f, MIG), "utf8"));
  const log = [];
  return { db, log, prepare(sql) { let a = []; const st = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return st; },
    async all() { log.push({ sql, a }); return { results: db.prepare(sql).all(...a) }; },
    async run() { log.push({ sql, a }); db.prepare(sql).run(...a); return {}; } }; return st; } };
}
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const graded = (id, over = {}) => gradeAll([shelf(id, over)])[0];
let clock = 0; const now = () => "2026-11-09T00:00:" + String(clock++).padStart(2, "0") + "Z";
const rowsQ = () => [{ cluster_id: "a", label: "Alpha", first_seen: "2026-11-01T00:00:00Z", status: "QUEUED_FOR_GENERATOR" }, { cluster_id: "b", label: "Bravo", first_seen: "2026-11-02T00:00:00Z", status: "QUEUED_FOR_GENERATOR" }];
const throws = async (f) => { try { await f(); return null; } catch (e) { return String(e.message); } };

// S1 upsert idempotency (memory + D1)
for (const [name, mk] of [["mem", () => new MemoryGradedStore(now)], ["d1", () => new D1GradedStore(fakeD1(), now)]]) {
  const s = mk(); const g = graded("a");
  await s.saveGraded("a", g, "Alpha"); const first = (await s.loadAll())[0];
  await s.saveGraded("a", g, "Alpha"); await s.saveGraded("a", g, "Alpha");
  const all = await s.loadAll();
  t(`S1 ${name} one row after 3 saves`, all.length === 1);
  t(`S1 ${name} graded_at stable on identical content`, all[0].graded_at === first.graded_at, all[0].graded_at);
  const g2 = graded("a", { name: "Synthetic a pack v2" });
  await s.saveGraded("a", g2, "Alpha");
  const after = await s.loadAll();
  t(`S1 ${name} changed content replaces the row`, after.length === 1 && after[0].content_hash === contentHash(g2) && after[0].graded_at !== first.graded_at);
}
// S1b the D1 UPSERT is keyed on cluster_id and the table is not duplicated
{ const d = fakeD1(); const s = new D1GradedStore(d, now); await s.saveGraded("x", graded("x"), "X"); await s.saveGraded("x", graded("x"), "X");
  t("S1b one DB row", d.db.prepare("SELECT count(*) n FROM graded_run").get().n === 1); t("S1b UPSERT keyed on cluster_id", /ON CONFLICT\(cluster_id\)/.test(GRADED_UPSERT_SQL)); }
// S2 JSON round trip of checks (columns hold JSON text, read back deep-equal)
{ const d = fakeD1(); const s = new D1GradedStore(d, now); const g = graded("j");
  await s.saveGraded("j", g, "Jay"); const raw = d.db.prepare("SELECT * FROM graded_run WHERE cluster_id='j'").get();
  t("S2 checks column is JSON text", typeof raw.checks === "string" && Array.isArray(JSON.parse(raw.checks)) && JSON.parse(raw.checks).length === g.grade.checks.length, raw.checks.slice(0, 40));
  const back = (await s.loadAll())[0];
  t("S2 checks round trip deep equal", JSON.stringify(back.checks) === JSON.stringify(runFromGraded(g).checks));
  t("S2 shelf round trip", back.shelf.grade.pass === true && back.shelf.slug === "j" && contentHash(back.shelf) === back.content_hash);
  t("S2 content_hash is the run hash", back.content_hash === runFromGraded(g).content_hash && back.content_hash.length === 64);
  d.db.prepare("UPDATE graded_run SET checks='{not json' WHERE cluster_id='j'").run();
  const bad = (await s.loadAll())[0];
  t("S2b corrupt checks reads as empty, never a crash", Array.isArray(bad.checks) && bad.checks.length === 0);
  const e = await throws(() => buildCatalogueFromStore(s)); t("S2b corrupt checks blocks the build", e && /ungraded/.test(e), String(e)); }
// S3 persistDrained through the real drain (memory queue), cluster ids and labels bound
{ const q = new MemoryDrainQueue(rowsQ()); const store = new MemoryGradedStore(now);
  const gen = new SyntheticShelfGenerator(); const r = drainQueue(q, gen, { gradeAll }, 10);
  const saved = await persistDrained(q, store, r); const all = await store.loadAll();
  t("S3 every graded cluster persisted", saved.join() === "a,b" && all.map((x) => x.cluster_id).join() === "a,b" && all[0].label === "Alpha" && all[1].label === "Bravo", JSON.stringify(saved));
  t("S3 stored run matches runFromGraded", all.every((x, i) => x.content_hash === runFromGraded(r.graded[i]).content_hash));
  const again = await persistDrained(q, store, drainQueue(q, gen, { gradeAll }, 10));
  t("S3 re-run persists nothing", again.length === 0 && (await store.loadAll()).length === 2); }
// S3b a throwing generator persists nothing for the failed row and does not misalign the others
{ const q = new MemoryDrainQueue(rowsQ()); const store = new MemoryGradedStore(now);
  const gen = { generate: (e) => { if (e.cluster_id === "a") throw new Error("model offline"); return shelf(e.cluster_id); } };
  const r = drainQueue(q, gen, { gradeAll }, 10); const saved = await persistDrained(q, store, r);
  const all = await store.loadAll();
  t("S3b only b persisted, with b's shelf", saved.join() === "b" && all.length === 1 && all[0].cluster_id === "b" && all[0].shelf.slug === "b", JSON.stringify(saved)); }
// S4 restart persistence: save, drop every in-memory object, reopen the same db, load
{ const db = new DatabaseSync(":memory:"); const d1 = fakeD1(db); const q = new D1DrainQueue(d1);
  for (const r of rowsQ()) db.prepare("INSERT INTO generator_queue (cluster_id,label,first_seen,status) VALUES (?,?,?,?)").run(r.cluster_id, r.label, r.first_seen, r.status);
  await q.load(); const r = drainQueue(q, { generate: (e) => shelf(e.cluster_id) }, { gradeAll }, 10); await q.flush();
  await persistDrained(q, new D1GradedStore(d1, now), r);
  const restarted = new D1GradedStore({ prepare: (sql) => d1.prepare(sql) }, now); // a brand new store object over the same db
  const built = await buildCatalogueFromStore(restarted);
  t("S4 restart: load after save", (await restarted.loadAll()).length === 2 && built.published.length === 2 && built.catalogue.entries.length === 2, JSON.stringify([(await restarted.loadAll()).length, built.published.length, built.held, r.processed]));
  t("S4 restart: queue rows also persisted", db.prepare("SELECT count(*) n FROM generator_queue WHERE status='GRADED_PASS' OR status='GRADED_FAIL'").get().n === 2); }
// S4b the shipped SyntheticShelfGenerator always fails not-synthetic, so its shelves are stored, graded FAIL, and never published
{ const q = new MemoryDrainQueue(rowsQ()); const store = new MemoryGradedStore(now);
  await persistDrained(q, store, drainQueue(q, new SyntheticShelfGenerator(), { gradeAll }, 10));
  const b = await buildCatalogueFromStore(store);
  t("S4b synthetic shelves persisted but none published", (await store.loadAll()).length === 2 && b.published.length === 0 && b.held.length === 2 && b.catalogue.entries.length === 0); }
// S5 ungraded shelf blocks the build
{ const store = new MemoryGradedStore(now); await store.saveGraded("a", graded("a"), "Alpha");
  const e1 = await throws(() => buildCatalogueFromStore(store, { expectIds: ["a", "ghost"] }));
  t("S5 expected cluster with no stored run blocks", e1 && /ghost/.test(e1) && /ungraded/.test(e1), String(e1));
  // a stored row whose shelf was edited after grading (stale hash)
  const g = graded("c"); const edited = { ...g, name: "Edited after grading" };
  const bad = { loadAll: async () => [{ ...(await store.loadAll())[0], cluster_id: "c", content_hash: contentHash(g), shelf: edited }], saveGraded: async () => {} };
  const e2 = await throws(() => buildCatalogueFromStore(bad)); t("S5 stale hash blocks", e2 && /stale/.test(e2), String(e2));
  // a row with no checks at all
  const none = { loadAll: async () => [{ ...(await store.loadAll())[0], checks: [] }], saveGraded: async () => {} };
  const e3 = await throws(() => buildCatalogueFromStore(none)); t("S5 empty checks blocks", e3 && /ungraded/.test(e3), String(e3));
  // a poisoned base catalogue entry also throws via assertCatalogueAllGraded
  const base = { entries: [{ cluster_id: "z", label: "Z", content_hash: "0".repeat(64), shelf: shelf("z") }] };
  const e4 = await throws(() => buildCatalogueFromStore(store, { base })); t("S5 ungraded base entry blocks", e4 && /z/.test(e4), String(e4)); }
// S6 graded-only publishes: a failing grade is held (not published, not blocking); a passing one publishes
{ const store = new MemoryGradedStore(now);
  await store.saveGraded("ok", graded("ok"), "Fine"); await store.saveGraded("bad", graded("bad", { bluf: "" }), "Broken");
  const b = await buildCatalogueFromStore(store);
  t("S6 only the passing shelf published", b.published.map((p) => p.cluster_id).join() === "ok" && b.catalogue.entries.length === 1, JSON.stringify(b.published.map((p) => p.cluster_id)));
  t("S6 failing shelf held with reason", b.held.length === 1 && b.held[0].cluster_id === "bad" && /failed checks/.test(b.held[0].reason), JSON.stringify(b.held));
  const e = await throws(() => buildCatalogueFromStore(store, { strict: true })); t("S6 strict mode blocks on any held shelf", e && /bad/.test(e), String(e));
  t("S6 no failing shelf in catalogue", b.catalogue.entries.every((x) => x.shelf.grade.pass === true)); }
// S6b a run whose checks are all ok but whose pass flag is false is stored as pass=0 and held (the flag is not forgeable by the checks)
{ const d = fakeD1(); const store = new D1GradedStore(d, now); const g = graded("flag"); g.grade = { ...g.grade, pass: false };
  await store.saveGraded("flag", g, "Flag"); t("S6b pass column stored as 0", d.db.prepare("SELECT pass FROM graded_run WHERE cluster_id='flag'").get().pass === 0);
  const b = await buildCatalogueFromStore(store); t("S6b held, not published", b.published.length === 0 && b.held.length === 1 && /not marked pass/.test(b.held[0].reason), JSON.stringify(b.held)); }
// S7 wrong cluster_id cannot smuggle a grade onto another cluster
{ const q = new MemoryDrainQueue(rowsQ()); const store = new MemoryGradedStore(now);
  const r = drainQueue(q, new SyntheticShelfGenerator(), { gradeAll }, 10);
  await persistDrained(q, store, r); const all = await store.loadAll();
  t("S7 each stored label equals its queue label", all.every((x) => x.label === q.list().find((e) => e.cluster_id === x.cluster_id).label));
  const swapped = { processed: [{ cluster_id: "ghost", status: "GRADED_PASS", failed_checks: [], attempts: 1 }], graded: [r.graded[0]] };
  const e = await throws(() => persistDrained(q, new MemoryGradedStore(now), swapped)); t("S7 unknown cluster refused", e && /out of step/.test(e), String(e));
  const extra = { processed: r.processed, graded: [...r.graded, r.graded[0]] };
  const e2 = await throws(() => persistDrained(q, new MemoryGradedStore(now), extra)); t("S7 surplus graded shelf refused", e2 && /no GRADED outcome/.test(e2), String(e2)); }
// S8 content_hash is the actual hash (a dropped hash would store ''); stored hash differs for different shelves
{ const store = new MemoryGradedStore(now); await store.saveGraded("a", graded("a"), "A"); await store.saveGraded("b", graded("b"), "B");
  const [a, b] = await store.loadAll(); t("S8 hashes present and distinct", a.content_hash.length === 64 && b.content_hash.length === 64 && a.content_hash !== b.content_hash); }
// M migration lint: names + apply in order. 0016 f285, 0017 f301 and 0019 generator_shelves are unmerged, so labelled empty stubs stand in.
{ const { checkNames, applyAll } = await import("../portal-api/scripts/migration_lint.mjs");
  const dir = mkdtempSync(join(tmpdir(), "mig-")); const real = readdirSync(MIG);
  for (const f of real) copyFileSync(new URL(f, MIG), join(dir, f));
  for (const [n, who] of [["0016_stub_f285", "f285"], ["0017_stub_f301", "f301"], ["0019_stub_generator_shelves", "generator_shelves"]]) if (!real.some((f) => f.startsWith(n.slice(0, 4)))) writeFileSync(join(dir, n + ".sql"), "-- stub for unmerged " + who + "\n");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const names = checkNames(files, { gaps: [7], duplicates: [2, 3, 4, 5, 6, 8] }, []);
  t("M1 no name collision or gap involving 0020", !names.some((x) => x.includes("0020")) && !names.some((x) => /00(16|17|18|19)/.test(x)), names.join(" | "));
  t("M2 exactly one 0020 file", files.filter((f) => f.startsWith("0020_")).length === 1);
  const ap = applyAll(dir, files); t("M3 applies in order", ap.errs.length === 0, ap.errs.join()); }
console.log(`graded store: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
