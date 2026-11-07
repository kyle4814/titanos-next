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

// f210: the pending-purchase reconciler (f203 limit 1). ONE contract (P1..P8) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations), run on the real
// source AND on source copies carrying one mutation each (the suite must fail on every mutant). The provider is MockBilling: no network, no live Stripe. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f210-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
  const open = (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared); // a fresh "process" over the same durable state
  return { open, db };
}
const deps = (m: Mods, store: any, billing: MockBilling, now: number) => ({ store, billing, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const PRICE: Record<string, number> = { compliance_pack: 599700, ai_growth: 150000 };
async function seedPending(s: any, n: number, createdAt: number, product = "compliance_pack") {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ id: `pur${n}`, accountId: "acc1", productId: product, checkoutId: `cs_${n}`, amountCents: PRICE[product], deliverableIssued: false, refundedCents: 0, status: "pending", createdAt });
}
const paidSession = (n: number, extra: object = {}) => ({ id: `cs_${n}`, status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: `pi_${n}`, customer: `cus_${n}`, ...extra });
const invCount = async (s: any) => (await s.invoicesFor("acc1")).length;

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const { reconcilePending } = m.rec;
  const sweep = (open: () => any, b: MockBilling, now: number, abandonAfter?: number) => reconcilePending(deps(m, open(), b, now), GRACE, abandonAfter);

  // P1 empty store
  { const { open } = world(m, kind); const r = await sweep(open, new MockBilling(), T0 + GRACE);
    want("P1", r.scanned + r.recovered + r.abandoned + r.stillOpen + r.skipped + r.errors === 0, `empty store must report zeros, got ${JSON.stringify(r)}`); }

  // P2 paid-after-crash (the purchase never flipped): recovered EXACTLY ONCE over 3 sweeps, each sweep a fresh process; one-off payment AND subscription
  for (const [n, product] of [[1, "compliance_pack"], [2, "ai_growth"]] as const) {
    const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), n, T0, product);
    b.sessions.set(`cs_${n}`, paidSession(n, product === "ai_growth" ? { subscription: `sub_${n}` } : {}));
    const r1 = await sweep(open, b, T0 + GRACE), r2 = await sweep(open, b, T0 + GRACE + 1000), r3 = await sweep(open, b, T0 + 2 * GRACE);
    want("P2", r1.scanned === 1 && r1.recovered === 1 && r1.errors === 0, `${product}: sweep 1 must recover, got ${JSON.stringify(r1)}`);
    want("P2", r2.scanned === 0 && r2.recovered === 0 && r3.scanned === 0 && r3.recovered === 0, `${product}: sweeps 2 and 3 must be no-ops, got ${JSON.stringify([r2, r3])}`);
    const inv = await open().invoicesFor("acc1"), pur = await open().purchaseById(`pur${n}`);
    want("P2", inv.length === 1 && inv[0].purchaseId === `pur${n}` && inv[0].amountCents === PRICE[product] && inv[0].stripeEventId === `pendrecon:pur${n}`, `${product}: want ONE correct invoice, got ${JSON.stringify(inv)}`);
    want("P2", pur.status === "paid" && pur.paymentIntent === `pi_${n}` && pur.paidAt === T0 + GRACE, `${product}: purchase must be paid with the session's payment intent, got ${JSON.stringify(pur)}`);
    want("P2", (await open().accountById("acc1")).stripeCustomerId === `cus_${n}`, `${product}: customer id must be recorded`);
    if (product === "ai_growth") want("P2", (await open().subscriptionById(`sub_${n}`))?.purchaseId === `pur${n}`, "subscription row must be created through markPaid");
    want("P2", b.calls.filter((c) => c.op === "retrieveSession").length === 1, `${product}: Stripe asked once, then never again (row left pending state)`);
  }

  // P3 abandoned: an expired session is cancelled, never invoiced, never asked about again; an old open session is abandoned only past abandonAfter
  { const { open } = world(m, kind), b = new MockBilling();
    await seedPending(open(), 10, T0); await seedPending(open(), 11, T0); await seedPending(open(), 12, T0); await seedPending(open(), 13, T0);
    b.sessions.set("cs_10", { id: "cs_10", status: "expired", paymentStatus: "unpaid" });
    b.sessions.set("cs_11", { id: "cs_11", status: "open", paymentStatus: "unpaid" });
    b.sessions.set("cs_12", { id: "cs_12", status: "complete", paymentStatus: "unpaid" }); // async method still settling: never abandoned
    b.sessions.set("cs_13", { id: "cs_13", status: "open", paymentStatus: "unpaid" });
    const r = await sweep(open, b, T0 + GRACE, 24 * 3_600_000);
    want("P3", r.scanned === 4 && r.abandoned === 1 && r.stillOpen === 3 && r.recovered === 0, `want 1 abandoned 3 open, got ${JSON.stringify(r)}`);
    const st = async (n: number) => (await open().purchaseById(`pur${n}`)).status;
    want("P3", (await st(10)) === "abandoned" && (await st(11)) === "pending" && (await st(12)) === "pending", "expired abandoned; open and settling untouched");
    const late = await sweep(open, b, T0 + 24 * 3_600_000, 24 * 3_600_000);
    want("P3", late.abandoned === 2 && (await st(11)) === "abandoned" && (await st(13)) === "abandoned" && (await st(12)) === "pending", `open past abandonAfter must be cancelled, settling never, got ${JSON.stringify(late)}`);
    want("P3", (await invCount(open())) === 0, "an abandoned purchase never gets an invoice");
  }

  // P4 provider error: the row stays pending, the error is counted, the next sweep recovers it
  { const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), 20, T0); await seedPending(open(), 21, T0);
    b.sessions.set("cs_20", paidSession(20)); b.sessions.set("cs_21", paidSession(21)); b.failNext = { id: "cs_20", times: 1 };
    const r1 = await sweep(open, b, T0 + GRACE);
    want("P4", r1.scanned === 2 && r1.errors === 1 && r1.recovered === 1 && r1.errorDetails.length === 1 && r1.errorDetails[0].startsWith("pur20:"), `one error must not stop the sweep, got ${JSON.stringify(r1)}`);
    want("P4", (await open().purchaseById("pur20")).status === "pending" && (await invCount(open())) === 1, "the failed row stays pending, no invoice for it");
    const r2 = await sweep(open, b, T0 + GRACE + 1);
    want("P4", r2.scanned === 1 && r2.recovered === 1 && r2.errors === 0 && (await invCount(open())) === 2, `retry must recover it, got ${JSON.stringify(r2)}`);
    b.sessions.delete("cs_20"); await seedPending(open(), 22, T0); // unknown session (404) is an error too, not an abandon
    const r3 = await sweep(open, b, T0 + GRACE + 2);
    want("P4", r3.errors === 1 && (await open().purchaseById("pur22")).status === "pending", `a 404 stays pending and counted, got ${JSON.stringify(r3)}`);
  }

  // P5 grace boundary at N and N+1: age N-1 untouched (and Stripe not even asked), age N and N+1 eligible
  for (const [age, eligible] of [[GRACE - 1, false], [GRACE, true], [GRACE + 1, true]] as const) {
    const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), 30, T0); b.sessions.set("cs_30", paidSession(30));
    const r = await sweep(open, b, T0 + age);
    want("P5", r.scanned === (eligible ? 1 : 0) && r.recovered === (eligible ? 1 : 0), `age ${age}: eligible=${eligible}, got ${JSON.stringify(r)}`);
    want("P5", b.calls.filter((c) => c.op === "retrieveSession").length === (eligible ? 1 : 0), `age ${age}: provider call count`);
    want("P5", (await invCount(open())) === (eligible ? 1 : 0), `age ${age}: invoice count`);
  }

  // P6 a late webhook finishes the purchase WHILE the sweep is asking Stripe: the sweep skips, paidAt and invoice count untouched
  { const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), 40, T0); b.sessions.set("cs_40", paidSession(40));
    const orig = b.retrieveSession.bind(b);
    b.retrieveSession = async (id: string) => { const out = await orig(id); await m.svc.handleStripeEvent(deps(m, open(), b, T0 + GRACE - 5), { id: "evt_40", type: "checkout.session.completed", data: { object: { id: "cs_40", payment_status: "paid", payment_intent: "pi_40" } } }); return out; };
    const r = await sweep(open, b, T0 + GRACE);
    want("P6", r.recovered === 0 && r.skipped === 1 && (await invCount(open())) === 1, `a purchase finished mid-sweep must be skipped, got ${JSON.stringify(r)}`);
    want("P6", (await open().purchaseById("pur40")).paidAt === T0 + GRACE - 5, "paidAt must stay the webhook's, not be rewritten by the sweep");
  }

  // P7 a paid purchase the f203 way (status paid) is not this sweep's business
  { const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), 50, T0);
    const p = await open().purchaseById("pur50"); await open().putPurchase({ ...p, status: "paid", paidAt: T0 });
    const r = await sweep(open, b, T0 + GRACE);
    want("P7", r.scanned === 0 && b.calls.length === 0, `paid rows are not pending-swept, got ${JSON.stringify(r)}`);
  }

  // P8 createdAt survives an update that does not carry it (D1 COALESCE); startCheckout stamps it
  { const { open } = world(m, kind), b = new MockBilling(); await seedPending(open(), 60, T0 + 123);
    const p = await open().purchaseById("pur60"); const { createdAt: _c, ...rest } = p; await open().putPurchase({ ...rest, status: "pending" });
    want("P8", (await open().purchaseById("pur60")).createdAt === T0 + 123 || kind === "memory", "D1 must keep created_at when an update omits it");
    const d = deps(m, open(), b, T0 + 777); const acct = (await open().accountById("acc1"));
    const out = await m.svc.startCheckout(d, acct, "leads_starter", undefined);
    want("P8", (await open().purchaseById(out.purchaseId)).createdAt === T0 + 777, "startCheckout must stamp createdAt from the injected clock");
  }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`f210 pending reconciler contract holds on ${kind}`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// Source mutants: each edit must make the contract fail on at least one store.
