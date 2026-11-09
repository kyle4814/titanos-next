// f247 (ported onto int3 by the 2026-11-10 hand merge): runSweep is the ONE scheduled housekeeping entry.
// Before it, nothing called reapRefundMemos, reconcilePending or reconcileSubscriptions. SYNTHETIC data, MemoryStore, mock Stripe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, MEMO_TTL_MS, LEASE_MS, type Deps } from "../src/service.ts";
import { runSweep, SWEEP_GRACE_MS } from "../src/sweep.ts";

const T0 = Date.UTC(2026, 10, 10);
function deps(store = new MemoryStore()): Deps {
  return { store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech" };
}
const pur = (id: string, status: "paid" | "refunded") => ({ id, accountId: "acc_syn", productId: "ai_growth", checkoutId: `cs_${id}`, amountCents: 1000, deliverableIssued: false, refundedCents: status === "refunded" ? 1000 : 0, status });

test("S1 runs all three passes and reports each", async () => {
  const r = await runSweep(deps());
  assert.deepEqual(r.errors, []);
  assert.ok(r.pending && r.subscriptions && r.memos, JSON.stringify(r));
});
test("S2 reaps an expired memo of a settled purchase, keeps a pending refund and a fresh memo", async () => {
  const d = deps(), s = d.store as MemoryStore;
  await s.putPurchase(pur("p_settled", "refunded")); await s.putPurchase(pur("p_pending", "paid")); await s.putPurchase(pur("p_fresh", "refunded"));
  const old = T0 - MEMO_TTL_MS - 1;
  await s.memoInsert("refundsent:p_settled", { at: old }); await s.memoInsert("refundsent:p_pending", { at: old }); await s.memoInsert("refundsent:p_fresh", { at: T0 });
  const r = await runSweep(d);
  assert.deepEqual(r.memos!.reaped, ["refundsent:p_settled"]);
  assert.deepEqual([...r.memos!.kept].sort(), ["refundsent:p_fresh", "refundsent:p_pending"]);
});
test("S3 one failing pass never stops the others (isolated, named in errors)", async () => {
  const d = deps(); const s = d.store as MemoryStore;
  (s as any).memoList = async () => { throw new Error("boom"); };
  const r = await runSweep(d);
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /^memos: boom/);
  assert.ok(r.pending && r.subscriptions, "the passes before it still ran");
});
test("S4 the grace window stays above the claim lease (a sweep never races a live winner)", () => {
  assert.ok(SWEEP_GRACE_MS > LEASE_MS, `${SWEEP_GRACE_MS} > ${LEASE_MS}`);
});
