// C5 queue drain tests. SYNTHETIC queue rows and shelves only (invented, labelled; no model call, no network).
import { drainQueue, MemoryDrainQueue, MAX_ATTEMPTS } from "../lib/shop/drain.ts";
import { gradeAll } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const row = (id, first, extra = {}) => ({ cluster_id: id, label: id, first_seen: first, status: "QUEUED_FOR_GENERATOR", ...extra });
// SYNTHETIC shelf that passes every check except not-synthetic unless told otherwise.
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const gen = (over = {}, log = []) => ({ generate: (e) => { log.push(e.cluster_id); return shelf(e.cluster_id, over); } });
const grader = { gradeAll };
const mk = () => new MemoryDrainQueue([row("c", "2026-11-03T00:00:00Z"), row("a", "2026-11-01T00:00:00Z"), row("b", "2026-11-02T00:00:00Z"), row("n", null)]);

// D1 happy path: oldest first, all graded, none published.
let q = mk(), log = [];
let r = drainQueue(q, gen({}, log), grader, 10);
t("D1 oldest first", log.join() === "a,b,c,n", log.join());
t("D1 all GRADED_PASS", r.processed.length === 4 && r.processed.every((p) => p.status === "GRADED_PASS") && q.list().every((e) => e.status === "GRADED_PASS" && e.attempts === 1), JSON.stringify(q.list()));
t("D1 returns graded shelves, queue holds no shelf", r.graded.length === 4 && q.list().every((e) => !("grade" in e) && !("bullets" in e)));
// D2 cap.
q = mk(); log = [];
r = drainQueue(q, gen({}, log), grader, 2);
t("D2 cap respected", log.join() === "a,b" && r.remaining === 2 && q.list().filter((e) => e.status === "GRADED_PASS").length === 2, log.join());
t("D2b bad cap does nothing", drainQueue(mk(), gen({}, log = []), grader, 0).processed.length === 0 && drainQueue(mk(), gen({}, log), grader, -1).processed.length === 0 && drainQueue(mk(), gen({}, log), grader, NaN).processed.length === 0 && log.length === 0);
// D3 re-run no-op.
q = mk(); drainQueue(q, gen(), grader, 10);
const snap = JSON.stringify(q.list()), w = q.writes; log = [];
const r2 = drainQueue(q, gen({}, log), grader, 10);
t("D3 re-run no-op", JSON.stringify(q.list()) === snap && q.writes === w && log.length === 0 && r2.processed.length === 0, String(log));
// D4 throw then retry.
q = new MemoryDrainQueue([row("a", "2026-11-01T00:00:00Z")]);
let boom = true;
const flaky = { generate: (e) => { if (boom) throw new Error("model offline"); return shelf(e.cluster_id); } };
r = drainQueue(q, flaky, grader);
let e0 = q.list()[0];
t("D4 throw leaves QUEUED, attempts 1, error kept", e0.status === "QUEUED_FOR_GENERATOR" && e0.attempts === 1 && e0.last_error === "model offline" && r.graded.length === 0, JSON.stringify(e0));
boom = false; r = drainQueue(q, flaky, grader); e0 = q.list()[0];
t("D4 retry grades, attempts 2, error cleared", e0.status === "GRADED_PASS" && e0.attempts === 2 && e0.last_error === null, JSON.stringify(e0));
// D5 three attempts stop at FAILED.
q = new MemoryDrainQueue([row("a", "2026-11-01T00:00:00Z")]); log = [];
const dead = { generate: (e) => { log.push(e.cluster_id); throw new Error("down"); } };
drainQueue(q, dead, grader); drainQueue(q, dead, grader);
t("D5 still QUEUED after 2", q.list()[0].status === "QUEUED_FOR_GENERATOR" && q.list()[0].attempts === 2);
drainQueue(q, dead, grader);
t("D5 FAILED at attempt " + MAX_ATTEMPTS, q.list()[0].status === "FAILED" && q.list()[0].attempts === 3, JSON.stringify(q.list()[0]));
drainQueue(q, dead, grader);
t("D5 FAILED is never retried", log.length === 3 && q.list()[0].attempts === 3);
// D6 grader fail recorded with failing check names.
q = new MemoryDrainQueue([row("a", "2026-11-01T00:00:00Z")]);
r = drainQueue(q, gen({ synthetic: true, bluf: "short" }), grader);
e0 = q.list()[0];
t("D6 GRADED_FAIL with check names", e0.status === "GRADED_FAIL" && e0.failed_checks.includes("not-synthetic") && e0.failed_checks.includes("bluf") && !e0.failed_checks.includes("slug") && r.processed[0].failed_checks.length === e0.failed_checks.length, JSON.stringify(e0));
const sf = JSON.stringify(q.list()); drainQueue(q, gen(), grader);
t("D6b GRADED_FAIL is not re-processed", JSON.stringify(q.list()) === sf);
// D7 grader failing outright (empty / throw) counts as an attempt, never a pass.
q = new MemoryDrainQueue([row("a", "2026-11-01T00:00:00Z")]);
drainQueue(q, gen(), { gradeAll: () => [] });
t("D7 empty grader result is an attempt, not a pass", q.list()[0].status === "QUEUED_FOR_GENERATOR" && q.list()[0].attempts === 1);
// D8 mixed batch: one throws, others still processed; duplicate ids processed once; only QUEUED rows touched.
q = new MemoryDrainQueue([row("a", "2026-11-01T00:00:00Z"), row("x", "2026-11-02T00:00:00Z"), row("a", "2026-11-05T00:00:00Z"), row("p", "2026-10-01T00:00:00Z", { status: "GRADED_PASS" }), row("f", "2026-10-01T00:00:00Z", { status: "FAILED", attempts: 3 })]); log = [];
const mixed = { generate: (e) => { log.push(e.cluster_id); if (e.cluster_id === "a") throw new Error("x"); return shelf(e.cluster_id); } };
drainQueue(q, mixed, grader, 10);
t("D8 isolation + dedupe + untouched terminal rows", log.join() === "a,x" && q.list().find((e) => e.cluster_id === "x").status === "GRADED_PASS" && q.list().find((e) => e.cluster_id === "p").status === "GRADED_PASS" && q.list().find((e) => e.cluster_id === "f").attempts === 3, log.join());
// D9 nothing is published: drain never returns or stores a visible flag.
t("D9 no publish surface", !("visible" in r) && !q.list().some((e) => "visible" in e || "published" in e));
console.log(`shop drain: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
