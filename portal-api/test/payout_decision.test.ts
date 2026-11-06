// f40 tests. SYNTHETIC data only. The transfer adapter is the MockPayouts fixture: no Stripe, no network, no money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { CARD_TTL_MS, MemoryApprovalStore, decidePayoutRecorded, type DecideEnv } from "../src/enterprise/payout_decision.ts";
import { cardIdFor } from "../src/enterprise/payout_card.ts";
import { MockPayouts } from "./ent_harness.ts";

const T0 = 1_000_000;
async function world(amount = 250_000, account: string | null = "acct_SYNTH_1") {
  const store = new MemoryEntStore(), approvals = new MemoryApprovalStore(), transfer = new MockPayouts();
  await store.putTenant({ id: "t_partner_A", slug: "synth-a", name: "Synth A", kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: account ?? undefined });
  await store.putTenant({ id: "t_partner_B", slug: "synth-b", name: "Synth B", kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: "acct_SYNTH_2" });
  await store.putPayout({ id: "po_synth_1", partnerId: "t_partner_A", amountCents: amount, status: "pending_approval", createdAt: T0 });
  let n = 0, now = T0 + 60_000;
  const env = (): DecideEnv => ({ store, approvals, transfer, now, newId: () => `led_${++n}` });
  const decide = (decision: "approve" | "deny", extra: Record<string, unknown> = {}) => decidePayoutRecorded(env(), { payoutId: "po_synth_1", decision, ...extra });
  return { store, approvals, transfer, decide, setNow: (t: number) => { now = t; }, get now() { return now; } };
}
const status = async (w: Awaited<ReturnType<typeof world>>) => (await w.store.payoutById("po_synth_1"))!.status;

