import { test } from "node:test";
import assert from "node:assert/strict";
import { D1UnmatchedLog, D1GeneratorQueue, toAskRecords, toLogRow } from "../src/d1_demand.ts";
import { demandReport } from "../../lib/concierge/demand.ts";
import { enqueueDemandAsync } from "../../lib/concierge/genqueue.ts";
import { MemoryLog } from "../../lib/concierge/router.ts";
import { FakeD1 } from "./fake_d1.ts";

// C5 demand on D1 (f301). SYNTHETIC labelled asks and askers only (asker_syn_*): no network, no live D1, no real traffic.
// FakeD1 is real SQLite applying the REAL migrations (0017_unmatched_demand.sql included).
const stub = (ask: string, askerId: string | null, at: string | null) => ({ ask, normalised: ask.toLowerCase().trim(), seat: "guest" as const, status: "LOGGED_FOR_GENERATOR" as const, quote: null, askerId, firstSeenAt: at, lastSeenAt: at });
const ASK = "do you offer penetration testing for small medical clinics";
const T1 = "2026-11-01T00:00:00.000Z", T2 = "2026-11-03T00:00:00.000Z", T3 = "2026-11-05T00:00:00.000Z";

test("D1: same askerId counted once, repeat bumps seen_count and last_seen_at, keeps first_seen_at", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db);
  await log.append(stub(ASK, "asker_syn_a", T2));
  await log.append(stub(ASK, "asker_syn_a", T3));
  await log.append(stub(ASK, "asker_syn_a", T1));   // out-of-order arrival: first moves earlier, last does not move back
  const rows = await log.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seenCount, 3); assert.equal(rows[0].firstSeenAt, T1); assert.equal(rows[0].lastSeenAt, T3); assert.equal(rows[0].askerId, "asker_syn_a");
});

test("D1: two askers on one ask are two rows; demand report counts 2 distinct askers, 3 asks, first/last seen", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db);
  await log.append(stub(ASK, "asker_syn_a", T1)); await log.append(stub(ASK, "asker_syn_a", T2)); await log.append(stub(ASK, "asker_syn_b", T3));
  const [s] = demandReport(await log.askRecords(), { minAskers: 1 });
  assert.equal(s.distinct_askers, 2); assert.equal(s.ask_count, 3); assert.equal(s.first_seen, T1); assert.equal(s.last_seen, T3);
});

test("D1: anon fallback, missing askerId is ONE anon asker and reads back as null", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db);
  await log.append(stub(ASK, null, T1)); await log.append(stub(ASK, null, T2)); await log.append(stub(ASK, undefined as never, T3));
  const rows = await log.rows();
  assert.equal(rows.length, 1); assert.equal(rows[0].askerId, null); assert.equal(rows[0].seenCount, 3);
  const [s] = demandReport(toAskRecords(rows), { minAskers: 1 });
  assert.equal(s.distinct_askers, 1);
});

test("D1: null timestamps stay null; a later stamped sighting fills them", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db);
  await log.append(stub(ASK, "asker_syn_a", null));
  assert.deepEqual([(await log.rows())[0].firstSeenAt, (await log.rows())[0].lastSeenAt], [null, null]);
  await log.append(stub(ASK, "asker_syn_a", T2));
  const r = (await log.rows())[0]; assert.equal(r.firstSeenAt, T2); assert.equal(r.lastSeenAt, T2);
});

test("memory adapter and D1 adapter agree on the same history", async () => {
  const db = new FakeD1(), d1 = new D1UnmatchedLog(db), mem = new MemoryLog();
  const hist = [stub(ASK, "asker_syn_a", T2), stub(ASK, "asker_syn_b", T1), stub(ASK, "asker_syn_a", T3), stub("sso setup for staff", null, T1), stub("sso setup for staff", null, T2)];
  for (const h of hist) { await d1.append(h); mem.append(h); }
  const key = (r: any) => JSON.stringify([r.normalised, r.askerId ?? null, r.seenCount, r.firstSeenAt, r.lastSeenAt]);
  assert.deepEqual((await d1.rows()).map(key).sort(), mem.rows.map(key).sort());
});

