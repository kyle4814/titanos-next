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

// f251 (C2 residual from f245 limit 2): a checkout winner stalls past its lease TTL after its buildSubscription TOOK the held invoice periods (an invoice.paid that beat the checkout). The reconcile sweep seeds
// the row from Stripe's session period, which can differ from the held one; when the winner resumes, its insert-if-absent loses and only the held cancel and the plan-if-absent were merged, so the periods
// the winner consumed vanished with the row it built. Now buildSubscriptionTaken returns the taken periods and the merge observes them onto the stored row through casEditSubscription (the f248 helper).
// Forced interleavings use explicit barriers (promises), never sleeps. H1..H5 run on MemoryStore and D1PlanStore (FakeD1), on the real source AND on source mutants. SYNTHETIC ids, MockBilling only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f251-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), rec: await imp("reconcile.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
const addMonths = (ms: number, n: number) => { const x = new Date(ms); x.setUTCMonth(x.getUTCMonth() + n); return x.getTime(); };
// a session whose period is month `k` of a grid anchored at T0 (so month 0 = the first period)
const sessionFor = (k: number) => ({ id: "sub_1", current_period_start: addMonths(T0, k) / 1000, current_period_end: addMonths(T0, k + 1) / 1000, billing_cycle_anchor: T0 / 1000 });
const heldPeriod = (k: number) => ({ kind: "period", start: addMonths(T0, k), end: addMonths(T0, k + 1), create: false });
const ACC = { id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 };
const deps = (m: Mods, store: any, now = T0) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });

async function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), s: any = kind === "d1" ? new m.d1.D1PlanStore(db) : new m.store.MemoryStore();
  await s.putAccount(ACC);
  const pur = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "pending" };
  await s.putPurchase(pur);
  return { s, pur };
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
const paidSession = (k: number) => ({ id: "cs_1", status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: "pi_1", customer: "cus_1", subscription: sessionFor(k) as any });

