// ONE contract suite, run against MemoryMarketStore and D1MarketStore (real SQLite via FakeD1, foreign keys ON, REAL
// migrations 0001..0005). Same assertions for both; D1-only tests (SQL shape, identity columns, indexes) follow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryMarketStore, type Job, type JobStatus, type MarketStore } from "../src/market/store.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";

const ACCTS = ["own1", "own2", "pro1", "pro2", "pro3"];
function seed(f: FakeD1, domains: string[]) {
  for (const a of ACCTS) f.db.exec(`INSERT INTO accounts (id, email) VALUES ('${a}', '${a}@x.test')`);
  for (const [i, d] of domains.entries()) f.db.exec(`INSERT INTO domains (id, account_id, domain, verify_token) VALUES ('d${i}', 'own1', '${d}', 't')`);
}
const DOMS = ["a.test", "b.test", "c.test", "d.test", "e.test", "f.test", "g.test", "h.test"];
function job(id: string, o: Partial<Job> = {}): Job {
  return { id, ownerAccountId: "own1", domainId: "d0", domain: "a.test", check: "SPF", severity: "WARN", tier: "small", priceCents: 9900, claimFeeCents: 2900, status: "open", createdAt: 1000, updatedAt: 1000,
    baseline: { at: 1000, status: "WARN", detail: "soft fail" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [], ...o };
}
type Rig = { store: MarketStore; fake?: FakeD1; kind: string };
const adapters: { kind: string; make: () => Rig }[] = [
  { kind: "memory", make: () => ({ store: new MemoryMarketStore(), kind: "memory" }) },
  { kind: "d1", make: () => { const fake = new FakeD1(); seed(fake, DOMS); return { store: new D1MarketStore(fake), fake, kind: "d1" }; } },
];
const claimAs = (j: Job, pro: string, now = 5000): Job => ({ ...structuredClone(j), status: "claimed", proAccountId: pro, claimedAt: now, claimDeadline: now + 1000, updatedAt: now });

for (const { kind, make } of adapters) {
  test(`[${kind}] job roundtrip, unknown id, clone isolation, list order`, async () => {
    const { store } = make();
    assert.equal(await store.getJob("nope"), undefined);
    await store.putJob(job("j1", { domainId: "d0", domain: "a.test" })); await store.putJob(job("j2", { domainId: "d1", domain: "b.test" }));
    const got = (await store.getJob("j1"))!; assert.equal(got.priceCents, 9900); assert.equal(got.baseline.detail, "soft fail");
    got.priceCents = 1; got.baseline.detail = "mutated"; assert.equal((await store.getJob("j1"))!.priceCents, 9900, "returned copy is detached");
    assert.deepEqual((await store.allJobs()).map((j) => j.id), ["j1", "j2"]);
    await store.putJob({ ...job("j1"), deliveryNote: "x", updatedAt: 2000 }); assert.equal((await store.getJob("j1"))!.deliveryNote, "x"); assert.equal((await store.allJobs()).length, 2, "putJob is an upsert");
  });

  test(`[${kind}] transition is compare-and-set on status: wrong status is refused and changes nothing`, async () => {
    const { store } = make(); await store.putJob(job("j1"));
    assert.equal(await store.transition(["claimed"], claimAs(job("j1"), "pro1")), false, "open is not claimed");
    assert.equal((await store.getJob("j1"))!.status, "open"); assert.equal((await store.getJob("j1"))!.proAccountId, undefined);
    assert.equal(await store.transition([], claimAs(job("j1"), "pro1")), false, "empty from-set fails closed");
    assert.equal(await store.transition(["awaiting_funds", "open"], claimAs(job("j1"), "pro1")), true, "any listed status matches");
    assert.equal((await store.getJob("j1"))!.proAccountId, "pro1");
    assert.equal(await store.transition(["open"], claimAs(job("j1"), "pro2")), false, "second claimer after the fact loses");
    assert.equal((await store.getJob("j1"))!.proAccountId, "pro1");
    assert.equal(await store.transition(["open"], claimAs(job("ghost"), "pro1")), false, "unknown id never matches");
    assert.equal(await store.getJob("ghost"), undefined, "transition never inserts");
  });

  test(`[${kind}] RACE: 2 claimers at once, exactly one wins, the stored claimer is the winner`, async () => {
    for (let round = 0; round < 40; round++) {
      const { store } = make(); await store.putJob(job("j1"));
      const [a, b] = await Promise.all([store.transition(["open"], claimAs(job("j1"), "pro1")), store.transition(["open"], claimAs(job("j1"), "pro2"))]);
      assert.equal([a, b].filter(Boolean).length, 1, `round ${round}: exactly one winner`);
      assert.equal((await store.getJob("j1"))!.proAccountId, a ? "pro1" : "pro2");
    }
  });

  test(`[${kind}] RACE: 12 claimers, 1 winner; 8 concurrent payouts from reproved, 1 winner`, async () => {
    const { store } = make(); await store.putJob(job("j1"));
    const pros = ["pro1", "pro2", "pro3", ...Array.from({ length: 9 }, (_, i) => "pro1")];
    const res = await Promise.all(pros.map((p, i) => store.transition(["open"], { ...claimAs(job("j1"), p), rescans: i })));
    assert.equal(res.filter(Boolean).length, 1);
    await store.putJob({ ...job("j2", { domainId: "d1", domain: "b.test" }), status: "reproved", proAccountId: "pro1" });
    const pay = await Promise.all(Array.from({ length: 8 }, (_, i) => store.transition(["reproved"], { ...job("j2", { domainId: "d1" }), status: "paid", proAccountId: "pro1", payout: { status: "paid", amountCents: 9900, transferId: `tr_${i}` } })));
    assert.equal(pay.filter(Boolean).length, 1); const paid = (await store.getJob("j2"))!; assert.equal(paid.status, "paid");
    assert.equal(paid.payout!.transferId, `tr_${pay.indexOf(true)}`, "the stored transfer is the winner's");
  });

  test(`[${kind}] claim expiry: a lapsed claim reopens exactly once, and a live claim is left alone`, async () => {
    const { store } = make();
    await store.putJob(job("late", { domainId: "d0" })); await store.putJob(job("live", { domainId: "d1", domain: "b.test" })); await store.putJob(job("open1", { domainId: "d2", domain: "c.test" }));
    assert.ok(await store.transition(["open"], claimAs(job("late"), "pro1", 1000)));                     // deadline 2000
    assert.ok(await store.transition(["open"], claimAs(job("live", { domainId: "d1" }), "pro2", 9000))); // deadline 10000
    await store.putJob({ ...job("done", { domainId: "d3", domain: "d.test" }), status: "delivered", proAccountId: "pro3", claimedAt: 100, claimDeadline: 200, updatedAt: 300 });   // past deadline but delivered: not expired
    const now = 5000;
    const lapsed = (await store.allJobs()).filter((j) => j.status === "claimed" && j.claimDeadline! < now);
    assert.deepEqual(lapsed.map((j) => j.id), ["late"]);
    if (store instanceof D1MarketStore) assert.deepEqual((await store.expiredClaims(now)).map((j) => j.id), ["late"], "indexed read agrees with the scan");
    const reopen = (j: Job): Job => ({ ...j, status: "open", proAccountId: undefined, claimedAt: undefined, claimDeadline: undefined, abandonedBy: [...j.abandonedBy, j.proAccountId!], updatedAt: now });
    const [r1, r2] = await Promise.all([store.transition(["claimed"], reopen(lapsed[0])), store.transition(["claimed"], reopen(lapsed[0]))]);
    assert.equal([r1, r2].filter(Boolean).length, 1, "two sweeps at once reopen once");
    const after = (await store.getJob("late"))!; assert.equal(after.status, "open"); assert.equal(after.proAccountId, undefined); assert.deepEqual(after.abandonedBy, ["pro1"]);
    assert.equal((await store.getJob("live"))!.status, "claimed");
    if (store instanceof D1MarketStore) assert.deepEqual(await store.expiredClaims(now), [], "reopened job leaves the expiry index");
  });

  test(`[${kind}] pro profiles and cards: roundtrip, upsert, per-account isolation, open filter`, async () => {
    const { store } = make();
    await store.putPro({ accountId: "pro1", joinedAt: 1, onboarded: false, plan: "payg", display: "Pro One" }); await store.putPro({ accountId: "pro2", joinedAt: 2, onboarded: true, plan: "seat", display: "Pro Two" });
    await store.putPro({ accountId: "pro1", joinedAt: 1, onboarded: true, plan: "payg", display: "Pro One", connectAccountId: "acct_1" });
    assert.equal((await store.getPro("pro1"))!.connectAccountId, "acct_1"); assert.equal((await store.getPro("pro2"))!.connectAccountId, undefined);
    assert.equal(await store.getPro("pro3"), undefined); assert.equal((await store.allPros()).length, 2);
    await store.putJob(job("j1"));
    await store.putCard({ id: "c1", kind: "payout_review", jobId: "j1", reason: "big", createdAt: 1, resolved: false }); await store.putCard({ id: "c2", kind: "dispute", jobId: "j1", reason: "x", createdAt: 2, resolved: false });
    await store.putCard({ id: "c1", kind: "payout_review", jobId: "j1", reason: "big", createdAt: 1, resolved: true, outcome: "approved" });
    assert.deepEqual((await store.openCards()).map((c) => c.id), ["c2"]); assert.equal((await store.getCard("c1"))!.outcome, "approved"); assert.equal((await store.getCard("c1"))!.resolved, true);
    assert.equal(await store.getCard("zz"), undefined);
  });
}

// ---- D1-only: tenant isolation, identity columns, indexes, SQL shape, column authority ----
const d1 = () => { const fake = new FakeD1(); seed(fake, DOMS); return { fake, store: new D1MarketStore(fake) }; };
const raw = (f: FakeD1, sql: string, ...a: unknown[]) => JSON.parse(JSON.stringify(f.db.prepare(sql).all(...(a as never[])))) as Record<string, unknown>[];

test("[d1] tenant isolation: a job always belongs to its owner; no write path can re-home it or re-point its domain", async () => {
  const { fake, store } = d1(); await store.putJob(job("j1"));
  await store.putJob({ ...job("j1"), ownerAccountId: "own2", domainId: "d3", check: "DMARC", updatedAt: 2 });           // upsert with different identity
  assert.deepEqual(raw(fake, "SELECT owner_account_id o, domain_id d, check_name c FROM market_jobs WHERE id='j1'"), [{ o: "own1", d: "d0", c: "SPF" }], "identity columns survive an upsert");
  assert.ok(await store.transition(["open"], { ...claimAs(job("j1"), "pro1"), ownerAccountId: "own2", domainId: "d3", check: "DMARC" }));
  const back = (await store.getJob("j1"))!; assert.deepEqual([back.ownerAccountId, back.domainId, back.check], ["own1", "d0", "SPF"], "reads take identity from the columns, not the JSON");
  assert.deepEqual(raw(fake, "SELECT owner_account_id o, domain_id d, check_name c FROM market_jobs WHERE id='j1'"), [{ o: "own1", d: "d0", c: "SPF" }], "identity columns survive a transition");
  await assert.rejects(store.putJob(job("j9", { ownerAccountId: "ghost-tenant", domainId: "d4" })), /FOREIGN KEY/i, "a job for a non-existent account is refused by the schema");
  await assert.rejects(store.putJob(job("j8", { domainId: "no-such-domain", check: "DKIM" })), /FOREIGN KEY/i);
  await assert.rejects(store.putJob({ ...claimAs(job("j7", { domainId: "d5" }), "ghost-pro") }), /FOREIGN KEY/i, "a claim by a non-account is refused");
  assert.equal(raw(fake, "SELECT count(*) n FROM market_jobs WHERE owner_account_id='own2'")[0].n, 0, "own2 owns nothing");
});

test("[d1] one live job per (domain, check): second live hire refused by the unique index, allowed after the first ends", async () => {
  const { store } = d1(); await store.putJob(job("j1"));
  await assert.rejects(store.putJob(job("j2")), /UNIQUE/i, "same domain+check while j1 is live");
  await store.putJob(job("j3", { check: "DMARC" }));                                                                    // different check is fine
  assert.ok(await store.transition(["open"], { ...job("j1"), status: "cancelled", updatedAt: 3 }));
  await store.putJob(job("j2"));                                                                                          // cancelled no longer counts
  assert.equal((await store.allJobs()).length, 3);
});

test("[d1] the status COLUMN is authoritative: a stale or tampered state_json cannot change what the CAS sees", async () => {
  const { fake, store } = d1(); await store.putJob(job("j1"));
  fake.db.exec(`UPDATE market_jobs SET state_json = json_set(state_json, '$.status', 'paid') WHERE id='j1'`);
  assert.equal((await store.getJob("j1"))!.status, "open", "hydrate takes status from the column");
  assert.equal(await store.transition(["paid"], claimAs(job("j1"), "pro1")), false, "CAS tests the column, not the JSON");
  assert.ok(await store.transition(["open"], claimAs(job("j1"), "pro1")));
});

test("[d1] SQL shape: the CAS is ONE conditional UPDATE, one round trip, values bound, rows-changed decides", async () => {
  const { fake, store } = d1(); await store.putJob(job("j1")); fake.log.length = 0;
  const evil = "j1' OR '1'='1";
  assert.equal(await store.transition(["open", "awaiting_funds"], claimAs(job(evil), "pro1")), false, "an injection-shaped id matches nothing");
  assert.equal(fake.log.length, 1, "one statement, no preceding SELECT");
  const { sql, args } = fake.log[0];
  assert.match(sql, /^UPDATE market_jobs SET .* WHERE id = \? AND status IN \(\?, \?\)$/s);
  assert.ok(args.includes(evil) && !sql.includes(evil), "id is bound, never in the SQL text");
  assert.equal((await store.getJob("j1"))!.status, "open", "the injection touched nothing");
  fake.log.length = 0; assert.ok(await store.transition(["open"], claimAs(job("j1"), "pro1"))); assert.equal(fake.log.length, 1);
  assert.equal(fake.log.some((l) => /INSERT OR REPLACE|REPLACE INTO/i.test(l.sql)), false);
});

test("[d1] MUTANT bites: a read-then-write claim on the same fake lets two claimers both 'win'", async () => {
  class Mutant extends D1MarketStore {
    override async transition(from: JobStatus[], j: Job) { const cur = await this.getJob(j.id); if (!cur || !from.includes(cur.status)) return false; await this.putJob(j); return true; }
  }
  let doubleWins = 0;
  for (let i = 0; i < 40; i++) {
    const fake = new FakeD1(); seed(fake, DOMS); const m = new Mutant(fake); await m.putJob(job("j1"));
    const r = await Promise.all([m.transition(["open"], claimAs(job("j1"), "pro1")), m.transition(["open"], claimAs(job("j1"), "pro2"))]);
    if (r.every(Boolean)) doubleWins++;
  }
  assert.ok(doubleWins > 0, `the race test can detect a non-atomic CAS (double wins seen: ${doubleWins}/40)`);
});

test("[d1] migrations: 0005 is additive and only touches market_jobs; indexes exist", async () => {
  const { fake } = d1();
  const idx = raw(fake, "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='market_jobs'").map((r) => r.name);
  for (const n of ["idx_market_jobs_status", "idx_market_jobs_claim_deadline", "uq_market_live_job"]) assert.ok(idx.includes(n), n);
  assert.ok(raw(fake, "PRAGMA table_info(market_jobs)").some((c) => c.name === "claim_deadline"));
});
