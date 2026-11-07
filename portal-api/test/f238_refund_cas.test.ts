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

// f238: a refund (charge.refunded webhook, held refund fact, in-policy requestRefund) is a compare-and-set from the status just read (recordRefund), and markPaid never writes the purchase after its claim.
// ONE contract (F1..F6) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations), real source AND source mutants. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f238-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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


const rev = (id: string, cents = 150000) => ({ id, type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: cents } } });
// count the casPurchase calls that LANDED a refunded status, and the tracked pause points
function track(s: any, wins: { refunded: number }, h: { before?: Record<string, () => Promise<void>> } = {}) {
  return new Proxy(s, { get(t, k: string) {
    const v = t[k]; if (typeof v !== "function") return v;
    return async (...a: unknown[]) => { await h.before?.[k]?.(); const r = await v.apply(t, a); if (k === "casPurchase" && r === true && (a[0] as any).status === "refunded") wins.refunded++; return r; };
  } });
}
const events = (s: any) => s; // (kept for readability)

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const final = async (c: string, tag: string, st: any, wins: { refunded: number }) => {
    const p = await st.purchaseById("pur1");
    want(c, p.status === "refunded" && p.refundedCents === 150000, `${tag}: must end refunded for the full amount, got ${JSON.stringify(p)}`);
    want(c, (await st.invoicesFor("acc1")).length === 1, `${tag}: want ONE invoice, got ${(await st.invoicesFor("acc1")).length}`);
    want(c, wins.refunded === 1, `${tag}: want exactly ONE refund record (one landed paid -> refunded), got ${wins.refunded}`);
  };

  // F1 THE RACE, markPaid already won its claim: the refund webhook lands while markPaid is paused (at takeFacts, then at putInvoiceOnce), then markPaid finishes. Ends refunded, never paid.
  for (const pause of ["takeFacts", "putInvoiceOnce"]) {
    const { open } = world(m, kind), b = new MockBilling(); await seed(open()); const wins = { refunded: 0 }, g = gate(), reached = gate();
    const wsx = track(open(), wins, { before: { [pause]: async () => { reached.go(); await g.p; } } });
    const pay = m.svc.handleStripeEvent(deps(m, wsx, b), { ...ev("evt_p"), data: { object: { ...ev("evt_p").data.object, subscription: undefined } } }).catch((e: Error) => "THREW " + e.message);
    await reached.p;
    const r = await m.svc.handleStripeEvent(deps(m, track(open(), wins), b), rev("evt_r1"));
    g.go(); const w = await pay;
    want("F1", r === "handled" && w === "handled", `F1 ${pause}: both events handled, got ${r} / ${w}`);
    await final("F1", `F1 ${pause}`, open(), wins);
  }

  // F2 three-point race, released together: a held refund fact (refund before payment) is drained by markPaid while a refund webhook for the same payment intent reads the paid row;
  // BOTH are paused at casPurchase of the refund write and released together. One lands, the other re-reads and no-ops. The claim itself is not paused (it is the first casPurchase of markPaid).
  { const { open } = world(m, kind), b = new MockBilling(); await seed(open(), "paid"); await open().putPurchase({ ...(await open().purchaseById("pur1")), paymentIntent: "pi_1", paidAt: T0 });
    const wins = { refunded: 0 }, g = gate(), rA = gate(), rB = gate();
    const a = m.svc.recordRefund({ store: track(open(), wins, { before: { casPurchase: async () => { rA.go(); await g.p; } } }) }, "pur1", 150000);
    const c = m.svc.recordRefund({ store: track(open(), wins, { before: { casPurchase: async () => { rB.go(); await g.p; } } }) }, "pur1", 150000);
    await Promise.all([rA.p, rB.p]); g.go(); await Promise.all([a, c]);
    const p = await open().purchaseById("pur1");
    want("F2", p.status === "refunded" && p.refundedCents === 150000 && wins.refunded === 1, `F2 two refund writers released together: one landed, got status ${p.status} wins ${wins.refunded}`); }

  // F3 refund-before-payment, ordering race: the refund looked up the purchase (none), is paused before its hold, markPaid runs completely (its takeFacts finds nothing), then the hold lands.
  // The post-hold re-check must drain it: ends refunded, not paid with an orphaned fact.
  { const { open } = world(m, kind), b = new MockBilling(); await seed(open()); const wins = { refunded: 0 }, g = gate(), reached = gate();
    const rs = track(open(), wins, { before: { holdFact: async () => { reached.go(); await g.p; } } });
    const refund = m.svc.handleStripeEvent(deps(m, rs, b), rev("evt_r3")).catch((e: Error) => "THREW " + e.message);
    await reached.p;
    await m.svc.handleStripeEvent(deps(m, track(open(), wins), b), { ...ev("evt_p3"), data: { object: { ...ev("evt_p3").data.object, subscription: undefined } } });
    want("F3", (await open().purchaseById("pur1")).status === "paid", "F3 setup: paid before the hold lands");
    g.go(); want("F3", (await refund) === "handled", "F3 refund handled");
    await final("F3", "F3 orphan-hold race", open(), wins); }

  // F4 the refund replayed (different event ids, same cumulative cents, and a smaller stale value) is a no-op: one landed write, stored row unchanged
  { const { open } = world(m, kind), b = new MockBilling(); await seed(open()); const wins = { refunded: 0 }; const s = track(open(), wins);
    await m.svc.handleStripeEvent(deps(m, s, b), { ...ev("evt_p4"), data: { object: { ...ev("evt_p4").data.object, subscription: undefined } } });
    await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_r4a")); const once = JSON.stringify(await open().purchaseById("pur1"));
    await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_r4b")); await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_r4c", 50000));
    want("F4", JSON.stringify(await open().purchaseById("pur1")) === once, "F4 a replayed or smaller refund must change nothing");
    await final("F4", "F4 replay", open(), wins); }

  // F5 no resurrection: a late markPaid cannot move refunded / cancelled / abandoned back to paid, and a refund signal never touches a pending or abandoned row
  for (const st of ["refunded", "cancelled", "abandoned"]) {
    const { open } = world(m, kind), s = open(); await seed(s, st);
    const r = await m.svc.markPaid(deps(m, s, new MockBilling()), await s.purchaseById("pur1"), { payment_intent: "pi_1" }, "evt_f5");
    want("F5", r.won === false && (await s.purchaseById("pur1")).status === st, `F5 ${st} must stay ${st}`);
  }
  for (const st of ["pending", "abandoned"]) {
    const { open } = world(m, kind), s = open(); await seed(s, st); await s.putPurchase({ ...(await s.purchaseById("pur1")), paymentIntent: "pi_1" });
    await m.svc.recordRefund({ store: s }, "pur1", 150000); const p = await s.purchaseById("pur1");
    want("F5", p.status === st && p.refundedCents === 0, `F5 a refund must not touch a ${st} row, got ${JSON.stringify(p)}`);
  }

  // F6 policy: cancelled WITH a payment intent (money moved) goes to refunded; a partial refund keeps paid and records the cents
  { const { open } = world(m, kind), s = open(); await seed(s, "cancelled"); await s.putPurchase({ ...(await s.purchaseById("pur1")), paymentIntent: "pi_1", paidAt: T0 });
    await m.svc.recordRefund({ store: s }, "pur1", 150000); want("F6", (await s.purchaseById("pur1")).status === "refunded", "F6 cancelled with a payment intent -> refunded"); }
  { const { open } = world(m, kind), s = open(); await seed(s, "paid"); await s.putPurchase({ ...(await s.purchaseById("pur1")), paymentIntent: "pi_1", paidAt: T0 });
    await m.svc.recordRefund({ store: s }, "pur1", 40000); const p = await s.purchaseById("pur1"); want("F6", p.status === "paid" && p.refundedCents === 40000, `F6 partial refund keeps paid, got ${JSON.stringify(p)}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] refund CAS contract F1..F6 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 refund is a blind put again", edits: [["service.ts", "if (await d.store.casPurchase(next, cur.status)) return next;", "{ await d.store.putPurchase(next); return next; }"]] },
  { id: "M2 markPaid final write is a blind put again", edits: [["service.ts", "Object.assign(pur, (await d.store.purchaseById(pur.id)) ?? {});", "await d.store.putPurchase(pur);"]] },
  { id: "M3 status guard dropped (pending/abandoned refundable)", edits: [["service.ts", "if (!cur || !(cur.status === \"paid\" || cur.status === \"refunded\" || (cur.status === \"cancelled\" && cur.paymentIntent))) return cur;", "if (!cur) return cur;"]] },
  { id: "M4 no-op short-circuit dropped (replay rewrites)", edits: [["service.ts", "if (next.refundedCents === cur.refundedCents && next.status === cur.status) return cur;", ""]] },
  { id: "M5 post-hold re-check removed", edits: [["service.ts", "if (late) for (const f of", "if (false && late) for (const f of"]] },
  { id: "M6 CAS expectation hardcoded to paid", edits: [["service.ts", "casPurchase(next, cur.status)) return next;", "casPurchase(next, \"paid\")) return next;"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the refund contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { if ((await violations(m, kind)).length) killed = true; } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`C2RCAS_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
