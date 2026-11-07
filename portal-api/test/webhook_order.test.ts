import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, type Store } from "../src/store.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, handleStripeEvent, type Deps } from "../src/service.ts";
import { PRODUCTS } from "../src/catalogue.ts";

// C2 webhook-order suite (f92). SYNTHETIC fixtures only: no network, no Stripe key, no model call.
// 1,000 seeded sequences of checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded and
// customer.subscription.deleted for ONE account, shuffled and duplicated, through the real handleStripeEvent + MemoryStore.
const T0 = Date.UTC(2026, 10, 6);
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Ev = { id: string; type: string; data: { object: Record<string, any> } };
interface Scenario { events: Ev[]; productId: string; maxRefund: number; hasPaid: true; hasCancel: boolean; refundCents: number[] }

function build(r: () => number, seq: number): Scenario {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const productId = pick(["monitor_monthly", "ai_growth", "compliance_pack", "leads_starter", "leads_retainer"]);
  const p = PRODUCTS[productId], sub = p.mode === "subscription", n = `${seq}`;
  const cs = `cs_test_${n}`, pi = `pi_test_${n}`, subId = `sub_test_${n}`;
  const base = { id: cs, payment_intent: pi, customer: `cus_test_${n}`, ...(sub ? { subscription: subId } : {}) };
  const events: Ev[] = [];
  const e = (id: string, type: string, object: Record<string, any>) => events.push({ id: `evt_${n}_${id}`, type, data: { object } });
  const asyncPay = r() < 0.4;
  if (asyncPay) { e("c_unpaid", "checkout.session.completed", { ...base, payment_status: "unpaid" }); e("async", "checkout.session.async_payment_succeeded", { ...base, payment_status: "paid" }); }
  else { e("c", "checkout.session.completed", { ...base, payment_status: "paid" }); if (r() < 0.3) e("async_late", "checkout.session.async_payment_succeeded", { ...base, payment_status: "paid" }); }
  if (r() < 0.2) e("async_replay", "checkout.session.async_payment_succeeded", { ...base, payment_status: "paid" }); // Stripe resend under a fresh id
  const refundCents: number[] = [];
  const nref = r() < 0.6 ? 1 + Math.floor(r() * 2) : 0;
  let cum = 0;
  for (let i = 0; i < nref; i++) { cum = i === nref - 1 && r() < 0.5 ? p.amountCents : Math.min(p.amountCents, cum + Math.floor(p.amountCents * (0.2 + r() * 0.4))); refundCents.push(cum); e(`r${i}`, "charge.refunded", { id: `ch_test_${n}`, payment_intent: pi, amount_refunded: cum }); }
  let hasCancel = false;
  if (sub && r() < 0.6) { hasCancel = true; e("del", "customer.subscription.deleted", { id: subId }); }
  if (r() < 0.5) e("unk1", "customer.updated", { id: `cus_test_${n}` });
  if (r() < 0.3) e("unk2", "invoice.created", { id: `in_test_${n}` });
  return { events, productId, maxRefund: refundCents.length ? Math.min(p.amountCents, Math.max(...refundCents)) : 0, hasPaid: true, hasCancel, refundCents };
}
function shuffle<T>(a: T[], r: () => number) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

type Kind = "memory" | "d1";
const KINDS: Kind[] = ["memory", "d1"];
// f171: the same suite on BOTH adapters. D1Store runs over FakeD1 (real SQLite, the real migrations 0001..0006).
async function fresh(sc: Scenario, kind: Kind = "memory") {
  const d1 = kind === "d1" ? new FakeD1() : undefined;
  const store: Store = d1 ? new D1Store(d1) : new MemoryStore();
  const heldCount = async () => (d1 ? Number((d1.db.prepare("SELECT COUNT(*) AS c FROM held_facts").get() as { c: number }).c) : [...(store as MemoryStore).held.entries()].filter(([, v]) => v.length).length);
  const billing = new MockBilling(), mailer = new MockMailer(), log: string[] = [];
  const deps: Deps = { store, billing, dns: fakeResolver({}), mailer, now: () => T0, siteOrigin: "https://titanos.tech", log: (l) => log.push(l) };
  const p = PRODUCTS[sc.productId];
  const first = sc.events[0].data.object;
  await store.putAccount({ id: "acc_test", email: "a@acme.com.au", seat: "owner", createdAt: T0 });
  await store.putPurchase({ id: "pur_test", accountId: "acc_test", productId: p.id, checkoutId: String(first.id), amountCents: p.amountCents, deliverableIssued: false, refundedCents: 0, status: "pending" });
  return { store, billing, mailer, deps, log, heldCount };
}
async function snapshot(h: Awaited<ReturnType<typeof fresh>>) {
  const s = h.store, pur = (await s.purchaseById("pur_test"))!, acc = (await s.accountById("acc_test"))!;
  return {
    purchase: { status: pur.status, refundedCents: pur.refundedCents, paymentIntent: pur.paymentIntent, subscriptionId: pur.subscriptionId, paidAt: pur.paidAt, amountCents: pur.amountCents },
    customer: acc.stripeCustomerId,
    subs: (await s.subscriptionsFor("acc_test")).map((x) => ({ id: x.id, cancelledAt: x.cancelledAt ?? null, startedAt: x.startedAt })).sort((a, b) => a.id.localeCompare(b.id)),
    invoices: (await s.invoicesFor("acc_test")).map((i) => ({ productId: i.productId, amountCents: i.amountCents })),
    held: await h.heldCount(),
  };
}

