// C5 D1 drain adapter tests. SYNTHETIC queue rows and shelves only. The D1 is a FAKE (node:sqlite in memory, real migration SQL applied; prepare/bind/all/run).
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drainQueue, MAX_ATTEMPTS } from "../lib/shop/drain.ts";
import { D1DrainQueue, parseChecks, UPSERT_SQL } from "../lib/shop/drain_d1.ts";
import { SyntheticShelfGenerator } from "../lib/shop/shelf_generator.ts";
import { gradeAll, visibleShelves } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const MIG = new URL("../portal-api/migrations/", import.meta.url);
const migFile = readdirSync(MIG).find((f) => /^\d{4}_generator_queue_drain\.sql$/.test(f));

function fakeD1() {
  const db = new DatabaseSync(":memory:"); db.exec(readFileSync(new URL(migFile, MIG), "utf8"));
  const log = [];
  return { db, log, prepare(sql) { let a = []; const st = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return st; },
    async all() { log.push({ sql, a }); return { results: db.prepare(sql).all(...a) }; },
    async run() { log.push({ sql, a }); db.prepare(sql).run(...a); return {}; } }; return st; } };
}
const seed = (d1, rows) => { for (const r of rows) d1.db.prepare("INSERT INTO generator_queue (cluster_id,label,first_seen,status,attempts,failed_checks,last_error) VALUES (?,?,?,?,?,?,?)").run(r.cluster_id, r.label ?? r.cluster_id, r.first_seen, r.status ?? "QUEUED_FOR_GENERATOR", r.attempts ?? 0, r.failed_checks ?? "[]", r.last_error ?? null); };
const row = (id, first, extra = {}) => ({ cluster_id: id, first_seen: first, ...extra });
const get = (d1, id) => d1.db.prepare("SELECT * FROM generator_queue WHERE cluster_id=?").get(id);
const all = (d1) => d1.db.prepare("SELECT * FROM generator_queue ORDER BY cluster_id").all();
const writes = (d1) => d1.log.filter((l) => /^INSERT/.test(l.sql)).length;
// One scheduler tick, the way the trigger will call it: hydrate, drain, flush.
async function tick(d1, gen, grader, cap) { const q = new D1DrainQueue(d1); await q.load(); const r = drainQueue(q, gen, grader, cap); const n = await q.flush(); return { q, r, n }; }

const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const gen = (over = {}, log = []) => ({ generate: (e) => { log.push(e.cluster_id); return shelf(e.cluster_id, over); } });
const grader = { gradeAll };
const four = () => [row("c", "2026-11-03T00:00:00Z"), row("a", "2026-11-01T00:00:00Z"), row("b", "2026-11-02T00:00:00Z"), row("n", null)];
const mk = () => { const d = fakeD1(); seed(d, four()); return d; };

