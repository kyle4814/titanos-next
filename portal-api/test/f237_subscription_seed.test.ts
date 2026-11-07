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

// f237: repair of a PAID subscription purchase with no subscription row (f236 limit 2). Contract S1..S6 on MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations),
// run on the real source AND on source mutants. Stripe is MockBilling only. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f237-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  const leases = new Map(); // f242: one lease table per world, shared by every D1 store instance (the in-memory stand-in for a shared lease row); this also removes a pre-existing ~1/6 flake in S4 (two unleased sweeps racing on the held cancel)
  return { open: (): any => { if (kind !== "d1") return shared; const s = new m.d1.D1PlanStore(db); s.leases = leases; return s; }, db };
}
const base = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0 };
async function seed(s: any, status: string = "pending", over: Record<string, unknown> = {}) {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ ...base, status, ...over });
}
const sessionObj = { id: "sub_1", current_period_start: T0 / 1000, current_period_end: T0 / 1000 + 30 * 86400, billing_cycle_anchor: T0 / 1000 };
const paidSession = (sub: unknown = sessionObj) => ({ id: "cs_1", status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: "pi_1", customer: "cus_1", subscription: sub as any });
const D = (m: Mods, store: any) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const NOW = T0 + GRACE * 3;
const o = { payment_intent: "pi_1", customer: "cus_1", subscription: sessionObj };
function crashAt(s: any, method: string) { // throws once at `method` (an isolate killed mid-flight)
  let done = false;
  return new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => { if (k === method && !done) { done = true; throw new Error("isolate killed"); } return v.apply(t, a); }; } });
}
function spy(s: any, calls: Record<string, number>, before: Record<string, () => Promise<void>> = {}) {
  return new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => { calls[k] = (calls[k] ?? 0) + 1; await before[k]?.(); return v.apply(t, a); }; } });
}
const stale = (s: any, id: string) => new Proxy(s, { get(t, k: string) { // a sweep whose candidate list went stale: it still lists `id` even though a row now exists
  if (k === "paidWithoutSubscriptionBefore") return async () => [await t.purchaseById(id)]; const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const count = async (s: any) => ({ subs: (await s.subscriptionsFor("acc1")).length, inv: (await s.invoicesFor("acc1")).length });

  // S1 crash between the claim and the subscription seed: the winner dies, the sweep completes it. Exactly one subscription and one invoice, built from the session.
  for (const crashPoint of ["putSubscription", "putInvoiceOnce", "takeFacts"]) {
    const { open } = world(m, kind), s0 = open(); await seed(s0);
    const d = D(m, crashAt(s0, crashPoint));
    let threw = false; try { await m.svc.markPaid(d, { ...(await s0.purchaseById("pur1")) }, o, "evt1"); } catch { threw = true; }
    want("S1", threw, `S1 ${crashPoint}: the injected crash must surface`);
    const mid = await open().purchaseById("pur1"); want("S1", mid.status === "paid", `S1 ${crashPoint}: the claim must have landed (paid)`);
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const s = open(), rep = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE);
    // the invoice step may need the f203 reconciler when the crash was after the seed: run it too (it is the existing repair for that window)
    if (crashPoint !== "putSubscription") await m.rec.reconcile(s, NOW, GRACE); // an invoice-only crash is the f203 window; the seed crash must be fully repaired by the new sweep alone
    const c = await count(s); want("S1", c.subs === 1 && c.inv === 1, `S1 ${crashPoint}: expected 1 sub and 1 invoice, got ${JSON.stringify(c)} rep ${JSON.stringify(rep)}`);
    const sub = (await s.subscriptionsFor("acc1"))[0];
    want("S1", !!sub && sub.id === "sub_1" && sub.purchaseId === "pur1" && sub.productId === "ai_growth", `S1 ${crashPoint}: the row must be keyed on the purchase`);
    if (crashPoint === "putSubscription") {
      want("S1", rep.seeded === 1, `S1 putSubscription: seeded must be 1, got ${JSON.stringify(rep)}`);
      want("S1", sub?.startedAt === T0 && !!sub?.plan, "S1 the row must carry Stripe's period and plan, as markPaid would have written it");
    }
  }

  // S2 double-run idempotence: the second run changes nothing, asks Stripe nothing, burns no invoice number
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    await m.svc.markPaid(D(m, crashAt(s0, "putSubscription")), { ...(await s0.purchaseById("pur1")) }, o, "evt1").catch(() => {});
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession()); const s = open();
    await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE);
    const before = JSON.stringify([await s.subscriptionsFor("acc1"), await s.invoicesFor("acc1"), await s.nextInvoiceNumber()]);
    const r2 = await m.rec.reconcileSubscriptions(s, bill, NOW + 1000, GRACE);
    const after = JSON.stringify([await s.subscriptionsFor("acc1"), await s.invoicesFor("acc1"), await s.nextInvoiceNumber()]);
    want("S2", r2.seeded === 0 && r2.scanned === 0, `S2 second run must find nothing, got ${JSON.stringify(r2)}`);
    want("S2", before.replace(/,"TT-\d+"\]$/, "") === after.replace(/,"TT-\d+"\]$/, "") && bill.calls.filter((c) => c.op === "retrieveSession").length === 1, "S2 second run must change nothing and not call Stripe again");
    const n1 = Number(JSON.parse(before)[2].slice(3)), n2 = Number(JSON.parse(after)[2].slice(3)); want("S2", n2 === n1 + 1, `S2 no invoice number burned by the second run (${n1} -> ${n2})`);
  }

  // S3 stale candidate list (a concurrent sweep already seeded): the existence check must skip BEFORE the destructive takeFacts and before asking Stripe
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    await m.svc.markPaid(D(m, s0), { ...(await s0.purchaseById("pur1")) }, o, "evt1"); // healthy purchase: sub + invoice exist
    await s0.holdFact("sub:sub_1", { kind: "cancel" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const rep = await m.rec.reconcileSubscriptions(stale(open(), "pur1"), bill, NOW, GRACE);
    want("S3", rep.seeded === 0 && bill.calls.length === 0, `S3 existing row: must skip without calling Stripe, got ${JSON.stringify(rep)} calls ${bill.calls.length}`);
    want("S3", (await open().takeFacts("sub:sub_1")).length === 1, "S3 the held cancel fact must not be consumed by a skipped purchase");
    want("S3", (await count(open())).subs === 1, "S3 still one subscription");
  }

  // S4 two sweeps at once, both past the existence check: one row, and the held cancel survives (the loser's write must not overwrite)
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    await m.svc.markPaid(D(m, crashAt(s0, "putSubscription")), { ...(await s0.purchaseById("pur1")) }, o, "evt1").catch(() => {});
    await s0.holdFact("sub:sub_1", { kind: "cancel" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    let waiting = 0; let release!: () => void; const gate = new Promise<void>((r) => (release = r));
    const mk = () => spy(open(), {}, { takeFacts: async () => { waiting++; if (waiting >= 2) release(); await Promise.race([gate, new Promise((r) => setTimeout(r, 300))]); } });
    const [a, b] = await Promise.all([m.rec.reconcileSubscriptions(mk(), bill, NOW, GRACE), m.rec.reconcileSubscriptions(mk(), bill, NOW, GRACE)]);
    const s = open(), subs = await s.subscriptionsFor("acc1");
    want("S4", subs.length === 1, `S4 exactly one subscription, got ${subs.length}`);
    want("S4", a.seeded + b.seeded === 1, `S4 exactly one sweep seeds, got ${a.seeded}+${b.seeded}`);
    want("S4", subs[0]?.cancelledAt !== undefined, "S4 the held cancel must survive the race");
    await m.rec.reconcile(s, NOW, GRACE); want("S4", (await count(s)).inv === 1, "S4 one invoice");
  }
  // S4b f242: the claim lease now keeps two sweeps apart on one Memory store, so the store-level once-guard is pinned directly (defence in depth behind the lease)
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { paidAt: T0, subscriptionId: "sub_1" });
    const row = { id: "sub_1", accountId: "acc1", purchaseId: "pur1", productId: "ai_growth", startedAt: T0 };
    const [a, b] = await Promise.all([s.putSubscriptionOnce({ ...row }), s.putSubscriptionOnce({ ...row, startedAt: T0 + 1 })]);
    want("S4", a !== b && (await s.subscriptionsFor("acc1")).length === 1, `S4b putSubscriptionOnce twice: exactly one writes, got ${a}/${b}`);
  }

  // S5 untouched: refunded, abandoned, pending, cancelled never get a subscription (and Stripe is never asked); one-off products too
  for (const st of ["refunded", "abandoned", "pending", "cancelled"]) {
    const { open } = world(m, kind), s = open(); await seed(s, st, { paidAt: st === "refunded" ? T0 : undefined, subscriptionId: "sub_1" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const rep = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE);
    want("S5", rep.scanned === 0 && (await count(s)).subs === 0 && bill.calls.length === 0, `S5 ${st} must be untouched, got ${JSON.stringify(rep)}`);
    want("S5", (await s.purchaseById("pur1")).status === st, `S5 ${st} status must stay`);
  }
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { productId: "compliance_pack", amountCents: 599700, paidAt: T0 });
    const bill = new MockBilling(); const rep = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE);
    want("S5", rep.scanned === 0 && (await count(s)).subs === 0, "S5 a one-off product has no subscription to seed");
  }

  // S6 inside the grace window, an unpaid/open Stripe session, or a Stripe outage: nothing seeded, retried next sweep
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { paidAt: NOW - 1000, subscriptionId: "sub_1" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", paidSession());
    const r = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE); want("S6", r.scanned === 0 && (await count(s)).subs === 0, "S6 inside grace: left alone");
    const r2 = await m.rec.reconcileSubscriptions(s, bill, NOW + GRACE * 2, GRACE); want("S6", r2.seeded === 1, "S6 after grace: seeded");
  }
  { const { open } = world(m, kind), s = open(); await seed(s, "paid", { paidAt: T0, subscriptionId: "sub_1" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", { ...paidSession(), status: "open", paymentStatus: "unpaid" });
    const r = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE); want("S6", r.seeded === 0 && r.errors.length === 1 && (await count(s)).subs === 0, `S6 unpaid session: no seed, reported, got ${JSON.stringify(r)}`);
    bill.sessions.set("cs_1", paidSession()); bill.failNext = { times: 1 };
    const r2 = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE); want("S6", r2.seeded === 0 && (await count(s)).subs === 0, "S6 Stripe outage: nothing written");
    const r3 = await m.rec.reconcileSubscriptions(s, bill, NOW, GRACE); want("S6", r3.seeded === 1, "S6 next sweep recovers");
  }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f237 contract S1..S6 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// Mutants: each must break the contract on at least one store.
