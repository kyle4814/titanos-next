// f334 C5: the Worker-hosted drain tick against a REAL SQLite D1 stand-in (real migrations 0018 + 0020) that can throw mid-batch.
// SYNTHETIC clusters, a deterministic stub generator, no model call, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { drainTickScheduled, isDrainTick, DRAIN_TICK_CRON } from "../src/shop/drain_tick_worker.ts";
import { createWorker } from "../src/index.ts";
import type { Env } from "../src/env.ts";

const shelf = (id: string, over: Record<string, unknown> = {}) => ({
  id: "generator:" + id, kind: "generator", slug: id, name: "Synthetic " + id + " pack", bluf: "A ready-made synthetic pack for " + id + " businesses, built from a labelled fixture.",
  bullets: ["Fixture-proven step"], faq: [{ q: "Is this real?", a: "No, it is a labelled synthetic test shelf." }], priceAud: null, cadence: "quote", priceLabel: "QUOTE",
  status: "READY", availability: "QUOTE", buyUrl: null, href: "/shop/" + id, source: "synthetic-test", synthetic: false, proof: { fixture: "fx", passed: true }, tags: [], ...over,
});
function gen(calls = { n: 0 }, bad = new Set<string>()) {
  return { calls, port: { async generate(e: { cluster_id: string }) { calls.n++; return { shelf: (bad.has(e.cluster_id) ? shelf(e.cluster_id, { bluf: "", bullets: [], faq: [] }) : shelf(e.cluster_id)) as never, cost: 1 }; } } };
}
function seed(d1: FakeD1, n: number) {
  for (let i = 0; i < n; i++) d1.db.prepare("INSERT INTO generator_queue (cluster_id,label,first_seen,status,attempts,failed_checks,last_error) VALUES (?,?,?,?,?,?,?)")
    .run("c" + String(i).padStart(4, "0"), "Cluster " + i, "2026-11-01T00:00:" + String(i % 60).padStart(2, "0") + "Z", "QUEUED_FOR_GENERATOR", 0, "[]", null);
}
const statuses = (d1: FakeD1) => d1.db.prepare("SELECT status, COUNT(*) n FROM generator_queue GROUP BY status ORDER BY status").all().map((r: any) => r.status + ":" + r.n).join(",");
const graded = (d1: FakeD1) => Number((d1.db.prepare("SELECT COUNT(*) n FROM graded_run").get() as any).n);
// A D1 wrapper that throws on the Nth write (run) or on any call once armed. Reads are never the one that throws unless failOn says "all".
function flaky(d1: FakeD1, o: { failWriteAt?: number; failLoad?: boolean } = {}) {
  let writes = 0;
  return { prepare(sql: string) {
    const st: any = d1.prepare(sql);
    if (/^SELECT/i.test(sql) && o.failLoad) return { bind: () => ({}), all: async () => { throw new Error("D1 down (load)"); } } as any;
    if (/^INSERT/i.test(sql) && o.failWriteAt !== undefined) {
      const run = st.run.bind(st); const bind = st.bind.bind(st);
      st.bind = (...a: unknown[]) => { bind(...a); return st; };
      st.run = async () => { writes++; if (writes === o.failWriteAt) throw new Error("D1 write boom #" + writes); return run(); };
    }
    return st;
  } } as any;
}
const env = (d1: unknown, on = "1"): Env => ({ DB: d1 as never, DRAIN_TICK_ENABLED: on });
const quiet = () => { const lines: string[] = []; return { lines, log: (l: string) => lines.push(l) }; };

