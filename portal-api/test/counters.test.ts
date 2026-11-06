// SYNTHETIC data throughout: invented counts, no real scans.
import test from "node:test";
import assert from "node:assert/strict";
import { D1CounterStore, HOUR_MS, MemoryCounterStore, EVENT_SCAN, EVENT_GET_FIXED, COUNTER_MINUTES } from "../src/counters/store.ts";
import { handRaiseRate, hoursLedger } from "../src/counters/tally.ts";
import { readSiteTally } from "../src/counters/read.ts";

const T0 = 1_800_000_000_000 - (1_800_000_000_000 % HOUR_MS); // an hour boundary

test("counts: increment returns running total, read matches, names are independent", async () => {
  const s = new MemoryCounterStore(() => T0);
  assert.equal(await s.read("a"), 0);
  assert.equal(await s.increment("a"), 1);
  assert.equal(await s.increment("a", 4), 5);
  assert.equal(await s.increment("b"), 1);
  assert.equal(await s.read("a"), 5);
});
test("rejects bad increments", async () => {
  const s = new MemoryCounterStore();
  for (const by of [0, -1, 1.5, NaN]) await assert.rejects(() => s.increment("a", by), RangeError);
});
test("window rollover: hour boundary splits buckets; window is [from,to)", async () => {
  const s = new MemoryCounterStore();
  await s.increment("a", 1, T0 + HOUR_MS - 1);   // last ms of hour 0
  await s.increment("a", 2, T0 + HOUR_MS);       // first ms of hour 1
  await s.increment("a", 4, T0 + 2 * HOUR_MS);   // hour 2
  assert.equal(await s.window("a", T0, T0 + HOUR_MS), 1);
  assert.equal(await s.window("a", T0 + HOUR_MS, T0 + 2 * HOUR_MS), 2);
  assert.equal(await s.window("a", T0, T0 + 3 * HOUR_MS), 7);
  assert.equal(await s.window("a", T0 + 5 * HOUR_MS, T0 + 6 * HOUR_MS), 0);
  assert.equal(await s.window("a", T0 + HOUR_MS, T0 + HOUR_MS), 0); // empty window
  assert.equal(await s.window("a", T0 + 2 * HOUR_MS, T0), 0);       // inverted window
  assert.equal(await s.window("missing", T0, T0 + HOUR_MS), 0);
});
test("rate maths at 0 scans is UNKNOWN, not 0%", () => {
  const r = handRaiseRate(0, 0);
  assert.equal(r.rate, null); assert.equal(r.percent, null); assert.equal(r.verdict, "PENDING");
});
test("kill-test boundary: 30/1000 PASS, 29/1000 FAIL, 999 scans PENDING", () => {
  assert.equal(handRaiseRate(30, 1000).verdict, "PASS");
  assert.equal(handRaiseRate(29, 1000).verdict, "FAIL");
  assert.equal(handRaiseRate(31, 1000).verdict, "PASS");
  assert.equal(handRaiseRate(30, 999).verdict, "PENDING");
  assert.equal(handRaiseRate(30, 1000).percent, 3);
  assert.equal(handRaiseRate(0, 1000).verdict, "FAIL");
});
test("rate rejects impossible counts", () => {
  assert.throws(() => handRaiseRate(5, 4), RangeError);
  assert.throws(() => handRaiseRate(-1, 4), RangeError);
  assert.throws(() => handRaiseRate(1.5, 4), RangeError);
});
test("hours ledger tally", () => {
  assert.equal(hoursLedger(0, 0).hoursHandedBack, 0);
  assert.match(hoursLedger(0, 0).source, /UNKNOWN/);
  const l = hoursLedger(10, 95);
  assert.equal(l.hoursHandedBack, 1.6);
  assert.throws(() => hoursLedger(-1, 0), RangeError);
});
test("concurrent increments in the in-memory adapter lose nothing", async () => {
  const s = new MemoryCounterStore(() => T0);
  await Promise.all(Array.from({ length: 1000 }, (_, i) => s.increment("c", 1 + (i % 3), T0 + (i % 5) * HOUR_MS)));
  const expected = Array.from({ length: 1000 }, (_, i) => 1 + (i % 3)).reduce((a, b) => a + b, 0);
  assert.equal(await s.read("c"), expected);
  assert.equal(await s.window("c", T0, T0 + 5 * HOUR_MS), expected);
});
test("readSiteTally end to end (synthetic 1000 scans, 30 presses)", async () => {
  const s = new MemoryCounterStore(() => T0);
  for (let i = 0; i < 1000; i++) { await s.increment(EVENT_SCAN); await s.increment(COUNTER_MINUTES, 6); }
  for (let i = 0; i < 30; i++) await s.increment(EVENT_GET_FIXED);
  const t = await readSiteTally(s);
  assert.equal(t.handRaise.verdict, "PASS");
  assert.equal(t.ledger.hoursHandedBack, 100);
  const w = await readSiteTally(s, T0 + HOUR_MS, T0 + 2 * HOUR_MS);
  assert.equal(w.handRaise.scans, 0); assert.equal(w.handRaise.verdict, "PENDING");
});
test("D1 adapter issues the upsert and sums against the table (fake D1)", async () => {
  const rows = new Map<string, number>(); const sqls: string[] = [];
  const db = { prepare(sql: string) {
    sqls.push(sql); let args: unknown[] = [];
    const st = { bind(...a: unknown[]) { args = a; return st; },
      async run() { const k = `${args[0]}|${args[1]}`; rows.set(k, (rows.get(k) ?? 0) + (args[2] as number)); return {}; },
      async first() { let t = 0; for (const [k, n] of rows) { const [nm, b] = k.split("|"); if (nm !== args[0]) continue; if (args.length === 3 && !(+b >= (args[1] as number) && +b < (args[2] as number))) continue; t += n; } return { total: t }; },
      async all() { return { results: [] }; } };
    return st; } };
  const s = new D1CounterStore(db as never, () => T0);
  assert.equal(await s.increment("a", 2), 2);
  assert.equal(await s.increment("a", 3, T0 + HOUR_MS), 5);
  assert.equal(await s.window("a", T0, T0 + HOUR_MS), 2);
  assert.match(sqls[0], /ON CONFLICT \(name, bucket\) DO UPDATE SET n = n \+ excluded\.n/);
});
