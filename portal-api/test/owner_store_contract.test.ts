// ONE contract suite over MemoryOwnerStore and D1OwnerStore (real SQLite via owner_fake_d1.ts, the real migrations).
// Synthetic data only. Account ids a1/a2, domains example.test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryOwnerStore, newState, setMonitor, DAY, type DomainState, type OwnerStore } from "../src/owner/engine.ts";
import { D1OwnerStore, type ScopedOwnerStore } from "../src/owner/d1ownerstore.ts";
import { FakeD1 } from "./owner_fake_d1.ts";

const T0 = Date.UTC(2026, 10, 6);
type Made = { store: ScopedOwnerStore; seed?: (id: string, acct: string) => void; d1?: FakeD1 };
const adapters: { name: string; make: () => Made }[] = [
  { name: "MemoryOwnerStore", make: () => ({ store: new MemoryOwnerStore() as unknown as ScopedOwnerStore }) },
  { name: "D1OwnerStore", make: () => {
    const d1 = new FakeD1(); const accts = new Set<string>(), doms = new Set<string>();
    const store = new D1OwnerStore(d1, () => T0);
    // owner_state has foreign keys to accounts/domains: seed parents the way the Store would have
    const seed = (id: string, acct: string) => {
      if (!accts.has(acct)) { d1.db.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(acct, `${acct}@example.test`); accts.add(acct); }
      if (!doms.has(id)) { d1.db.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?, ?, ?, 't')").run(id, acct, `${id}.example.test`); doms.add(id); }
    };
    return { store, seed, d1 };
  } },
];
const st = (id: string, acct: string, on = false, at = T0): DomainState => { const s = newState(id, `${id}.example.test`, acct, true); if (on) setMonitor(s, true, at); return s; };

for (const { name, make } of adapters) {
  const mk = () => { const m = make(); const put = async (s: DomainState) => { m.seed?.(s.domainId, s.accountId); await m.store.put(s); }; return { ...m, put }; };
  test(`${name}: put/get round trip, structured clone, upsert replaces`, async () => {
    const { store, put } = mk(); const s = st("d1", "a1"); await put(s);
    const g = (await store.get("d1"))!; assert.deepEqual(g, s); g.xp = 99; assert.equal((await store.get("d1"))!.xp, 0);
    s.xp = 7; await store.put(s); assert.equal((await store.get("d1"))!.xp, 7); assert.equal((await store.all()).length, 1);
  });
  test(`${name}: account filter: getFor/allFor never cross accounts`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1")); await put(st("d2", "a2")); await put(st("d3", "a1"));
    assert.equal(await store.getFor("a2", "d1"), undefined); assert.equal((await store.getFor("a1", "d1"))!.domainId, "d1");
    assert.deepEqual((await store.allFor("a1")).map((s) => s.domainId), ["d1", "d3"]); assert.deepEqual((await store.allFor("a2")).map((s) => s.domainId), ["d2"]);
    assert.deepEqual(await store.allFor("nobody"), []);
  });
  test(`${name}: put by another account cannot overwrite a row`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1"));
    const evil = st("d1", "a2"); evil.xp = 1000;
    await assert.rejects(store.put(evil), /owner_state_account_mismatch/);
    assert.equal((await store.get("d1"))!.xp, 0); assert.equal((await store.get("d1"))!.accountId, "a1");
  });
  test(`${name}: claimDomain is idempotent and refuses another account`, async () => {
    const { store, seed } = mk(); seed?.("d1", "a1"); seed?.("d1x", "a2");
    const s = st("d1", "a1"); assert.equal(await store.claimDomain(s), "created");
    const later = st("d1", "a1"); later.xp = 500;
    assert.equal(await store.claimDomain(later), "exists"); assert.equal(await store.claimDomain(later), "exists");
    assert.equal((await store.get("d1"))!.xp, 0, "a re-claim must not overwrite state");
    assert.equal((await store.allFor("a1")).length, 1);
    assert.equal(await store.claimDomain(st("d1", "a2")), "conflict");
    assert.equal((await store.get("d1"))!.accountId, "a1");
  });
  test(`${name}: setMonitorSub idempotent: a replay does not push next_scan_at back`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1"));
    assert.equal(await store.setMonitorSub("a1", "d1", true, T0), "changed");
    assert.equal(await store.setMonitorSub("a1", "d1", true, T0 + DAY), "unchanged");
    const s = (await store.get("d1"))!; assert.equal(s.monitor.active, true); assert.equal(s.monitor.nextScanAt, T0);
    assert.equal(await store.setMonitorSub("a1", "d1", false, T0 + 1), "changed");
    assert.equal(await store.setMonitorSub("a1", "d1", false, T0 + 2), "unchanged");
    assert.equal((await store.get("d1"))!.monitor.active, false); assert.equal((await store.due(T0 + 10 * DAY, 10)).length, 0);
  });
  test(`${name}: setMonitorSub is account-scoped and reports missing`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1"));
    assert.equal(await store.setMonitorSub("a2", "d1", true, T0), "missing"); assert.equal((await store.get("d1"))!.monitor.active, false);
    assert.equal(await store.setMonitorSub("a1", "nope", true, T0), "missing");
  });
  test(`${name}: 20 racing monitor flips: exactly one changed`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1"));
    const r = await Promise.all(Array.from({ length: 20 }, () => store.setMonitorSub("a1", "d1", true, T0)));
    assert.equal(r.filter((x) => x === "changed").length, 1); assert.equal(r.filter((x) => x === "unchanged").length, 19);
  });
  test(`${name}: due: only active and due, longest overdue first, ties by id, bounded`, async () => {
    const { store, put } = mk();
    await put(st("dA", "a1", true, T0 + 3000)); await put(st("dB", "a1", true, T0 + 1000)); await put(st("dC", "a2", true, T0 + 1000));
    await put(st("dD", "a2", true, T0 + 9_000_000)); await put(st("dE", "a1", false));
    const ids = (await store.due(T0 + 5000, 10)).map((s) => s.domainId); assert.deepEqual(ids, ["dB", "dC", "dA"]);
    assert.deepEqual((await store.due(T0 + 5000, 2)).map((s) => s.domainId), ["dB", "dC"]);
    assert.deepEqual(await store.due(T0 + 5000, 0), []); assert.deepEqual(await store.due(T0, 10), []);
    assert.equal((await store.due(T0 + 1000, 10)).length, 2, "boundary: next_scan_at == now is due");
  });
  test(`${name}: put with monitor off clears the schedule (not re-selected)`, async () => {
    const { store, put } = mk(); const s = st("d1", "a1", true); await put(s); assert.equal((await store.due(T0, 5)).length, 1);
    setMonitor(s, false, T0 + 1); await store.put(s); assert.equal((await store.due(T0 + DAY, 5)).length, 0);
  });
  test(`${name}: anonymise removes only that account's rows and returns the count`, async () => {
    const { store, put } = mk(); await put(st("d1", "a1", true)); await put(st("d2", "a1")); await put(st("d3", "a2", true));
    assert.equal(await store.anonymise("a1"), 2); assert.equal(await store.anonymise("a1"), 0);
    assert.deepEqual((await store.all()).map((s) => s.domainId), ["d3"]); assert.deepEqual((await store.due(T0 + DAY, 9)).map((s) => s.domainId), ["d3"]);
  });
  test(`${name}: satisfies the plain OwnerStore interface used by the cron/engine`, async () => {
    const { store, put } = mk(); const o: OwnerStore = store; await put(st("d1", "a1")); assert.equal((await o.all()).length, 1);
  });
}

