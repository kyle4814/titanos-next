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

// f248: replayLateFacts used to read, then write the subscription row non-atomically (a plain put of a copy read earlier), so a cancel webhook that wrote in between was overwritten: a cancelled subscription came back.
// The mirror hazard existed on the cancel path (a plain put of a stale copy wiped the replay's period advance). Both now go through casSubscription (compare-and-set on the exact state read, retry on a lost CAS).
// Forced interleavings use explicit barriers (promises), never sleeps. Scenarios S1..S7 run on MemoryStore and D1PlanStore (FakeD1), on the real source AND on source mutants. SYNTHETIC ids, MockBilling only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f248-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
const sessionObj = { id: "sub_1", current_period_start: T0 / 1000, current_period_end: T0 / 1000 + 30 * 86400, billing_cycle_anchor: T0 / 1000 };
const DAY = 86_400_000;
// A cycle invoice held for the NEXT billing period (it beat the seed): replaying it advances the plan, so the replay really writes.
const nextPeriod = () => ({ kind: "period", start: T0 + 30 * DAY, end: T0 + 61 * DAY, create: false });
const deps = (m: Mods, store: any, now = T0) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const cancelEv = (id: string) => ({ id, type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });

// A fresh world: one paid purchase, ONE seeded subscription row (with a plan), ONE invoice. The caller then holds late facts.
async function fresh(m: Mods, kind: Kind) {
  const db = new FakeD1(), s: any = kind === "d1" ? new m.d1.D1PlanStore(db) : new m.store.MemoryStore();
  await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  const pur = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "paid", paidAt: T0, paymentIntent: "pi_1", subscriptionId: "sub_1" };
  await s.putPurchase(pur);
  await s.putSubscription(await m.svc.buildSubscription(deps(m, s), pur, sessionObj, T0));
  await m.svc.issueInvoiceOnce(deps(m, s), pur, 150000, "evt_seed");
  return s;
}
// Barrier: the FIRST write of a subscription row through this store view parks until `release()`. `parked` resolves when it is parked. Reads and every other call pass straight through.
function barrier(s: any) {
  let release!: () => void, parkedRes!: () => void, hit = false;
  const gate = new Promise<void>((r) => (release = r)), parked = new Promise<void>((r) => (parkedRes = r));
  const view = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => {
    if ((k === "casSubscription" || k === "putSubscription") && !hit) { hit = true; parkedRes(); await gate; }
    return v.apply(t, a); }; } });
  return { view, parked, release: () => release() };
}

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  async function check(c: string, s: any, base: string) {
    const subs = await s.subscriptionsFor("acc1"), inv = await s.invoicesFor("acc1"), row = await s.subscriptionById("sub_1");
    want(c, subs.length === 1 && inv.length === 1, `${c} one subscription row and one invoice, got ${subs.length}/${inv.length}`);
    want(c, !!row?.cancelledAt, `${c} the subscription must end CANCELLED (a resurrected row has no cancelledAt), got ${JSON.stringify(row)}`);
    want(c, row?.cancelledAt === T0, `${c} cancelledAt is stamped once by the first cancel (${T0}), got ${row?.cancelledAt}`);
    want(c, JSON.stringify(row?.plan) !== base, `${c} the replayed period must still be applied (plan advanced), got ${JSON.stringify(row?.plan)}`);
    want(c, (await s.takeFacts("sub:sub_1")).length === 0, `${c} no fact left held`);
  }

  // S1 cancel-before: the cancel lands first; the replay holds a STALE copy of the row read before it.
  { const s = await fresh(m, kind), base = JSON.stringify((await s.subscriptionById("sub_1")).plan), stale = structuredClone(await s.subscriptionById("sub_1"));
    await s.holdFact("sub:sub_1", nextPeriod());
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c1"));
    want("S1", await m.svc.replayLateFacts(deps(m, s), stale) === true, "S1 replay reports it applied");
    await check("S1", s, base); }

  // S2 cancel-during, the failing interleaving: replay has read, parks at its write; the cancel webhook writes cancelled; the replay then writes.
  { const s = await fresh(m, kind), base = JSON.stringify((await s.subscriptionById("sub_1")).plan), stale = structuredClone(await s.subscriptionById("sub_1"));
    await s.holdFact("sub:sub_1", nextPeriod());
    const b = barrier(s), replay = m.svc.replayLateFacts(deps(m, b.view), stale);
    await b.parked;
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c2"));
    b.release(); await replay;
    await check("S2", s, base); }

  // S3 cancel-during, mirror: the cancel webhook has read, parks at its write; the replay runs to completion; the cancel then writes (it must not wipe the replayed period).
  { const s = await fresh(m, kind), base = JSON.stringify((await s.subscriptionById("sub_1")).plan);
    await s.holdFact("sub:sub_1", nextPeriod());
    const b = barrier(s), cancel = m.svc.handleStripeEvent(deps(m, b.view), cancelEv("evt_c3"));
    await b.parked;
    await m.svc.replayLateFacts(deps(m, s), structuredClone(await s.subscriptionById("sub_1")));
    b.release(); await cancel;
    await check("S3", s, base); }

  // S4 cancel-after: the replay finishes, then the cancel arrives.
  { const s = await fresh(m, kind), base = JSON.stringify((await s.subscriptionById("sub_1")).plan);
    await s.holdFact("sub:sub_1", nextPeriod());
    await m.svc.replayLateFacts(deps(m, s), structuredClone(await s.subscriptionById("sub_1")));
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c4"));
    await check("S4", s, base); }

  // S5 a late CANCEL fact replayed after the webhook already cancelled: cancelled stays, stamped once (the replay clock is later and must not re-stamp).
  { const s = await fresh(m, kind), base = JSON.stringify((await s.subscriptionById("sub_1")).plan);
    await s.holdFact("sub:sub_1", { kind: "cancel" }); await s.holdFact("sub:sub_1", nextPeriod());
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c5"));
    await m.svc.replayLateFacts(deps(m, s, T0 + 5000), structuredClone(await s.subscriptionById("sub_1")));
    await check("S5", s, base); }

  // S6 retries are bounded and lossless: if the CAS can never win, replay throws SubscriptionContention and puts the consumed facts back (nothing silently dropped).
  { const s = await fresh(m, kind); await s.holdFact("sub:sub_1", nextPeriod());
    const always = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => (k === "casSubscription" ? false : v.apply(t, a)); } });
    let threw = "";
    try { await m.svc.replayLateFacts(deps(m, always), structuredClone(await s.subscriptionById("sub_1"))); } catch (e) { threw = (e as Error).name; }
    want("S6", threw === "SubscriptionContention", `S6 an unwinnable CAS must throw SubscriptionContention, got ${JSON.stringify(threw)}`);
    want("S6", (await s.takeFacts("sub:sub_1")).length === 1, "S6 the consumed fact must be re-held after the retries run out"); }

  // S7 invoice.paid (cycle) on the same row is also a CAS: parked at its write while a cancel lands, it must not resurrect the row.
  { const s = await fresh(m, kind);
    const inv = { id: "evt_i7", type: "invoice.paid", data: { object: { subscription: "sub_1", billing_reason: "subscription_cycle", amount_paid: 150000, lines: { data: [{ period: { start: T0 / 1000 + 30 * 86400, end: T0 / 1000 + 61 * 86400 } }] } } } };
    const b = barrier(s), paid = m.svc.handleStripeEvent(deps(m, b.view), inv);
    await b.parked;
    await m.svc.handleStripeEvent(deps(m, s), cancelEv("evt_c7"));
    b.release(); await paid;
    const row = await s.subscriptionById("sub_1");
    want("S7", !!row?.cancelledAt, `S7 invoice.paid must not resurrect a cancelled row, got ${JSON.stringify(row)}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f248 S1..S7 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
  test(`f248 20 repeated runs, 0 failures (${kind})`, async () => {
    const m = await load(); let fails = 0;
    for (let i = 0; i < 20; i++) if ((await violations(m, kind)).length > 0) fails++;
    console.log(`C2REPLAYCAS_REPEAT ${kind} 20 runs, ${fails} failures`); assert.equal(fails, 0);
  });
}

const MUT: [string, [string, string, string][]][] = [
  ["N1 casEdit writes blind (CAS reverted to put)", [["service.ts", "if (await d.store.casSubscription(next, expected)) {", "if ((await d.store.putSubscription(next), true)) {"]]],
  ["N2 memory CAS ignores expected state", [["store.ts", "if (!cur || subStateKey(cur) !== subStateKey(expected)) return false;", "if (!cur) return false;"]]],
  ["N3 D1 CAS drops the cancelled_at guard", [["d1_plan_store.ts", "AND cancelled_at IS ?", "AND (cancelled_at IS ? OR 1 = 1)"]]],
  ["N4 cancel webhook back to a blind put", [["service.ts", "if (!sub.cancelledAt) await casEditSubscription(d, sub.id, (s) => { if (s.cancelledAt) return false; s.cancelledAt = d.now(); return true; });", "if (!sub.cancelledAt) { sub.cancelledAt = d.now(); await d.store.putSubscription(sub); }"]]],
  ["N5 no retry after a lost CAS", [["service.ts", "const SUB_TRIES = 8;", "const SUB_TRIES = 1;"]]],
  ["N6 replay re-stamps an already cancelled row", [["service.ts", "if (late.some((f) => f.kind === \"cancel\") && !s.cancelledAt) s.cancelledAt = d.now();", "if (late.some((f) => f.kind === \"cancel\")) s.cancelledAt = d.now();"]]],
  ["N7 taken facts not memoised across retries", [["service.ts", "if (!taken.has(k)) taken.set(k, await t.takeFacts(k)); return", "taken.set(k, await t.takeFacts(k)); return"]]],
  ["N8 consumed facts not re-held on give-up", [["service.ts", "for (const [k, fs] of taken) for (const f of fs) await d.store.holdFact(k, f);", ""]]],
  ["N9 invoice.paid back to a blind put", [["service.ts", "await casEditSubscription(d, subId, async (s, dd) => { await seedPeriod(dd, s, period, !cycle); return true; });", "await seedPeriod(d, sub, period, !cycle); await d.store.putSubscription(sub);"]]],
];
test("f248 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2REPLAYCAS_MUTANTS ${killed}/${MUT.length} killed`);
});
