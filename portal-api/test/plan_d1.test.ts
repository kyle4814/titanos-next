import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, handleStripeEvent, type Deps } from "../src/service.ts";
import { changePlan } from "../src/plan_change_service.ts";
import { boundary, termEnd } from "../src/plan_change.ts";
import { FakeD1 } from "./fake_d1.ts";

// C2 plan state on D1 (f172). SYNTHETIC labelled fixtures only (example.invalid, sub_syn, cs_syn): no network, no Stripe key, no live D1.
// FakeD1 is real SQLite with the REAL migration files (0004_subscription_plan.sql included) and foreign keys ON.
const DAY = 86_400_000, sec = (y: number, m: number, d: number, h = 0, mi = 0) => Math.floor(Date.UTC(y, m - 1, d, h, mi) / 1000);
const T0 = Date.UTC(2026, 10, 6);
const START = sec(2026, 11, 17, 3, 20), END = sec(2026, 12, 17, 3, 20); // mid-month Stripe period, deliberately not the handler clock

type Cls = new (db: any) => D1PlanStore;
type Mods = { D1PlanStore: Cls; svc: any; billing: any; resolver: any; plan: any };

// One scenario, any D1PlanStore class: seed from a Stripe checkout event, change plan, RESTART (new store, same FakeD1), then check.
async function violations(m: Mods): Promise<string[]> {
  const bad: string[] = [], d1 = new FakeD1(); let t = T0, store = new m.D1PlanStore(d1);
  const deps = (): Deps => ({ store, billing: new m.billing.MockBilling(), dns: m.resolver.fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => t, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" });
  const a = { id: "acc_syn", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
  await store.putAccount(a);
  await store.putPurchase({ id: "pur_syn", accountId: a.id, productId: "ai_growth", checkoutId: "cs_syn", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
  const sub = { id: "sub_syn", current_period_start: START, current_period_end: END, billing_cycle_anchor: START };
  await m.svc.handleStripeEvent(deps(), { id: "e1", type: "checkout.session.completed", data: { object: { id: "cs_syn", payment_status: "paid", payment_intent: "pi_syn", customer: "cus_syn", subscription: sub } } });
  t = START * 1000 + 10 * DAY;
  const up = await changePlan(deps(), a, "sub_syn", { eventId: "evt_up", kind: "upgrade", to: "ai_embedded" });
  const dn = await changePlan(deps(), a, "sub_syn", { eventId: "evt_dn", kind: "downgrade", to: "ai_ops" });
  const before = await store.subscriptionById("sub_syn");
  if (!before?.plan) { bad.push("P1 plan not stored (none read back before restart)"); return bad; }

  store = new m.D1PlanStore(d1); // RESTART: nothing in process memory, only SQLite rows
  const after = await store.subscriptionById("sub_syn");
  if (!after?.plan) { bad.push("P1 plan lost across restart"); return bad; }
  if (JSON.stringify(after.plan) !== JSON.stringify(before.plan)) bad.push("P1b plan changed across restart");
  if (after.plan.tier !== "ai_embedded" || after.productId !== "ai_embedded") bad.push("P2 tier lost");
  if (after.plan.startedAt !== START * 1000) bad.push("P3 period start lost");
  if (JSON.stringify(after.plan.periodNow) !== JSON.stringify({ start: START * 1000, end: END * 1000 })) bad.push("P3b current period lost");
  if (!after.plan.cycle || boundary(after.plan, 1) !== END * 1000) bad.push("P3c billing grid lost");
  if (after.plan.pending?.kind !== "downgrade" || after.plan.pending.effectiveAt !== (dn.outcome as any).effectiveAt) bad.push("P4 scheduled downgrade lost");
  // minimum term: the downgrade asked at day 10 may not take effect before start + 3 calendar months
  const term = m.plan.termEnd(START * 1000);
  if (!((dn.outcome as any).effectiveAt >= term)) bad.push("P5 minimum term not honoured by the stored downgrade");
  // replay after restart: first outcome back, ledger untouched
  const rp = await changePlan(deps(), a, "sub_syn", { eventId: "evt_up", kind: "upgrade", to: "ai_embedded" });
  if (!rp.replayed || JSON.stringify(rp.outcome) !== JSON.stringify(up.outcome)) bad.push("P6 replay after restart not idempotent");
  const again = await store.subscriptionById("sub_syn");
  if (again!.plan!.ledger.length !== after.plan.ledger.length) bad.push("P6b replay grew the ledger");
  // a cancel after the restart still lands on or after the minimum term end
  t = START * 1000 + 20 * DAY;
  const c = await changePlan(deps(), a, "sub_syn", { eventId: "evt_c", kind: "cancel" });
  const fin = await store.subscriptionById("sub_syn");
  if (!(c.outcome as any).ok || fin!.cancelAt !== (c.outcome as any).effectiveAt || fin!.cancelAt! < term) bad.push("P7 cancel after restart inside the term");
  // a third store instance sees the cancel too
  if ((await new m.D1PlanStore(d1).subscriptionById("sub_syn"))!.cancelAt !== fin!.cancelAt) bad.push("P8 cancelAt not durable");
  // the row for a plain subscription with no plan stays NULL, not the string "undefined"
  await store.putPurchase({ id: "pur_m", accountId: a.id, productId: "monitor_monthly", checkoutId: "cs_m", amountCents: 14900, deliverableIssued: false, refundedCents: 0, status: "paid" });
  await store.putSubscription({ id: "sub_m", accountId: a.id, purchaseId: "pur_m", productId: "monitor_monthly", startedAt: T0 });
  const raw = d1.db.prepare("SELECT plan_json FROM subscriptions WHERE id = 'sub_m'").get() as any;
  if (raw.plan_json !== null) bad.push("P9 planless subscription stored a value");
  if ((await store.subscriptionById("sub_m"))!.plan !== undefined) bad.push("P9b planless subscription read back a plan");
  return bad;
}
const REAL: Mods = { D1PlanStore, svc: { MockMailer, handleStripeEvent }, billing: { MockBilling }, resolver: { fakeResolver }, plan: { termEnd } };

test("restart: a new D1PlanStore over the same FakeD1 keeps plan, Stripe period, billing grid, pending downgrade and the minimum term", async () => {
  assert.deepEqual(await violations(REAL), []);
});

test("migration 0004 is additive, nullable, marked NOT APPLIED, and the column exists in the schema the adapter ran against", () => {
  const sql = readFileSync(resolve(import.meta.dirname, "../migrations/0004_subscription_plan.sql"), "utf8");
  assert.match(sql, /NOT APPLIED/); assert.match(sql, /ALTER TABLE subscriptions ADD COLUMN plan_json TEXT;/);
  assert.doesNotMatch(sql, /NOT NULL|DROP|DELETE|UPDATE/i);
  const cols = new FakeD1().db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string; notnull: number }[];
  const c = cols.find((x) => x.name === "plan_json"); assert.ok(c); assert.equal(c!.notnull, 0);
});

test("the schema is enforced: a subscription whose purchase row does not exist is refused by D1 (foreign keys ON)", async () => {
  const d1 = new FakeD1(), s = new D1PlanStore(d1);
  await s.putAccount({ id: "acc_f", email: "fk@example.invalid", seat: "owner", createdAt: T0 });
  await assert.rejects(() => s.putSubscription({ id: "sub_f", accountId: "acc_f", purchaseId: "pur_missing", productId: "ai_growth", startedAt: T0 }), /FOREIGN KEY/i);
});

test("an upsert replaces the stored plan (second write wins) and clears cancelAt when set undefined", async () => {
  const d1 = new FakeD1(), s = new D1PlanStore(d1);
  await s.putAccount({ id: "acc_u", email: "u@example.invalid", seat: "owner", createdAt: T0 });
  await s.putPurchase({ id: "pur_u", accountId: "acc_u", productId: "ai_growth", checkoutId: "cs_u", amountCents: 1, deliverableIssued: false, refundedCents: 0, status: "paid" });
  const base = { id: "sub_u", accountId: "acc_u", purchaseId: "pur_u", productId: "ai_growth", startedAt: T0 };
  await s.putSubscription({ ...base, cancelAt: T0 + DAY, plan: { startedAt: T0, tier: "ai_growth", billedPeriods: 1, lastAt: T0, ledger: [], outcomes: {} } as any });
  await s.putSubscription({ ...base, cancelAt: undefined, plan: { startedAt: T0, tier: "ai_growth", billedPeriods: 2, lastAt: T0, ledger: [], outcomes: {} } as any });
  const r = (await new D1PlanStore(d1).subscriptionById("sub_u"))!;
  assert.equal(r.plan!.billedPeriods, 2); assert.equal("cancelAt" in r, false);
  assert.equal((await s.subscriptionsFor("acc_u")).length, 1);
});

// ---------- mutation: each adapter mutant must be caught by a named check ----------
const SRC = resolve(import.meta.dirname, "../src");
const MUT: { id: string; inv: string; from: string; to: string }[] = [
  { id: "A1 write omits plan_json", inv: "P1", from: "s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan));", to: "s.cancelAt), n(s.cancelledAt), null);" },
  { id: "A2 read ignores plan_json", inv: "P1", from: "if (r.plan_json !== null && r.plan_json !== undefined) s.plan", to: "if (false) s.plan" },
  { id: "A3 upsert keeps the old plan_json", inv: "P2", from: "cancelled_at = excluded.cancelled_at, plan_json = excluded.plan_json", to: "cancelled_at = excluded.cancelled_at" },
  { id: "A4 upsert keeps the old cancel_at", inv: "P7", from: "cancel_at = excluded.cancel_at, cancelled_at", to: "cancelled_at" },
  { id: "A5 planless row stores the string null", inv: "P9", from: "s.plan === undefined ? null : JSON.stringify(s.plan)", to: "JSON.stringify(s.plan) ?? 'null'" },
  { id: "A6 started_at not persisted", inv: "P3", from: "n(s.cancelAt), n(s.cancelledAt), s.plan", to: "n(s.cancelAt), n(s.cancelledAt), s.plan" }, // placeholder replaced below
];
MUT[5] = { id: "A6 product_id not updated on upsert", inv: "P2", from: "product_id = excluded.product_id, started_at = excluded.started_at, cancel_at", to: "started_at = excluded.started_at, cancel_at" };
test(`mutation: ${MUT.length} of ${MUT.length} adapter mutants are killed by their named check`, async () => {
  const text = readFileSync(join(SRC, "d1_plan_store.ts"), "utf8");
  for (const mu of MUT) {
    assert.equal(text.split(mu.from).length - 1, 1, `anchor must match exactly once: ${mu.id}`);
    const root = mkdtempSync(join(tmpdir(), "pland1_mut_")), dir = join(root, "portal-api"); mkdirSync(dir);
    try {
      symlinkSync(resolve(SRC, "../../lib"), join(root, "lib"));   // src/market value-imports ../../../lib
      cpSync(SRC, join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "d1_plan_store.ts"), text.replace(mu.from, mu.to));
      const U = (f: string) => import(pathToFileURL(join(dir, "src", f)).href);
      const [ds, svc, st, dns, plan] = await Promise.all([U("d1_plan_store.ts"), U("service.ts"), U("stripe.ts"), U("dns.ts"), U("plan_change.ts")]);
      const bad = await violations({ D1PlanStore: ds.D1PlanStore, svc, billing: st, resolver: dns, plan });
      assert.ok(bad.length > 0, "SURVIVED: " + mu.id);
      assert.ok(bad.some((b) => b.startsWith(mu.inv)), `killed, but not by ${mu.inv}: ${bad.slice(0, 3).join(" | ")}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