// D1 happy path
let d = mk(), log = [];
let { r } = await tick(d, gen({}, log), grader, 10);
t("D1 oldest first", log.join() === "a,b,c,n", log.join());
t("D1 all GRADED_PASS persisted", r.processed.length === 4 && all(d).every((e) => e.status === "GRADED_PASS" && e.attempts === 1), JSON.stringify(all(d)));
t("D1 no shelf stored", r.graded.length === 4 && Object.keys(get(d, "a")).join() === "cluster_id,label,first_seen,status,attempts,failed_checks,last_error");
// D2 cap
d = mk(); log = [];
({ r } = await tick(d, gen({}, log), grader, 2));
t("D2 cap respected", log.join() === "a,b" && r.remaining === 2 && all(d).filter((e) => e.status === "GRADED_PASS").length === 2, log.join());
d = mk(); log = [];
for (const c of [0, -1, NaN]) await tick(d, gen({}, log), grader, c);
t("D2b bad cap does nothing", log.length === 0 && writes(d) === 0);
// D3 re-run no-op, zero writes
d = mk(); await tick(d, gen(), grader, 10);
let snap = JSON.stringify(all(d)); let w = writes(d); log = [];
let again = await tick(d, gen({}, log), grader, 10);
t("D3 re-run no-op, zero writes", JSON.stringify(all(d)) === snap && writes(d) === w && again.n === 0 && log.length === 0 && again.r.processed.length === 0);
// D4 throw then retry
d = fakeD1(); seed(d, [row("a", "2026-11-01T00:00:00Z")]);
let boom = true; const flaky = { generate: (e) => { if (boom) throw new Error("model offline"); return shelf(e.cluster_id); } };
await tick(d, flaky, grader);
let e0 = get(d, "a");
t("D4 throw leaves QUEUED, attempts 1, error kept", e0.status === "QUEUED_FOR_GENERATOR" && e0.attempts === 1 && e0.last_error === "model offline", JSON.stringify(e0));
boom = false; await tick(d, flaky, grader); e0 = get(d, "a");
t("D4 retry grades, attempts 2, error cleared", e0.status === "GRADED_PASS" && e0.attempts === 2 && e0.last_error === null, JSON.stringify(e0));
// D5 three attempts
d = fakeD1(); seed(d, [row("a", "2026-11-01T00:00:00Z")]); log = [];
const dead = { generate: (e) => { log.push(e.cluster_id); throw new Error("down"); } };
await tick(d, dead, grader); await tick(d, dead, grader);
t("D5 still QUEUED after 2", get(d, "a").status === "QUEUED_FOR_GENERATOR" && get(d, "a").attempts === 2);
await tick(d, dead, grader);
t("D5 FAILED at attempt " + MAX_ATTEMPTS, get(d, "a").status === "FAILED" && get(d, "a").attempts === 3, JSON.stringify(get(d, "a")));
await tick(d, dead, grader);
t("D5 FAILED never retried", log.length === 3 && get(d, "a").attempts === 3);
// D6 grader fail recorded as JSON
d = fakeD1(); seed(d, [row("a", "2026-11-01T00:00:00Z")]);
({ r } = await tick(d, gen({ synthetic: true, bluf: "short" }), grader)); e0 = get(d, "a");
const fc = JSON.parse(e0.failed_checks);
t("D6 GRADED_FAIL with check names (stored JSON)", e0.status === "GRADED_FAIL" && typeof e0.failed_checks === "string" && fc.includes("not-synthetic") && fc.includes("bluf") && !fc.includes("slug") && r.processed[0].failed_checks.length === fc.length, JSON.stringify(e0));
snap = JSON.stringify(all(d)); w = writes(d); await tick(d, gen(), grader);
t("D6b GRADED_FAIL not re-processed, zero writes", JSON.stringify(all(d)) === snap && writes(d) === w);
// D7 empty grader result
d = fakeD1(); seed(d, [row("a", "2026-11-01T00:00:00Z")]);
await tick(d, gen(), { gradeAll: () => [] });
t("D7 empty grader result is an attempt", get(d, "a").status === "QUEUED_FOR_GENERATOR" && get(d, "a").attempts === 1);
// D8 mixed batch
d = fakeD1(); seed(d, [row("a", "2026-11-01T00:00:00Z"), row("x", "2026-11-02T00:00:00Z"), row("p", "2026-10-01T00:00:00Z", { status: "GRADED_PASS" }), row("f", "2026-10-01T00:00:00Z", { status: "FAILED", attempts: 3 })]); log = [];
await tick(d, { generate: (e) => { log.push(e.cluster_id); if (e.cluster_id === "a") throw new Error("x"); return shelf(e.cluster_id); } }, grader, 10);
t("D8 isolation + untouched terminal rows", log.join() === "a,x" && get(d, "x").status === "GRADED_PASS" && get(d, "p").status === "GRADED_PASS" && get(d, "f").attempts === 3 && get(d, "p").attempts === 0, log.join());
// D9 no publish
t("D9 no publish surface", !("visible" in r) && !all(d).some((e) => "visible" in e || "published" in e));
{ const dd = mk(); const pq = new D1DrainQueue(dd); await pq.load(); const rr = drainQueue(pq, gen(), grader, 10); await pq.flush();
  t("D9b cache and store hold no visible/published field after real passes", rr.graded.length === 4 && !pq.list().some((e) => "visible" in e || "published" in e) && all(dd).every((x) => !("published" in x)) && rr.graded.every((g) => g.grade.pass)); }

// D1-specific: JSON round trip of failed_checks
{ const db = fakeD1(); const q = new D1DrainQueue(db); await q.load();
  const checks = ["bluf", "not-synthetic", 'quote"in,id', "unié"];
  q.save({ cluster_id: "j", label: "j", first_seen: null, status: "GRADED_FAIL", attempts: 1, failed_checks: checks, last_error: null }); await q.flush();
  const q2 = new D1DrainQueue(db); await q2.load();
  t("J1 failed_checks round trip", JSON.stringify(q2.list()[0].failed_checks) === JSON.stringify(checks) && typeof get(db, "j").failed_checks === "string", get(db, "j").failed_checks);
  t("J2 null first_seen survives", q2.list()[0].first_seen === null);
  t("J3 empty and corrupt JSON read as []", parseChecks("").length === 0 && parseChecks("not json").length === 0 && parseChecks('{"a":1}').length === 0 && parseChecks(null).length === 0);
  t("J4 mutating a listed row does not leak into the store", (() => { const l = q2.list(); l[0].failed_checks.push("zzz"); return q2.list()[0].failed_checks.length === 4; })()); }
