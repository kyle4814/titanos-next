import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";

// f239: partial-refund lost update (f238 limit 2). casPurchase takes an optional expectedRefundedCents; recordRefund passes the total it read, so the write is
// UPDATE purchases SET ... WHERE id = ? AND status = ? AND refunded_cents = ? (changes() checked, no migration). A lost CAS re-reads and re-merges (cumulative, monotone, clamped), bounded.
// ONE contract (R1..R4) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations), real source AND source mutants (R5). SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const root = mkdtempSync(join(tmpdir(), "f239-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp"); const dir = join(root, "portal-api", "src"); mkdirSync(dir, { recursive: true }); symlinkSync(resolve(SRC, "../../lib"), join(root, "lib")); // f245: src/ imports enterprise/, agent/, owner/ siblings and ../../lib
  try {
    cpSync(SRC, dir, { recursive: true });
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts") };
  } finally { setTimeout(() => rmSync(root, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared), db };
}
const deps = (m: Mods, store: any, billing: MockBilling, now = T0 + GRACE) => ({ store, billing, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const base = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0 };
async function seed(s: any, status: string = "pending", extra: Record<string, unknown> = {}) {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ ...base, status, ...extra });
}
const seedPaid = (s: any) => seed(s, "paid", { paymentIntent: "pi_1", paidAt: T0 });
const ev = (id: string) => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", customer: "cus_1" } } });
const rev = (id: string, cents: number) => ({ id, type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: cents } } });
const gate = () => { let go!: () => void; const p = new Promise<void>((r) => (go = r)); const t = setTimeout(() => go(), 2000); return { p: p.then(() => { clearTimeout(t); }), go: () => { clearTimeout(t); go(); } }; };
const tick = () => new Promise<void>((r) => setTimeout(r, 15));
// every casPurchase that LANDED, with the refunded total it wrote; optional pause (before) and interference (before, once per call) hooks
function track(s: any, landed: { cents: number; status: string }[], h: { before?: Record<string, () => Promise<void>> } = {}) {
  return new Proxy(s, { get(t, k: string) {
    const v = t[k]; if (typeof v !== "function") return v;
    return async (...a: unknown[]) => { await h.before?.[k]?.(); const r = await v.apply(t, a); if (k === "casPurchase" && r === true) landed.push({ cents: (a[0] as any).refundedCents, status: (a[0] as any).status }); return r; };
  } });
}
const monotone = (l: { cents: number }[]) => l.every((x, i) => i === 0 || x.cents >= l[i - 1].cents);

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };

  // R1 two concurrent partial refunds, each paused at its casPurchase and released together, BOTH release orders: ends at the larger cumulative, the ledger never goes backwards.
  // (larger-first is the order that loses the update under a status-only guard.) Third case: both clamp past the amount -> refunded at the full amount.
  for (const [name, a, b, order, status, cents] of [
    ["small released first", 40000, 90000, "ab", "paid", 90000], ["large released first", 40000, 90000, "ba", "paid", 90000],
    ["clamped, large first", 100000, 200000, "ba", "refunded", 150000], ["clamped, small first", 100000, 200000, "ab", "refunded", 150000]] as const) {
    const { open } = world(m, kind); await seedPaid(open()); const landed: any[] = [], gA = gate(), gB = gate(), rA = gate(), rB = gate();
    const pa = m.svc.recordRefund({ store: track(open(), landed, { before: { casPurchase: async () => { rA.go(); await gA.p; } } }) }, "pur1", a).catch((e: Error) => { bad.push(`R1 ${name}: writer A threw ${e.message}`); });
    const pb = m.svc.recordRefund({ store: track(open(), landed, { before: { casPurchase: async () => { rB.go(); await gB.p; } } }) }, "pur1", b).catch((e: Error) => { bad.push(`R1 ${name}: writer B threw ${e.message}`); });
    await Promise.all([rA.p, rB.p]);
    if (order === "ab") { gA.go(); await tick(); gB.go(); } else { gB.go(); await tick(); gA.go(); }
    await Promise.all([pa, pb]);
    const p = await open().purchaseById("pur1");
    want("R1", p.refundedCents === cents && p.status === status, `R1 ${name}: want ${status}/${cents}, got ${p.status}/${p.refundedCents}`);
    want("R1", monotone(landed), `R1 ${name}: the stored refund total went backwards: ${JSON.stringify(landed)}`);
  }

  // R2 three-point pause race: markPaid has won its claim and is paused at takeFacts / putAccount / putInvoiceOnce while a PARTIAL refund webhook lands; markPaid finishes.
  // Ends paid with the partial recorded, ONE invoice, the partial never erased back to 0.
  for (const pause of ["takeFacts", "putAccount", "putInvoiceOnce"]) {
    const { open } = world(m, kind), b = new MockBilling(); await seed(open()); const landed: any[] = [], g = gate(), reached = gate();
    const pay = m.svc.handleStripeEvent(deps(m, track(open(), landed, { before: { [pause]: async () => { reached.go(); await g.p; } } }), b), ev("evt_p")).catch((e: Error) => "THREW " + e.message);
    await reached.p;
    const r = await m.svc.handleStripeEvent(deps(m, track(open(), landed), b), rev("evt_r", 40000));
    g.go(); const w = await pay;
    const p = await open().purchaseById("pur1");
    want("R2", r === "handled" && w === "handled", `R2 ${pause}: both handled, got ${r} / ${w}`);
    want("R2", p.status === "paid" && p.refundedCents === 40000, `R2 ${pause}: want paid/40000, got ${p.status}/${p.refundedCents}`);
    want("R2", (await open().invoicesFor("acc1")).length === 1, `R2 ${pause}: want ONE invoice`);
    want("R2", monotone(landed), `R2 ${pause}: refund total went backwards: ${JSON.stringify(landed)}`);
  }

  // R3 replay is a no-op: the same cumulative again, a smaller stale one, in any order, adds no landed write and leaves the row byte-identical
  { const { open } = world(m, kind), b = new MockBilling(); await seedPaid(open()); const landed: any[] = [], s = track(open(), landed);
    await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_a", 40000)); await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_b", 90000));
    const once = JSON.stringify(await open().purchaseById("pur1")), n = landed.length;
    for (const [i, c] of [90000, 40000, 90000, 0, 40000].entries()) await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_rp" + i, c));
    want("R3", JSON.stringify(await open().purchaseById("pur1")) === once, "R3 a replayed or smaller refund must change nothing");
    want("R3", n === 2 && landed.length === 2, `R3 want exactly two landed writes (40000, 90000), got ${n} then ${landed.length}`); }

  // R4 real contention. A rival refund lands between our read and our write on each of our first 3 CAS attempts: we lose 3 times, re-read, re-merge and land (bounded retry works).
  // A rival that wins EVERY attempt exhausts the retries: recordRefund throws RefundContention (clear error), the webhook is NOT reported handled, and the rival's total is never overwritten.
  { const { open } = world(m, kind); await seedPaid(open()); const landed: any[] = []; let rival = 0;
    const s = track(open(), landed, { before: { casPurchase: async () => { if (rival < 3) { rival++; const c = await open().purchaseById("pur1"); await open().putPurchase({ ...c, refundedCents: c.refundedCents + 1000 }); } } } });
    const p = await m.svc.recordRefund({ store: s }, "pur1", 90000);
    const st = await open().purchaseById("pur1");
    want("R4", rival === 3 && st.refundedCents === 90000 && p?.refundedCents === 90000, `R4 after 3 lost CAS the refund must land at 90000, got ${st.refundedCents} (rival ${rival})`); }
  { const { open } = world(m, kind), b = new MockBilling(); await seedPaid(open()); let rival = 0;
    const s = track(open(), [], { before: { casPurchase: async () => { rival++; const c = await open().purchaseById("pur1"); await open().putPurchase({ ...c, refundedCents: Math.min(60000, c.refundedCents + 100) }); } } });
    let threw = "", ret: any;
    try { ret = await m.svc.recordRefund({ store: s }, "pur1", 90000); } catch (e) { threw = (e as Error).constructor?.name + ": " + (e as Error).message; }
    want("R4", /RefundContention/.test(threw) && /CAS lost/.test(threw), `R4 exhaustion must throw RefundContention, got threw=${JSON.stringify(threw)} returned=${JSON.stringify(ret)}`);
    want("R4", rival >= 2 && rival <= 20, `R4 retries must be bounded, saw ${rival} attempts`);
    want("R4", (await open().purchaseById("pur1")).refundedCents <= 60000, "R4 exhaustion must not overwrite the rival's total");
    let rr = ""; try { rr = await m.svc.handleStripeEvent(deps(m, s, b), rev("evt_x", 90000)); } catch { rr = "THREW"; }
    want("R4", rr !== "handled", `R4 a webhook whose refund could not land must not report handled, got ${rr}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] partial-refund CAS contract R1..R4 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// R5 mutants, each must make the contract fail on at least one store
const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 MemoryStore drops the refunded_cents guard", edits: [["store.ts", " || (expectedRefundedCents !== undefined && cur.refundedCents !== expectedRefundedCents)", ""]] },
  { id: "M2 D1 drops the refunded_cents guard (SQL clause)", edits: [["d1_plan_store.ts", " + (g ? \" AND refunded_cents = ?\" : \"\")", ""], ["d1_plan_store.ts", "p.id, expected, ...(g ? [expectedRefundedCents] : []));", "p.id, expected);"]] },
  { id: "M3 recordRefund no longer passes the refund total it read", edits: [["service.ts", "casPurchase(next, cur.status, cur.refundedCents)) return next;", "casPurchase(next, cur.status)) return next;"]] },
  { id: "M4 retry exhaustion silently returns the stale row", edits: [["service.ts", "throw new RefundContention(purchaseId);", "return d.store.purchaseById(purchaseId);"]] },
  { id: "M5 guard compares against the NEW total (always passes for a raise)", edits: [["service.ts", "casPurchase(next, cur.status, cur.refundedCents)) return next;", "casPurchase(next, cur.status, next.refundedCents)) return next;"]] },
  { id: "M6 retry loop removed (one attempt, then give up)", edits: [["service.ts", "const REFUND_TRIES = 8;", "const REFUND_TRIES = 1;"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the partial-refund contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { const v = await violations(m, kind); if (v.length) { killed = true; if (process.env.C2PREF_WHY) console.log(`# ${mu.id} [${kind}] killed by ${[...new Set(v.map((x) => x.slice(0, 2)))].join(",")}`); } } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`C2PREF_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
