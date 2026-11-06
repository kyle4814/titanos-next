import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, seeded } from "./fake_d1.ts";

// C2 residual (f186): markPaid is insert-if-absent. When two paid deliveries for one checkout slip past the `pur.status === "pending"` guard
// (both read "pending" before either writes), both run markPaid. The one that TOOK the held facts (cancel / Stripe period) but lost the
// createSubscription race used to consume them without effect. SYNTHETIC labelled fixtures only (example.invalid, sub_dup, cs_dup).
// Each schedule: facts held BEFORE the payment (a cancel and/or a subscription_create period), then 2..3 concurrent paid deliveries
// (checkout.session.completed, async_payment_succeeded with a different event id, and a replay of the first event id), each store call
// yielding a SEEDED 0..3 ticks. Both stores: MemoryStore and D1PlanStore over FakeD1 (real SQLite, real migrations).
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 6), START = T0 - 10 * DAY;
export const MD_SCHEDULES = 200;
const acc = { id: "acc_dup", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
type M = Record<string, any>;
const base = async () => {
  const f = (n: string) => import(pathToFileURL(join(SRC, n)).href);
  const [store, d1, svc, pc, st, dns] = await Promise.all([f("store.ts"), f("d1_plan_store.ts"), f("service.ts"), f("plan_change.ts"), f("stripe.ts"), f("dns.ts")]);
  return { store, d1, svc, pc, st, dns } as M;
};
const depsFor = (m: M, store: any) => ({ store, billing: new m.st.MockBilling(), dns: m.dns.fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" });
// purchases come back as COPIES (as from a real DB row): the MemoryStore otherwise hands out one shared object, so the first markPaid's
// status write is visible to the second delivery's pending guard by aliasing and the duplicate never slips past it
const COPY = new Set(["purchaseByCheckout", "purchaseById", "purchaseByPaymentIntent"]);
const yielding = (store: any, rng: () => number) => new Proxy(store, { get(t, k) { const v = t[k]; return typeof v !== "function" ? v : async (...a: unknown[]) => { for (let i = Math.floor(rng() * 4); i >= 0; i--) await new Promise((r) => setImmediate(r)); const out = await v.apply(t, a); return COPY.has(String(k)) && out ? structuredClone(out) : out; }; } });
const secs = (ms: number) => Math.floor(ms / 1000);
const paid = (id: string, type: string) => ({ id, type, data: { object: { id: "cs_dup", payment_status: "paid", subscription: "sub_dup", payment_intent: "pi_dup" } } });

export async function runDup(m: M, kind: "memory" | "d1", seed: number) {
  const bad: string[] = [], rng = seeded(seed), r = seeded(seed * 7919 + 3);
  const raw = kind === "d1" ? new m.d1.D1PlanStore(new FakeD1(seeded(seed))) : new m.store.MemoryStore();
  await raw.putAccount(acc);
  await raw.putPurchase({ id: "pur_dup", accountId: acc.id, productId: "ai_growth", checkoutId: "cs_dup", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
  // facts held before the payment: at least one of cancel / period
  const wantCancel = r() < 0.5, wantPeriod = !wantCancel || r() < 0.6;
  if (wantCancel) await raw.holdFact("sub:sub_dup", { kind: "cancel" });
  if (wantPeriod) await raw.holdFact("sub:sub_dup", { kind: "period", start: START, end: m.pc.addMonths(START, 1), create: true });
  // int3 shape: the seed is putSubscriptionOnce (keyed on purchase id) behind the f236 claim CAS + f242 lease, so a duplicate delivery normally LOSES THE CLAIM and never reaches the seed.
  // creates = attempts at the seed, created = rows written; lostClaims = acquireLease / casPurchase(pending) calls that lost (a delivery that raced and was absorbed)
  let creates = 0, created = 0, lostClaims = 0; const mk = raw.putSubscriptionOnce.bind(raw), cp = raw.casPurchase.bind(raw), al = raw.acquireLease.bind(raw);
  raw.putSubscriptionOnce = async (s: any) => { creates++; const ok = await mk(s); if (ok) created++; return ok; };
  raw.acquireLease = async (...a: any[]) => { const ok = await al(...a); if (!ok) lostClaims++; return ok; };
  raw.casPurchase = async (p: any, e: any, ...r: any[]) => { const ok = await cp(p, e, ...r); if (!ok && e === "pending") lostClaims++; return ok; };
  const d = depsFor(m, yielding(raw, rng));
  const evs = [paid("evt_dup_a", "checkout.session.completed"), paid("evt_dup_b", "checkout.session.async_payment_succeeded")];
  if (r() < 0.5) evs.push(paid("evt_dup_a", "checkout.session.completed")); // webhook replay of the first delivery (claimEvent must absorb it)
  const settled = await Promise.allSettled(evs.map((e) => m.svc.handleStripeEvent(d, e)));
  for (const s of settled) if (s.status === "rejected") bad.push("X rejection " + String((s.reason as any)?.message ?? s.reason));
  const sub = await raw.subscriptionById("sub_dup");
  if (!sub) { bad.push("I1 no subscription row"); return { bad, creates, raced: false }; }
  if (wantCancel && sub.cancelledAt === undefined) bad.push("I2 held cancel consumed without effect: cancelledAt unset");
  if (!wantCancel && sub.cancelledAt !== undefined) bad.push("I2b cancelledAt set with no cancel fact");
  if (wantPeriod && sub.startedAt !== START) bad.push(`I3 held period consumed without effect: startedAt ${sub.startedAt} != ${START}`);
  if (wantPeriod && !sub.plan) bad.push("I3b held period consumed without effect: no PlanState");
  const left = await raw.takeFacts("sub:sub_dup");
  if (left.length) bad.push(`I4 ${left.length} held fact(s) orphaned`);
  if (created !== 1) bad.push(`I5 ${created} rows created`);
  return { bad, creates, raced: lostClaims > 0 || creates > 1 };
}
async function all(m: M, kind: "memory" | "d1") { const bad: string[] = []; let raced = 0; for (let s = 1; s <= MD_SCHEDULES; s++) { const r = await runDup(m, kind, s); if (r.raced) raced++; for (const b of r.bad) bad.push(`${kind} seed ${s}: ${b}`); } return { bad, raced }; }

for (const kind of ["memory", "d1"] as const) {
  test(`MARKPAIDDUP: ${MD_SCHEDULES} seeded markPaid-vs-markPaid + replay schedules on ${kind}: held cancel/period facts are never consumed without effect`, async () => {
    const r = await all(await base(), kind);
    console.log(`MARKPAIDDUP_COUNTS ${kind} schedules=${MD_SCHEDULES} schedules_where_a_duplicate_delivery_raced_the_claim=${r.raced} violations=${r.bad.length}`);
    assert.ok(r.raced >= 20, `the schedules must actually race (only ${r.raced} had a delivery lose the lease/claim)`);
    assert.deepEqual(r.bad.slice(0, 10), []);
  });
}

// ---- f186 re-expressed on int3 (f245 lease-stall path): a winner that stalls past the lease TTL loses putSubscriptionOnce to a sweep's row; the held cancel AND period it took are applied to that row ----
for (const kind of ["memory", "d1"] as const) {
  test(`MARKPAIDDUP lease-stall on ${kind}: facts taken by the losing winner (cancel + Stripe period) land on the row that stands`, async () => {
    const m = await base(), db = new FakeD1(), raw = kind === "d1" ? new m.d1.D1PlanStore(db) : new m.store.MemoryStore();
    await raw.putAccount(acc);
    await raw.putPurchase({ id: "pur_dup", accountId: acc.id, productId: "ai_growth", checkoutId: "cs_dup", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
    await raw.holdFact("sub:sub_dup", { kind: "cancel" });
    await raw.holdFact("sub:sub_dup", { kind: "period", start: START, end: m.pc.addMonths(START, 1), create: true });
    // the "sweep" seeds a bare row (no plan, no cancel) just before the winner's seed write
    let done = false;
    const store = new Proxy(raw, { get(t: any, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => {
      if (k === "putSubscriptionOnce" && !done) { done = true; await raw.putSubscriptionOnce({ id: "sub_dup", accountId: acc.id, purchaseId: "pur_dup", productId: "ai_growth", startedAt: T0 }); }
      return v.apply(t, a); }; } });
    const d = depsFor(m, store);
    await m.svc.handleStripeEvent(d, paid("evt_stall", "checkout.session.completed"));
    const sub = await raw.subscriptionById("sub_dup");
    assert.ok(sub); assert.equal(sub.cancelledAt !== undefined, true, "held cancel merged onto the standing row");
    assert.equal(sub.startedAt, START, "held period merged onto the standing row"); assert.ok(sub.plan, "PlanState seeded on the standing row");
    assert.equal((await raw.subscriptionsFor(acc.id)).length, 1);
    assert.equal((await raw.takeFacts("sub:sub_dup")).length, 0);
  });
}