const MUTANTS: [string, [string, string, string][]][] = [
  ["M1 skip the markPaid path", [["pending_reconciler.ts", "const r = await markPaid(d, fresh, { payment_intent: s.paymentIntent, customer: s.customer, subscription: s.subscription }, pendingReconcileEventId(p.id));", "const r = { won: false };"]]],
  ["M2 grace ignored", [["pending_reconciler.ts", "now - grace", "now"]]],
  ["M3 boundary exclusive (memory)", [["store.ts", "(p.createdAt ?? 0) <= cutoff", "(p.createdAt ?? 0) < cutoff"]]],
  ["M4 boundary exclusive (d1)", [["d1_plan_store.ts", "COALESCE(created_at, 0) <= ?", "COALESCE(created_at, 0) < ?"]]],
  ["M5 expired not abandoned", [["pending_reconciler.ts", 's.status === "expired" ||', "false ||"]]],
  ["M6 provider error swallowed", [["pending_reconciler.ts", "rep.errors++; ", ""]]],
  // M7 "no re-read before finalising" is RETIRED by f236: with the compare-and-set in markPaid the re-read is only an optimisation (the outcome is identical), so the mutant is equivalent. The CAS itself is mutation-tested in f236_purchase_cas.test.ts.
  ["M8 settling session abandoned", [["pending_reconciler.ts", '(now - (p.createdAt ?? 0) >= abandonAfterMs && s.status === "open")', "(now - (p.createdAt ?? 0) >= abandonAfterMs)"]]],
  ["M9 sweep stops at first error", [["pending_reconciler.ts", "rep.errors++;", "rep.errors++; return rep;"]]],
  ["M10 unpaid session treated as paid", [["pending_reconciler.ts", 's.paymentStatus === "paid" ||', 'true ||']]],
  ["M11 createdAt not stamped", [["service.ts", 'status: "pending", createdAt: d.now() }', 'status: "pending" }']]],
  ["M12 d1 created_at overwritten", [["d1_plan_store.ts", "created_at = COALESCE(purchases.created_at, excluded.created_at)", "created_at = excluded.created_at"]]],
];
test("f210 mutants: every one is killed", async () => {
  const survivors: string[] = [];
  for (const [name, edits] of MUTANTS) {
    const m = await load(edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { if ((await violations(m, kind)).length) killed = true; } catch { killed = true; } }
    if (!killed) survivors.push(name);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`PENDRECON_MUTANTS ${MUTANTS.length}/${MUTANTS.length} killed`);
});

