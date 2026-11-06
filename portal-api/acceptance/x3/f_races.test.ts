// x3 F: concurrency. The MemoryStore interleaves at every await, so Promise.all exposes check-then-act gaps a D1 adapter would also have.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "../../test/harness.ts";
import { fullRig, blocked } from "./lib.ts";

const j = async (r: Response) => (await r.json()) as any;

test("F-01 BLOCKED: 12 concurrent claims by 4 pros on one job: exactly one wins, one fee", async () => {
  const r = fullRig(); const o = await r.owner("race-o@x3.test", "race1.com.au");
  const pros = await Promise.all(["a", "b", "c", "d"].map((n) => r.pro(`race-${n}@x3.test`)));
  const job = (await r.hire(o)).job;
  const res = await Promise.all(Array.from({ length: 12 }, (_, i) => r.claim(pros[i % 4].session, job.id)));
  assert.equal(res.filter((x) => x.status === 200).length, 1, res.map((x) => x.status).join());
  assert.equal(r.payments.calls.filter((c) => c.op === "claim_fee").length, 1);
  blocked("F-01", "claim race");
});

test("F-02 BLOCKED: concurrent delivers/rescans/sweeps/owner rescans pay exactly once", async () => {
  const r = fullRig(); const o = await r.owner("race-o2@x3.test", "race2.com.au"); const p = await r.pro("race-p2@x3.test");
  const job = (await r.hire(o)).job; await r.claim(p.session, job.id); r.fix("race2.com.au");
  const jobs = [r.deliver(p.session, job.id), r.deliver(p.session, job.id), r.internal("POST", "/internal/market/sweep"), r.internal("POST", "/internal/market/sweep"), r.h.req("POST", `/market/jobs/${job.id}/rescan`, { token: o.session }), r.h.req("POST", `/market/jobs/${job.id}/rescan`, { token: p.session })];
  await Promise.all(jobs);
  // int3 (f28 attribution): a sweep that observes the fix before delivery WITHHOLDS pay (correct: the pro did not cause it). So the invariant is AT MOST one transfer, never two, and status agrees with the transfer count.
  const n = r.payments.count("transfer"); const st = (await r.store.getJob(job.id))!.status;
  assert.ok(n <= 1, `transfers=${n}`); assert.equal(st === "paid", n === 1, `status ${st} vs transfers ${n}`);
  blocked("F-02", `payout race: ${n} transfer(s), status ${st}`);
  // serial control: delivery observed first pays exactly once
  const r2 = fullRig(); const o2 = await r2.owner("race-o3@x3.test", "race3.com.au"); const p2 = await r2.pro("race-p3@x3.test");
  const j2 = (await r2.hire(o2)).job; await r2.claim(p2.session, j2.id); r2.fix("race3.com.au");
  await r2.deliver(p2.session, j2.id); await r2.deliver(p2.session, j2.id);
  assert.equal(r2.payments.count("transfer"), 1); assert.equal((await r2.store.getJob(j2.id))!.status, "paid");
});

test("F-03 BLOCKED: one login link used by 10 concurrent verifies yields one session; one event delivered 10 times yields one invoice", async () => {
  const h = make();
  await h.req("POST", "/auth/request", { body: { email: "race3@x3.test" } });
  const tok = h.mailer.outbox.at(-1)!.text.match(/(ll_[0-9a-f]+)/)![1];
  const rs = await Promise.all(Array.from({ length: 10 }, () => h.req("POST", "/auth/verify", { body: { token: tok } })));
  assert.equal(rs.filter((x) => x.status === 200).length, 1);
  const u = await h.login("race3b@x3.test");
  await h.req("POST", "/checkout", { token: u.session, body: { product: "leads_starter" } });
  const pur = [...h.store.purchases.values()][0];
  const ws = await Promise.all(Array.from({ length: 10 }, () => h.webhook("checkout.session.completed", { id: pur.checkoutId, payment_status: "paid", payment_intent: "pi_r" }, { id: "evt_same" })));
  const results = (await Promise.all(ws.map(j))).map((x) => x.result);
  assert.equal(results.filter((x) => x === "handled").length, 1, results.join()); assert.equal(h.store.invoices.size, 1);
  blocked("F-03", "token and event races");
});

test("F-04 BLOCKED: 30 concurrent paid MCP calls against a 50-credit balance spend at most 50 credits and never go negative", async () => {
  const h = make(); const u = await h.login("race4@x3.test");
  const k = await j(await h.req("POST", "/keys", { token: u.session, body: { scopes: ["scan:read"] } }));
  await h.store.creditApply(u.account.id, 50, "topup", "seed", h.clock.t);
  h.dns.zone["race4.com.au"] = ["v=spf1 -all"];
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => h.req("POST", "/mcp", { token: k.key, body: { jsonrpc: "2.0", id: i, method: "tools/call", params: { name: "domain_check", arguments: { domain: "race4.com.au" } } } })));
  const ok = (await Promise.all(rs.map(j))).filter((x) => x.result && !x.result.isError).length;
  assert.equal(ok, 10); assert.equal(await h.store.creditBalance(u.account.id), 0);
  blocked("F-04", "credit race");
});

test("F-05 BLOCKED: 10 concurrent refund requests reach the provider under ONE idempotency key", async () => {
  const h = make(); const u = await h.login("race5@x3.test");
  await h.verifiedDomain(u.session, "race5.com.au");
  await h.req("POST", "/checkout", { token: u.session, body: { product: "compliance_pack", domain: "race5.com.au" } });
  const { purchase } = await h.pay("compliance_pack");
  const rs = await Promise.all(Array.from({ length: 10 }, () => h.req("POST", "/refunds", { token: u.session, body: { purchaseId: purchase.id } })));
  assert.ok(rs.every((x) => x.status === 200 || x.status === 409));
  const keys = new Set(h.billing.calls.filter((c) => c.op === "refund").map((c) => (c.args as any).key));
  assert.equal(keys.size, 1, "all refund calls share one Stripe idempotency key, so Stripe pays once");
  blocked("F-05", `refund race: ${h.billing.calls.filter((c) => c.op === "refund").length} provider calls, 1 key`);
});