test("row mappers: log row and queue row round-trip, no id or grade leaks", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db), q = new D1GeneratorQueue(db);
  await log.append(stub(ASK, "asker_syn_a", T1)); await log.append(stub(ASK, "asker_syn_b", T2));
  const r = await enqueueDemandAsync(q, await log.askRecords(), { minAskers: 1 });
  assert.equal(r.queued, 1); assert.equal(r.changed, true);
  const [e] = await q.list();
  assert.equal(e.status, "QUEUED_FOR_GENERATOR"); assert.equal(e.distinct_askers, 2); assert.equal(e.first_seen, T1); assert.equal(e.last_seen, T2);
  assert.ok(Array.isArray(e.sample_asks) && e.sample_asks.length >= 1);
  assert.deepEqual(Object.keys(e).sort(), ["ask_count", "cluster_id", "distinct_askers", "first_seen", "label", "last_seen", "sample_asks", "status"]);
  assert.equal(toLogRow({ normalised: "x", asker_id: "anon", ask: "x", seat: "guest", seen_count: 1, first_seen_at: null, last_seen_at: null }).askerId, null);
});

test("queue on D1: re-run over the same log writes nothing (no-op), a new asker updates in one batch", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db), q = new D1GeneratorQueue(db);
  await log.append(stub(ASK, "asker_syn_a", T1));
  await enqueueDemandAsync(q, await log.askRecords(), { minAskers: 1 });
  const before = db.log.filter((l) => /generator_queue/.test(l.sql) && /^(INSERT|DELETE)/.test(l.sql)).length;
  const again = await enqueueDemandAsync(q, await log.askRecords(), { minAskers: 1 });
  assert.equal(again.changed, false);
  assert.equal(db.log.filter((l) => /generator_queue/.test(l.sql) && /^(INSERT|DELETE)/.test(l.sql)).length, before);
  await log.append(stub(ASK, "asker_syn_b", T3));
  const third = await enqueueDemandAsync(q, await log.askRecords(), { minAskers: 1 });
  assert.equal(third.changed, true); assert.equal((await q.list())[0].distinct_askers, 2); assert.equal((await q.list()).length, 1);
});

test("SQL shape: every write binds its values, no asker or ask text in SQL", async () => {
  const db = new FakeD1(), log = new D1UnmatchedLog(db);
  await log.append(stub("it's a 'quoted' ask; DROP TABLE unmatched_log", "asker_syn_a'); --", T1));
  assert.equal((await log.rows()).length, 1);
  const w = db.log.find((l) => /INSERT INTO unmatched_log/.test(l.sql))!;
  assert.ok(!/DROP|asker_syn/.test(w.sql)); assert.ok(w.args.includes("asker_syn_a'); --"));
});

// MUTATION: drop the askerId column (an adapter that writes everything as 'anon'). Distinct askers must come out WRONG, proving the column carries the count.
test("MUTANT: dropping askerId collapses distinct askers (real adapter 3, mutant 1)", async () => {
  class NoAsker extends D1UnmatchedLog { override async append(s: any) { return super.append({ ...s, askerId: null }); } }
  const feed = async (l: D1UnmatchedLog) => { for (const a of ["asker_syn_a", "asker_syn_b", "asker_syn_c"]) await l.append(stub(ASK, a, T1)); return demandReport(await l.askRecords(), { minAskers: 1 })[0].distinct_askers; };
  assert.equal(await feed(new D1UnmatchedLog(new FakeD1())), 3);
  assert.equal(await feed(new NoAsker(new FakeD1())), 1);
});

test("memory MemoryLog: dedupe, first/last, anon", () => {
  const m = new MemoryLog();
  m.append(stub(ASK, "asker_syn_a", T2)); m.append(stub(ASK, "asker_syn_a", T3)); m.append(stub(ASK, "asker_syn_a", T1)); m.append(stub(ASK, null, T1));
  assert.equal(m.rows.length, 2);
  const a = m.rows.find((r) => r.askerId === "asker_syn_a")!;
  assert.deepEqual([a.seenCount, a.firstSeenAt, a.lastSeenAt], [3, T1, T3]);
});