// The real-Stripe adapter's lookup, over an injected fake fetch (no network). PENDING LIVE: never run against api.stripe.com.
test("f210 StripeHttpBilling.retrieveSession: GET only, maps status, throws on non-2xx", async () => {
  const { StripeHttpBilling } = await import("../src/stripe.ts");
  const seen: { url: string; method?: string }[] = [];
  const mk = (status: number, body: unknown) => (async (u: string, init?: RequestInit) => { seen.push({ url: String(u), method: init?.method }); return new Response(JSON.stringify(body), { status }); }) as unknown as typeof fetch;
  const ok = await new StripeHttpBilling("sk_test_fixture", "test", mk(200, { id: "cs_x", status: "complete", payment_status: "paid", payment_intent: "pi_x", customer: "cus_x", subscription: { id: "sub_x" } })).retrieveSession("cs_x");
  assert.deepEqual([ok.status, ok.paymentStatus, ok.paymentIntent, ok.customer, (ok.subscription as any).id], ["complete", "paid", "pi_x", "cus_x", "sub_x"]);
  assert.equal(seen[0].method, "GET"); assert.match(seen[0].url, /\/v1\/checkout\/sessions\/cs_x\?expand\[\]=subscription$/);
  const odd = await new StripeHttpBilling("sk_test_fixture", "test", mk(200, { id: "cs_y", status: "weird", payment_status: "weird" })).retrieveSession("cs_y");
  assert.deepEqual([odd.status, odd.paymentStatus], ["open", "unpaid"]); // unknown values fail safe: not paid, not expired
  await assert.rejects(new StripeHttpBilling("sk_test_fixture", "test", mk(500, {})).retrieveSession("cs_z"), /stripe_500/);
});
