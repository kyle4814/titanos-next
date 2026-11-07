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

// f240: requestRefund-level contention (f239 limit 3). Stripe is called BEFORE the refunded_cents CAS; a lost CAS must never re-call Stripe, exhaustion must surface a typed error carrying the refund id,
// and a replay must converge without a second Stripe call. ONE contract (Q1..Q4) over MemoryStore and D1PlanStore (FakeD1), real source AND source mutants (Q5). SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000;
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f240-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared) };
}
// Stripe-faithful fake: counts every refund call, and (like Stripe) answers a repeated idempotency key with the SAME refund id.
class CountingBilling extends MockBilling {
  byKey = new Map<string, string>(); n = 0; keys: string[] = [];
  override async refund(pi: string, amountCents: number, key: string) { this.n++; this.keys.push(key); if (!this.byKey.has(key)) this.byKey.set(key, "re_syn_" + (this.byKey.size + 1)); return { id: this.byKey.get(key)! }; }
  get distinct() { return this.byKey.size; }
}
const NOW = T0 + DAY; // inside the 14-day policy window
const deps = (m: Mods, store: any, billing: MockBilling) => ({ store, billing, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => NOW, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const acct = { id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 };
async function seedPaid(s: any, extra: Record<string, unknown> = {}) {
  await s.putAccount(acct);
  await s.putPurchase({ id: "pur1", accountId: "acc1", productId: "compliance_pack", checkoutId: "cs_1", amountCents: 599700, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "paid", paymentIntent: "pi_1", paidAt: T0, ...extra });
}
// interfere before every casPurchase: a rival bumps refunded_cents (never reaching the full amount), so our CAS keeps losing
function rival(s: any, counter: { n: number }, max = Infinity) {
  return new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v;
    return async (...a: unknown[]) => { if (k === "casPurchase" && counter.n < max) { counter.n++; const c = await t.purchaseById("pur1"); await t.putPurchase({ ...c, refundedCents: Math.min(300000, c.refundedCents + 100) }); } return v.apply(t, a); }; } });
}

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };

  // Q1 two concurrent requestRefund calls on one paid row: each calls billing.refund at most once, both under the one key, ledger ends at the clamped full amount (refunded), no throw.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const d = deps(m, open(), b);
    const rs = await Promise.allSettled([m.svc.requestRefund(d, acct, "pur1"), m.svc.requestRefund(d, acct, "pur1")]);
    const p = await open().purchaseById("pur1");
    want("Q1", rs.every((r) => r.status === "fulfilled"), `Q1 both calls must settle, got ${rs.map((r) => r.status + ((r as any).reason?.message ?? ""))}`);
    want("Q1", b.n <= 2 && b.distinct === 1 && b.keys.every((k) => k === "refund-pur1"), `Q1 at most one refund per call under ONE key, got n=${b.n} keys=${JSON.stringify(b.keys)}`);
    want("Q1", p.status === "refunded" && p.refundedCents === 599700, `Q1 want refunded/599700, got ${p.status}/${p.refundedCents}`); }
  // Q2 a CAS lost 3 times (rival lands each time) then wins: ONE billing.refund call in total, one key, ledger lands at the full amount.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const c = { n: 0 };
    const out = await m.svc.requestRefund(deps(m, rival(open(), c, 3), b), acct, "pur1");
    const p = await open().purchaseById("pur1");
    want("Q2", c.n === 3, `Q2 the rival must have forced 3 lost CAS, saw ${c.n}`);
    want("Q2", b.n === 1 && b.keys[0] === "refund-pur1", `Q2 a lost CAS must never re-call Stripe: want 1 call under refund-pur1, got n=${b.n} keys=${JSON.stringify(b.keys)}`);
    want("Q2", out.status === "refunded" && p.refundedCents === 599700 && p.status === "refunded", `Q2 want refunded/599700, got ${out.status} ${p.status}/${p.refundedCents}`); }

  // Q3 exhaustion after a successful billing.refund: typed RefundRecordPending (still a RefundContention) carrying the refund id, key and purchase id; ONE Stripe call; HTTP-visible code documented in index.ts.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const c = { n: 0 }; let err: any, ret: any;
    try { ret = await m.svc.requestRefund(deps(m, rival(open(), c), b), acct, "pur1"); } catch (e) { err = e; }
    want("Q3", err !== undefined && ret === undefined, `Q3 exhaustion must throw, never return as if refunded; returned=${JSON.stringify(ret)}`);
    want("Q3", err instanceof m.svc.RefundContention && err?.name === "RefundRecordPending", `Q3 want RefundRecordPending (a RefundContention), got ${err?.name}`);
    want("Q3", err?.refundId === "re_syn_1" && err?.idempotencyKey === "refund-pur1" && err?.purchaseId === "pur1", `Q3 error must carry refundId/key/purchaseId, got ${JSON.stringify({ r: err?.refundId, k: err?.idempotencyKey, p: err?.purchaseId })}`);
    want("Q3", b.n === 1, `Q3 exactly one Stripe call across all retries, got ${b.n}`);
    want("Q3", c.n >= 2 && c.n <= 20, `Q3 retries must be bounded, saw ${c.n}`);
    // the next charge.refunded webhook heals the ledger (no Stripe call)
    const wh = await m.svc.handleStripeEvent(deps(m, open(), b), { id: "evt_h", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: 599700 } } });
    const p = await open().purchaseById("pur1");
    want("Q3", wh === "handled" && p.status === "refunded" && p.refundedCents === 599700 && b.n === 1, `Q3 the next webhook must heal to refunded/599700 with no new Stripe call, got ${wh} ${p.status}/${p.refundedCents} n=${b.n}`); }

  // Q4 replay after exhaustion (no webhook yet): converges to refunded/full amount WITHOUT a second Stripe call; a further replay is a clean 409, no Stripe call, memo cleared.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const c = { n: 0 };
    await m.svc.requestRefund(deps(m, rival(open(), c), b), acct, "pur1").catch(() => undefined);
    const again = await m.svc.requestRefund(deps(m, open(), b), acct, "pur1");
    const p = await open().purchaseById("pur1");
    want("Q4", again.status === "refunded" && p.status === "refunded" && p.refundedCents === 599700, `Q4 replay must converge to refunded/599700, got ${again.status} ${p.status}/${p.refundedCents}`);
    want("Q4", b.n === 1, `Q4 replay must not call Stripe again, got ${b.n} calls`);
    let code = ""; try { await m.svc.requestRefund(deps(m, open(), b), acct, "pur1"); } catch (e: any) { code = e.code ?? e.message; }
    want("Q4", code === "not_refundable_yet" && b.n === 1, `Q4 third call must be 409 not_refundable_yet with no Stripe call, got ${code} n=${b.n}`);
    want("Q4", (await open().memoPeek("refundsent:pur1")) === undefined, "Q4 the remembered refund must be cleared once the ledger landed"); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] requestRefund contention contract Q1..Q4 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// Q5 mutants, each must make the contract fail on at least one store