test("W1 default OFF: no flag, flag 0, flag true all do nothing and touch no D1", async () => {
  const d1 = new FakeD1(); seed(d1, 3); const g = gen();
  for (const v of [undefined, "0", "true", ""]) {
    const r = await drainTickScheduled({ cron: DRAIN_TICK_CRON }, { DB: d1 as never, ...(v === undefined ? {} : { DRAIN_TICK_ENABLED: v }) }, { buildGenerator: () => g.port });
    assert.equal(r.reason, "DISABLED"); assert.equal(r.ran, false);
  }
  assert.equal(g.calls.n, 0); assert.equal(d1.log.length, 0);
});
test("W2 enabled but no generator wired / no DB: no-op, no D1 write", async () => {
  const d1 = new FakeD1(); seed(d1, 2);
  assert.equal((await drainTickScheduled({}, env(d1))).reason, "NO_GENERATOR");
  assert.equal((await drainTickScheduled({}, env(d1), { buildGenerator: () => null })).reason, "NO_GENERATOR");
  const q = quiet(); const r = await drainTickScheduled({}, { DRAIN_TICK_ENABLED: "1" }, { buildGenerator: () => gen().port, log: q.log });
  assert.equal(r.reason, "NO_DB"); assert.equal(r.ok, false);
  assert.equal(d1.log.filter((l) => /^INSERT/.test(l.sql)).length, 0);
  assert.equal(statuses(d1), "QUEUED_FOR_GENERATOR:2");
});
test("W3 happy path through real SQL: passes land in graded_run, fails never do, queue leaves QUEUED", async () => {
  const d1 = new FakeD1(); seed(d1, 4); const g = gen({ n: 0 }, new Set(["c0001"])); const q = quiet();
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, log: q.log, now: () => 0 });
  assert.equal(r.ok, true); assert.equal(r.reason, "OK");
  assert.equal(statuses(d1), "GRADED_FAIL:1,GRADED_PASS:3"); assert.equal(graded(d1), 3);
  assert.equal(d1.db.prepare("SELECT 1 FROM graded_run WHERE cluster_id='c0001'").get(), undefined);
});
test("W4 idempotent: a second tick on the same D1 generates and writes nothing", async () => {
  const d1 = new FakeD1(); seed(d1, 5); const g = gen();
  await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, log: quiet().log });
  const before = g.calls.n, w = d1.log.filter((l) => /^INSERT/.test(l.sql)).length;
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, log: quiet().log });
  assert.equal(r.report!.drained, 0); assert.equal(g.calls.n, before);
  assert.equal(d1.log.filter((l) => /^INSERT/.test(l.sql)).length, w);
});
test("W5 per-run item cap respected, remainder drains on later ticks", async () => {
  const d1 = new FakeD1(); seed(d1, 12); const g = gen();
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, maxItems: 5, budget: 100, log: quiet().log });
  assert.equal(r.report!.stop, "MAX_ITEMS"); assert.equal(g.calls.n, 5); assert.equal(graded(d1), 5);
  await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, maxItems: 5, budget: 100, log: quiet().log });
  await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, maxItems: 5, budget: 100, log: quiet().log });
  assert.equal(graded(d1), 12); assert.equal(g.calls.n, 12);
});
test("W6 cost budget respected", async () => {
  const d1 = new FakeD1(); seed(d1, 12); const g = gen();
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, maxItems: 100, budget: 3, log: quiet().log });
  assert.equal(r.report!.stop, "BUDGET"); assert.equal(g.calls.n, 3);
});
test("W7 wall-clock budget respected (injected clock advances 10 ms per read)", async () => {
  const d1 = new FakeD1(); seed(d1, 12); const g = gen(); let t = 0;
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, maxItems: 100, budget: 100, maxMs: 25, now: () => (t += 10), log: quiet().log });
  assert.equal(r.report!.stop, "CLOCK"); assert.ok(g.calls.n >= 1 && g.calls.n < 12, "calls " + g.calls.n);
});
test("W8 D1 error on LOAD: fails closed, nothing written, error reported not thrown", async () => {
  const d1 = new FakeD1(); seed(d1, 3); const g = gen(); const q = quiet();
  const r = await drainTickScheduled({}, env(flaky(d1, { failLoad: true })), { buildGenerator: () => g.port, log: q.log });
  assert.equal(r.ok, false); assert.equal(r.reason, "D1_ERROR"); assert.match(r.error!, /D1 down/);
  assert.equal(g.calls.n, 0); assert.equal(graded(d1), 0); assert.equal(statuses(d1), "QUEUED_FOR_GENERATOR:3");
  assert.ok(q.lines.some((l) => l.includes("d1_error")));
});
test("W9 D1 write throws mid-batch: earlier items stay committed, failing item stays QUEUED, no partial grade, next tick finishes with no double grade", async () => {
  const d1 = new FakeD1(); seed(d1, 6); const g = gen();
  // writes per item: graded_run upsert, then generator_queue upsert. Write #5 = the graded_run save of the 3rd item.
  const r = await drainTickScheduled({}, env(flaky(d1, { failWriteAt: 5 })), { buildGenerator: () => g.port, log: quiet().log });
  assert.equal(r.ok, false); assert.equal(r.reason, "D1_ERROR"); assert.equal(r.report!.errors.length, 1);
  assert.equal(statuses(d1), "GRADED_PASS:2,QUEUED_FOR_GENERATOR:4"); assert.equal(graded(d1), 2);
  const r2 = await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, log: quiet().log });
  assert.equal(r2.ok, true); assert.equal(statuses(d1), "GRADED_PASS:6"); assert.equal(graded(d1), 6);
  assert.equal(Number((d1.db.prepare("SELECT COUNT(DISTINCT cluster_id) n FROM graded_run").get() as any).n), 6);
});
test("W10 queue flush fails AFTER the graded save: retry re-saves the same content (upsert), still one row, graded_at not rewritten", async () => {
  const d1 = new FakeD1(); seed(d1, 2); const g = gen(); let t = Date.UTC(2026, 10, 9);
  const r = await drainTickScheduled({}, env(flaky(d1, { failWriteAt: 2 })), { buildGenerator: () => g.port, log: quiet().log, now: () => (t += 1000) });
  assert.equal(r.ok, false); assert.equal(graded(d1), 1); assert.equal(statuses(d1), "QUEUED_FOR_GENERATOR:2");
  const first = (d1.db.prepare("SELECT graded_at FROM graded_run WHERE cluster_id='c0000'").get() as any).graded_at;
  await drainTickScheduled({}, env(d1), { buildGenerator: () => g.port, log: quiet().log, now: () => (t += 1000) });
  assert.equal(graded(d1), 2); assert.equal(statuses(d1), "GRADED_PASS:2");
  assert.equal((d1.db.prepare("SELECT graded_at FROM graded_run WHERE cluster_id='c0000'").get() as any).graded_at, first); // same content re-graded on retry = no new grade
});
test("W11 generator throwing is counted per item, not a tick abort; a generator build error is reported", async () => {
  const d1 = new FakeD1(); seed(d1, 3);
  const r = await drainTickScheduled({}, env(d1), { buildGenerator: () => ({ async generate(e: { cluster_id: string }) { if (e.cluster_id === "c0001") throw new Error("gen boom"); return { shelf: shelf(e.cluster_id) as never, cost: 1 }; } }), log: quiet().log });
  assert.equal(r.ok, false); assert.equal(r.report!.errors.length, 1); assert.equal(graded(d1), 2);
  assert.equal((d1.db.prepare("SELECT attempts FROM generator_queue WHERE cluster_id='c0001'").get() as any).attempts, 1);
  const r2 = await drainTickScheduled({}, env(d1), { buildGenerator: () => { throw new Error("no key"); }, log: quiet().log });
  assert.equal(r2.reason, "NO_GENERATOR"); assert.equal(r2.ok, false);
});
test("W12 no network: fetch is never called by a tick", async () => {
  const d1 = new FakeD1(); seed(d1, 3); const orig = globalThis.fetch; let hits = 0;
  globalThis.fetch = (async () => { hits++; throw new Error("network forbidden"); }) as never;
  try { await drainTickScheduled({}, env(d1), { buildGenerator: () => gen().port, log: quiet().log }); } finally { globalThis.fetch = orig; }
  assert.equal(hits, 0);
});
test("W13 Worker routing: the drain cron reaches the drain tick; any other cron goes to the monitor handler and never the generator", async () => {
  const d1 = new FakeD1(); seed(d1, 2); const g = gen(); const logs: string[] = [];
  const w = createWorker({ buildDeps: () => undefined, drainTick: { buildGenerator: () => g.port, log: (l) => logs.push(l) } });
  assert.equal(isDrainTick({ cron: DRAIN_TICK_CRON }), true); assert.equal(isDrainTick({ cron: "0 * * * *" }), false);
  const seen: string[] = []; const orig = console.log; console.log = (...a: unknown[]) => { seen.push(a.join(" ")); };
  try { await w.scheduled({ cron: "0 * * * *" }, env(d1)); } finally { console.log = orig; }
  assert.equal(g.calls.n, 0); assert.equal(graded(d1), 0);
  assert.ok(seen.some((l) => l.includes("monitor-cron")), "monitor handler ran");
  await w.scheduled({ cron: DRAIN_TICK_CRON }, env(d1));
  assert.equal(g.calls.n, 2); assert.equal(graded(d1), 2);
});
