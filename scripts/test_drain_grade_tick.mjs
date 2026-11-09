// C5 drain->grade tick tests. SYNTHETIC clusters and a deterministic stub generator only (labelled). No model, no network, no clock.
import { MemoryDrainQueue } from "../lib/shop/drain.ts";
import { gradeAll } from "../lib/shop/grader.ts";
import { MemoryGradedStore } from "../lib/shop/graded_store.ts";
import { runDrainGradeTick, scheduled } from "../lib/shop/drain_grade_tick.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const shelf = (id, over = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
const rows = (n, p = "c") => Array.from({ length: n }, (_, i) => ({ cluster_id: p + String(i).padStart(4, "0"), label: "Cluster " + i, first_seen: "2026-11-01T00:00:" + String(i % 60).padStart(2, "0") + "Z", status: "QUEUED_FOR_GENERATOR" }));
const stub = (badSet = new Set(), calls = { n: 0 }, throwSet = new Set()) => ({ calls, async generate(e) {
  calls.n++; if (throwSet.has(e.cluster_id)) throw new Error("gen boom " + e.cluster_id);
  return { shelf: badSet.has(e.cluster_id) ? shelf(e.cluster_id, { bluf: "" , bullets: [], faq: [] }) : shelf(e.cluster_id), cost: 1 }; } });
const grader = { gradeAll };
const mk = (rs, gen, store = new MemoryGradedStore(), extra = {}) => ({ queue: new MemoryDrainQueue(rs), generator: gen, grader, store, ...extra });
const throws = async (f) => { try { await f(); return null; } catch (e) { return e; } };

// premise: the "bad" stub shelf really grades FAIL, the good one PASS
t("T0 good shelf grades pass", gradeAll([shelf("g")])[0].grade.pass === true);
t("T0 bad shelf grades fail", gradeAll([shelf("b", { bluf: "", bullets: [], faq: [] })])[0].grade.pass === false);

// T1 1000 clusters, 10% bad, ticks until drained: 0 ungraded saved, failing never stored
{ const rs = rows(1000); const bad = new Set(rs.filter((_, i) => i % 10 === 3).map((r) => r.cluster_id));
  const p = mk(rs, stub(bad)); let saved = 0, failed = 0, ticks = 0;
  for (; ticks < 100; ticks++) { const r = await runDrainGradeTick(p, { maxItems: 20, budget: 1000 }); saved += r.saved.length; failed += r.failed.length; if (r.drained === 0) break; }
  const all = await p.store.loadAll();
  t("T1 all 1000 drained", saved + failed === 1000, saved + "+" + failed);
  t("T1 saved = passing only", all.length === 900 && saved === 900);
  t("T1 0 ungraded saved", all.every((s) => s.pass === true && s.shelf.grade.pass === true && !bad.has(s.cluster_id)));
  t("T1 failing recorded GRADED_FAIL", p.queue.rows.filter((r) => r.status === "GRADED_FAIL").length === 100 && p.queue.rows.every((r) => r.status !== "QUEUED_FOR_GENERATOR"));
  t("T1 50 ticks of 20", ticks === 50, String(ticks)); }

// T2 idempotency: re-run on a drained queue = 0 generator calls, 0 store writes, 0 queue writes
{ const calls = { n: 0 }; const p = mk(rows(30), stub(new Set(), calls)); await runDrainGradeTick(p, { maxItems: 100, budget: 100 });
  const w = [p.store.writes, p.queue.writes, calls.n]; const r = await runDrainGradeTick(p, { maxItems: 100, budget: 100 });
  t("T2 rerun writes nothing", p.store.writes === w[0] && p.queue.writes === w[1] && calls.n === w[2] && r.drained === 0 && r.saved.length === 0 && r.skipped === 0); }

// T3 crash mid-batch: store throws on the 4th save; first 3 intact, 4th stays queued, 5th untouched; re-run finishes with no duplicates
{ const store = new MemoryGradedStore(); const orig = store.saveGraded.bind(store); let n = 0; let boom = true;
  store.saveGraded = async (...a) => { if (boom && ++n === 4) throw new Error("d1 down"); return orig(...a); };
  const p = mk(rows(8), stub(), store); const e = await throws(() => runDrainGradeTick(p, { maxItems: 8, budget: 8 }));
  t("T3 tick threw", e && /aborted/.test(e.message) && e.report.errors.length === 1);
  t("T3 earlier 3 intact", (await store.loadAll()).length === 3 && p.queue.rows.filter((r) => r.status === "GRADED_PASS").length === 3);
  t("T3 failed item still queued, rest untouched", p.queue.rows.filter((r) => r.status === "QUEUED_FOR_GENERATOR").length === 5);
  t("T3 no partial shelf", (await store.loadAll()).every((s) => s.shelf && s.shelf.grade && s.shelf.grade.pass === true));
  boom = false; await runDrainGradeTick(p, { maxItems: 8, budget: 8 });
  t("T3 retry completes, 8 rows no dupes", (await store.loadAll()).length === 8); }

