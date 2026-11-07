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

// f236: compare-and-set purchase status (f210 limit 3, f234 limit 5). casPurchase(next, expected) writes ONLY IF the stored status is still `expected` (D1: one UPDATE ... WHERE id = ? AND status = ?,
// changes() checked; no migration). markPaid claims pending -> paid FIRST, so a webhook and the f210 sweep finishing one purchase at the same instant run the side effects (takeFacts, seed, account,
// invoice) exactly once; the loser is a no-op. ONE contract (K1..K6) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations), real source AND source mutants. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f236-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), rec: await imp("pending_reconciler.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared), db }; // a fresh "process" over the same durable state
}
const deps = (m: Mods, store: any, billing: MockBilling, now = T0 + GRACE) => ({ store, billing, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const base = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0 };
async function seed(s: any, status: string = "pending") {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ ...base, status });
}
const ev = (id: string) => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", customer: "cus_1", subscription: "sub_1" } } });
const paidSession = { id: "cs_1", status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: "pi_1", customer: "cus_1", subscription: "sub_1" };
// spy: pause before/after a named method, and count every call by method name into `calls`
function spy(s: any, calls: Record<string, number>, h: { before?: Record<string, () => Promise<void>> } = {}) {
  return new Proxy(s, { get(t, k: string) {
    const v = t[k]; if (typeof v !== "function") return v;
    return async (...a: unknown[]) => { calls[k] = (calls[k] ?? 0) + 1; await h.before?.[k]?.(); return v.apply(t, a); };
  } });
}
const gate = () => { let go!: () => void; const p = new Promise<void>((r) => (go = r)); const t = setTimeout(() => go(), 2000); return { p: p.then(() => { clearTimeout(t); }), go: () => { clearTimeout(t); go(); } }; };

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };

  // K1 the CAS itself: matching expectation writes and says true; a stale expectation writes nothing and says false; an absent row says false
  { const { open } = world(m, kind), s = open(); await seed(s);
    want("K1", (await s.casPurchase({ ...base, status: "paid", paidAt: T0 }, "paid")) === false && (await s.purchaseById("pur1")).status === "pending", "K1 a stale expected status must write nothing");
    want("K1", (await s.casPurchase({ ...base, status: "paid", paidAt: T0 }, "pending")) === true, "K1 the matching expected status must win");
    const row = await s.purchaseById("pur1"); want("K1", row.status === "paid" && row.paidAt === T0, `K1 the winning write must land, got ${JSON.stringify(row)}`);
    want("K1", (await s.casPurchase({ ...base, status: "abandoned" }, "pending")) === false && (await s.purchaseById("pur1")).status === "paid", "K1 pending -> abandoned must not overwrite paid");
    want("K1", (await s.casPurchase({ ...base, id: "nope", status: "paid" }, "pending")) === false, "K1 an absent row must say false");
    for (const to of ["cancelled", "refunded"] as const) { await seed(s, "pending"); want("K1", (await s.casPurchase({ ...base, status: to }, "pending")) === true && (await s.purchaseById("pur1")).status === to, `K1 pending -> ${to} must work`); }
  }

  // K2 N concurrent callers, same expected status: exactly one true (each from its own store object over one durable state)
  { const { open } = world(m, kind); await seed(open());
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => open().casPurchase({ ...base, status: "paid", paidAt: T0 + i }, "pending")));
    want("K2", rs.filter(Boolean).length === 1, `K2 want exactly one winner of 5, got ${JSON.stringify(rs)}`); }

  // K3 THE RACE (f203 R4 style, three points). The webhook and the sweep both reach the write; a held cancel fact + a subscription product make a doubled side effect visible
  // (the loser's takeFacts would return [] and its putSubscription would erase the cancel). Exactly one markPaid side effect, one invoice, one takeFacts seed, one subscription, cancel kept.
  for (const point of ["both paused before casPurchase, released together", "webhook paused at takeFacts (won), sweep runs through", "webhook paused at putInvoiceOnce (won), sweep runs through"]) {
    const { open } = world(m, kind), b = new MockBilling(), s0 = open(); await seed(s0); await s0.holdFact("sub:sub_1", { kind: "cancel" });
    b.sessions.set("cs_1", paidSession);
    const calls: Record<string, number> = {}, g = gate(), reachedW = gate(), reachedS = gate();
    let wsx = spy(open(), calls), ssx = spy(open(), calls);
    if (point.startsWith("both")) {
      wsx = spy(open(), calls, { before: { casPurchase: async () => { reachedW.go(); await g.p; } } });
      ssx = spy(open(), calls, { before: { casPurchase: async () => { reachedS.go(); await g.p; } } });
    } else wsx = spy(open(), calls, { before: { [point.includes("takeFacts") ? "takeFacts" : "putInvoiceOnce"]: async () => { reachedW.go(); await g.p; } } });
    const webhook = m.svc.handleStripeEvent(deps(m, wsx, b), ev("evt_1")).catch((e: Error) => "THREW " + e.message);
    let sweep: Promise<any>;
    if (point.startsWith("both")) { sweep = m.rec.reconcilePending(deps(m, ssx, b), GRACE).catch((e: Error) => "THREW " + e.message); await Promise.all([reachedW.p, reachedS.p]); g.go(); }
    else { await reachedW.p; sweep = m.rec.reconcilePending(deps(m, ssx, b), GRACE).catch((e: Error) => "THREW " + e.message); await sweep; g.go(); }
    const [w, r] = [await webhook, await sweep];
    want("K3", w === "handled", `${point}: webhook must finish handled, got ${w}`);
    const both = point.startsWith("both"); // points 2 and 3: the claim is already durable, so the sweep no longer lists the row (scanned 0): the cheapest possible loss
    want("K3", typeof r === "object" && r.errors === 0 && (both ? r.scanned === 1 && r.recovered + r.skipped === 1 : r.scanned === 0 && r.recovered === 0), `${point}: sweep must recover or skip, never error, got ${JSON.stringify(r)}`);
    const st = open();
    want("K3", (await st.invoicesFor("acc1")).length === 1, `${point}: want ONE invoice, got ${(await st.invoicesFor("acc1")).length}`);
    want("K3", (calls.takeFacts ?? 0) === 2, `${point}: want ONE markPaid run = takeFacts called twice (sub: + pi:), got ${calls.takeFacts}`);
    want("K3", (calls.nextInvoiceNumber ?? 0) === 1, `${point}: want one invoice number burned, got ${calls.nextInvoiceNumber}`);
    want("K3", (calls.putAccount ?? 0) === 1 && (calls.putSubscription ?? 0) === 1, `${point}: account and subscription written once each, got ${JSON.stringify(calls)}`);
    const subs = await st.subscriptionsFor("acc1"); want("K3", subs.length === 1 && !!subs[0].cancelledAt, `${point}: the held cancel must survive on the one subscription, got ${JSON.stringify(subs)}`);
    want("K3", (await st.purchaseById("pur1")).status === "paid", `${point}: purchase must end paid`);
  }

  // K4 sweep abandon vs a paid webhook: the sweep read pending and an expired session, is paused before its write, the webhook pays; the abandon must lose and paid must stand
  { const { open } = world(m, kind), b = new MockBilling(); await seed(open());
    b.sessions.set("cs_1", { ...paidSession, status: "expired", paymentStatus: "unpaid" }); delete (b.sessions.get("cs_1") as any).subscription;
    const calls: Record<string, number> = {}, g = gate(), reached = gate();
    const slow = spy(open(), calls, { before: { casPurchase: async () => { reached.go(); await g.p; } } });
    const sweep = m.rec.reconcilePending(deps(m, slow, b), GRACE);
    await reached.p;
    const w = await m.svc.handleStripeEvent(deps(m, open(), b), { id: "evt_k4", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", customer: "cus_1" } } });
    g.go(); const r = await sweep;
    want("K4", w === "handled" && (await open().purchaseById("pur1")).status === "paid", "K4 the paid webhook must win");
    want("K4", r.abandoned === 0 && r.skipped === 1 && (await open().countByStatus("abandoned")) === 0, `K4 the abandon must lose and not be counted, got ${JSON.stringify(r)}`);
    want("K4", (await open().invoicesFor("acc1")).length === 1, "K4 one invoice"); }

  // K5 the sequenced replay stays a no-op: markPaid on an already-paid purchase returns the winner's purchase without side effects
  { const { open } = world(m, kind), s = open(); await seed(s); const d = deps(m, s, new MockBilling());
    const a = await m.svc.markPaid(d, await s.purchaseById("pur1"), { payment_intent: "pi_1" }, "evt_a"), c = await m.svc.markPaid(d, await s.purchaseById("pur1"), { payment_intent: "pi_other" }, "evt_b");
    want("K5", a.won === true && c.won === false && c.purchase.status === "paid" && c.purchase.paymentIntent === "pi_1", `K5 the second call must be a no-op returning the winner, got ${JSON.stringify([a.won, c])}`);
    want("K5", (await s.invoicesFor("acc1")).length === 1, "K5 one invoice"); }

  // K6 a cancelled / refunded / abandoned purchase is never resurrected to paid by a late markPaid
  for (const st of ["cancelled", "refunded", "abandoned"]) {
    const { open } = world(m, kind), s = open(); await seed(s, st); const r = await m.svc.markPaid(deps(m, s, new MockBilling()), await s.purchaseById("pur1"), { payment_intent: "pi_1" }, "evt_k6");
    want("K6", r.won === false && (await s.purchaseById("pur1")).status === st && (await s.invoicesFor("acc1")).length === 0, `K6 ${st} must stay ${st} with no invoice`);
  }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] purchase CAS contract K1..K6 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 d1 WHERE status guard removed", edits: [["d1_plan_store.ts", "WHERE id = ? AND status = ?\",", "WHERE id = ?\","]] },
  { id: "M2 memory status guard removed", edits: [["store.ts", "if (!cur || cur.status !== expected) return false;", "if (!cur) return false;"]] },
  { id: "M3 d1 changes() not checked (always true)", edits: [["d1_plan_store.ts", "return r.meta.changes === 1;\n  }\n  override async purchaseById", "return true;\n  }\n  override async purchaseById"]] },
  { id: "M4 markPaid ignores a lost CAS", edits: [["service.ts", "if (!(await d.store.casPurchase(claim, \"pending\")))", "if (false && !(await d.store.casPurchase(claim, \"pending\")))"]] },
  { id: "M5 sweep abandon is a blind put again", edits: [["pending_reconciler.ts", "if (await d.store.casPurchase({ ...fresh, status: \"abandoned\" }, \"pending\")) rep.abandoned++; else rep.skipped++;", "await d.store.putPurchase({ ...fresh, status: \"abandoned\" }); rep.abandoned++;"]] },
  { id: "M6 markPaid claims from any status", edits: [["service.ts", "casPurchase(claim, \"pending\")", "casPurchase(claim, pur.status)"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the race contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { if ((await violations(m, kind)).length) killed = true; } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`CASPURCHASE_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
