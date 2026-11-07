import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";

// f250: the three plain putSubscription callers f248 left behind: (A) changePlan (plan_change_service), (B) cancelSubscription's cancelAt write, (C) markPaid's first subscription write.
// Each read the row, awaited, then blind-put a copy, so a cancel webhook (or sweep seed) that landed in between was overwritten. Now each goes through the f248 CAS helper / insert-if-absent.
// Forced interleavings use explicit barriers (promises), never sleeps. P1..P6 run on MemoryStore and D1PlanStore (FakeD1), on the real source AND on source mutants. SYNTHETIC ids, MockBilling only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any; pcs: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f250-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), pcs: await imp("plan_change_service.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
const DAY = 86_400_000;
const sessionObj = { id: "sub_1", current_period_start: T0 / 1000, current_period_end: T0 / 1000 + 30 * 86400, billing_cycle_anchor: T0 / 1000 };
const deps = (m: Mods, store: any, now = T0) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const cancelEv = (id: string) => ({ id, type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });
const ACC = { id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 };

async function world(m: Mods, kind: Kind, productId: string, status: "paid" | "pending" = "paid") {
  const db = new FakeD1(), s: any = kind === "d1" ? new m.d1.D1PlanStore(db) : new m.store.MemoryStore();
  await s.putAccount(ACC);
  const pur = { id: "pur1", accountId: "acc1", productId, checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0, status, ...(status === "paid" ? { paidAt: T0, paymentIntent: "pi_1", subscriptionId: "sub_1" } : {}) };
  await s.putPurchase(pur);
  return { s, pur };
}
async function seeded(m: Mods, kind: Kind, productId: string) {
  const { s, pur } = await world(m, kind, productId);
  await s.putSubscription(await m.svc.buildSubscription(deps(m, s), pur, sessionObj, T0));
  return s;
}
// Barrier: the nth (1-based) subscription WRITE through this store view parks until release(). Reads and every other call pass straight through.
const WRITES = ["casSubscription", "putSubscription", "putSubscriptionOnce"];
function barrier(s: any, nth = 1) {
  let release!: () => void, parkedRes!: () => void, n = 0;
  const gate = new Promise<void>((r) => (release = r)), parked = new Promise<void>((r) => (parkedRes = r));
  const view = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => {
    if (WRITES.includes(k) && ++n === nth) { parkedRes(); await gate; }
    return v.apply(t, a); }; } });
  return { view, parked, release: () => release() };
}

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };

  // P1 changePlan, cancel-during: the plan change has read, parks at its write; the cancel webhook writes cancelledAt; the plan change then writes. The webhook cancel must survive AND the plan change must land.
  { const s = await seeded(m, kind, "ai_growth"), a = ACC, later = T0 + 100 * DAY;
    const b = barrier(s), ch = m.pcs.changePlan(deps(m, b.view, later), a, "sub_1", { eventId: "evt_p1", kind: "cancel" });
    await b.parked;
    await m.svc.handleStripeEvent(deps(m, s, later), cancelEv("evt_c1"));
    b.release(); const r = await ch;
    const row = await s.subscriptionById("sub_1");
    want("P1", !!row?.cancelledAt, `P1 the webhook cancel must survive the plan change write, got ${JSON.stringify(row)}`);
    want("P1", !!r.outcome.ok && row?.cancelAt === r.outcome.effectiveAt, `P1 the plan change (cancelAt) must still land, got cancelAt=${row?.cancelAt}`);
    want("P1", !!row?.plan?.outcomes?.["evt_p1"], "P1 the plan must record the change outcome under its event id"); }

  // P2 changePlan, period-advance-during: invoice.paid (cycle) advances the plan while the plan change is parked; the advance must not be wiped.
  { const s = await seeded(m, kind, "ai_growth"), a = ACC, later = T0 + 100 * DAY;
    const before = JSON.stringify((await s.subscriptionById("sub_1")).plan);
    const b = barrier(s), ch = m.pcs.changePlan(deps(m, b.view, later), a, "sub_1", { eventId: "evt_p2", kind: "cancel" });
    await b.parked;
    const inv = { id: "evt_i2", type: "invoice.paid", data: { object: { subscription: "sub_1", billing_reason: "subscription_cycle", amount_paid: 150000, lines: { data: [{ period: { start: T0 / 1000 + 30 * 86400, end: T0 / 1000 + 61 * 86400 } }] } } } };
    await m.svc.handleStripeEvent(deps(m, s, later), inv);
    const midPlan = (await s.subscriptionById("sub_1")).plan, mid = JSON.stringify(midPlan);
    b.release(); await ch;
    const row = await s.subscriptionById("sub_1");
    want("P2", mid !== before, "P2 fixture: the invoice must have advanced the plan");
    want("P2", JSON.stringify(row?.plan?.periodNow) === JSON.stringify(midPlan?.periodNow) && JSON.stringify(row?.plan?.cycle) === JSON.stringify(midPlan?.cycle), `P2 the invoice's period advance must survive the plan change write, want ${JSON.stringify(midPlan?.periodNow)} got ${JSON.stringify(row?.plan?.periodNow)}`);
    want("P2", !!row?.cancelAt, "P2 the plan change must land too"); }

  // P3 changePlan replay is still a no-op (idempotent per eventId) and a lost CAS never double-applies.
  { const s = await seeded(m, kind, "ai_growth"), a = ACC, later = T0 + 100 * DAY;
    const r1 = await m.pcs.changePlan(deps(m, s, later), a, "sub_1", { eventId: "evt_p3", kind: "cancel" });
    const len = (await s.subscriptionById("sub_1")).plan.ledger.length;
    const r2 = await m.pcs.changePlan(deps(m, s, later), a, "sub_1", { eventId: "evt_p3", kind: "cancel" });
    want("P3", r2.replayed === true && (await s.subscriptionById("sub_1")).plan.ledger.length === len && r1.replayed === false, "P3 a replayed event id is a no-op"); }

  // P4 cancelSubscription (monitor), cancelAt write: re-read done, parked at its write; the webhook cancels; the cancelAt write then lands. Both must stand.
  { const s = await seeded(m, kind, "monitor_monthly"), a = ACC;
    const b = barrier(s), c = m.svc.cancelSubscription(deps(m, b.view), a, "sub_1");
    await b.parked;
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c4"));
    b.release(); const r = await c;
    const row = await s.subscriptionById("sub_1");
    want("P4", !!row?.cancelledAt, `P4 the webhook cancel must survive the cancelAt write, got ${JSON.stringify(row)}`);
    want("P4", r.status === "cancel_scheduled" && row?.cancelAt === r.effectiveAt, `P4 cancelAt must still land, got ${row?.cancelAt} vs ${r.effectiveAt}`); }

  // P5 cancelSubscription (retainer), the composed path: changePlan writes the plan + cancelAt, and the follow-up cancelAt step is a no-op when it already matches (so no second write exists to park); park the first write while the webhook cancels.
  { const s = await seeded(m, kind, "ai_growth"), a = ACC, later = T0 + 100 * DAY;
    const b = barrier(s), c = m.svc.cancelSubscription(deps(m, b.view, later), a, "sub_1");
    await b.parked;
    await m.svc.handleStripeEvent(deps(m, s, later), cancelEv("evt_c5"));
    b.release(); const r = await c;
    const row = await s.subscriptionById("sub_1");
    want("P5", !!row?.cancelledAt && row?.cancelAt === r.effectiveAt, `P5 retainer cancel: webhook cancel and cancelAt must both stand, got ${JSON.stringify({ c: row?.cancelledAt, a: row?.cancelAt, e: r.effectiveAt })}`); }

  // P6 markPaid first write: the winner parks at its subscription write; the f237 sweep seeds the row (lease expired) and a cancel webhook cancels it; the winner then writes. The cancel must survive, one row, one invoice.
  { const { s, pur } = await world(m, kind, "ai_growth", "pending");
    const stripeSess = { ...sessionObj, id: "cs_1", subscription: sessionObj, payment_intent: "pi_1", payment_status: "paid" };
    const b = barrier(s), win = m.svc.markPaid(deps(m, b.view), { ...pur }, stripeSess, "evt_6");
    await b.parked;
    const rival = await m.svc.buildSubscription(deps(m, s), { ...pur, subscriptionId: "sub_1" }, sessionObj, T0);
    await s.putSubscriptionOnce(rival);
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c6"));
    b.release(); await win;
    const row = await s.subscriptionById("sub_1"), subs = await s.subscriptionsFor("acc1"), inv = await s.invoicesFor("acc1");
    want("P6", !!row?.cancelledAt, `P6 the cancel on the sweep's row must survive the winner's first write, got ${JSON.stringify(row)}`);
    want("P6", subs.length === 1 && inv.length === 1, `P6 one subscription and one invoice, got ${subs.length}/${inv.length}`); }

  // P7 markPaid, held cancel: a cancel held before the payment is carried onto a row the sweep seeded first (merge by CAS, not lost).
  { const { s, pur } = await world(m, kind, "ai_growth", "pending");
    await s.holdFact("sub:sub_1", { kind: "cancel" });
    const stripeSess = { ...sessionObj, id: "cs_1", subscription: sessionObj, payment_intent: "pi_1", payment_status: "paid" };
    const b = barrier(s), win = m.svc.markPaid(deps(m, b.view), { ...pur }, stripeSess, "evt_7");
    await b.parked;
    await s.putSubscriptionOnce({ id: "sub_1", accountId: "acc1", purchaseId: "pur1", productId: "ai_growth", startedAt: T0 }); // the sweep's row, built before the cancel was visible to it
    b.release(); await win;
    const row = await s.subscriptionById("sub_1");
    want("P7", !!row?.cancelledAt, `P7 the held cancel the winner took must be merged onto the sweep's row, got ${JSON.stringify(row)}`); }

  // P8 retries are bounded and loud: an unwinnable CAS throws SubscriptionContention from changePlan (never a silent drop).
  { const s = await seeded(m, kind, "ai_growth");
    const always = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => (k === "casSubscription" ? false : v.apply(t, a)); } });
    let threw = "";
    try { await m.pcs.changePlan(deps(m, always, T0 + 100 * DAY), ACC, "sub_1", { eventId: "evt_p8", kind: "cancel" }); } catch (e) { threw = (e as Error).name; }
    want("P8", threw === "SubscriptionContention", `P8 an unwinnable CAS must throw SubscriptionContention, got ${JSON.stringify(threw)}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f250 P1..P8 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
  test(`f250 20 repeated runs, 0 failures (${kind})`, async () => {
    const m = await load(); let fails = 0;
    for (let i = 0; i < 20; i++) if ((await violations(m, kind)).length > 0) fails++;
    console.log(`C2PUTCAS_REPEAT ${kind} 20 runs, ${fails} failures`); assert.equal(fails, 0);
  });
}

const PCS_FROM = "const out = await casEditSubscription(d, subId, (s) => {";
const MUT: [string, [string, string, string][]][] = [
  ["M1 changePlan back to read-then-blind-put", [["plan_change_service.ts", PCS_FROM, "const out = await (async (f: (s: any) => boolean) => { const s = (await d.store.subscriptionById(subId))!; const ok = f(s); await d.store.putSubscription(s); return s; })((s) => {"]]],
  ["M2 cancelSubscription cancelAt back to re-read-then-put", [["service.ts", "await casEditSubscription(d, sub.id, (s) => { if (s.cancelAt === periodEnd) return false; s.cancelAt = periodEnd; return true; });", "{ const fresh = (await d.store.subscriptionById(sub.id)) ?? sub; fresh.cancelAt = periodEnd; await d.store.putSubscription(fresh); }"]]],
  ["M3 markPaid first write back to a blind upsert", [["service.ts", "if (!(await d.store.putSubscriptionOnce(built))) try { await casEditSubscription(", "if ((await d.store.putSubscription(built), false)) try { await casEditSubscription("]]],
  ["M4 markPaid drops the held-cancel merge", [["service.ts", "if (built.cancelledAt && !s.cancelledAt) { s.cancelledAt = built.cancelledAt; ch = true; }", ""]]],
  ["M5 changePlan retry loses the fresh row (SUB_TRIES = 1)", [["service.ts", "const SUB_TRIES = 8;", "const SUB_TRIES = 1;"]]],
];
test("f250 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2PUTCAS_MUTANTS ${killed}/${MUT.length} killed`);
});
