// f46 tests. SYNTHETIC data only. The transfer adapter is the in-memory MockPayouts: no Stripe, no network, no money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { retryApprovedPayouts, listHeldPayouts } from "../src/enterprise/payout_retry.ts";
import { MockPayouts } from "./ent_harness.ts";

const T0 = 1_000_000;
async function world() {
  const store = new MemoryEntStore(), transfer = new MockPayouts();
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) await store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
  const add = (id: string, partnerId = "t_partner_A", extra: Record<string, unknown> = {}) => store.putPayout({ id, partnerId, amountCents: 250_000, status: "approved_retry", createdAt: T0, ...extra } as any);
  const run = (maxAttempts = 3, tenantId?: string, now = T0 + 5000) => retryApprovedPayouts(store, transfer, now, maxAttempts, tenantId);
  return { store, transfer, add, run };
}
type W = Awaited<ReturnType<typeof world>>;
const st = async (w: W, id: string) => (await w.store.payoutById(id))!;

test("retry success: approved_retry -> paid with the provider ref, one transfer, key = payout id", async () => {
  const w = await world(); await w.add("po_synth_1");
  const r = await w.run();
  assert.deepEqual(r.items.map((i) => i.action), ["paid"]);
  const p = await st(w, "po_synth_1");
  assert.equal(p.status, "paid"); assert.equal(p.providerRef, "po_1");
  assert.equal(w.transfer.sent.length, 1); assert.equal(w.transfer.sent[0].idempotencyKey, "po_synth_1");
  assert.equal(w.transfer.sent[0].accountRef, "acct_SYNTH_1");
});
test("transient error then success: same key on both attempts, provider sees one logical transfer", async () => {
  const w = await world(); await w.add("po_synth_1");
  const keys: string[] = []; const orig = w.transfer.transfer.bind(w.transfer);
  w.transfer.transfer = async (x) => { keys.push(x.idempotencyKey); return orig(x); };
  w.transfer.fail = true;
  const r1 = await w.run();
  assert.deepEqual(r1.items.map((i) => [i.action, i.attempts]), [["approved_retry", 1]]);
  assert.equal((await st(w, "po_synth_1")).status, "approved_retry");
  assert.equal((await st(w, "po_synth_1")).attempts, 1);
  w.transfer.fail = false;
  const r2 = await w.run();
  assert.deepEqual(r2.items.map((i) => i.action), ["paid"]);
  assert.deepEqual(keys, ["po_synth_1", "po_synth_1"]);
  assert.equal(w.transfer.sent.length, 1, "one logical transfer");
  assert.equal((await st(w, "po_synth_1")).status, "paid");
});
test("exhaustion: after maxAttempts failures the payout is held (retry_exhausted); ledger untouched; later runs do nothing", async () => {
  const w = await world(); await w.add("po_synth_1"); w.transfer.fail = true;
  const before = JSON.stringify([...w.store.ledger.values()]);
  assert.equal((await w.run(3)).items[0].action, "approved_retry");
  assert.equal((await w.run(3)).items[0].action, "approved_retry");
  const last = await w.run(3);
  assert.deepEqual([last.items[0].action, last.items[0].reason, last.items[0].attempts], ["held", "retry_exhausted", 3]);
  const p = await st(w, "po_synth_1");
  assert.equal(p.status, "held"); assert.equal(p.reason, "retry_exhausted"); assert.equal(p.attempts, 3);
  assert.equal(JSON.stringify([...w.store.ledger.values()]), before, "no ledger reversal on held");
  w.transfer.fail = false;
  const again = await w.run(3);
  assert.equal(again.examined, 0); assert.equal(w.transfer.sent.length, 0, "a held payout is never re-sent");
});
test("maxAttempts 1 holds on the first failure; an invalid bound sends nothing", async () => {
  const w = await world(); await w.add("po_synth_1"); w.transfer.fail = true;
  assert.equal((await w.run(1)).items[0].action, "held");
  await w.add("po_synth_2");
  for (const bad of [0, -1, 1.5, NaN]) { const r = await w.run(bad); assert.equal(r.examined, 0); }
  assert.equal((await st(w, "po_synth_2")).status, "approved_retry");
});
test("repeated run is a no-op once paid", async () => {
  const w = await world(); await w.add("po_synth_1");
  await w.run();
  const snap = JSON.stringify([...w.store.payouts.values()]);
  const r = await w.run();
  assert.equal(r.examined, 0); assert.equal(r.items.length, 0);
  assert.equal(JSON.stringify([...w.store.payouts.values()]), snap); assert.equal(w.transfer.sent.length, 1);
});
test("concurrent double-run pays once", async () => {
  const w = await world(); await w.add("po_synth_1"); await w.add("po_synth_2", "t_partner_B");
  let calls = 0; const orig = w.transfer.transfer.bind(w.transfer);
  w.transfer.transfer = async (x) => { calls++; await new Promise((r) => setImmediate(r)); return orig(x); };
  const [a, b] = await Promise.all([w.run(), w.run()]);
  assert.equal(calls, 2, "one provider call per payout across both runs");
  assert.equal(w.transfer.sent.length, 2);
  const acts = [...a.items, ...b.items].map((i) => i.action).sort();
  assert.deepEqual(acts, ["lost_race", "lost_race", "paid", "paid"]);
});
test("a payout not in approved_retry is never touched (sending, pending, paid, held)", async () => {
  const w = await world();
  for (const s of ["sending", "pending_approval", "paid", "held", "rejected", "failed"]) await w.add(`po_${s}`, "t_partner_A", { status: s });
  const r = await w.run(); assert.equal(r.examined, 0); assert.equal(w.transfer.sent.length, 0);
});
test("tenant-scoped run only touches that tenant, even when the store ignores the filter", async () => {
  const w = await world(); await w.add("po_a", "t_partner_A"); await w.add("po_b", "t_partner_B");
  const real = w.store.payoutsByStatus.bind(w.store);
  w.store.payoutsByStatus = (s, _t) => real(s); // ignores the filter
  const r = await w.run(3, "t_partner_A");
  assert.deepEqual(r.items.map((i) => i.payoutId), ["po_a"]);
  assert.equal((await st(w, "po_b")).status, "approved_retry");
  assert.deepEqual(w.transfer.sent.map((x) => x.partnerId), ["t_partner_A"]);
});
test("missing payout account: held (payout_account_missing), nothing sent", async () => {
  const w = await world();
  await w.store.putTenant({ id: "t_noacct", slug: "n", name: "n", kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false });
  await w.add("po_x", "t_noacct");
  const r = await w.run();
  assert.equal(r.items[0].reason, "payout_account_missing"); assert.equal((await st(w, "po_x")).status, "held"); assert.equal(w.transfer.sent.length, 0);
});