// T4 caps honoured
{ const calls = { n: 0 }; let r = await runDrainGradeTick(mk(rows(50), stub(new Set(), calls)), { maxItems: 7, budget: 100 });
  t("T4 maxItems", r.drained === 7 && calls.n === 7 && r.skipped === 43 && r.stop === "MAX_ITEMS");
  const c2 = { n: 0 }; r = await runDrainGradeTick(mk(rows(50), stub(new Set(), c2)), { budget: 5, maxItems: 50 });
  t("T4 budget", r.drained === 5 && c2.n === 5 && r.stop === "BUDGET" && r.spent === 5);
  const c3 = { n: 0 }; let clk = 0; r = await runDrainGradeTick(mk(rows(50), stub(new Set(), c3), undefined, { now: () => (clk += 100) }), { maxMs: 350, maxItems: 50, budget: 50 });
  t("T4 wall clock", r.stop === "CLOCK" && c3.n === 3 && r.skipped === 47, JSON.stringify(r));
  const c4 = { n: 0 }; r = await runDrainGradeTick(mk(rows(50), stub(new Set(), c4)), { budget: 1000 });
  t("T4 default cap 20", r.drained === 20 && c4.n === 20);
  const c5 = { n: 0 }; r = await runDrainGradeTick(mk(rows(5), stub(new Set(), c5)), { maxItems: 0 });
  t("T4 maxItems 0 = no work", c5.n === 0 && r.drained === 0); }

// T5 disabled = 0 calls (also: absent flag, "true", "0"), enabled but no builder = no-op
{ let built = 0; const build = () => { built++; return mk(rows(3), stub()); };
  for (const env of [{}, { DRAIN_TICK_ENABLED: "0" }, { DRAIN_TICK_ENABLED: "true" }, { DRAIN_TICK_ENABLED: "" }]) { const r = await scheduled({}, env, build); t("T5 disabled " + JSON.stringify(env), r.ran === false && r.reason === "DISABLED"); }
  t("T5 disabled never builds ports", built === 0);
  const nb = await scheduled({}, { DRAIN_TICK_ENABLED: "1" }); t("T5 enabled without generator is a no-op", nb.ran === false && nb.reason === "NO_GENERATOR");
  const on = await scheduled({}, { DRAIN_TICK_ENABLED: "1" }, build); t("T5 enabled runs", on.ran === true && on.report.saved.length === 3 && built === 1); }

// T6 generator error is surfaced, counted, attempts capped to FAILED, others unaffected
{ const p = mk(rows(4), stub(new Set(), { n: 0 }, new Set(["c0001"])));
  let r = await runDrainGradeTick(p, { budget: 50 });
  t("T6 error reported", r.errors.length === 1 && r.errors[0].cluster_id === "c0001" && /gen boom/.test(r.errors[0].message) && r.saved.length === 3);
  const row = () => p.queue.rows.find((x) => x.cluster_id === "c0001");
  t("T6 attempt counted, still queued", row().attempts === 1 && row().status === "QUEUED_FOR_GENERATOR" && /gen boom/.test(row().last_error));
  await runDrainGradeTick(p, { budget: 50 }); await runDrainGradeTick(p, { budget: 50 });
  t("T6 FAILED after 3 attempts", row().status === "FAILED" && row().attempts === 3);
  r = await runDrainGradeTick(p, { budget: 50 }); t("T6 FAILED row not retried", r.drained === 0); }

// T7 grader returning nothing is an error not a save; duplicate cluster ids drained once; load/flush used when present
{ const p = mk(rows(2), stub()); p.grader = { gradeAll: () => [] }; const r = await runDrainGradeTick(p);
  t("T7 no-grade is error, nothing saved", r.errors.length === 2 && r.saved.length === 0 && (await p.store.loadAll()).length === 0);
  const dup = [...rows(2), ...rows(2)]; const c = { n: 0 }; const r2 = await runDrainGradeTick(mk(dup, stub(new Set(), c)));
  t("T7 duplicate ids drained once", c.n === 2 && r2.saved.length === 2);
  let loads = 0, flushes = 0; const q = new MemoryDrainQueue(rows(3)); q.load = async () => { loads++; }; q.flush = async () => { flushes++; };
  await runDrainGradeTick({ queue: q, generator: stub(), grader, store: new MemoryGradedStore() });
  t("T7 load once, flush per item", loads === 1 && flushes === 3, loads + "/" + flushes); }

console.log(`drain_grade_tick: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
