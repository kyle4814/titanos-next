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

// f247: (1) the scheduled sweep entry (src/sweep.ts runSweep, index.ts scheduled) calls reapRefundMemos beside reconcilePending/reconcileSubscriptions;
// (2) requestRefund's rival wait is bounded by an injectable CLOCK (deadline = the 60 s intent lease), not a yield count. Memory + FakeD1 (node:sqlite). SYNTHETIC ids only. Real source AND source mutants.
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000;
type Mods = { store: any; d1: any; svc: any; sweep: any; idx: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f247-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), sweep: await imp("sweep.ts"), idx: await imp("index.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) { const db = new FakeD1(), shared = new m.store.MemoryStore(); return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared) }; }
class CountingBilling extends MockBilling {
  byKey = new Map<string, string>(); n = 0;
  override async refund(_pi: string, _amt: number, key: string) { this.n++; if (!this.byKey.has(key)) this.byKey.set(key, "re_syn_" + (this.byKey.size + 1)); return { id: this.byKey.get(key)! }; }
}
const NOW = T0 + DAY;
const clockDeps = (m: Mods, store: any, billing: MockBilling, clock: { t: number }, sleep?: (ms: number) => Promise<void>) =>
  ({ store, billing, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => clock.t, sleep, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const acct = { id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 };
const pur = (id: string, extra: Record<string, unknown> = {}) => ({ id, accountId: "acc1", productId: "compliance_pack", checkoutId: "cs_" + id, amountCents: 599700, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "paid", paymentIntent: "pi_" + id, paidAt: T0, ...extra });
const MEMO = "refundsent:pur1";

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };

  // S1 a scheduled run reaps a stale SETTLED memo and keeps a stale memo whose purchase is still paid (a refund still pending), and a young one.
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct);
    await s.putPurchase(pur("pur1", { status: "refunded", refundedCents: 599700 })); await s.memoInsert("refundsent:pur1", { refundId: "re_old", at: NOW - 10 * DAY });
    await s.putPurchase(pur("pur2")); await s.memoInsert("refundsent:pur2", { refundId: "re_pending", at: NOW - 10 * DAY });
    await s.putPurchase(pur("pur3", { status: "refunded", refundedCents: 599700 })); await s.memoInsert("refundsent:pur3", { refundId: "re_young", at: NOW - 1000 });
    const d = clockDeps(m, s, new CountingBilling(), { t: NOW });
    const direct = await m.sweep.runSweep(d);
    want("S1", direct.errors.length === 0, `S1 sweep must run clean, got ${JSON.stringify(direct.errors)}`);
    want("S1", direct.memos?.reaped.join() === "refundsent:pur1" && (await s.memoPeek("refundsent:pur1")) === undefined, `S1 stale settled memo must be reaped by the sweep, got ${JSON.stringify(direct.memos)}`);
    want("S1", (await s.memoPeek("refundsent:pur2")) !== undefined, "S1 a memo whose purchase is still paid must be kept");
    want("S1", (await s.memoPeek("refundsent:pur3")) !== undefined, "S1 a young memo must be kept");
    want("S1", direct.pending !== undefined && direct.subscriptions !== undefined, "S1 the sweep still runs reconcilePending and reconcileSubscriptions"); }

  // S2 the Worker's scheduled() entry runs the same sweep; with no injected deps it fails closed and touches nothing.
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct); await s.putPurchase(pur("pur1", { status: "refunded", refundedCents: 599700 }));
    await s.memoInsert(MEMO, { refundId: "re_old", at: NOW - 10 * DAY });
    const none = await m.idx.scheduled({});
    want("S2", none?.skipped === "store_unavailable" && (await s.memoPeek(MEMO)) !== undefined, `S2 no deps must skip and touch nothing, got ${JSON.stringify(none)}`);
    const rep = await m.idx.scheduled({}, clockDeps(m, s, new CountingBilling(), { t: NOW }));
    want("S2", rep.memos?.reaped.join() === MEMO && (await s.memoPeek(MEMO)) === undefined, `S2 scheduled() must reap the stale settled memo, got ${JSON.stringify(rep)}`); }

  // S3 one failing pass never stops the others: reconcilePending throws, the reaper still runs and the error is reported.
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct); await s.putPurchase(pur("pur1", { status: "refunded", refundedCents: 599700 })); await s.memoInsert(MEMO, { refundId: "re_old", at: NOW - 10 * DAY });
    const broken = new Proxy(s, { get(t, k: string) { const v = t[k]; return typeof v === "function" ? (...a: unknown[]) => (k === "pendingPurchasesBefore" ? Promise.reject(new Error("boom")) : v.apply(t, a)) : v; } });
    const rep = await m.sweep.runSweep(clockDeps(m, broken, new CountingBilling(), { t: NOW }));
    want("S3", rep.errors.some((e: string) => e.startsWith("pending:")) && rep.memos?.reaped.join() === MEMO, `S3 a failing pass must be reported and the reaper still run, got ${JSON.stringify(rep)}`); }

  // W1 a rival past the deadline gets RefundInFlight with ZERO Stripe calls; the wait ends at start + MEMO_LEASE_MS on the injected clock (1 s polls).
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct); await s.putPurchase(pur("pur1")); await s.memoInsert(MEMO, { state: "intent", at: NOW }); const b = new CountingBilling(), clock = { t: NOW }; let naps = 0;
    let err: any; await m.svc.requestRefund(clockDeps(m, s, b, clock, async (ms: number) => { naps++; clock.t += 1000; void ms; }), acct, "pur1").catch((e: unknown) => { err = e; });
    want("W1", err?.name === "RefundInFlight" && b.n === 0, `W1 want RefundInFlight and 0 Stripe calls, got ${err?.name} n=${b.n}`);
    want("W1", clock.t >= NOW + m.svc.MEMO_LEASE_MS && naps <= 61, `W1 wait must end at the lease deadline on the clock, got clock +${clock.t - NOW} ms after ${naps} naps`); }

  // W2 the bound is the CLOCK, not a poll count: a clock that jumps 30 s per nap ends the wait in at most 3 naps (a 200-yield loop would nap 200 times).
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct); await s.putPurchase(pur("pur1")); await s.memoInsert(MEMO, { state: "intent", at: NOW }); const b = new CountingBilling(), clock = { t: NOW }; let naps = 0;
    let err: any; await m.svc.requestRefund(clockDeps(m, s, b, clock, async () => { naps++; clock.t += 30_000; }), acct, "pur1").catch((e: unknown) => { err = e; });
    want("W2", err?.name === "RefundInFlight" && b.n === 0 && naps <= 3, `W2 clock-bounded: want RefundInFlight, 0 calls, <=3 naps, got ${err?.name} n=${b.n} naps=${naps}`); }

  // W3 a rival whose winner settles INSIDE the deadline converges to exactly one refund (the winner's single Stripe call), memo cleared, no second call.
  { const { open } = world(m, kind), s = open(); await s.putAccount(acct); await s.putPurchase(pur("pur1")); await s.memoInsert(MEMO, { state: "intent", at: NOW }); const b = new CountingBilling(), clock = { t: NOW }; let naps = 0;
    const settle = async () => { const id = (await b.refund("pi_pur1", 599700, "refund-pur1")).id; await s.memoSwap(MEMO, { state: "intent", at: NOW }, { refundId: id, at: clock.t }); const c = await s.purchaseById("pur1"); await s.casPurchase({ ...c, status: "refunded", refundedCents: 599700 }, "paid"); };
    const out = await m.svc.requestRefund(clockDeps(m, s, b, clock, async () => { naps++; clock.t += 1000; if (naps === 5) await settle(); }), acct, "pur1");
    const p = await s.purchaseById("pur1");
    want("W3", out.status === "refunded" && p.status === "refunded" && p.refundedCents === 599700 && b.n === 1, `W3 want refunded with one Stripe call, got ${out.status} ${p.status}/${p.refundedCents} n=${b.n}`);
    want("W3", (await s.memoList("refundsent:")).length === 0, "W3 memo cleared after convergence"); }
  return bad;
}