const ZERO: Record<string, number> = { sequences: 0, order_independent: 0, no_double_fund: 0, no_double_refund: 0, no_double_email: 0, refund_before_payment_held_then_reconciled: 0, never_negative: 0, cancel_after_refund_closed_one_invoice: 0, unknown_ignored_with_log: 0, duplicates_injected: 0 };

const FINALS: Record<Kind, unknown[]> = { memory: [], d1: [] };
const ALLCOUNTS: Record<string, Record<string, number>> = {};
for (const kind of KINDS) test(`WEBHOOKORDER[${kind}]: 1,000 shuffled + duplicated sequences, every invariant`, async () => {
  const COUNTS = { ...ZERO }; ALLCOUNTS[kind] = COUNTS;
  const r = rng(92_2026_11_07); // same seed per adapter: both see the identical 1,000 sequences
  for (let seq = 0; seq < 1000; seq++) {
    const sc = build(r, seq), p = PRODUCTS[sc.productId];
    // reference: the event set applied once, in a fixed canonical order (payment signals first)
    const ref = await fresh(sc, kind);
    const canon = [...sc.events].sort((a, b) => Number(/refunded|deleted/.test(a.type)) - Number(/refunded|deleted/.test(b.type)));
    for (const ev of canon) await handleStripeEvent(ref.deps, ev);
    const want = await snapshot(ref);
    // expected from the spec, independently of the handler
    assert.equal(want.invoices.length, 1, `seq ${seq}: exactly one invoice`);
    assert.equal(want.purchase.refundedCents, sc.maxRefund, `seq ${seq}: refunded = max cumulative, clamped`);
    assert.equal(want.purchase.status, sc.maxRefund >= p.amountCents ? "refunded" : "paid");
    assert.equal(want.subs.length, p.mode === "subscription" ? 1 : 0);
    if (p.mode === "subscription") assert.equal(want.subs[0].cancelledAt !== null, sc.hasCancel);

    // the shuffled, duplicated run
    const order = shuffle(sc.events, r), dups = 1 + Math.floor(r() * 4);
    const seqEvents = [...order];
    for (let k = 0; k < dups; k++) seqEvents.splice(Math.floor(r() * (seqEvents.length + 1)), 0, sc.events[Math.floor(r() * sc.events.length)]);
    COUNTS.duplicates_injected += seqEvents.length - sc.events.length;
    const h = await fresh(sc, kind);
    let paidSeen = false, refundBeforePaid = false;
    const results: string[] = [];
    for (const ev of seqEvents) {
      if (ev.type === "charge.refunded" && !paidSeen) refundBeforePaid = true;
      results.push(await handleStripeEvent(h.deps, ev));
      const s = await snapshot(h);
      if ((ev.type === "checkout.session.completed" && ev.data.object.payment_status === "paid") || ev.type === "checkout.session.async_payment_succeeded") paidSeen = true;
      // never negative, never above the amount, never more than one invoice, at every step
      assert.ok(s.purchase.refundedCents >= 0 && s.purchase.refundedCents <= p.amountCents, `seq ${seq}: refund in range`);
      assert.ok(s.invoices.length <= 1, `seq ${seq}: at most one invoice at every step`);
      if (!paidSeen) { assert.equal(s.purchase.status, "pending", `seq ${seq}: no state change before payment`); assert.equal(s.purchase.refundedCents, 0); assert.equal(s.invoices.length, 0); }
    }
    COUNTS.never_negative++;
    const got = await snapshot(h);
    assert.deepEqual(got, want, `seq ${seq}: final state differs from canonical order`);
    COUNTS.order_independent++; FINALS[kind].push({ want, got });
    assert.equal(got.invoices.length, 1); COUNTS.no_double_fund++;                       // one funding, one invoice, despite duplicates and replays under fresh ids
    assert.equal(h.billing.calls.length, 0); COUNTS.no_double_refund++;                  // the webhook records Stripe's refunds, it never issues one
    assert.equal(got.purchase.refundedCents, sc.maxRefund);
    assert.equal(h.mailer.outbox.length, 0); COUNTS.no_double_email++;                   // webhooks send no mail at all, so a duplicate cannot send twice
    assert.equal(got.held, 0, `seq ${seq}: nothing left held once the payment arrived`);
    if (refundBeforePaid) { assert.equal(got.purchase.refundedCents, sc.maxRefund); COUNTS.refund_before_payment_held_then_reconciled++; }
    if (sc.hasCancel && sc.maxRefund > 0) {
      assert.equal(got.subs[0].cancelledAt, T0); assert.equal(got.invoices.length, 1);
      if (sc.maxRefund >= p.amountCents) assert.equal(got.purchase.status, "refunded");
      COUNTS.cancel_after_refund_closed_one_invoice++;
    }
    const unk = sc.events.filter((e) => !["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded", "customer.subscription.deleted"].includes(e.type));
    if (unk.length) {
      const seen = new Set(seqEvents.filter((e) => unk.includes(e)).map((e) => e.id));
      assert.equal(h.log.filter((l) => l.includes("unknown event type")).length, seen.size); // first delivery logs, a duplicate id is a "duplicate" with no second log
      for (const u of unk) assert.equal(results[seqEvents.indexOf(u)], "ignored");
      COUNTS.unknown_ignored_with_log++;
    }
    COUNTS.sequences++;
  }
  console.log(`WEBHOOKORDER_COUNTS ${kind} ` + JSON.stringify(COUNTS));
  assert.equal(COUNTS.sequences, 1000);
});

