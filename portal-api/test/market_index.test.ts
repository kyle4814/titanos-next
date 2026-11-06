// f29 C4 alljobs index: the indexed store reads must equal the full-scan reads (content AND order), and no request path may call allJobs().
// All data here is SYNTHETIC (generated ids, example domains).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryMarketStore, type Job, type JobStatus } from "../src/market/store.ts";
import { rig, INTERNAL } from "./market_harness.ts";

const STATUSES: JobStatus[] = ["awaiting_funds", "open", "claimed", "delivered", "reproved", "paid", "disputed", "cancelled", "refunded"];
let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const job = (id: string, o: Partial<Job> = {}): Job => ({ id, ownerAccountId: "o0", domainId: "d0", domain: "x0.example.com", check: "SPF", severity: "WARN", tier: "small", priceCents: 100, claimFeeCents: 10, status: "open", createdAt: 1, updatedAt: 1, baseline: { at: 1, status: "WARN", detail: "" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [], ...o });
const ids = (js: Job[]) => js.map((j) => j.id);

async function reference(st: MemoryMarketStore) {
  const all = await st.allJobs();
  return {
    owner: (id: string) => ids(all.filter((j) => j.ownerAccountId === id)), pro: (id: string) => ids(all.filter((j) => j.proAccountId === id)),
    touching: (id: string) => ids(all.filter((j) => j.proAccountId === id || j.abandonedBy.includes(id))),
    status: (x: JobStatus[]) => ids(all.filter((j) => x.includes(j.status))), domain: (id: string) => ids(all.filter((j) => j.domainId === id)),
  };
}

test("indexed reads equal the full scan after a random mix of puts and transitions (content and order)", async () => {
  const st = new MemoryMarketStore(); const owners = ["o0", "o1", "o2"], pros = ["p0", "p1", "p2", "p3"], doms = ["d0", "d1", "d2", "d3"];
  const n = 60;
  for (let step = 0; step < 600; step++) {
    const id = "j" + Math.floor(rnd() * n); const cur = await st.getJob(id);
    const j = cur ?? job(id, { ownerAccountId: pick(owners), domainId: pick(doms) });
    j.status = pick(STATUSES); j.proAccountId = rnd() < 0.6 ? pick(pros) : undefined; j.abandonedBy = rnd() < 0.4 ? [pick(pros), pick(pros)] : [];
    if (rnd() < 0.5) await st.putJob(j); else await st.transition(STATUSES, j);
    if (step % 50 === 49) {
      const ref = await reference(st);
      for (const o of owners) assert.deepEqual(ids(await st.jobsByOwner(o)), ref.owner(o), "owner " + o);
      for (const p of pros) { assert.deepEqual(ids(await st.jobsByPro(p)), ref.pro(p), "pro " + p); assert.deepEqual(ids(await st.jobsTouchingPro(p)), ref.touching(p), "touching " + p); }
      for (const d of doms) assert.deepEqual(ids(await st.jobsByDomain(d)), ref.domain(d), "domain " + d);
      // view=true (no defensive clone) must return identical content and order; only the copy differs
      for (const p of pros) { assert.deepEqual(await st.jobsTouchingPro(p, true), await st.jobsTouchingPro(p), "view touching " + p); assert.deepEqual(await st.jobsByPro(p, true), await st.jobsByPro(p), "view pro " + p); }
      for (const o of owners) assert.deepEqual(await st.jobsByOwner(o, true), await st.jobsByOwner(o), "view owner " + o);
      assert.deepEqual(await st.jobsByStatus(["open", "paid"], true), await st.jobsByStatus(["open", "paid"]), "view status");
      assert.deepEqual(await st.jobsByDomain("d1", true), await st.jobsByDomain("d1"), "view domain");
      for (const x of [["open"], ["claimed", "open", "reproved"], ["paid", "reproved"], STATUSES] as JobStatus[][]) assert.deepEqual(ids(await st.jobsByStatus(x)), ref.status(x), "status " + x);
    }
  }
});

test("status index follows a job through transitions: no stale entry under the old status, no duplicate", async () => {
  const st = new MemoryMarketStore(); await st.putJob(job("a", { status: "open" })); await st.putJob(job("b", { status: "open" }));
  const a = (await st.getJob("a"))!; a.status = "claimed"; a.proAccountId = "p1";
  assert.equal(await st.transition(["open"], a), true);
  assert.deepEqual(ids(await st.jobsByStatus(["open"])), ["b"]); assert.deepEqual(ids(await st.jobsByStatus(["claimed"])), ["a"]);
  assert.deepEqual(ids(await st.jobsByPro("p1")), ["a"]);
  a.status = "open"; a.proAccountId = undefined; a.abandonedBy = ["p1"];   // claim expired: back to the board, p1 abandoned
  assert.equal(await st.transition(["claimed"], a), true);
  assert.deepEqual(ids(await st.jobsByPro("p1")), []); assert.deepEqual(ids(await st.jobsTouchingPro("p1")), ["a"]);
  assert.deepEqual(ids(await st.jobsByStatus(["open"])), ["a", "b"], "first-insert order is kept, like allJobs");
  assert.equal(await st.transition(["claimed"], a), false, "failed CAS must not touch the indexes");
  assert.deepEqual(ids(await st.jobsByStatus(["claimed"])), []);
});

test("results are clones: mutating one cannot corrupt the store or its indexes", async () => {
  const st = new MemoryMarketStore(); await st.putJob(job("a", { status: "open" }));
  const got = (await st.jobsByStatus(["open"]))[0]!; got.status = "paid"; got.ownerAccountId = "evil";
  assert.deepEqual(ids(await st.jobsByStatus(["open"])), ["a"]); assert.deepEqual(ids(await st.jobsByOwner("o0")), ["a"]); assert.deepEqual(ids(await st.jobsByOwner("evil")), []);
});

test("no request path or sweep calls allJobs(): the whole marketplace flow runs with allJobs() booby-trapped", async () => {
  const r = rig(); (r.store as any).allJobs = async () => { throw new Error("allJobs called on a hot path"); };
  const o = await r.owner("o@acme.com.au", "acme.com.au"); const p = await r.pro("pro@agency.com"); const o2 = await r.owner("o2@beta.com.au", "beta.com.au");
  const hired = await r.hire(o); const id = hired.job.id; await r.hire(o2);
  assert.equal((await r.h.req("GET", "/pro/board", { token: p.session })).status, 200);
  assert.equal((await r.claim(p.session, id)).status, 200);
  assert.equal((await r.h.req("GET", "/market/jobs", { token: o.session })).status, 200);
  r.fix("acme.com.au"); const d = await r.h.j(await r.deliver(p.session, id)); assert.equal(d.job.status, "paid");
  for (const [t, path] of [[p.session, "/pro/rank"], [p.session, "/pro/payouts"], ["", "/market/leaderboard"], [o.session, "/market/jobs"], [o.session, "/account/export"]] as const) assert.equal((await r.h.req("GET", path, t ? { token: t } : {})).status, 200, path);
  assert.equal((await r.h.req("POST", "/internal/market/sweep", { headers: { "x-internal-secret": INTERNAL } })).status, 200);
  const lb = await r.h.j(await r.h.req("GET", "/market/leaderboard")); assert.equal(lb.rows.length, 1); assert.equal(lb.rows[0].provenFixes, 1);
  const rank = await r.h.j(await r.h.req("GET", "/pro/rank", { token: p.session })); assert.equal(rank.points, 1);
});

test("hasActiveMarketJobs: owner side and pro side through the indexes (account deletion guard)", async () => {
  const { hasActiveMarketJobs } = await import("../src/market/service.ts"); const r = rig(); const d = r.h.deps;
  const acct = (id: string) => ({ id } as any);
  await r.store.putJob(job("a", { ownerAccountId: "ownA", status: "awaiting_funds" })); await r.store.putJob(job("b", { ownerAccountId: "ownB", status: "cancelled" }));
  await r.store.putJob(job("c", { ownerAccountId: "ownC", status: "paid", proAccountId: "proC" })); await r.store.putJob(job("e", { ownerAccountId: "ownD", status: "reproved", proAccountId: "proE" }));
  await r.store.putJob(job("f", { ownerAccountId: "ownF", status: "claimed", proAccountId: "proF" }));
  assert.equal(await hasActiveMarketJobs(d, acct("ownA")), true); assert.equal(await hasActiveMarketJobs(d, acct("ownB")), false);
  assert.equal(await hasActiveMarketJobs(d, acct("proC")), false, "paid is settled"); assert.equal(await hasActiveMarketJobs(d, acct("ownC")), false);
  assert.equal(await hasActiveMarketJobs(d, acct("proE")), true, "a pro with an un-paid reproved job is active"); assert.equal(await hasActiveMarketJobs(d, acct("ownD")), false, "owner side of reproved is not in the active list");
  assert.equal(await hasActiveMarketJobs(d, acct("proF")), true); assert.equal(await hasActiveMarketJobs(d, acct("nobody")), false);
});

test("sweep reaches every status it acts on through jobsByStatus: expired claim reopens, unfunded job cancels, open job stays", async () => {
  const { sweep, CLAIM_WINDOW_MS } = await import("../src/market/service.ts"); const r = rig(); const now = r.h.clock.t;
  await r.store.putJob(job("x1", { status: "claimed", proAccountId: "p1", claimedAt: now - 2 * CLAIM_WINDOW_MS, claimDeadline: now - 1000, createdAt: now - 2 * CLAIM_WINDOW_MS, fundedAt: now - 2 * CLAIM_WINDOW_MS }));
  await r.store.putJob(job("x2", { status: "awaiting_funds", createdAt: now - 25 * 3600_000 }));
  await r.store.putJob(job("x3", { status: "open", fundedAt: now - 1000, createdAt: now - 1000 }));
  await r.store.putJob(job("x4", { status: "paid", createdAt: now - 400 * 86_400_000 }));
  await r.store.putJob(job("x5", { status: "open", fundedAt: now - 31 * 86_400_000, createdAt: now - 31 * 86_400_000 }));   // nobody claimed it in 30 days
  const out = await sweep(r.h.deps);
  assert.equal(out.reopened, 1); assert.equal(out.cancelled, 2); assert.equal((await r.store.getJob("x5"))!.status, "cancelled");
  const x1 = (await r.store.getJob("x1"))!; assert.equal(x1.status, "open"); assert.deepEqual(x1.abandonedBy, ["p1"]); assert.equal(x1.proAccountId, undefined);
  assert.deepEqual(ids(await r.store.jobsByPro("p1")), []); assert.deepEqual(ids(await r.store.jobsTouchingPro("p1")), ["x1"]);
  assert.equal((await r.store.getJob("x2"))!.status, "cancelled"); assert.equal((await r.store.getJob("x3"))!.status, "open"); assert.equal((await r.store.getJob("x4"))!.status, "paid");
});

test("owner open-job cap counts the owner's own live jobs in every live status, not other owners' and not settled ones", async () => {
  const { MAX_OPEN_JOBS_PER_OWNER } = await import("../src/market/service.ts"); const r = rig();
  const o = await r.owner("o@acme.com.au", "acme.com.au"); const other = await r.owner("o2@beta.com.au", "beta.com.au");
  for (let i = 0; i < MAX_OPEN_JOBS_PER_OWNER; i++) await r.store.putJob(job("other" + i, { ownerAccountId: other.account.id, domainId: "dx" + i, status: "open" }));
  for (let i = 0; i < MAX_OPEN_JOBS_PER_OWNER - 1; i++) await r.store.putJob(job("mine" + i, { ownerAccountId: o.account.id, domainId: "dy" + i, status: i % 2 ? "awaiting_funds" : "claimed" }));
  await r.store.putJob(job("done", { ownerAccountId: o.account.id, domainId: "dz", status: "paid" }));
  assert.equal((await r.h.req("POST", "/market/jobs", { token: o.session, body: { domainId: o.domainId, check: "SPF" } })).status, 201, "one under the cap: settled and other owners' jobs do not count");
  assert.equal((await r.h.req("POST", "/market/jobs", { token: o.session, body: { domainId: o.domainId, check: "DMARC" } })).status, 429, "at the cap");
});

test("warrantySweep sees proofs on both paid and reproved jobs; rank counts a pro's abandoned claims", async () => {
  const { warrantySweep } = await import("../src/market/service.ts"); const r = rig(); const o = await r.owner("o@acme.com.au", "acme.com.au"); const p = await r.pro("pro@agency.com");
  const proof = { scanId: "s", at: r.h.clock.t - 1000, baseline: "WARN", now: "PASS", detail: "" };
  for (const [id, status] of [["w1", "paid"], ["w2", "reproved"]] as const) await r.store.putJob(job(id, { ownerAccountId: o.account.id, domainId: o.domainId, domain: "acme.com.au", status, proAccountId: p.account.id, proof }));
  await r.store.putJob(job("ab", { ownerAccountId: o.account.id, domainId: "dq", status: "open", abandonedBy: [p.account.id] }));
  const out = await warrantySweep(r.h.deps); assert.equal(out.checked, 2); assert.equal(out.regressed, 2, "the zone still has the SPF fault, so both fixes regressed");
  assert.equal((await r.h.j(await r.h.req("GET", "/pro/rank", { token: p.session }))).abandoned, 1);
});

test("a view read is a snapshot: a later write replaces the stored job and never edits the view", async () => {
  const st = new MemoryMarketStore(); await st.putJob(job("a", { status: "open" }));
  const v = await st.jobsByStatus(["open"], true); const j = (await st.getJob("a"))!; j.status = "paid"; await st.putJob(j);
  assert.equal(v[0]!.status, "open"); assert.deepEqual(ids(await st.jobsByStatus(["paid"], true)), ["a"]); assert.deepEqual(ids(await st.jobsByStatus(["open"], true)), []);
});

test("sweep retries a refund that failed on a cancelled funded job, once, and leaves settled jobs alone", async () => {
  const { sweep } = await import("../src/market/service.ts"); const r = rig(); const now = r.h.clock.t;
  await r.store.putJob(job("c1", { status: "cancelled", fundedAt: now - 5000, paymentIntent: "pi_c1" })); await r.store.putJob(job("c2", { status: "refunded", fundedAt: now - 5000, paymentIntent: "pi_c2", refundRef: "re_done" }));
  await r.store.putJob(job("c3", { status: "cancelled" }));
  const a = await sweep(r.h.deps); assert.equal(a.retriedRefunds, 1); assert.ok((await r.store.getJob("c1"))!.refundRef);
  const b = await sweep(r.h.deps); assert.equal(b.retriedRefunds, 0, "second sweep has nothing due"); assert.equal(r.payments.calls.filter((c) => c.op.startsWith("refund")).length, 1, "exactly one provider refund call across both sweeps");
});
