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

// f241: independent cumulative-CAS contract (closes f239 limit on partial-refund lost update). Builds on the f239 CAS already in the base. SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f241-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
  const bad: string[] = [], want = (ok: boolean, msg: string) => { if (!ok) bad.push(msg); };

  // P1 casPurchase guard, direct: a stale expected total fails and leaves the row untouched; the right total lands; omitting it stays status-only.
  { const { open } = world(m, kind), s = open(); await seedPaid(s);
    await s.putPurchase({ ...base, status: "paid", paymentIntent: "pi_1", paidAt: T0, refundedCents: 40000 });
    const stale = await s.casPurchase({ ...base, status: "paid", paymentIntent: "pi_1", paidAt: T0, refundedCents: 50000 }, "paid", 0);
    want(stale === false && (await s.purchaseById("pur1")).refundedCents === 40000, "P1 stale expected total must fail and leave 40000");
    const high = await s.casPurchase({ ...base, status: "paid", paymentIntent: "pi_1", paidAt: T0, refundedCents: 95000 }, "paid", 90000);
    want(high === false && (await s.purchaseById("pur1")).refundedCents === 40000, "P1 an expected total above the stored one must fail too (exact match, not an inequality)");
    const ok = await s.casPurchase({ ...base, status: "paid", paymentIntent: "pi_1", paidAt: T0, refundedCents: 70000 }, "paid", 40000);
    want(ok === true && (await s.purchaseById("pur1")).refundedCents === 70000, "P1 correct expected total must land 70000"); }

  // P2 three concurrent partials (30000, 90000, 60000), every one of the 6 release orders: all land, final is the max, stored total never decreases.
  const perms: number[][] = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]], vals = [30000, 90000, 60000];
  for (const ord of perms) {
    const { open } = world(m, kind); await seedPaid(open()); const landed: any[] = [], gs = vals.map(() => gate()), rs = vals.map(() => gate());
    const ps = vals.map((v, i) => m.svc.recordRefund({ store: track(open(), landed, { before: { casPurchase: async () => { rs[i].go(); await gs[i].p; } } }) }, "pur1", v).catch((e: Error) => { bad.push(`P2 ${ord} writer ${i} threw ${e.message}`); }));
    await Promise.all(rs.map((r) => r.p));
    for (const i of ord) { gs[i].go(); await tick(); }
    await Promise.all(ps);
    const p = await open().purchaseById("pur1");
    want(p.refundedCents === 90000 && p.status === "paid", `P2 order ${ord}: want paid/90000, got ${p.status}/${p.refundedCents}`);
    want(monotone(landed), `P2 order ${ord}: stored total went backwards ${JSON.stringify(landed)}`);
  }

  // P3 webhook level: concurrent charge.refunded events (cumulative 40000 and 90000) both handled, final 90000; then replays of lower cumulatives (0, 40000, 90000) never reduce it.
  { const { open } = world(m, kind), b = new MockBilling(); await seedPaid(open()); const landed: any[] = [], ga = gate(), gb = gate(), ra = gate(), rb = gate();
    const wa = m.svc.handleStripeEvent(deps(m, track(open(), landed, { before: { casPurchase: async () => { ra.go(); await ga.p; } } }), b), rev("evt_a", 90000)).catch((e: Error) => "THREW " + e.message);
    const wb = m.svc.handleStripeEvent(deps(m, track(open(), landed, { before: { casPurchase: async () => { rb.go(); await gb.p; } } }), b), rev("evt_b", 40000)).catch((e: Error) => "THREW " + e.message);
    await Promise.all([ra.p, rb.p]); ga.go(); await tick(); gb.go();
    const [x, y] = await Promise.all([wa, wb]);
    want(x === "handled" && y === "handled", `P3 both handled, got ${x}/${y}`);
    want((await open().purchaseById("pur1")).refundedCents === 90000, "P3 want 90000 after concurrent 90000 and 40000");
    for (const [i, c] of [0, 40000, 90000, 10000].entries()) {
      await m.svc.handleStripeEvent(deps(m, open(), b), rev("evt_rp" + i, c));
      want((await open().purchaseById("pur1")).refundedCents === 90000, `P3 replay of cumulative ${c} must leave 90000`);
    }
    want(monotone(landed), "P3 stored total went backwards"); }

  // P4 over-refund clamp: a cumulative above the amount lands refunded at exactly amountCents, and a later lower replay does not reopen it.
  { const { open } = world(m, kind), b = new MockBilling(); await seedPaid(open());
    await m.svc.handleStripeEvent(deps(m, open(), b), rev("evt_big", 999999));
    let p = await open().purchaseById("pur1");
    want(p.refundedCents === 150000 && p.status === "refunded", `P4 want refunded/150000, got ${p.status}/${p.refundedCents}`);
    await m.svc.handleStripeEvent(deps(m, open(), b), rev("evt_low", 20000));
    p = await open().purchaseById("pur1");
    want(p.refundedCents === 150000 && p.status === "refunded", `P4 lower replay must not reduce or reopen, got ${p.status}/${p.refundedCents}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] cumulative partial-refund CAS contract P1..P4 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 MemoryStore drops the refunded_cents guard", edits: [["store.ts", " || (expectedRefundedCents !== undefined && cur.refundedCents !== expectedRefundedCents)", ""]] },
  { id: "M2 D1 drops the refunded_cents SQL clause", edits: [["d1_plan_store.ts", " + (g ? \" AND refunded_cents = ?\" : \"\")", ""], ["d1_plan_store.ts", "p.id, expected, ...(g ? [expectedRefundedCents] : []));", "p.id, expected);"]] },
  { id: "M3 recordRefund omits the total it read", edits: [["service.ts", "casPurchase(next, cur.status, cur.refundedCents)) return next;", "casPurchase(next, cur.status)) return next;"]] },
  { id: "M4 applyRefund not monotone (replay lowers the total)", edits: [["service.ts", "pur.refundedCents = Math.max(pur.refundedCents, Math.min(", "pur.refundedCents = (Math.min("]] },
  { id: "M5 applyRefund drops the amount clamp", edits: [["service.ts", "Math.min(pur.amountCents, Math.max(0, Math.trunc(cents) || 0))", "Math.max(0, Math.trunc(cents) || 0)"]] },
  { id: "M6 single attempt only", edits: [["service.ts", "const REFUND_TRIES = 8;", "const REFUND_TRIES = 1;"]] },
  { id: "M7 retry reuses a stale snapshot via the new total as guard", edits: [["service.ts", "casPurchase(next, cur.status, cur.refundedCents)) return next;", "casPurchase(next, cur.status, next.refundedCents)) return next;"]] },
  { id: "M8 guard compares total with <= (accepts a stale lower read)", edits: [["store.ts", "cur.refundedCents !== expectedRefundedCents", "cur.refundedCents > expectedRefundedCents"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the cumulative contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { if ((await violations(m, kind)).length) killed = true; } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`C2PREFCUM_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