// f171: MemoryStore and D1Store (over FakeD1) must end every one of the 1,000 sequences in IDENTICAL state.
test("WEBHOOKORDER: MemoryStore and D1Store give identical final state on all 1,000 sequences", () => {
  assert.equal(FINALS.memory.length, 1000); assert.equal(FINALS.d1.length, 1000);
  for (let i = 0; i < 1000; i++) assert.deepEqual(FINALS.d1[i], FINALS.memory[i], `seq ${i}: D1 differs from Memory`);
  console.log("WEBHOOKORDER_PARITY memory==d1 1000/1000");
});

for (const kind of KINDS) test(`regression[${kind}]: a cancel that arrives before its payment is held, then applied (it used to be dropped as ignored)`, async () => {
  const sc = { events: [{ id: "e0", type: "checkout.session.completed", data: { object: { id: "cs_x", payment_status: "paid", payment_intent: "pi_x", subscription: "sub_x" } } }], productId: "ai_growth" } as unknown as Scenario;
  const h = await fresh(sc, kind);
  assert.equal(await handleStripeEvent(h.deps, { id: "e1", type: "customer.subscription.deleted", data: { object: { id: "sub_x" } } }), "handled");
  await handleStripeEvent(h.deps, sc.events[0]);
  assert.ok((await h.store.subscriptionById("sub_x"))!.cancelledAt);
});

for (const kind of KINDS) test(`regression[${kind}]: an unpaid completed session does not fund; async_payment_succeeded does, once`, async () => {
  const sc = { events: [{ id: "e0", type: "x", data: { object: { id: "cs_y" } } }], productId: "compliance_pack" } as unknown as Scenario;
  const h = await fresh(sc, kind);
  const o = { id: "cs_y", payment_intent: "pi_y" };
  await handleStripeEvent(h.deps, { id: "u1", type: "checkout.session.completed", data: { object: { ...o, payment_status: "unpaid" } } });
  assert.equal((await h.store.purchaseById("pur_test"))!.status, "pending");
  await handleStripeEvent(h.deps, { id: "a1", type: "checkout.session.async_payment_succeeded", data: { object: { ...o, payment_status: "paid" } } });
  await handleStripeEvent(h.deps, { id: "a2", type: "checkout.session.async_payment_succeeded", data: { object: { ...o, payment_status: "paid" } } });
  assert.equal((await h.store.invoicesFor("acc_test")).length, 1);
});

for (const kind of KINDS) test(`hostile amounts[${kind}]: over-large, negative and non-numeric amount_refunded stay within [0, amount], before and after payment`, async () => {
  for (const bad of [10 ** 9, -500, NaN, "abc", null]) {
    const sc = { events: [{ id: "e0", type: "x", data: { object: { id: "cs_z" } } }], productId: "compliance_pack" } as unknown as Scenario;
    for (const beforePay of [true, false]) {
      const h = await fresh(sc, kind), amt = PRODUCTS.compliance_pack.amountCents;
      const pay = () => handleStripeEvent(h.deps, { id: "p", type: "checkout.session.completed", data: { object: { id: "cs_z", payment_status: "paid", payment_intent: "pi_z" } } });
      const ref = () => handleStripeEvent(h.deps, { id: "r", type: "charge.refunded", data: { object: { payment_intent: "pi_z", amount_refunded: bad } } });
      if (beforePay) { await ref(); await pay(); } else { await pay(); await ref(); }
      const p = (await h.store.purchaseById("pur_test"))!;
      assert.ok(p.refundedCents >= 0 && p.refundedCents <= amt, `${String(bad)} ${beforePay}: ${p.refundedCents}`);
      assert.equal(p.refundedCents, typeof bad === "number" && bad > 0 ? amt : 0);
      assert.equal((await h.store.invoicesFor("acc_test")).length, 1);
    }
  }
});
