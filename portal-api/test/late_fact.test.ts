import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, seeded } from "./fake_d1.ts";

// C2 residual (f191, from f186 limit 2 / f183 limit 2): a webhook that reads "no subscription yet" and then HOLDS its fact (cancel / Stripe
// period) can run AFTER markPaid already took the held facts and created the row. The fact is then parked under a key nobody takes again.
// SYNTHETIC labelled fixtures only (example.invalid, sub_late, cs_late). Each schedule: one paid delivery races 1..2 late webhooks
// (customer.subscription.deleted and/or a subscription_create invoice.paid carrying the first period), each started after a seeded delay and
// with every store call yielding a seeded 0..3 ticks. Both stores: MemoryStore and D1PlanStore over FakeD1 (real SQLite, real migrations).
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 6), START = T0 - 10 * DAY;
export const LF_SCHEDULES = 200;
const acc = { id: "acc_late", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
type M = Record<string, any>;
const base = async () => {
  const f = (n: string) => import(pathToFileURL(join(SRC, n)).href);
  const [store, d1, svc, pc, st, dns] = await Promise.all([f("store.ts"), f("d1_plan_store.ts"), f("service.ts"), f("plan_change.ts"), f("stripe.ts"), f("dns.ts")]);
  return { store, d1, svc, pc, st, dns } as M;
};
const depsFor = (m: M, store: any) => ({ store, billing: new m.st.MockBilling(), dns: m.dns.fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" });
const COPY = new Set(["purchaseByCheckout", "purchaseById", "purchaseByPaymentIntent"]);
const yielding = (store: any, rng: () => number) => new Proxy(store, { get(t, k) { const v = t[k]; return typeof v !== "function" ? v : async (...a: unknown[]) => { for (let i = Math.floor(rng() * 4); i >= 0; i--) await new Promise((r) => setImmediate(r)); const out = await v.apply(t, a); return COPY.has(String(k)) && out ? structuredClone(out) : out; }; } });
const secs = (ms: number) => Math.floor(ms / 1000);
const paid = { id: "evt_late_pay", type: "checkout.session.completed", data: { object: { id: "cs_late", payment_status: "paid", subscription: "sub_late", payment_intent: "pi_late" } } };
const cancelEv = { id: "evt_late_cancel", type: "customer.subscription.deleted", data: { object: { id: "sub_late" } } };
const createInv = (m: M) => ({ id: "evt_late_inv", type: "invoice.paid", data: { object: { subscription: "sub_late", billing_reason: "subscription_create", amount_paid: 150000, lines: { data: [{ period: { start: secs(START), end: secs(m.pc.addMonths(START, 1)) } }] } } } });
const ticks = async (n: number) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

export async function runLate(m: M, kind: "memory" | "d1", seed: number) {
  const bad: string[] = [], rng = seeded(seed), r = seeded(seed * 7919 + 3);
  const raw = kind === "d1" ? new m.d1.D1PlanStore(new FakeD1(seeded(seed))) : new m.store.MemoryStore();
  await raw.putAccount(acc);
  await raw.putPurchase({ id: "pur_late", accountId: acc.id, productId: "ai_growth", checkoutId: "cs_late", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
  const wantCancel = r() < 0.6, wantPeriod = !wantCancel || r() < 0.6;
  const slowHold = r() < 0.5; // half the schedules park the fact very late (after markPaid's whole run), half park it promptly (inside the take-to-create window)
  let creates = 0, created = 0, heldAfterCreate = 0; const mk = raw.putSubscriptionOnce.bind(raw), hf = raw.holdFact.bind(raw);
  raw.putSubscriptionOnce = async (s: any) => { creates++; const ok = await mk(s); if (ok) created++; return ok; };
  raw.holdFact = async (k: string, f: any) => { await ticks(slowHold ? Math.floor(r() * 40) : 0); if (created > 0 && k === "sub:sub_late") heldAfterCreate++; return hf(k, f); }; // the race window: a fact parked AFTER the row exists
  const d = depsFor(m, yielding(raw, rng));
  const late: Promise<unknown>[] = [];
  const fire = (ev: any) => late.push((async () => { await ticks(Math.floor(r() * 30)); return m.svc.handleStripeEvent(d, ev); })());
  if (wantCancel) fire(cancelEv);
  if (wantPeriod) fire(createInv(m));
  const settled = await Promise.allSettled([m.svc.handleStripeEvent(d, paid), ...late]);
  for (const s of settled) if (s.status === "rejected") bad.push("X rejection " + String((s.reason as any)?.message ?? s.reason));
  const sub = await raw.subscriptionById("sub_late");
  if (!sub) { bad.push("I1 no subscription row"); return { bad, late: heldAfterCreate > 0 }; }
  if (wantCancel && sub.cancelledAt === undefined) bad.push("I2 late cancel lost: cancelledAt unset");
  if (!wantCancel && sub.cancelledAt !== undefined) bad.push("I2b cancelledAt set with no cancel");
  if (wantPeriod && sub.startedAt !== START) bad.push(`I3 late period lost: startedAt ${sub.startedAt} != ${START}`);
  if (wantPeriod && !sub.plan) bad.push("I3b late period lost: no PlanState");
  const left = await raw.takeFacts("sub:sub_late");
  if (left.length) bad.push(`I4 ${left.length} fact(s) orphaned under sub:sub_late`);
  if (created !== 1) bad.push(`I5 ${created} rows created`);
  return { bad, late: heldAfterCreate > 0 };
}
async function all(m: M, kind: "memory" | "d1") { const bad: string[] = []; let late = 0; for (let s = 1; s <= LF_SCHEDULES; s++) { const r = await runLate(m, kind, s); if (r.late) late++; for (const b of r.bad) bad.push(`${kind} seed ${s}: ${b}`); } return { bad, late }; }

for (const kind of ["memory", "d1"] as const) {
  test(`LATEFACT: ${LF_SCHEDULES} seeded paid-vs-late-webhook schedules on ${kind}: a fact held after the row exists is applied, never dropped`, async () => {
    const r = await all(await base(), kind);
    console.log(`LATEFACT_COUNTS ${kind} schedules=${LF_SCHEDULES} schedules_where_a_fact_was_held_after_create=${r.late} violations=${r.bad.length}`);
    assert.ok(r.late >= 10, `the schedules must actually hit the window (only ${r.late} held after create)`);
    assert.deepEqual(r.bad.slice(0, 10), []);
  });
}
