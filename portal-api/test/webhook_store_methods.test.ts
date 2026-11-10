import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, type Store, type Purchase, type RefundCase } from "../src/store.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";

// f171: contract for the three f92 Store methods (purchaseByPaymentIntent, holdFact, takeFacts) plus the refund-case,
// card and plan-state persistence the webhook flow needs, on MemoryStore and D1Store. SYNTHETIC rows only.
const ADAPTERS: [string, () => Store][] = [["MemoryStore", () => new MemoryStore()], ["D1Store(FakeD1)", () => new D1Store(new FakeD1())]];
const pur = (id: string, extra: Partial<Purchase> = {}): Purchase => ({ id, accountId: "a1", productId: "compliance_pack", checkoutId: `cs_${id}`, amountCents: 599700, deliverableIssued: false, refundedCents: 0, status: "pending", ...extra });

for (const [name, mk] of ADAPTERS) describe(`webhook store methods: ${name}`, () => {
  async function seed() { const s = mk(); await s.putAccount({ id: "a1", email: "a1@ex.com.au", seat: "owner", createdAt: 1 }); return s; }
  test("purchaseByPaymentIntent: finds by pi, undefined when unknown, follows an update", async () => {
    const s = await seed();
    await s.putPurchase(pur("p1")); await s.putPurchase(pur("p2", { paymentIntent: "pi_2" }));
    assert.equal(await s.purchaseByPaymentIntent("pi_2").then((p) => p?.id), "p2");
    assert.equal(await s.purchaseByPaymentIntent("pi_1"), undefined);
    await s.putPurchase(pur("p1", { paymentIntent: "pi_1" }));
    assert.equal((await s.purchaseByPaymentIntent("pi_1"))?.id, "p1");
    assert.equal(await s.purchaseByPaymentIntent(""), undefined);
  });
  test("holdFact/takeFacts: arrival order kept, keys isolated, take removes, second take is empty", async () => {
    const s = mk();
    await s.holdFact("k1", { n: 1, nested: { x: [1, 2] } }); await s.holdFact("k2", { n: 9 }); await s.holdFact("k1", { n: 2, s: "o'brien; DROP TABLE x" });
    assert.deepEqual(await s.takeFacts("k1"), [{ n: 1, nested: { x: [1, 2] } }, { n: 2, s: "o'brien; DROP TABLE x" }]);
    assert.deepEqual(await s.takeFacts("k1"), []);
    assert.deepEqual(await s.takeFacts("k2"), [{ n: 9 }]);
    assert.deepEqual(await s.takeFacts("never"), []);
  });
  test("takeFacts: two concurrent takers split nothing, together they get each fact exactly once", async () => {
    const s = mk();
    for (let i = 0; i < 5; i++) await s.holdFact("k", { i });
    const [a, b] = await Promise.all([s.takeFacts("k"), s.takeFacts("k")]);
    assert.equal(a.length + b.length, 5);
    assert.deepEqual([...a, ...b].map((f) => f.i).sort(), [0, 1, 2, 3, 4]);
  });
  test("refund cases and cards round-trip (optional decidedAt, boolean inPolicy)", async () => {
    const s = await seed(); await s.putPurchase(pur("p1"));
    const rc: RefundCase = { id: "rc1", accountId: "a1", purchaseId: "p1", productName: "Compliance Pack", amountCents: 100, reason: "outside_window", inPolicy: false, status: "pending_review", createdAt: 5 };
    await s.putRefundCase(rc);
    assert.deepEqual(JSON.parse(JSON.stringify(await s.refundCaseById("rc1"))), rc);
    await s.putRefundCase({ ...rc, status: "approved", decidedAt: 9 });
    assert.equal((await s.refundCasesFor("p1"))[0].decidedAt, 9);
    assert.deepEqual(await s.refundCasesFor("p_none"), []);
    await s.putCard({ id: "c1", accountId: "a1", purchaseId: "p1", kind: "refund", reason: "r", createdAt: 1, resolved: false } as never);
    assert.equal((await s.cardById("c1"))?.id, "c1"); assert.equal((await s.allCards()).length, 1);
  });
  test("subscription plan state survives a round trip", async () => {
    const s = await seed(); await s.putPurchase(pur("p1"));
    const plan = { tier: "ai_growth", periodStart: 1, periodEnd: 2, history: [{ a: 1 }] } as never;
    await s.putSubscription({ id: "sub1", accountId: "a1", purchaseId: "p1", productId: "ai_growth", startedAt: 1, plan });
    assert.deepEqual((await s.subscriptionById("sub1"))?.plan, plan);
    await s.putSubscription({ id: "sub2", accountId: "a1", purchaseId: "p1", productId: "ai_growth", startedAt: 1 });
    assert.equal((await s.subscriptionById("sub2"))?.plan, undefined);
  });
});
