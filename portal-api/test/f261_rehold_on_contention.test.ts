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

// f261 (C2 residual from f251 limit 3; the f251 text follows for the shared harness): a checkout winner stalls past its lease TTL after its buildSubscription TOOK the held invoice periods (an invoice.paid that beat the checkout). The reconcile sweep seeds
// the row from Stripe's session period, which can differ from the held one; when the winner resumes, its insert-if-absent loses and only the held cancel and the plan-if-absent were merged, so the periods
// the winner consumed vanished with the row it built. Now buildSubscriptionTaken returns the taken periods and the merge observes them onto the stored row through casEditSubscription (the f248 helper).
// Forced interleavings use explicit barriers (promises), never sleeps. H1..H5 run on MemoryStore and D1PlanStore (FakeD1), on the real source AND on source mutants. SYNTHETIC ids, MockBilling only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f261-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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


// f261: the winner's CAS retries EXHAUST after buildSubscriptionTaken consumed the held month-1 invoice period and the held cancel. Contention is forced by an explicit barrier (the winner parks at its first
// write, the sweep seeds the row, then every casSubscription of the winner loses) and not by sleeps. The consumed facts must be re-held before SubscriptionContention is thrown.
async function contend(m: Mods, kind: Kind) {
  const { s, pur } = await world(m, kind);
  await s.holdFact("sub:sub_1", heldPeriod(1)); await s.holdFact("sub:sub_1", { kind: "cancel" });
  const o = { payment_intent: "pi_1", customer: "cus_1", subscription: sessionFor(0) };
  const b = barrier(s); let lose = false, casCalls = 0;
  const view = new Proxy(b.view, { get(t: any, k: string) { if (k === "casSubscription") return async (...a: unknown[]) => { if (lose) { casCalls++; return false; } return t[k](...a); }; return t[k]; } });
  const win = m.svc.markPaid(deps(m, view), { ...pur }, o, "evt_w");
  let threw = ""; const settled = win.then(() => "", (e: Error) => { threw = e.name; return e.name; });
  await b.parked;
  const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession(0));
  const rep = await m.rec.reconcileSubscriptions(s, bill, T0 + m.svc.LEASE_MS + 1, 0);
  lose = true; b.release(); await settled;
  return { s, pur, o, rep, threw, casCalls };
}
export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const facts = async (s: any) => { const f = await s.takeFacts("sub:sub_1"); for (const x of f) await s.holdFact("sub:sub_1", x); return f as any[]; };
  // R1 the headline: after the throw the taken period and the cancel are held again (same keys), not lost.
  { const { s, rep, threw, casCalls } = await contend(m, kind);
    want("R1", rep.seeded === 1 && casCalls >= 1, `R1 setup: the sweep seeds and the winner's CAS must lose, got ${JSON.stringify(rep)} cas=${casCalls}`);
    want("R1", threw === "SubscriptionContention", `R1 retries exhausted must throw SubscriptionContention, got ${JSON.stringify(threw)}`);
    const f = await facts(s);
    want("R1", f.some((x) => x.kind === "cancel") && f.some((x) => x.kind === "period" && x.start === addMonths(T0, 1)), `R1 the consumed month-1 period and the cancel must be held again, held=${JSON.stringify(f)}`); }
  // R2 the next consumer (replayLateFacts, the sweep's reader) applies them: final row has month 1 and the cancel; one row, one invoice, nothing held.
  { const { s } = await contend(m, kind);
    const row = await s.subscriptionById("sub_1");
    const changed = await m.svc.replayLateFacts(deps(m, s), row);
    const subs = await s.subscriptionsFor("acc1"), inv = (await s.invoicesFor("acc1")).length;
    want("R2", changed === true && subs.length === 1 && inv === 1, `R2 replay must apply once on one row, got changed=${changed} subs=${subs.length} inv=${inv}`);
    want("R2", subs[0]?.plan?.periodNow?.start === addMonths(T0, 1), `R2 final row must carry the later period (month 1), got ${JSON.stringify(subs[0]?.plan?.periodNow)}`);
    want("R2", !!subs[0]?.cancelledAt, "R2 final row must carry the held cancel");
    want("R2", (await facts(s)).length === 0, "R2 no held fact left after the replay"); }
  // R3 replay of the same sequence is a no-op: markPaid again loses the claim, no duplicate held facts, a second replay writes nothing.
  { const { s, pur, o } = await contend(m, kind);
    const before = (await facts(s)).length;
    const again = await m.svc.markPaid(deps(m, s), { ...pur }, o, "evt_w2");
    const after = await facts(s);
    want("R3", again.won === false && after.length === before && before === 2, `R3 replayed markPaid must lose and add no held fact, got won=${again.won} held ${before}->${after.length}`);
    await m.svc.replayLateFacts(deps(m, s), await s.subscriptionById("sub_1"));
    const snap = JSON.stringify(await s.subscriptionById("sub_1"));
    const second = await m.svc.replayLateFacts(deps(m, s), await s.subscriptionById("sub_1"));
    const subs = await s.subscriptionsFor("acc1"), inv = (await s.invoicesFor("acc1")).length;
    want("R3", second === false && JSON.stringify(subs[0]) === snap && subs.length === 1 && inv === 1, `R3 second replay must be a no-op on one row, one invoice, got second=${second} subs=${subs.length} inv=${inv}`); }
  return bad;
}
for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f261 R1..R3 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
  test(`f261 20 repeated runs, 0 failures (${kind})`, async () => {
    const m = await load(); let fails = 0;
    for (let i = 0; i < 20; i++) if ((await violations(m, kind)).length > 0) fails++;
    console.log(`C2REHOLD_REPEAT ${kind} 20 runs, ${fails} failures`); assert.equal(fails, 0);
  });
}
const MUT: [string, [string, string, string][]][] = [
  ["M1 drop the re-hold (f251 behaviour)", [["service.ts", "if (e instanceof SubscriptionContention) for (const f of tookFacts) await d.store.holdFact(`sub:${pur.subscriptionId}`, f);", ""]]],
  ["M2 re-hold only the periods, drop the cancel", [["service.ts", "for (const f of tookFacts) await d.store", "for (const f of tookFacts.filter((x) => x.kind !== \"cancel\")) await d.store"]]],
  ["M3 re-hold twice (duplicate held facts)", [["service.ts", "for (const f of tookFacts) await d.store.holdFact(`sub:${pur.subscriptionId}`, f);", "for (const f of [...tookFacts, ...tookFacts]) await d.store.holdFact(`sub:${pur.subscriptionId}`, f);"]]],
  ["M4 swallow the contention (no throw)", [["service.ts", "        throw e;\n      }\n    }\n    if (pur.paymentIntent)", "      }\n    }\n    if (pur.paymentIntent)"]]],
];
test("f261 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2REHOLD_MUTANTS ${killed}/${MUT.length} killed`);
});