test("approve moves pending_approval to sending to paid once, with an approval record, via the mock adapter", async () => {
  const w = await world();
  const r = await w.decide("approve", { tenantId: "t_partner_A", cardId: cardIdFor("po_synth_1", 250_000) });
  assert.ok(r.ok && r.outcome === "applied" && r.state === "paid");
  assert.equal(w.transfer.sent.length, 1);
  assert.equal(w.transfer.sent[0].idempotencyKey, "po_synth_1");
  assert.equal((await w.approvals.get("po_synth_1"))?.decision, "approve");
});
test("sending is observable only after the record exists", async () => {
  const w = await world();
  let recordAtTransfer: unknown, statusAtTransfer = "";
  const orig = w.transfer.transfer.bind(w.transfer);
  w.transfer.transfer = async (x) => { recordAtTransfer = await w.approvals.get(x.idempotencyKey); statusAtTransfer = (await w.store.payoutById(x.idempotencyKey))!.status; return orig(x); };
  await w.decide("approve");
  assert.equal(statusAtTransfer, "sending");
  assert.ok(recordAtTransfer, "approval record existed before the transfer");
});
test("DOUBLE TAP: approve twice sends once; the second is a replayed success", async () => {
  const w = await world();
  const a = await w.decide("approve"), b = await w.decide("approve");
  assert.ok(a.ok && a.outcome === "applied");
  assert.ok(b.ok && b.outcome === "replayed");
  assert.equal(w.transfer.sent.length, 1);
});
test("DOUBLE TAP concurrent: ten simultaneous approve taps send once", async () => {
  const w = await world();
  const rs = await Promise.all(Array.from({ length: 10 }, () => w.decide("approve")));
  assert.equal(rs.filter((r) => r.ok && r.outcome === "applied").length, 1);
  assert.equal(rs.filter((r) => r.ok && r.outcome === "replayed").length, 9);
  assert.equal(w.transfer.sent.length, 1);
});
test("deny: terminal held state with the reason, balance returned, nothing sent; repeat deny is a no-op", async () => {
  const w = await world();
  const r = await w.decide("deny", { reason: "amount looks wrong <b>x</b>" });
  assert.ok(r.ok && r.outcome === "applied" && r.state === "held");
  assert.equal(r.ok && r.reason, "amount looks wrong bxb");
  const p = (await w.store.payoutById("po_synth_1"))!;
  assert.equal(p.status, "rejected"); assert.equal(p.reason, "amount looks wrong bxb");
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((e) => e.kind === "payout_reversal").length, 1);
  const again = await w.decide("deny");
  assert.ok(again.ok && again.outcome === "replayed" && again.state === "held" && again.reason === "amount looks wrong bxb");
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((e) => e.kind === "payout_reversal").length, 1, "no second reversal");
  assert.equal(w.transfer.sent.length, 0);
});
test("DENY THEN APPROVE: refused, stays held, nothing sent (both orders)", async () => {
  const w = await world();
  await w.decide("deny");
  const r = await w.decide("approve");
  assert.ok(!r.ok && r.refused === "already_decided");
  assert.equal(await status(w), "rejected"); assert.equal(w.transfer.sent.length, 0);
  const w2 = await world();
  await w2.decide("approve");
  const r2 = await w2.decide("deny");
  assert.ok(!r2.ok && r2.refused === "already_decided");
  assert.equal(await status(w2), "paid"); assert.equal(w2.transfer.sent.length, 1);
});
test("APPROVE AFTER EXPIRY: refused, no record, no send, payout still pending; deny after expiry still works", async () => {
  const w = await world();
  w.setNow(T0 + CARD_TTL_MS + 1);
  const r = await w.decide("approve");
  assert.ok(!r.ok && r.refused === "expired");
  assert.equal(await w.approvals.get("po_synth_1"), undefined);
  assert.equal(await status(w), "pending_approval"); assert.equal(w.transfer.sent.length, 0);
  const d = await w.decide("deny");
  assert.ok(d.ok && d.state === "held");
  const w2 = await world(); w2.setNow(T0 + CARD_TTL_MS); // exactly at expiry is still good
  assert.ok((await w2.decide("approve")).ok);
});
test("payout never reaches sending without an approval record: every refusal leaves it pending and unsent", async () => {
  const w = await world();
  const bad = [
    await w.decide("approve", { tenantId: "t_partner_B" }),
    await w.decide("approve", { cardId: cardIdFor("po_synth_1", 1) }),
    await w.decide("bogus" as any),
    await decidePayoutRecorded({ store: w.store, approvals: w.approvals, transfer: w.transfer, now: T0, newId: () => "x" }, { payoutId: "po_missing", decision: "approve" }),
  ];
  assert.deepEqual(bad.map((r) => !r.ok && r.refused), ["not_found", "card_mismatch", "bad_decision", "not_found"]);
  assert.equal(await status(w), "pending_approval"); assert.equal(w.transfer.sent.length, 0); assert.equal(await w.approvals.get("po_synth_1"), undefined);
});
test("approve with no payout account is refused before any record or send", async () => {
  const w = await world(250_000, null);
  const r = await w.decide("approve");
  assert.ok(!r.ok && r.refused === "payout_account_missing");
  assert.equal(await w.approvals.get("po_synth_1"), undefined); assert.equal(await status(w), "pending_approval");
});
test("a payout already sending/paid with no record cannot be re-approved into a second send", async () => {
  const w = await world();
  await w.store.putPayout({ id: "po_synth_1", partnerId: "t_partner_A", amountCents: 250_000, status: "paid", createdAt: T0 });
  const r = await w.decide("approve");
  assert.ok(!r.ok && r.refused === "wrong_state"); assert.equal(w.transfer.sent.length, 0); assert.equal(await w.approvals.get("po_synth_1"), undefined, "no stray record on a non-pending payout");
});
test("provider failure after approval: payout failed, balance reversed once, repeat tap does not resend", async () => {
  const w = await world(); w.transfer.fail = true;
  const r = await w.decide("approve");
  assert.ok(r.ok && r.state === "failed");
  const b = await w.decide("approve");
  assert.ok(b.ok && b.outcome === "replayed" && b.state === "failed");
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((e) => e.kind === "payout_reversal").length, 1);
});
test("module is mock-only: no fetch, fs, env, stripe or telegram, and no dashes", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_decision.ts", import.meta.url), "utf8");
  for (const bad of [/\bfetch\(/, /node:fs/, /process\.env/, /\bstripe\b/i, /telegram/i, /[\u2013\u2014]/]) assert.ok(!bad.test(src.replace(/^\/\/.*$/gm, "").replace(/\/\/.*$/gm, "")), String(bad));
});