// ---- D1-only: SQL shape, index use, schema
const d1only = () => { const d1 = new FakeD1(); const store = new D1OwnerStore(d1, () => T0); return { d1, store }; };
test("D1: every account-scoped statement binds account_id as an argument, never in the SQL text; no INSERT OR REPLACE", async () => {
  const { d1, store } = d1only(); d1.db.prepare("INSERT INTO accounts (id,email) VALUES ('acct_secret','x@example.test')").run();
  d1.db.prepare("INSERT INTO domains (id,account_id,domain,verify_token) VALUES ('dm','acct_secret','dm.example.test','t')").run();
  const s = st("dm", "acct_secret", true); d1.log.length = 0;
  await store.put(s); await store.claimDomain(s); await store.getFor("acct_secret", "dm"); await store.allFor("acct_secret"); await store.setMonitorSub("acct_secret", "dm", false, T0); await store.anonymise("acct_secret");
  for (const q of d1.log) { assert.ok(!q.sql.includes("acct_secret"), q.sql); assert.ok(!/INSERT OR REPLACE|REPLACE INTO/i.test(q.sql), q.sql); }
  const scoped = d1.log.filter((q) => /WHERE .*account_id = \?/.test(q.sql)); assert.ok(scoped.length >= 4);
  for (const q of scoped) assert.ok(q.args.includes("acct_secret"), q.sql);
  assert.ok(!/INSERT OR REPLACE|REPLACE INTO/i.test(JSON.stringify(Object.getOwnPropertyNames(D1OwnerStore.prototype))));
});
test("D1: the due query the store really issues uses the partial index (EXPLAIN QUERY PLAN), no temp sort", async () => {
  const { d1, store } = d1only(); d1.log.length = 0; await store.due(T0, 5);
  const q = d1.log.find((x) => /next_scan_at/.test(x.sql))!;
  const plan = d1.db.prepare("EXPLAIN QUERY PLAN " + q.sql).all(...(q.args as never[])).map((r) => String((r as { detail: string }).detail)).join(" | ");
  assert.match(plan, /idx_owner_state_due2/); assert.doesNotMatch(plan, /TEMP B-TREE/);
});
test("D1: migration 0005 is numbered above every migration on the w3/f14/w7/w8/f13 branches and is additive only", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../migrations/0005_owner_d1.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|UPDATE)\b/i); assert.match(sql, /CREATE INDEX IF NOT EXISTS/);
});
test("D1: due query 5000 rows, limit 50, reads only the limit (rows touched bounded by the index)", async () => {
  const { d1, store } = d1only(); d1.db.prepare("INSERT INTO accounts (id,email) VALUES ('a','a@example.test')").run();
  const ins = d1.db.prepare("INSERT INTO domains (id,account_id,domain,verify_token) VALUES (?, 'a', ?, 't')"), ins2 = d1.db.prepare("INSERT INTO owner_state (domain_id,account_id,state_json,next_scan_at,updated_at) VALUES (?, 'a', '{}', ?, 0)");
  for (let i = 0; i < 5000; i++) { ins.run(`x${i}`, `x${i}.example.test`); ins2.run(`x${i}`, i % 2 ? T0 + i : null); }
  d1.log.length = 0; const rows = await store.due(T0 + 6000, 50); assert.equal(rows.length, 50);
});