test("listHeldPayouts: reason, age, amount; only held; oldest first", async () => {
  const w = await world();
  await w.add("po_h1", "t_partner_A", { status: "held", reason: "provider_unknown", sendingAt: T0, amountCents: 100 });
  await w.add("po_h2", "t_partner_A", { status: "held", reason: "retry_exhausted", heldAt: T0 + 4000, attempts: 3, amountCents: 200 });
  await w.add("po_ok", "t_partner_A", { status: "paid" });
  const rows = await listHeldPayouts(w.store, "t_partner_A", T0 + 5000);
  assert.deepEqual(rows.map((r) => [r.payoutId, r.reason, r.ageMs, r.amountCents, r.attempts]), [["po_h1", "provider_unknown", 5000, 100, 0], ["po_h2", "retry_exhausted", 1000, 200, 3]]);
});
test("listHeldPayouts tenant isolation: other tenants' held rows never appear, even if the store ignores the filter; empty tenant sees nothing", async () => {
  const w = await world();
  await w.add("po_a", "t_partner_A", { status: "held", reason: "r" }); await w.add("po_b", "t_partner_B", { status: "held", reason: "r" });
  assert.deepEqual((await listHeldPayouts(w.store, "t_partner_B", T0)).map((r) => r.payoutId), ["po_b"]);
  const real = w.store.payoutsByStatus.bind(w.store);
  w.store.payoutsByStatus = (s, _t) => real(s);
  assert.deepEqual((await listHeldPayouts(w.store, "t_partner_A", T0)).map((r) => r.payoutId), ["po_a"]);
  assert.deepEqual(await listHeldPayouts(w.store, "", T0), []);
  assert.deepEqual(await listHeldPayouts(w.store, "t_unknown", T0), []);
});
test("source check: no stripe, fetch, timers, cron, em or en dashes", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_retry.ts", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const bad of [/stripe/i, /\bfetch\(/, /setInterval|setTimeout/, /cron/i]) assert.ok(!bad.test(src), String(bad));
  assert.ok(!/[–—]/.test(readFileSync(new URL("../src/enterprise/payout_retry.ts", import.meta.url), "utf8")));
});

