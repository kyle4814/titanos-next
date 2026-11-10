import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, symlinkSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";

// f243: atomic refund memo + reaper (f240 limit 2). Stripe is called BEFORE the refunded_cents CAS; a lost CAS must never re-call Stripe, exhaustion must surface a typed error carrying the refund id,
// and a replay must converge without a second Stripe call. ONE contract (Q1..Q4) over MemoryStore and D1PlanStore (FakeD1), real source AND source mutants (Q5). SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000;
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const root = mkdtempSync(join(tmpdir(), "f243-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp");
  // f344 restack: int3's service.ts imports ./enterprise/* (which reaches ../../../lib/guestscan), so the whole src tree is copied
  // under <root>/portal-api/src and the repo lib/ is linked at <root>/lib. The mutations still edit only the copy.
  const dir = join(root, "portal-api", "src");
  try {
    cpSync(SRC, dir, { recursive: true });
    symlinkSync(resolve(SRC, "../../lib"), join(root, "lib"));
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


const MEMO = "refundsent:pur1";
export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const intentAt = (s: any, at: number) => s.memoInsert(MEMO, { state: "intent", at });

  // A1 crash between take and hold: the memo is claimed by ONE insert, so a crash right after the Stripe call (the swap that remembers the refund id throws) leaves the intent in place, never nothing.
  // The replay after the lease takes it over, reuses the same key, ends refunded with the memo cleared and no orphan.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling();
    const crashing = new Proxy(open(), { get(t, k: string) { const v = t[k]; return typeof v === "function" ? (...a: unknown[]) => (k === "memoSwap" && (a[2] as any)?.refundId ? Promise.reject(new Error("crash")) : v.apply(t, a)) : v; } });
    let crashed = false; await m.svc.requestRefund(deps(m, crashing, b), acct, "pur1").catch(() => { crashed = true; });
    want("A1", crashed, "A1 the injected crash must surface");
    const left = await open().memoPeek(MEMO);
    want("A1", left !== undefined && left.state === "intent", `A1 a crash after the claim must leave the intent (not lose the memo), got ${JSON.stringify(left)}`);
    const later = { ...deps(m, open(), b), now: () => NOW + m.svc.MEMO_LEASE_MS + 1 };
    const out = await m.svc.requestRefund(later, acct, "pur1"); const p = await open().purchaseById("pur1");
    want("A1", out.status === "refunded" && p.status === "refunded" && p.refundedCents === 599700, `A1 replay must converge, got ${out.status} ${p.status}/${p.refundedCents}`);
    want("A1", b.distinct === 1 && b.keys.every((k) => k === "refund-pur1"), `A1 every Stripe call under ONE key, got ${JSON.stringify(b.keys)}`);
    want("A1", (await open().memoList("refundsent:")).length === 0, "A1 no orphan memo after convergence"); }

  // A2 a live (unexpired) intent is respected: a rival never calls Stripe while the owner may still be working.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); await intentAt(open(), NOW);
    let err: any; await m.svc.requestRefund(deps(m, open(), b), acct, "pur1").catch((e: unknown) => { err = e; });
    want("A2", err?.name === "RefundInFlight" && b.n === 0, `A2 live intent: want RefundInFlight and 0 Stripe calls, got ${err?.name} n=${b.n}`); }

  // A3 two concurrent requestRefund (3 callers to be sure): EXACTLY ONE billing.refund call, all settle, ends refunded/full, memo cleared.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const d = deps(m, open(), b);
    const rs = await Promise.allSettled([m.svc.requestRefund(d, acct, "pur1"), m.svc.requestRefund(d, acct, "pur1"), m.svc.requestRefund(d, acct, "pur1")]);
    const p = await open().purchaseById("pur1");
    want("A3", b.n === 1 && b.keys[0] === "refund-pur1", `A3 exactly one billing.refund call, got n=${b.n}`);
    want("A3", rs.every((r) => r.status === "fulfilled"), `A3 all callers settle, got ${rs.map((r) => r.status + ((r as any).reason?.message ?? ""))}`);
    want("A3", p.status === "refunded" && p.refundedCents === 599700, `A3 want refunded/599700, got ${p.status}/${p.refundedCents}`);
    want("A3", (await open().memoList("refundsent:")).length === 0, "A3 memo cleared"); }

  // A4 reaper: removes a stale memo whose purchase is no longer paid; keeps a young one, and keeps an OLD memo whose refund is still pending (purchase still paid).
  { const { open } = world(m, kind); const s = open(); await seedPaid(s, { status: "refunded", refundedCents: 599700 });
    await s.memoInsert("refundsent:pur1", { refundId: "re_old", at: NOW - 10 * DAY });                 // stale + settled -> reaped
    await s.putPurchase({ id: "pur2", accountId: "acc1", productId: "compliance_pack", checkoutId: "cs_2", amountCents: 599700, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "paid", paymentIntent: "pi_2", paidAt: T0 });
    await s.memoInsert("refundsent:pur2", { refundId: "re_pending", at: NOW - 10 * DAY });             // stale but STILL PENDING -> kept
    await s.putPurchase({ id: "pur3", accountId: "acc1", productId: "compliance_pack", checkoutId: "cs_3", amountCents: 599700, deliverableIssued: false, refundedCents: 599700, createdAt: T0, status: "refunded", paymentIntent: "pi_3", paidAt: T0 });
    await s.memoInsert("refundsent:pur3", { refundId: "re_young", at: NOW - 1000 });                   // young -> kept
    await s.memoInsert("refundsent:ghost", { state: "intent", at: NOW - 10 * DAY });                   // purchase gone -> reaped
    const r = await m.svc.reapRefundMemos(deps(m, s, new CountingBilling()));
    want("A4", [...r.reaped].sort().join() === "refundsent:ghost,refundsent:pur1", `A4 reaped want ghost+pur1, got ${r.reaped}`);
    want("A4", (await s.memoPeek("refundsent:pur2")) !== undefined, "A4 a pending refund memo must never be reaped");
    want("A4", (await s.memoPeek("refundsent:pur3")) !== undefined, "A4 a young memo must be kept");
    // a memo rewritten between list and delete survives the reap (CAS on the exact fact)
    await s.memoInsert("refundsent:race", { state: "intent", at: NOW - 10 * DAY });
    const racing = new Proxy(s, { get(t, k: string) { const v = t[k]; return typeof v === "function" ? async (...a: unknown[]) => { if (k === "purchaseById" && a[0] === "race") await t.memoSwap("refundsent:race", { state: "intent", at: NOW - 10 * DAY }, { refundId: "re_live", at: NOW }); return v.apply(t, a); } : v; } });
    await m.svc.reapRefundMemos(deps(m, racing, new CountingBilling()));
    want("A4", (await s.memoPeek("refundsent:race"))?.refundId === "re_live", "A4 a memo a live call just rewrote must survive the reaper"); }

  // A5 replay after reap still converges: the webhook healed the ledger, the memo is reaped, a replayed requestRefund is a clean 409 with no Stripe call;
  // and if the refund is still pending the memo is NOT reaped, so the replay converges with no second Stripe call.
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const c = { n: 0 };
    await m.svc.requestRefund(deps(m, rival(open(), c), b), acct, "pur1").catch(() => undefined);              // RefundRecordPending: memo kept
    const late = { ...deps(m, open(), b), now: () => NOW + m.svc.MEMO_TTL_MS + 1 };
    const r1 = await m.svc.reapRefundMemos(late);
    want("A5", r1.reaped.length === 0 && (await open().memoPeek(MEMO)) !== undefined, `A5 pending refund survives the reaper, got ${JSON.stringify(r1)}`);
    await m.svc.handleStripeEvent(deps(m, open(), b), { id: "evt_r", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: 599700 } } });
    const r2 = await m.svc.reapRefundMemos(late);
    want("A5", r2.reaped.join() === MEMO && (await open().memoPeek(MEMO)) === undefined, `A5 once settled the memo is reaped, got ${JSON.stringify(r2)}`);
    let code = ""; try { await m.svc.requestRefund(deps(m, open(), b), acct, "pur1"); } catch (e: any) { code = e.code ?? e.message; }
    const p = await open().purchaseById("pur1");
    want("A5", code === "not_refundable_yet" && b.n === 1 && p.status === "refunded" && p.refundedCents === 599700, `A5 replay after reap: want 409 and 1 Stripe call, got ${code} n=${b.n} ${p.status}`); }
  { const { open } = world(m, kind); await seedPaid(open()); const b = new CountingBilling(); const c = { n: 0 };
    await m.svc.requestRefund(deps(m, rival(open(), c), b), acct, "pur1").catch(() => undefined);
    await m.svc.reapRefundMemos({ ...deps(m, open(), b), now: () => NOW + m.svc.MEMO_TTL_MS + 1 });
    const again = await m.svc.requestRefund(deps(m, open(), b), acct, "pur1"); const p = await open().purchaseById("pur1");
    want("A5", again.status === "refunded" && p.refundedCents === 599700 && b.n === 1, `A5 replay after a (no-op) reap converges with one Stripe call, got ${again.status} n=${b.n}`); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] atomic refund memo + reaper contract A1..A5 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// A6 mutants. M1 reverts atomicity: the claim becomes peek-then-write (take-then-hold shape: a yield between check and write), so two callers both "win". Others break the reaper and the lease.