const MUT: [string, [string, string, string][]][] = [
  ["M1 existence check dropped", [["reconcile.ts", "if (await store.subscriptionByPurchase(p.id)) { rep.skipped++; continue; }", ""]]],
  ["M2 putSubscriptionOnce is an upsert (Memory)", [["store.ts", "if (this.subs.has(s.id) || [...this.subs.values()].some((x) => x.purchaseId === s.purchaseId)) return false;", ""]]],
  ["M3 putSubscriptionOnce guard dropped (D1)", [["d1_plan_store.ts", " WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE purchase_id = ? OR id = ?)\"", "\""]]],
  ["M4 query lists refunded too (Memory)", [["store.ts", "p.status === \"paid\" && p.paidAt !== undefined && cutoff >= p.paidAt && ids.includes", "(p.status === \"paid\" || p.status === \"refunded\") && p.paidAt !== undefined && p.paidAt <= cutoff && ids.includes"]]],
  ["M5 unpaid session still seeds", [["reconcile.ts", "if (s.status !== \"complete\" || s.paymentStatus !== \"paid\")", "if (false)"]]],
  ["M6 first invoice not issued", [["reconcile.ts", "if (prod) await issueInvoiceOnce(d, pur, prod.amountCents, seedEventId(p.id));", ""]]],
  ["M7 grace ignored", [["reconcile.ts", "paidWithoutSubscriptionBefore(now - grace, ids)", "paidWithoutSubscriptionBefore(now, ids)"]]],
];
test("f237 mutants are all killed", async () => {
  let killed = 0;
  for (const [name, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
  }
  console.log(`C2SUBSEED_MUTANTS ${killed}/${MUT.length} killed`);
});
