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

// f252 (C2 residual from f245 limit 3): markPaid did not call replayLateFacts. A cancel or invoice period held for the subscription AFTER the winner's buildSubscriptionTaken takeFacts and BEFORE its
// putSubscriptionOnce was covered only by the lease and the 10 minute grace; the row was then written without it and the fact sat held. Now the winner drains late facts after its write, through
// replayLateFacts -> casEditSubscription (f248). Explicit barriers (promises), no sleeps. L1..L4 on MemoryStore and D1PlanStore (FakeD1), on real source AND on a mutant. SYNTHETIC ids, MockBilling only.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f252-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
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
const addMonths = (ms: number, n: number) => { const x = new Date(ms); x.setUTCMonth(x.getUTCMonth() + n); return x.getTime(); };
const sessionFor = (k: number) => ({ id: "sub_1", current_period_start: addMonths(T0, k) / 1000, current_period_end: addMonths(T0, k + 1) / 1000, billing_cycle_anchor: T0 / 1000 });
const heldPeriod = (k: number) => ({ kind: "period", start: addMonths(T0, k), end: addMonths(T0, k + 1), create: false });
const ACC = { id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 };
const deps = (m: Mods, store: any) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
async function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), s: any = kind === "d1" ? new m.d1.D1PlanStore(db) : new m.store.MemoryStore();
  await s.putAccount(ACC);
  const pur = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0, status: "pending" };
  await s.putPurchase(pur);
  return { s, pur };
}
// Barrier: the first subscription WRITE parks until release(). By then the winner's last takeFacts of the build has run.
function barrier(s: any) {
  let release!: () => void, parkedRes!: () => void, n = 0;
  const gate = new Promise<void>((r) => (release = r)), parked = new Promise<void>((r) => (parkedRes = r));
  const view = new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => {
    if (["casSubscription", "putSubscription", "putSubscriptionOnce"].includes(k) && ++n === 1) { parkedRes(); await gate; }
    return v.apply(t, a); }; } });
  return { view, parked, release: () => release() };
}
const o = { payment_intent: "pi_1", customer: "cus_1", subscription: sessionFor(0) };
// the winner parks at its write; `late` facts are held now (after its takeFacts, before the write); it resumes.
async function run(m: Mods, kind: Kind, late: Record<string, unknown>[]) {
  const { s, pur } = await world(m, kind);
  const b = barrier(s), win = m.svc.markPaid(deps(m, b.view), { ...pur }, o, "evt_w");
  await b.parked;
  for (const f of late) await s.holdFact("sub:sub_1", f);
  b.release(); const r = await win;
  return { s, pur, r };
}
export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const shape = async (s: any) => ({ subs: await s.subscriptionsFor("acc1"), inv: (await s.invoicesFor("acc1")).length });
  // L1 a cancel held in the window is applied: the row ends cancelled, nothing left held.
  { const { s, r } = await run(m, kind, [{ kind: "cancel" }]); const { subs, inv } = await shape(s);
    want("L1", r.won === true && subs.length === 1 && inv === 1, `L1 one row, one invoice, got ${subs.length}/${inv}`);
    want("L1", !!subs[0]?.cancelledAt, "L1 the cancel held after the winner's last takeFacts must be on the row");
    want("L1", (await s.takeFacts("sub:sub_1")).length === 0, "L1 no held fact left behind"); }
  // L2 an invoice period held in the window advances the plan.
  { const { s } = await run(m, kind, [heldPeriod(1)]); const { subs, inv } = await shape(s);
    want("L2", subs.length === 1 && inv === 1, `L2 one row, one invoice, got ${subs.length}/${inv}`);
    want("L2", subs[0]?.plan?.periodNow?.start === addMonths(T0, 1), `L2 the late invoice period (month 1) must be on the row, got ${JSON.stringify(subs[0]?.plan?.periodNow)}`);
    want("L2", (await s.takeFacts("sub:sub_1")).length === 0, "L2 no held fact left behind"); }
  // L3 both together, then the same sequence replayed (markPaid again): exactly one row, one invoice, row byte-identical.
  { const { s, pur, r } = await run(m, kind, [{ kind: "cancel" }, heldPeriod(1)]);
    const before = JSON.stringify(await s.subscriptionById("sub_1"));
    const again = await m.svc.markPaid(deps(m, s), { ...pur }, o, "evt_w2"); const { subs, inv } = await shape(s);
    want("L3", r.won === true && !!subs[0]?.cancelledAt && subs[0]?.plan?.periodNow?.start === addMonths(T0, 1), `L3 cancel and period both applied, got ${JSON.stringify(subs[0])}`);
    want("L3", again.won === false && subs.length === 1 && inv === 1 && JSON.stringify(subs[0]) === before, `L3 replay is a no-op (one row, one invoice, identical), got ${subs.length}/${inv}`); }
  // L4 no late fact: no change from today (cancelled absent, one row, one invoice).
  { const { s } = await run(m, kind, []); const { subs, inv } = await shape(s);
    want("L4", subs.length === 1 && inv === 1 && !subs[0]?.cancelledAt, `L4 a quiet window changes nothing, got ${subs.length}/${inv} cancelled=${subs[0]?.cancelledAt}`); }
  return bad;
}
for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f252 L1..L4 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
  test(`f252 20 repeated runs, 0 failures (${kind})`, async () => {
    const m = await load(); let fails = 0;
    for (let i = 0; i < 20; i++) if ((await violations(m, kind)).length > 0) fails++;
    console.log(`C2MARKPAIDREPLAY_REPEAT ${kind} 20 runs, ${fails} failures`); assert.equal(fails, 0);
  });
}
test("f252 mutant dropping the new replay call is killed", async () => {
  const m = await load([["service.ts", "await replayLateFacts(d, built);", ""]]);
  const v = [...(await violations(m, "memory")), ...(await violations(m, "d1"))];
  console.log("C2MARKPAIDREPLAY_MUTANT killed by", [...new Set(v.map((x) => x.slice(0, 2)))].join(",")); assert.ok(v.length > 0);
});