const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 idempotency key not reused (fresh key per attempt)", edits: [["service.ts", "const key = `refund-${pur.id}`, memo", "const key = `refund-${pur.id}-${Math.random()}`, memo"]] },
  { id: "M2 RefundContention swallowed (requestRefund reports refunded)", edits: [["service.ts", "if (e instanceof RefundContention) throw new RefundRecordPending(pur.id, sent.refundId, key); throw e;", "if (e instanceof RefundContention) return { status: \"refunded\" as const, amountCents: pur.amountCents }; throw e;"]] },
  { id: "M3 refund id not carried on the error", edits: [["service.ts", "throw new RefundRecordPending(pur.id, sent.refundId, key)", "throw new RefundRecordPending(pur.id, \"\", key)"]] },
  { id: "M4 replay ignores the remembered refund (calls Stripe again)", edits: [["service.ts", "if (typeof cur.refundId === \"string\") { sent = cur as { refundId: string }; break; }", "if (typeof cur.refundId === \"string\") { await d.store.memoSwap(memo, cur, null); continue; }"]] },
  { id: "M5 Stripe re-called inside the retry (once per CAS attempt)", edits: [["service.ts", "try { await recordRefund(d, pur.id, pur.amountCents); }", "try { await d.billing.refund(pur.paymentIntent, 1, key); await recordRefund(d, pur.id, pur.amountCents); }"]] },
  { id: "M6 error is a bare RefundContention (not the typed pending error)", edits: [["service.ts", "throw new RefundRecordPending(pur.id, sent.refundId, key); throw e;", "throw e;"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the requestRefund contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { const v = await violations(m, kind); if (v.length) { killed = true; if (process.env.C2REQ_WHY) console.log(`# ${mu.id} [${kind}] killed by ${[...new Set(v.map((x) => x.slice(0, 2)))].join(",")}`); } } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`C2REQ_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