for (const kind of ["memory", "d1"] as const) test(`[${kind}] sweep wiring + clock-bounded rival wait S1..S3 W1..W3 hold on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });

// Mutants (scratch copies of src; the real tree is never edited). Each reverts exactly one of the two changes, or breaks it.
const STEP = '  await step("memos", () => reapRefundMemos(d));\n';
const MUT: { id: string; edits: [string, string, string][] }[] = [
  { id: "M1 sweep no longer calls reapRefundMemos (change 1 reverted)", edits: [["sweep.ts", STEP, ""]] },
  { id: "M2 scheduled() skips the sweep", edits: [["index.ts", "return runSweep(deps);", "return { errors: [] };"]] },
  { id: "M3 failing pass aborts the sweep (no isolation)", edits: [["sweep.ts", "catch (e) { rep.errors.push(", "catch (e) { throw e; rep.errors.push("]] },
  { id: "M4 rival wait back to a poll count, clock ignored (change 2 reverted)", edits: [["service.ts", "if (d.now() >= deadline || waited >= MEMO_LEASE_MS) break;", "if (waited >= 200 * MEMO_POLL_MS) break;"]] },
  { id: "M5 rival wait never ends on a live intent (unbounded)", edits: [["service.ts", "if (d.now() >= deadline || waited >= MEMO_LEASE_MS) break;", ""]] },
  { id: "M6 deadline is clock-only, shorter than the lease (5 s)", edits: [["service.ts", "const deadline = d.now() + MEMO_LEASE_MS", "const deadline = d.now() + 5_000"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants fail the f247 contract`, async () => {
  const survivors: string[] = [];
  for (const mu of MUT) {
    const m = await load(mu.edits); let killed = false;
    for (const kind of ["memory", "d1"] as const) { let tm: NodeJS.Timeout | undefined; try { const v = await Promise.race([violations(m, kind), new Promise<string[]>((_, rej) => { tm = setTimeout(() => rej(new Error("hang")), 20_000); })]); if (v.length) { killed = true; if (process.env.F247_WHY) console.log(`# ${mu.id} [${kind}] killed by ${[...new Set(v.map((x) => x.slice(0, 2)))].join(",")}`); } } catch (e) { killed = true; if (process.env.F247_WHY) console.log(`# ${mu.id} [${kind}] killed by throw: ${(e as Error).message.slice(0, 80)}`); } finally { clearTimeout(tm); } }
    if (!killed) survivors.push(mu.id);
  }
  assert.deepEqual(survivors, [], "surviving mutants");
  console.log(`F247_MUTANTS ${MUT.length}/${MUT.length} killed`);
});
