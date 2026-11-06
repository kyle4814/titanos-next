import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { MemoryStore } from "../src/store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, handleStripeEvent, type Deps } from "../src/service.ts";
import { boundary, periodFromStripe, cycleFor, observePeriod, initPlanFromStripe, addMonths } from "../src/plan_change.ts";

// C2 Stripe period seed (f101). SYNTHETIC fixtures only (example.invalid, sub_syn*, cs_syn*): no network, no Stripe key, no model call.
// Event shapes are MOCKS of the documented fields (seconds on the wire): checkout.session.completed with `subscription` expanded
// (current_period_start/end, billing_cycle_anchor) and invoice.paid with the paid service period on lines.data[0].period.
const HERE = dirname(fileURLToPath(import.meta.url)), SRC = join(HERE, "..", "src");
const sec = (y: number, m: number, d: number, h = 0, mi = 0) => Math.floor(Date.UTC(y, m - 1, d, h, mi) / 1000);
const ms = (x: number) => x * 1000;
const T0 = Date.UTC(2026, 10, 6); // the handler clock: deliberately NOT the Stripe start, so "seeded from now" is distinguishable
type Ev = { id: string; type: string; data: { object: Record<string, any> } };

function fresh(productId = "ai_growth") {
  const store = new MemoryStore(), log: string[] = [];
  const deps: Deps = { store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", log: (l) => log.push(l) };
  void store.putAccount({ id: "acc_syn", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 });
  void store.putPurchase({ id: "pur_syn", accountId: "acc_syn", productId, checkoutId: "cs_syn", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
  return { store, deps, log };
}
const subObj = (start: number, end: number, anchor = start) => ({ id: "sub_syn", current_period_start: start, current_period_end: end, billing_cycle_anchor: anchor });
const checkout = (id: string, sub: unknown): Ev => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_syn", payment_status: "paid", payment_intent: "pi_syn", customer: "cus_syn", subscription: sub } } });
const invoice = (id: string, reason: string, start: number, end: number, extra: Record<string, any> = {}): Ev => ({ id, type: "invoice.paid", data: { object: { id: `in_${id}`, subscription: "sub_syn", billing_reason: reason, amount_paid: 150000, lines: { data: [{ period: { start, end } }] }, ...extra } } });
const planOf = async (h: ReturnType<typeof fresh>) => (await h.store.subscriptionById("sub_syn"))!;

test("S1 mid-month start: checkout seeds PlanState from Stripe's current period, not the handler clock or a calendar month", async () => {
  const h = fresh(), start = sec(2026, 11, 17, 3, 20), end = sec(2026, 12, 17, 3, 20);
  assert.equal(await handleStripeEvent(h.deps, checkout("e1", subObj(start, end))), "handled");
  const sub = await planOf(h);
  assert.equal(sub.startedAt, ms(start)); assert.notEqual(sub.startedAt, T0);
  assert.equal(sub.plan!.startedAt, ms(start));
  assert.equal(boundary(sub.plan!, 1), ms(end));                       // period 1 ends exactly where Stripe says
  assert.equal(boundary(sub.plan!, 2), Date.UTC(2027, 0, 17, 3, 20));   // and the grid continues on the 17th at 03:20 UTC
  assert.deepEqual(sub.plan!.periodNow, { start: ms(start), end: ms(end) });
  assert.equal(sub.plan!.ledger.length, 1); assert.equal(sub.plan!.billedPeriods, 1);
  // the old rule (calendar months from the handler clock) would have said 6 Dec: that is the defect this lane closes
  assert.notEqual(addMonths(T0, 1), ms(end));
});

test("S2 31-day versus 28-day month: anchor day 31 keeps Feb 28 -> Mar 31, never drifts to the 28th", async () => {
  const h = fresh(), a = sec(2027, 1, 31, 10, 0);
  await handleStripeEvent(h.deps, checkout("e1", subObj(a, sec(2027, 2, 28, 10, 0))));
  let sub = await planOf(h); const p = sub.plan!;
  assert.equal(boundary(p, 1) - boundary(p, 0), 28 * 86_400_000);
  assert.equal(boundary(p, 2) - boundary(p, 1), 31 * 86_400_000);       // Feb 28 -> Mar 31 (a cumulative +1 month would give Mar 28)
  assert.equal(boundary(p, 3), Date.UTC(2027, 3, 30, 10, 0));            // Apr has 30 days: clamped, again from the anchor
  await handleStripeEvent(h.deps, invoice("e2", "subscription_cycle", sec(2027, 2, 28, 10, 0), sec(2027, 3, 31, 10, 0)));
  await handleStripeEvent(h.deps, invoice("e3", "subscription_cycle", sec(2027, 3, 31, 10, 0), sec(2027, 4, 30, 10, 0)));
  sub = await planOf(h);
  assert.equal(sub.plan!.billedPeriods, 3); assert.equal(sub.plan!.ledger.length, 3);
  assert.deepEqual(sub.plan!.periodNow, { start: ms(sec(2027, 3, 31, 10, 0)), end: ms(sec(2027, 4, 30, 10, 0)) });
  assert.equal(sub.plan!.ledger.every((e) => e.cents === 150000), true);
  // leap year: 29 Feb 2028
  assert.equal(addMonths(Date.UTC(2028, 0, 31), 1), Date.UTC(2028, 1, 29));
});

test("S3 delayed billing anchor: a short first period, then the anchor's grid", async () => {
  const h = fresh(), s = sec(2026, 11, 17, 3, 20), anchor = sec(2026, 12, 1, 0, 0);
  await handleStripeEvent(h.deps, checkout("e1", subObj(s, anchor, anchor)));
  const p = (await planOf(h)).plan!;
  assert.equal(boundary(p, 1), ms(anchor)); assert.equal(boundary(p, 2), Date.UTC(2027, 0, 1)); assert.equal(boundary(p, 3), Date.UTC(2027, 1, 1));
  assert.ok(boundary(p, 1) - boundary(p, 0) < 28 * 86_400_000);          // 14 days: not a calendar month from the start
  assert.equal(p.cycle!.irregular, undefined);
});

test("S4 replayed event: same id is a duplicate; the same period under a fresh id changes nothing", async () => {
  const h = fresh(), a = sec(2026, 11, 17), b = sec(2026, 12, 17), c = sec(2027, 1, 17);
  await handleStripeEvent(h.deps, checkout("e1", subObj(a, b)));
  assert.equal(await handleStripeEvent(h.deps, checkout("e1", subObj(a, b))), "duplicate");
  await handleStripeEvent(h.deps, invoice("e2", "subscription_cycle", b, c));
  const before = JSON.stringify((await planOf(h)).plan);
  assert.equal(await handleStripeEvent(h.deps, invoice("e2", "subscription_cycle", b, c)), "duplicate");
  await handleStripeEvent(h.deps, invoice("e2b_fresh_id", "subscription_cycle", b, c));  // Stripe resend under a new id
  assert.equal(JSON.stringify((await planOf(h)).plan), before);
  assert.equal((await h.store.subscriptionsFor("acc_syn")).length, 1);
});

test("S5 out-of-order: an older invoice never rewinds; a cycle invoice before its checkout is held and applied in order", async () => {
  const h = fresh(), p0 = sec(2026, 11, 17), p1 = sec(2026, 12, 17), p2 = sec(2027, 1, 17), p3 = sec(2027, 2, 17);
  // invoices for periods 2 and 1 arrive (newest first) BEFORE the checkout; the subscription_create invoice arrives last of all
  assert.equal(await handleStripeEvent(h.deps, invoice("i2", "subscription_cycle", p2, p3)), "handled");
  assert.equal(await handleStripeEvent(h.deps, invoice("i1", "subscription_cycle", p1, p2)), "handled");
  assert.equal(await handleStripeEvent(h.deps, invoice("i0", "subscription_create", p0, p1)), "handled");
  assert.equal(await h.store.subscriptionById("sub_syn"), undefined);   // still no subscription: nothing seeded from a cycle invoice alone
  await handleStripeEvent(h.deps, checkout("c", "sub_syn"));            // string subscription: the held create period seeds the plan
  const sub = await planOf(h), p = sub.plan!;
  assert.equal(sub.startedAt, ms(p0)); assert.equal(p.billedPeriods, 3);
  assert.deepEqual(p.periodNow, { start: ms(p2), end: ms(p3) });
  assert.equal(sub.cancelledAt, undefined);                              // regression: held PERIOD facts must not read as a held cancel
  // after the plan exists, an older invoice is stale
  const snap = JSON.stringify(sub.plan);
  await handleStripeEvent(h.deps, invoice("late1", "subscription_cycle", p1, p2));
  assert.equal(JSON.stringify((await planOf(h)).plan), snap);
});

test("S6 cancel and period both held before the checkout: the cancel applies, the period seeds, neither eats the other", async () => {
  const h = fresh(), a = sec(2026, 11, 17), b = sec(2026, 12, 17);
  await handleStripeEvent(h.deps, invoice("i0", "subscription_create", a, b));
  await handleStripeEvent(h.deps, { id: "d1", type: "customer.subscription.deleted", data: { object: { id: "sub_syn" } } });
  await handleStripeEvent(h.deps, checkout("c", "sub_syn"));
  const sub = await planOf(h);
  assert.ok(sub.cancelledAt); assert.equal(sub.plan!.startedAt, ms(a));
});

test("S7 a cycle invoice after a string-only checkout waits for the create invoice and never defines the start", async () => {
  const h = fresh(), a = sec(2026, 11, 17), b = sec(2026, 12, 17), c = sec(2027, 1, 17);
  await handleStripeEvent(h.deps, checkout("c", "sub_syn"));
  const noPlan = await planOf(h); assert.equal(noPlan.plan, undefined); assert.equal(noPlan.startedAt, T0); // no period known: old calendar behaviour, unchanged
  await handleStripeEvent(h.deps, invoice("i1", "subscription_cycle", b, c));
  assert.equal((await planOf(h)).plan, undefined);                       // held, not seeded
  await handleStripeEvent(h.deps, invoice("i0", "subscription_create", a, b));
  const sub = await planOf(h);
  assert.equal(sub.startedAt, ms(a)); assert.equal(sub.plan!.billedPeriods, 2); assert.deepEqual(sub.plan!.periodNow, { start: ms(b), end: ms(c) });
});

test("S8 hostile periods: zero, negative, reversed, fractional and string values seed nothing and never throw", async () => {
  const bad: any[] = [[0, 100], [-5, 10], [200, 100], [100, 100], [1.5e9 + 0.5, 1.6e9], ["1700000000", "1700100000"], [null, undefined], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]];
  for (const [s, e] of bad) {
    const h = fresh();
    await handleStripeEvent(h.deps, checkout("c", { id: "sub_syn", current_period_start: s, current_period_end: e }));
    const sub = await planOf(h); assert.equal(sub.plan, undefined, JSON.stringify([s, e])); assert.equal(sub.startedAt, T0);
  }
  assert.equal(periodFromStripe(1, 2)?.start, 1000);
  const h = fresh(); const a = sec(2026, 11, 17), b = sec(2026, 12, 17);
  await handleStripeEvent(h.deps, checkout("c", subObj(a, b)));
  await handleStripeEvent(h.deps, invoice("off", "subscription_cycle", sec(2026, 12, 20), sec(2027, 1, 20))); // off the grid
  assert.ok(h.log.some((l) => l.includes("off the billing grid")));
  assert.deepEqual((await planOf(h)).plan!.periodNow, { start: ms(a), end: ms(b) });                          // state untouched
  const nonRetainer = fresh("monitor_monthly");
  await handleStripeEvent(nonRetainer.deps, checkout("c", subObj(a, b)));
  assert.equal((await planOf(nonRetainer)).plan, undefined);                                                   // monitor owns no PlanState
});

// ---- property: any order, any duplication, the same final plan --------------------------------------------------------
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const P = (n: number, day: number) => { const d = new Date(Date.UTC(2027, 0, 1) ); return [addMonths(Date.UTC(2026, 11, day, 5, 5), n) / 1000]; };
test("S9 property: 400 seeded shuffles with duplicates reach the canonical plan", async () => {
  const r = rng(101_2026_11_07);
  for (let i = 0; i < 400; i++) {
    const day = [1, 15, 28, 29, 30, 31][Math.floor(r() * 6)], n = 2 + Math.floor(r() * 4), g = (k: number) => P(k, day)[0];
    const expanded = r() < 0.5;
    const evs: Ev[] = [checkout("c", expanded ? subObj(g(0), g(1), g(0)) : "sub_syn"), invoice("i0", "subscription_create", g(0), g(1))];
    for (let k = 1; k <= n; k++) evs.push(invoice(`i${k}`, "subscription_cycle", g(k), g(k + 1)));
    const canon = fresh(); for (const e of evs) await handleStripeEvent(canon.deps, e);
    const want = (await planOf(canon)).plan!;
    const order = [...evs]; for (let j = order.length - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)); [order[j], order[q]] = [order[q], order[j]]; }
    for (let k = 0; k < 3; k++) order.splice(Math.floor(r() * (order.length + 1)), 0, { ...evs[Math.floor(r() * evs.length)], id: `dup_${i}_${k}` });
    const h = fresh(); const events = order.map((e, ix) => (e.id.startsWith("dup_") || e.id === "c" ? e : e));
    // the string-only checkout needs its create invoice; if the create invoice arrived first or last the plan must still converge
    for (const e of events) await handleStripeEvent(h.deps, e);
    const got = (await planOf(h)).plan;
    assert.ok(got, `seq ${i}: plan exists`);
    assert.equal(got!.startedAt, ms(g(0)), `seq ${i}: start from Stripe`);
    assert.deepEqual(got!.periodNow, want.periodNow, `seq ${i}: newest period`);
    assert.equal(got!.billedPeriods, want.billedPeriods, `seq ${i}: billed periods`);
    assert.equal(got!.ledger.length, want.ledger.length, `seq ${i}: one ledger line per period`);
    assert.deepEqual(got!.cycle, want.cycle);
    for (let k = 0; k < got!.billedPeriods; k++) assert.equal(got!.ledger[k].at, boundary(got!, k), `seq ${i}: ledger on Stripe boundary ${k}`);
  }
  console.log("STRIPEPERIOD_COUNTS shuffles=400 anchors=1,15,28,29,30,31");
});