const NONATOMIC = "if (await d.store.memoInsert(memo, intent)) { mine = intent; break; }";
const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 claim not atomic (peek, yield, then write)", edits: [["service.ts", NONATOMIC, "if (!(await d.store.memoPeek(memo))) { await new Promise((r) => setImmediate(r)); await d.store.memoSwap(memo, intent, null); await d.store.memoInsert(memo, { ...intent, again: 1 }); mine = intent; break; }"]] },
  { id: "M2 reaper ignores a pending refund (reaps while purchase is paid)", edits: [["service.ts", "if (pur && pur.status === \"paid\") { kept.push(key); continue; }", ""]] },
  { id: "M3 reaper ignores the TTL", edits: [["service.ts", "if (d.now() - Number(fact.at ?? 0) <= ttlMs)", "if (false)"]] },
  { id: "M4 reaper deletes blind (no CAS on the exact fact)", edits: [["service.ts", "if (await d.store.memoSwap(key, fact, null)) reaped.push(key)", "if (await d.store.memoSwap(key, (await d.store.memoPeek(key)) ?? fact, null)) reaped.push(key)"]] },
  { id: "M5 expired intent never taken over (crash strands the refund)", edits: [["service.ts", "d.now() - Number(cur.at) > MEMO_LEASE_MS &&", "false &&"]] },
  { id: "M6 live intent ignored (rival takes over at once)", edits: [["service.ts", "d.now() - Number(cur.at) > MEMO_LEASE_MS &&", "true &&"]] },
  { id: "M7 memo never cleared once the ledger lands (orphan)", edits: [["service.ts", "const cur = await d.store.memoPeek(memo); if (cur) await d.store.memoSwap(memo, cur, null);", ""]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the memo contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { try { const v = await violations(m, kind); if (v.length) { killed = true; if (process.env.C2MEMO_WHY) console.log(`# ${mu.id} [${kind}] killed by ${[...new Set(v.map((x) => x.slice(0, 2)))].join(",")}`); } } catch { killed = true; } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`C2MEMO_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