// ---- f51: permanent errors hold at once ----
import { PermanentTransferError, classify } from "../src/enterprise/payout_errors.ts";
const failWith = (w: W, errs: unknown[]) => { let n = 0; w.transfer.transfer = async () => { throw errs[Math.min(n++, errs.length - 1)]; }; return () => n; };
const coded = (code: string) => Object.assign(new Error("provider says " + code), { code });
const ledgerJson = (w: W) => JSON.stringify([...w.store.ledger.values()]);

test("permanent on attempt 1: held with ONE adapter call, reason kept, ledger byte-identical", async () => {
  const w = await world(); await w.add("po_synth_1");
  const calls = failWith(w, [coded("account_closed")]); const before = ledgerJson(w);
  const r = await w.run(5);
  assert.deepEqual([r.items[0].action, r.items[0].reason, r.items[0].attempts], ["held", "permanent_account_closed", 1]);
  const p = await st(w, "po_synth_1");
  assert.equal(p.status, "held"); assert.equal(p.reason, "permanent_account_closed"); assert.equal(p.attempts, 1); assert.equal(p.heldAt, T0 + 5000);
  assert.equal(calls(), 1); assert.equal(ledgerJson(w), before);
  assert.equal((await listHeldPayouts(w.store, "t_partner_A", T0 + 9000))[0].reason, "permanent_account_closed");
});
test("PermanentTransferError thrown directly is held on attempt 1", async () => {
  const w = await world(); await w.add("po_synth_1");
  const calls = failWith(w, [new PermanentTransferError("invalid_destination")]);
  assert.equal((await w.run(3)).items[0].reason, "permanent_invalid_destination"); assert.equal(calls(), 1);
});
test("PermanentTransferError with a code outside the known list is still permanent (the class itself decides)", async () => {
  const w = await world(); await w.add("po_synth_1");
  const calls = failWith(w, [new PermanentTransferError("bespoke_refusal")]);
  assert.equal((await w.run(4)).items[0].reason, "permanent_bespoke_refusal"); assert.equal(calls(), 1);
});
test("transient x2 then permanent: held at call 3, not at maxAttempts", async () => {
  const w = await world(); await w.add("po_synth_1");
  const calls = failWith(w, [new Error("provider_down"), new Error("provider_down"), coded("currency_not_supported")]); const before = ledgerJson(w);
  assert.equal((await w.run(10)).items[0].action, "approved_retry");
  assert.equal((await w.run(10)).items[0].action, "approved_retry");
  const r3 = await w.run(10);
  assert.deepEqual([r3.items[0].action, r3.items[0].reason, r3.items[0].attempts], ["held", "permanent_currency_not_supported", 3]);
  assert.equal(calls(), 3); assert.equal(ledgerJson(w), before);
});
test("unknown error stays transient (retried, held only by exhaustion)", async () => {
  const w = await world(); await w.add("po_synth_1");
  failWith(w, [coded("something_new"), new Error("boom"), "a string", undefined]);
  assert.equal((await w.run(3)).items[0].action, "approved_retry");
  assert.equal((await w.run(3)).items[0].action, "approved_retry");
  assert.equal((await w.run(3)).items[0].reason, "retry_exhausted");
  assert.deepEqual(classify(undefined), { kind: "transient", code: "unknown" });
  assert.deepEqual(classify(coded("ACCOUNT_CLOSED")), { kind: "permanent", code: "account_closed" });
  assert.equal(classify({ message: "account_closed" }).kind, "transient", "the message is never read, only the code");
});
test("a permanently held row is never re-sent, on any later run", async () => {
  const w = await world(); await w.add("po_synth_1");
  const calls = failWith(w, [coded("invalid_account")]);
  await w.run(5); await w.run(5); await w.run(5);
  assert.equal(calls(), 1); assert.equal(w.transfer.sent.length, 0);
  assert.equal((await st(w, "po_synth_1")).status, "held");
});
test("source: payout_errors has no network or timers and no em or en dashes", () => {
  const s = readFileSync(new URL("../src/enterprise/payout_errors.ts", import.meta.url), "utf8");
  assert.ok(!/stripe\.com|fetch\(|setTimeout|setInterval/.test(s)); assert.ok(!/[–—]/.test(s));
});
