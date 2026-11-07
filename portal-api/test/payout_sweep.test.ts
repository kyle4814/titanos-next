// f42 tests. SYNTHETIC data only. Transfer and lookup are in-memory fixtures over MockPayouts: no Stripe, no network, no money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { MemoryApprovalStore, decidePayoutRecorded } from "../src/enterprise/payout_decision.ts";
import { sweepStuckPayouts, type TransferLookup, type TransferLookupResult } from "../src/enterprise/payout_sweep.ts";
import { MockPayouts } from "./ent_harness.ts";

const T0 = 1_000_000, AGE = 15 * 60_000;
class MockLookup implements TransferLookup {
  calls: string[] = []; mode: "truth" | "unknown" | "throw" = "truth"; override?: TransferLookupResult;
  p: MockPayouts;
  constructor(p: MockPayouts) { this.p = p; }
  async lookup(key: string): Promise<TransferLookupResult> {
    this.calls.push(key);
    if (this.mode === "throw") throw new Error("lookup_down");
    if (this.mode === "unknown") return { found: "unknown" };
    if (this.override) return this.override;
    const s = this.p.sent.find((x) => x.idempotencyKey === key);
    return s ? { found: true, ref: `po_${this.p.sent.indexOf(s) + 1}`, partnerId: s.partnerId, amountCents: s.amountCents } : { found: false };
  }
}
async function world() {
  const store = new MemoryEntStore(), approvals = new MemoryApprovalStore(), transfer = new MockPayouts(), lookup = new MockLookup(transfer);
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) await store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
  const add = (id: string, partnerId: string, extra: Record<string, unknown> = {}) => store.putPayout({ id, partnerId, amountCents: 250_000, status: "sending", createdAt: T0, sendingAt: T0, ...extra } as any);
  let now = T0 + AGE + 1, n = 0;
  const sweep = (maxAge = AGE, tenantId?: string) => sweepStuckPayouts({ store, lookup, now, tenantId }, maxAge);
  const decideEnv = () => ({ store, approvals, transfer, now: T0, newId: () => `led_${++n}` });
  return { store, approvals, transfer, lookup, add, sweep, decideEnv, setNow: (t: number) => { now = t; } };
}
const st = async (w: Awaited<ReturnType<typeof world>>, id: string) => (await w.store.payoutById(id))!;