// ---- mutation: each new invariant has a mutant that must be killed -------------------------------------------------------
function load(edits: [string, string, string][]) { // [file, from, to]; each anchor must match exactly once
  const dir = mkdtempSync(join(tmpdir(), "f101mut-")); mkdirSync(join(dir, "src")); mkdirSync(join(dir, "test"));
  try {
    for (const f of ["catalogue.ts", "dns.ts", "env.ts", "flows.ts", "index.ts", "plan_change.ts", "plan_change_service.ts", "refund_card.ts", "service.ts", "store.ts", "stripe.ts", "util.ts"]) {
      let t = readFileSync(join(SRC, f), "utf8");
      for (const [ef, from, to] of edits) if (ef === f) { assert.equal(t.split(from).length - 1, 1, `anchor not unique in ${f}: ${from}`); t = t.replace(from, to); }
      writeFileSync(join(dir, "src", f), t);
    }
    copyFileSync(fileURLToPath(import.meta.url), join(dir, "test", "stripe_period.test.ts"));
    const run = spawnSync(process.execPath, ["--test", "--experimental-strip-types", "--test-name-pattern=^S[0-9]", join(dir, "test", "stripe_period.test.ts")], { encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")), F101_MUTANT: "1" } });
    return { code: run.status, out: run.stdout + run.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const MUT: { id: string; inv: string; edits: [string, string, string][] }[] = [
  { id: "M1 start from the handler clock, not Stripe", inv: "S1", edits: [["service.ts", "startedAt: sp ? sp.start : now,", "startedAt: now,"], ["service.ts", "sub.startedAt = p.start; sub.plan", "sub.plan"]] },
  { id: "M2 grid ignores the anchor (calendar months from start)", inv: "S3", edits: [["plan_change.ts", "const anchor = p.anchor ?? p.start;", "const anchor = p.start;"]] },
  { id: "M3 cumulative month (no clamp from anchor)", inv: "S2", edits: [["plan_change.ts", "addMonths(s.cycle ? s.cycle.anchor : s.startedAt, (s.cycle ? s.cycle.offset : 1) + k - 1)", "addMonths(boundary(s, k - 1), 1)"]] },
  { id: "M4 replay re-applied (same start advances again)", inv: "S4", edits: [["plan_change.ts", "if (cur && p.start === cur.start) return { state: s, applied: \"same\" };", ""], ["plan_change.ts", "return { state: { ...advance(s, p.start), periodNow", "return { state: { ...s, billedPeriods: s.billedPeriods + 1, periodNow"]] },
  { id: "M5 stale period rewinds", inv: "S5", edits: [["plan_change.ts", "if (cur && p.start < cur.start) return { state: s, applied: \"stale\" };", ""]] },
  { id: "M6 any held fact cancels", inv: "S5", edits: [["service.ts", "cancel = facts.some((f) => f.kind === \"cancel\");", "cancel = facts.length > 0;"]] },
  { id: "M7 a cycle invoice may define the start", inv: "S7", edits: [["service.ts", "if (!create) { const f =", "if (false as boolean) { const f ="]] },
  { id: "M8 off-grid period applied", inv: "S8", edits: [["plan_change.ts", "if (boundary(s, k) !== p.start) return { state: s, applied: \"offgrid\" };", ""]] },
  { id: "M9 invalid period accepted", inv: "S8", edits: [["plan_change.ts", "if (!okSec(startSec) || !okSec(endSec) || startSec >= endSec) return undefined;", ""]] },
];
if (!process.env.F101_MUTANT) for (const mu of MUT) {
  test(`mutant ${mu.id} is killed by ${mu.inv}`, () => {
    const r = load(mu.edits);
    assert.notEqual(r.code, 0, "SURVIVED: " + mu.id);
    assert.ok(new RegExp(`not ok \\d+ - ${mu.inv} `).test(r.out), `killed, but not by ${mu.inv}:\n${r.out.slice(0, 600)}`);
  });
}