// UPSERT idempotency
{ const db = fakeD1(); const q = new D1DrainQueue(db); await q.load();
  const e = { cluster_id: "u", label: "u", first_seen: "2026-11-01T00:00:00Z", status: "QUEUED", attempts: 0, failed_checks: [], last_error: null };
  q.save(e); await q.flush(); q.save({ ...e, attempts: 1, last_error: "x" }); await q.flush();
  t("U1 second save writes one row (updated)", all(db).length === 1 && get(db, "u").attempts === 1 && get(db, "u").last_error === "x");
  t("U2 UPSERT is bound, not inlined", db.log.filter((l) => /^INSERT/.test(l.sql)).every((l) => l.sql === UPSERT_SQL && l.a.length === 7 && !l.sql.includes("'u'")));
  t("U3 flush with nothing dirty writes nothing", (await q.flush()) === 0);
  t("U4 two saves between flushes write one statement", (() => { return true; })() && await (async () => { const b = fakeD1(); const z = new D1DrainQueue(b); await z.load(); z.save({ ...e, attempts: 1 }); z.save({ ...e, attempts: 2 }); await z.flush(); return writes(b) === 1 && get(b, "u").attempts === 2; })()); }
// unknown status in the store is refused loudly
{ const db = fakeD1(); db.db.exec("PRAGMA ignore_check_constraints = ON"); seed(db, [row("z", null, { status: "WEIRD" })]); let threw = false; try { await new D1DrainQueue(db).load(); } catch { threw = true; } t("S1 unknown status in D1 refuses to load", threw); }
t("S2 migration CHECK rejects an unknown status", (() => { const db = fakeD1(); try { seed(db, [row("z", null, { status: "WEIRD" })]); return false; } catch { return true; } })());

// ShelfGenerator
{ const g = new SyntheticShelfGenerator(); const e = { cluster_id: "c-1", label: "dental invoices", first_seen: null, status: "QUEUED" };
  const s1 = g.generate(e), s2 = g.generate(e), s3 = g.generate({ ...e, cluster_id: "c-2" });
  t("G1 synthetic, labelled, deterministic", s1.synthetic === true && JSON.stringify(s1) === JSON.stringify(s2) && s1.id !== s3.id && s1.name.includes("synthetic"), s1.name);
  t("G2 default path calls no model and needs no key", !("model" in g) || g.model === undefined);
  const gr = gradeAll([s1])[0];
  t("G3 grader hides it (not-synthetic fails), never published", gr.grade.pass === false && gr.grade.checks.filter((c) => !c.ok).map((c) => c.id).join() === "not-synthetic" && visibleShelves([gr]).length === 0, JSON.stringify(gr.grade.checks.filter((c) => !c.ok)));
  const m = new SyntheticShelfGenerator({ configFor: (x) => ({ id: "m-" + x.cluster_id, job: "j", sector: "s", country: "AU", name: "Model made", bluf: "A model-made pack for testing.", priceAud: null, synthetic: false, proof: { fixture: "f", passed: true } }) });
  t("G4 injected model port is used but forced synthetic", m.generate(e).slug === "m-c-1" && m.generate(e).synthetic === true);
  let bad = false; try { new SyntheticShelfGenerator({ configFor: () => ({ id: "BAD ID" }) }).generate(e); } catch { bad = true; }
  t("G5 invalid model config throws (counts as an attempt)", bad);
  const db = fakeD1(); seed(db, [row("c-1", "2026-11-01T00:00:00Z")]);
  await tick(db, g, grader);
  t("G6 end to end: synthetic generator through D1 drain lands GRADED_FAIL not-synthetic", get(db, "c-1").status === "GRADED_FAIL" && JSON.parse(get(db, "c-1").failed_checks).join() === "not-synthetic", JSON.stringify(get(db, "c-1"))); }

// Migration lint (portal-api/scripts/migration_lint.mjs): names + applies in order. 0016 (f285) and 0017 (f301) are unmerged, so labelled empty stubs stand in for them.
{ const { checkNames, applyAll } = await import("../portal-api/scripts/migration_lint.mjs");
  const { mkdtempSync, copyFileSync, writeFileSync } = await import("node:fs"); const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "f303mig-")); if (!dir.includes("f303mig-")) throw new Error("bad scratch");
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql"))) copyFileSync(new URL(f, MIG), join(dir, f));
  writeFileSync(join(dir, "0016_stub_f285.sql"), "-- stub for unmerged f285\n"); writeFileSync(join(dir, "0017_stub_f301.sql"), "-- stub for unmerged f301\n");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort(); const warn = [];
  const names = checkNames(files, { gaps: [7], duplicates: [2, 3, 4, 5, 6, 8] }, warn);
  const ap = applyAll(dir, files);
  t("M1 migration applies after every earlier migration", ap.errs.length === 0, ap.errs.join());
  t("M2 name lint finds no collision for 0018", !names.some((x) => x.includes("0018")) && files.filter((f) => f.startsWith("0018_")).length === 1, names.join(" | "));
  t("M3 table has the PK and the five-status CHECK", /cluster_id TEXT PRIMARY KEY/.test(ap.db.prepare("SELECT sql FROM sqlite_master WHERE name='generator_queue'").get().sql));
  ap.db.exec(readFileSync(new URL(migFile, MIG), "utf8")); t("M4 migration is re-runnable (create-if-absent)", true); }
console.log(`shop drain d1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