test("crash between the CAS to sending and the provider call: provider has no record, so approved_retry; no transfer issued", async () => {
  const w = await world();
  await w.store.putPayout({ id: "po_synth_1", partnerId: "t_partner_A", amountCents: 250_000, status: "pending_approval", createdAt: T0 });
  w.transfer.transfer = () => new Promise(() => {}); // the process "dies" inside the provider call
  void decidePayoutRecorded(w.decideEnv(), { payoutId: "po_synth_1", decision: "approve" });
  await new Promise((r) => setImmediate(r));
  assert.equal((await st(w, "po_synth_1")).status, "sending");
  const r = await w.sweep();
  assert.deepEqual(r.items.map((i) => i.action), ["approved_retry"]);
  assert.equal((await st(w, "po_synth_1")).status, "approved_retry");
  assert.equal((await st(w, "po_synth_1")).reason, "provider_no_record");
  assert.equal(w.transfer.sent.length, 0, "the sweep never sends");
});
test("crash after provider success before recording: provider confirms, so paid with its ref; still exactly one transfer", async () => {
  const w = await world();
  await w.store.putPayout({ id: "po_synth_1", partnerId: "t_partner_A", amountCents: 250_000, status: "pending_approval", createdAt: T0 });
  const orig = w.transfer.transfer.bind(w.transfer);
  w.transfer.transfer = async (x) => { await orig(x); return new Promise(() => {}); }; // money moved, then death before we record
  void decidePayoutRecorded(w.decideEnv(), { payoutId: "po_synth_1", decision: "approve" });
  await new Promise((r) => setImmediate(r));
  assert.equal((await st(w, "po_synth_1")).status, "sending");
  const r = await w.sweep();
  assert.deepEqual(r.items.map((i) => i.action), ["paid"]);
  const p = await st(w, "po_synth_1");
  assert.equal(p.status, "paid"); assert.equal(p.providerRef, "po_1");
  assert.equal(w.transfer.sent.length, 1);
  assert.equal((await w.store.ledgerOf("t_partner_A")).length, 0, "no ledger movement on a confirmed payout");
});
test("provider error on lookup: held with reason provider_error, nothing reversed, nothing sent", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A"); w.lookup.mode = "throw";
  const r = await w.sweep();
  assert.deepEqual(r.items.map((i) => [i.action, i.reason]), [["held", "provider_error"]]);
  assert.equal((await st(w, "po_1")).status, "held");
  assert.equal((await w.store.ledgerOf("t_partner_A")).length, 0);
  assert.equal(w.transfer.sent.length, 0);
});
test("provider cannot say: held with reason provider_unknown", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A"); w.lookup.mode = "unknown";
  const r = await w.sweep();
  assert.deepEqual(r.items.map((i) => [i.action, i.reason]), [["held", "provider_unknown"]]);
});
test("repeated sweep is a no-op: second and third pass touch nothing and ask the provider nothing", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A"); await w.add("po_2", "t_partner_A");
  w.transfer.sent.push({ partnerId: "t_partner_A", accountRef: "acct_SYNTH_1", amountCents: 250_000, idempotencyKey: "po_1" });
  const a = await w.sweep(); const calls = w.lookup.calls.length;
  assert.equal(a.items.length, 2);
  const snap = JSON.stringify([await st(w, "po_1"), await st(w, "po_2")]);
  for (let i = 0; i < 2; i++) { const b = await w.sweep(); assert.equal(b.examined, 0); assert.deepEqual(b.items, []); }
  assert.equal(w.lookup.calls.length, calls);
  assert.equal(JSON.stringify([await st(w, "po_1"), await st(w, "po_2")]), snap);
  assert.equal(w.transfer.sent.length, 1);
});
test("a payout under maxAgeMs is untouched and not looked up; exactly at maxAgeMs it is swept", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A");
  w.setNow(T0 + AGE - 1);
  const r = await w.sweep();
  assert.equal(r.skippedYoung, 1); assert.deepEqual(r.items, []);
  assert.equal((await st(w, "po_1")).status, "sending"); assert.equal(w.lookup.calls.length, 0);
  w.setNow(T0 + AGE);
  assert.equal((await w.sweep()).items.length, 1);
});
test("age falls back to createdAt when sendingAt was never stamped", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A", { sendingAt: undefined });
  assert.equal((await w.sweep()).items.length, 1);
});
test("TENANT ISOLATION: a scoped sweep leaves the other tenant's stuck payout alone", async () => {
  const w = await world(); await w.add("po_A", "t_partner_A"); await w.add("po_B", "t_partner_B");
  const r = await w.sweep(AGE, "t_partner_A");
  assert.deepEqual(r.items.map((i) => i.payoutId), ["po_A"]);
  assert.equal((await st(w, "po_B")).status, "sending"); assert.deepEqual(w.lookup.calls, ["po_A"]);
});
test("TENANT ISOLATION: a store that ignores the tenant filter cannot widen the scope", async () => {
  const w = await world(); await w.add("po_A", "t_partner_A"); await w.add("po_B", "t_partner_B");
  const real = w.store.payoutsByStatus.bind(w.store);
  w.store.payoutsByStatus = (s) => real(s); // drops the partner filter
  const r = await w.sweep(AGE, "t_partner_A");
  assert.deepEqual(r.items.map((i) => i.payoutId), ["po_A"]);
  assert.equal((await st(w, "po_B")).status, "sending");
});
test("TENANT ISOLATION: a provider record for another tenant or another amount is held, never marked paid", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A");
  w.lookup.override = { found: true, ref: "po_x", partnerId: "t_partner_B", amountCents: 250_000 };
  assert.deepEqual((await w.sweep()).items.map((i) => i.reason), ["provider_mismatch_tenant"]);
  const w2 = await world(); await w2.add("po_1", "t_partner_A");
  w2.lookup.override = { found: true, ref: "po_x", partnerId: "t_partner_A", amountCents: 1 };
  assert.deepEqual((await w2.sweep()).items.map((i) => i.reason), ["provider_mismatch_amount"]);
  assert.equal((await st(w2, "po_1")).status, "held"); assert.equal((await st(w2, "po_1")).providerRef, undefined);
});
test("only sending payouts move: pending_approval, paid, failed, rejected, held are never touched", async () => {
  const w = await world();
  for (const s of ["pending_approval", "paid", "failed", "rejected", "held", "approved_retry"]) await w.add(`po_${s}`, "t_partner_A", { status: s });
  const r = await w.sweep();
  assert.equal(r.examined, 0); assert.equal(w.lookup.calls.length, 0);
});
test("race: the live path wins the CAS first, the sweep reports lost_race and writes nothing", async () => {
  const w = await world(); await w.add("po_1", "t_partner_A");
  const realLookup = w.lookup.lookup.bind(w.lookup);
  w.lookup.lookup = async (k) => { const r = await realLookup(k); await w.store.transitionPayout(k, "sending", "paid"); return r; };
  const r = await w.sweep();
  assert.deepEqual(r.items.map((i) => i.action), ["lost_race"]);
  assert.equal((await st(w, "po_1")).status, "paid"); assert.equal((await st(w, "po_1")).reason, undefined);
});
test("the sweep module never calls transfer, Stripe or the network (source check)", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_sweep.ts", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/\.transfer\(|stripe|fetch\(|setInterval|setTimeout|cron/i.test(src));
});
test("copy hygiene: no em or en dashes in the new files", () => {
  for (const f of ["../src/enterprise/payout_sweep.ts", "./payout_sweep.test.ts"]) assert.ok(!new RegExp("[\\u2013\\u2014]").test(readFileSync(new URL(f, import.meta.url), "utf8")), f);
});
