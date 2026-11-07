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

// f242: a claim LEASE (owner token + expiry, test adapter only) closes the f237 residual race. The purchase winner (markPaid) takes it BEFORE the pending -> paid CAS and releases it when done; the
// f237 sweep (reconcileSubscriptions) acquires it before it seeds or consumes a held cancel. A live lease = skip; an expired lease (killed winner) = proceed; a holdFact written after the sweep
// seeded is replayed onto the row. Contract L1..L6 on MemoryStore and D1PlanStore (FakeD1), run on the real source AND on source mutants. Stripe is MockBilling only. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f242-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore(), leases = new Map(); // D1 stores share one lease map: the in-memory stand-in for a shared lease row
  return { open: (): any => { if (kind !== "d1") return shared; const s = new m.d1.D1PlanStore(db); s.leases = leases; return s; }, db };
}
const base = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0 };
async function seed(s: any, status: string = "pending", over: Record<string, unknown> = {}) {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ ...base, status, ...over });
}
const sessionObj = { id: "sub_1", current_period_start: T0 / 1000, current_period_end: T0 / 1000 + 30 * 86400, billing_cycle_anchor: T0 / 1000 };
const paidSession = () => ({ id: "cs_1", status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: "pi_1", customer: "cus_1", subscription: sessionObj as any });
const D = (m: Mods, store: any) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const o = { payment_intent: "pi_1", customer: "cus_1", subscription: sessionObj };
// runs `fn` once, just BEFORE the named store method executes (a pause point inside the winner or the sweep)
function pauseAt(s: any, method: string, fn: () => Promise<void>, calls: Record<string, number> = {}) {
  let done = false;
  return new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => {
    calls[k] = (calls[k] ?? 0) + 1;
    if (k === method && !done) { done = true; await fn(); }
    return v.apply(t, a); }; } });
}

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const count = async (s: any) => ({ subs: (await s.subscriptionsFor("acc1")).length, inv: (await s.invoicesFor("acc1")).length });
  const LEASE = m.svc.LEASE_MS as number, KEY = m.svc.leaseKey("pur1") as string;

  // L1 + L3 the winner is paused mid-flight (after the claim, before it reads its held cancel); the sweep runs in that window. Live lease: the sweep skips, asks Stripe nothing, and the winner
  // consumes the held cancel exactly once, so the one subscription ends cancelled.
  { const { open } = world(m, kind), s0 = open(); await seed(s0); await s0.holdFact("sub:sub_1", { kind: "cancel" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    let rep: any, mid: any, taken = 0;
    const counted = new Proxy(s0, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => { const r = await v.apply(t, a); if (k === "takeFacts" && a[0] === "sub:sub_1") taken += (r as any[]).filter((f) => f.kind === "cancel").length; return r; }; } });
    const winner = pauseAt(counted, "takeFacts", async () => { rep = await m.rec.reconcileSubscriptions(open(), bill, T0 + 1000, 0); mid = await count(open()); });
    const r = await m.svc.markPaid(D(m, winner), { ...(await s0.purchaseById("pur1")) }, o, "evt1");
    want("L1", r.won === true, "L1 the winner must still win");
    want("L1", !!rep && rep.scanned === 1 && rep.seeded === 0 && rep.skipped === 1, `L1 sweep must skip while the lease is live, got ${JSON.stringify(rep)}`);
    want("L1", bill.calls.length === 0, "L1 a skipped sweep must not ask Stripe");
    want("L1", !!mid && mid.subs === 0, `L1 the sweep must not have seeded under the winner, got ${JSON.stringify(mid)}`);
    const subs = await open().subscriptionsFor("acc1"), c = await count(open());
    want("L3", taken === 1, `L3 the held cancel must be consumed exactly once (by the winner), got ${taken}`);
    want("L3", subs.length === 1 && !!subs[0].cancelledAt && c.inv === 1, `L3 one subscription, cancelled, one invoice, got ${JSON.stringify({ subs, c })}`);
    want("L3", (await open().takeFacts("sub:sub_1")).length === 0, "L3 no held fact left behind");
  }

  // L2 expiry: a lease whose holder died (never released). Live at LEASE-1 = skip; free at LEASE = the sweep proceeds and seeds.
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { paidAt: T0, subscriptionId: "sub_1" });
    await s.acquireLease(KEY, "dead-owner", T0, LEASE);
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const a = await m.rec.reconcileSubscriptions(s, bill, T0 + LEASE - 1, 0);
    want("L2", a.seeded === 0 && a.skipped === 1 && (await count(s)).subs === 0, `L2 live lease: skip, got ${JSON.stringify(a)}`);
    const b = await m.rec.reconcileSubscriptions(s, bill, T0 + LEASE, 0);
    want("L2", b.seeded === 1 && (await count(s)).subs === 1, `L2 expired lease: the sweep proceeds, got ${JSON.stringify(b)}`);
  }

  // L4 a holdFact written AFTER the sweep took its facts but before the row landed is replayed onto the seeded row (the webhook looked the row up, found none, then held).
  { const { open } = world(m, kind), s0 = open(); await seed(s0, "paid", { paidAt: T0, subscriptionId: "sub_1" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const sweeper = pauseAt(s0, "putSubscriptionOnce", async () => { await s0.holdFact("sub:sub_1", { kind: "cancel" }); });
    const rep = await m.rec.reconcileSubscriptions(sweeper, bill, T0 + LEASE * 3, 0);
    const subs = await open().subscriptionsFor("acc1");
    want("L4", rep.seeded === 1 && subs.length === 1 && !!subs[0].cancelledAt, `L4 the late cancel must be replayed onto the seeded row, got ${JSON.stringify({ rep, subs })}`);
    want("L4", (await open().takeFacts("sub:sub_1")).length === 0, "L4 the replayed fact is consumed, not left held");
    const again = await m.rec.reconcileSubscriptions(open(), bill, T0 + LEASE * 4, 0);
    want("L4", again.scanned === 0 && (await count(open())).subs === 1, "L4 a second sweep is a no-op");
  }

  // L5 leases are released: after a normal markPaid and after a sweep another owner can take the key at once; a foreign owner cannot release someone else's lease.
  { const { open } = world(m, kind), s = open(); await seed(s);
    await m.svc.markPaid(D(m, s), { ...(await s.purchaseById("pur1")) }, o, "evt1");
    want("L5", (await s.acquireLease(KEY, "other", T0, LEASE)) === true, "L5 markPaid must release its lease when done");
    await s.releaseLease(KEY, "other");
    await s.acquireLease(KEY, "holder", T0, LEASE); await s.releaseLease(KEY, "thief");
    want("L5", (await s.acquireLease(KEY, "other", T0, LEASE)) === false, "L5 a foreign owner must not release the lease");
    await s.releaseLease(KEY, "holder");
  }
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { paidAt: T0, subscriptionId: "sub_1" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    await m.rec.reconcileSubscriptions(s, bill, T0 + LEASE * 3, 0);
    want("L5", (await s.acquireLease(KEY, "other", T0 + LEASE * 3, LEASE)) === true, "L5 the sweep must release its lease when done");
  }

  // L6 two finalisers while one holds the lease: the second is a no-op that returns the stored row; still one invoice, one subscription.
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    let second: any;
    const first = pauseAt(s0, "casPurchase", async () => { second = await m.svc.markPaid(D(m, open()), { ...(await s0.purchaseById("pur1")) }, o, "evt2"); });
    const r = await m.svc.markPaid(D(m, first), { ...(await s0.purchaseById("pur1")) }, o, "evt1");
    const c = await count(open());
    want("L6", r.won === true && second?.won === false && c.subs === 1 && c.inv === 1, `L6 one winner, one sub, one invoice, got ${JSON.stringify({ w: r.won, l: second?.won, c })}`);
  }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f242 contract L1..L6 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

const MUT: [string, [string, string, string][]][] = [
  ["M1 sweep lease check removed", [["reconcile.ts", "if (!(await store.acquireLease(leaseKey(p.id), owner, now, LEASE_MS))) { rep.skipped++; continue; }", ""]]],
  ["M2 lease never expires", [["store.ts", "cur.owner !== owner && cur.expiresAt > now", "cur.owner !== owner"]]],
  ["M3 late-fact replay removed", [["reconcile.ts", "await replayLateFacts(d, sub);", ""]]],
  ["M4 winner takes no lease", [["service.ts", "if (!(await d.store.acquireLease(leaseKey(pur.id), owner, now, LEASE_MS)))", "if (false)"]]],
  ["M5 winner never releases", [["service.ts", "finally { await d.store.releaseLease(leaseKey(pur.id), owner); }", "finally { }"]]],
  ["M6 any owner may release", [["store.ts", "if (this.leases.get(key)?.owner === owner)", "if (this.leases.has(key))"]]],
  ["M7 sweep never releases", [["reconcile.ts", "finally { await store.releaseLease(leaseKey(p.id), owner); }", "finally { }"]]],
];
test("f242 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2LEASE_MUTANTS ${killed}/${MUT.length} killed`);
});