// The winner (session period 0) took `held` months as invoice periods, stalls at its first subscription write past the lease TTL; the sweep seeds from `sweepMonth`; the winner then resumes.
async function race(m: Mods, kind: Kind, held: number[], sweepMonth: number) {
  const { s, pur } = await world(m, kind);
  for (const k of held) await s.holdFact("sub:sub_1", heldPeriod(k));
  const o = { payment_intent: "pi_1", customer: "cus_1", subscription: sessionFor(0) };
  const b = barrier(s), win = m.svc.markPaid(deps(m, b.view), { ...pur }, o, "evt_w");
  await b.parked; // the winner has claimed, taken its facts (build done), and is parked at its first subscription write
  const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession(sweepMonth));
  const rep = await m.rec.reconcileSubscriptions(s, bill, T0 + m.svc.LEASE_MS + 1, 0); // the lease has expired: the sweep proceeds
  b.release(); const r = await win;
  return { s, pur, rep, r, o };
}

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const shape = async (s: any) => ({ subs: await s.subscriptionsFor("acc1"), inv: (await s.invoicesFor("acc1")).length });

  // H1 the headline: the winner took a held month-1 invoice period; the sweep seeded from the month-0 session period. The final row must carry month 1 (the later), one row, one invoice.
  { const { s, rep, r } = await race(m, kind, [1], 0);
    const { subs, inv } = await shape(s);
    want("H1", rep.seeded === 1, `H1 the sweep must have seeded the row, got ${JSON.stringify(rep)}`);
    want("H1", r.won === true, "H1 the stalled winner still won the purchase claim");
    want("H1", subs.length === 1 && inv === 1, `H1 exactly one subscription and one invoice, got ${subs.length}/${inv}`);
    want("H1", subs[0]?.plan?.periodNow?.start === addMonths(T0, 1), `H1 the winner's held invoice period (month 1) must be re-applied to the sweep's row, got periodNow=${JSON.stringify(subs[0]?.plan?.periodNow)}`);
    want("H1", (await s.takeFacts("sub:sub_1")).length === 0, "H1 no held fact left behind"); }

  // H2 several held periods: the latest wins, billed periods follow the grid.
  { const { s } = await race(m, kind, [1, 2], 0);
    const { subs, inv } = await shape(s);
    want("H2", subs.length === 1 && inv === 1 && subs[0]?.plan?.periodNow?.start === addMonths(T0, 2), `H2 the later of two held periods (month 2) must win, got ${JSON.stringify(subs[0]?.plan?.periodNow)} (${subs.length}/${inv})`); }

  // H3 the sweep is already AHEAD (its session period is month 3): the winner's older periods are stale and must not rewind the row.
  { const { s } = await race(m, kind, [1], 3);
    const { subs, inv } = await shape(s);
    want("H3", subs.length === 1 && inv === 1 && subs[0]?.plan?.periodNow?.start === addMonths(T0, 3), `H3 an older taken period must never rewind the sweep's newer plan, got ${JSON.stringify(subs[0]?.plan?.periodNow)} (${subs.length}/${inv})`); }

  // H4 replay of the same sequence is a no-op: markPaid again, the sweep again, and the merge itself again leave the row byte-identical and write nothing.
  { const { s, pur, o } = await race(m, kind, [1], 0);
    const before = JSON.stringify(await s.subscriptionById("sub_1"));
    let writes = 0;
    const counted = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => { if (WRITES.includes(k)) writes++; return v.apply(t, a); }; } });
    const again = await m.svc.markPaid(deps(m, counted), { ...pur }, o, "evt_w2");
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession(0));
    const rep = await m.rec.reconcileSubscriptions(counted, bill, T0 + m.svc.LEASE_MS + 5, 0);
    const built = await m.svc.buildSubscriptionTaken(deps(m, counted), { ...pur, subscriptionId: "sub_1" }, o.subscription, T0);
    await m.svc.casEditSubscription(deps(m, counted), "sub_1", (row: any) => m.svc.mergeTakenPeriods(deps(m, counted), row, [...built.periods, { start: addMonths(T0, 1), end: addMonths(T0, 2) }]));
    const { subs, inv } = await shape(s);
    want("H4", again.won === false, "H4 a replayed markPaid must lose the claim");
    want("H4", JSON.stringify(subs[0]) === before, `H4 replay must leave the row identical, before=${before} after=${JSON.stringify(subs[0])}`);
    want("H4", writes === 0 && rep.seeded === 0 && subs.length === 1 && inv === 1, `H4 replay must write nothing, got writes=${writes} seeded=${rep.seeded} subs=${subs.length} inv=${inv}`); }

  // H5 buildSubscriptionTaken reports exactly the periods it consumed (session period first, then held ones oldest first), and buildSubscription still returns the bare row.
  { const { s, pur } = await world(m, kind);
    await s.holdFact("sub:sub_1", heldPeriod(2)); await s.holdFact("sub:sub_1", heldPeriod(1));
    const p = { ...pur, subscriptionId: "sub_1" };
    const t = await m.svc.buildSubscriptionTaken(deps(m, s), p, sessionFor(0), T0);
    want("H5", JSON.stringify(t.periods.map((x: any) => x.start)) === JSON.stringify([0, 1, 2].map((k) => addMonths(T0, k))), `H5 taken periods must be session then held oldest first, got ${JSON.stringify(t.periods.map((x: any) => x.start))}`);
    want("H5", t.sub.plan?.periodNow?.start === addMonths(T0, 2) && !("periods" in t.sub), "H5 the built row carries the latest period and no stray field");
    await s.holdFact("sub:sub_1", heldPeriod(1));
    const bare = await m.svc.buildSubscription(deps(m, s), p, sessionFor(0), T0);
    want("H5", bare.id === "sub_1" && !("periods" in bare), "H5 buildSubscription keeps returning the bare Subscription"); }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f251 H1..H5 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
  test(`f251 20 repeated runs, 0 failures (${kind})`, async () => {
    const m = await load(); let fails = 0;
    for (let i = 0; i < 20; i++) if ((await violations(m, kind)).length > 0) fails++;
    console.log(`C2HELDPERIOD_REPEAT ${kind} 20 runs, ${fails} failures`); assert.equal(fails, 0);
  });
}

const MUT: [string, [string, string, string][]][] = [
  ["M1 drop the period merge (f250 behaviour)", [["service.ts", "else if (mergeTakenPeriods(d, s, taken)) ch = true;", ""]]],
  ["M3 merge overwrites the plan with the winner's (rewinds a newer sweep)", [["service.ts", "else if (mergeTakenPeriods(d, s, taken)) ch = true;", "else if (built.plan) { s.plan = built.plan; ch = true; }"]]],
  ["M4 buildSubscriptionTaken forgets the held periods", [["service.ts", "periods: [...(sp ? [sp] : []), ...held.rest], facts };", "periods: [...(sp ? [sp] : [])], facts };"]]],
];
test("f251 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2HELDPERIOD_MUTANTS ${killed}/${MUT.length} killed`);
});
