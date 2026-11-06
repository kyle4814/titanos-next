// SYNTHETIC DATA ONLY (a@acme.com.au, mock Stripe, in-memory store). Nothing is sent, no network, no money moved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { requestRefund, decideRefund, migrateReviewCards, HttpError } from "../src/service.ts";

const DAY = 86_400_000;
async function late() { // a paid compliance pack, day 15: out of policy
  const h = make();
  const a = await h.login("a@acme.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "compliance_pack", domain: "acme.com.au" } });
  const { purchase } = await h.pay("compliance_pack");
  h.clock.t += 15 * DAY;
  const account = (await h.store.accountById(a.account.id))!;
  return { h, a, account, purchase };
}
const refunds = (h: Awaited<ReturnType<typeof late>>["h"]) => h.billing.calls.filter((c) => c.op === "refund").length;

test("request: out of policy creates a pending_review RefundCase, a card payload (data only) and the legacy ReviewCard in step", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  assert.equal(r.status, "needs_review"); assert.equal(r.reason, "outside_14_days");
  assert.equal(r.caseStatus, "pending_review"); assert.match(r.card.cardId, /^rcard_[0-9a-f]{16}$/);
  assert.match(r.card.text, /WHAT:[\s\S]*WHY:[\s\S]*COST:[\s\S]*REVERSIBLE:/);
  const rc = (await h.store.refundCaseById(r.refundId))!;
  assert.equal(rc.status, "pending_review"); assert.equal(rc.inPolicy, false); assert.equal(rc.amountCents, 599700);
  assert.equal((await h.store.cardById(r.refundId))!.resolved, false);
  assert.equal((await h.store.openCards()).length, 1);
  assert.equal(refunds(h), 0, "no money moved"); assert.equal(h.mailer.outbox.filter((m) => m.subject !== "Your TITANOS login link").length, 0, "nothing sent");
});

test("request replay is idempotent: same case, same card id, no second ReviewCard", async () => {
  const { h, account, purchase } = await late();
  const r1 = await requestRefund(h.deps, account, purchase.id) as any, r2 = await requestRefund(h.deps, account, purchase.id) as any;
  assert.equal(r2.refundId, r1.refundId); assert.equal(r2.card.cardId, r1.card.cardId);
  assert.equal(h.store.refundCases.size, 1); assert.equal(h.store.cards.size, 1);
});

test("decide approve: pending_review -> approved, ReviewCard.resolved in step, still no money moved", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  const d = await decideRefund(h.deps, r.refundId, "approve");
  assert.equal(d.changed, true); assert.equal(d.refund.status, "approved"); assert.equal(d.refund.decidedAt, h.clock.t);
  assert.equal((await h.store.cardById(r.refundId))!.resolved, true); assert.equal((await h.store.openCards()).length, 0);
  assert.equal(refunds(h), 0, "approve records only; the Stripe call is a CARD NEEDED"); assert.equal((await h.store.purchaseById(purchase.id))!.status, "paid");
});

test("decide deny: pending_review -> denied, card resolved; a fresh request after a denial opens a NEW case", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  assert.equal((await decideRefund(h.deps, r.refundId, "deny")).refund.status, "denied");
  assert.equal((await h.store.cardById(r.refundId))!.resolved, true);
  const r2 = await requestRefund(h.deps, account, purchase.id) as any;
  assert.notEqual(r2.refundId, r.refundId); assert.equal(r2.caseStatus, "pending_review");
  assert.equal((await h.store.openCards()).length, 1);
});

test("decide replay is a no-op; illegal order (opposite decision, unknown id, bad decision) is refused", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  const first = await decideRefund(h.deps, r.refundId, "approve");
  const again = await decideRefund(h.deps, r.refundId, "approve");
  assert.equal(again.changed, false); assert.equal(again.refund.decidedAt, first.refund.decidedAt);
  await assert.rejects(() => decideRefund(h.deps, r.refundId, "deny"), (e: any) => e instanceof HttpError && e.status === 409 && e.code === "already_decided");
  assert.equal((await h.store.refundCaseById(r.refundId))!.status, "approved", "opposite decision did not flip it");
  await assert.rejects(() => decideRefund(h.deps, "rf_nope", "approve"), (e: any) => e.status === 404);
  const r2 = await late(); const q = await requestRefund(r2.h.deps, r2.account, r2.purchase.id) as any;
  await assert.rejects(() => decideRefund(r2.h.deps, q.refundId, "refund" as any), (e: any) => e.status === 400 && e.code === "bad_decision");
  assert.equal((await r2.h.store.refundCaseById(q.refundId))!.status, "pending_review");
});

test("decide heals a card left unresolved (case decided, crash before the card write)", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  const rc = (await h.store.refundCaseById(r.refundId))!;
  await h.store.putRefundCase({ ...rc, status: "denied", decidedAt: h.clock.t });
  assert.equal((await h.store.cardById(r.refundId))!.resolved, false);
  assert.equal((await decideRefund(h.deps, r.refundId, "deny")).changed, false);
  assert.equal((await h.store.cardById(r.refundId))!.resolved, true);
});

test("IN POLICY untouched: day 13 refunds automatically, no RefundCase, no card, one Stripe call, same response shape", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"); await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "compliance_pack", domain: "acme.com.au" } });
  const { purchase } = await h.pay("compliance_pack");
  h.clock.t += 13 * DAY;
  const r = await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: purchase.id } }));
  assert.deepEqual(r, { status: "refunded", amountCents: 599700 });
  assert.equal(h.store.refundCases.size, 0); assert.equal(h.store.cards.size, 0); assert.equal(refunds(h), 1);
});

test("migration: legacy ReviewCards (synthetic) become RefundCases; resolved maps to denied (no money ever moved); idempotent", async () => {
  const { h, purchase } = await late();
  await h.store.putCard({ id: "card_open", accountId: purchase.accountId, purchaseId: purchase.id, kind: "refund_outside_policy", reason: "outside_14_days", createdAt: h.clock.t, resolved: false });
  await h.store.putCard({ id: "card_done", accountId: purchase.accountId, purchaseId: purchase.id, kind: "refund_outside_policy", reason: "deliverable_issued", createdAt: h.clock.t - 1, resolved: true });
  await h.store.putCard({ id: "card_orphan", accountId: "x", purchaseId: "pur_missing", kind: "refund_outside_policy", reason: "outside_14_days", createdAt: 1, resolved: false });
  assert.deepEqual(await migrateReviewCards(h.deps), { migrated: 2, skipped: 1 });
  assert.equal((await h.store.refundCaseById("card_open"))!.status, "pending_review");
  const done = (await h.store.refundCaseById("card_done"))!; assert.equal(done.status, "denied"); assert.equal(done.decidedAt, h.clock.t - 1);
  assert.equal(await h.store.refundCaseById("card_orphan"), undefined);
  assert.deepEqual(await migrateReviewCards(h.deps), { migrated: 0, skipped: 3 }, "second run changes nothing");
  assert.equal((await decideRefund(h.deps, "card_open", "deny")).refund.status, "denied"); // a migrated case is decidable
  assert.equal((await h.store.cardById("card_open"))!.resolved, true);
  assert.equal(refunds(h), 0);
});

test("the wire module sends nothing: no fetch, no stripe or telegram import in refund service code path", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/service.ts", import.meta.url), "utf8");
  const seg = src.slice(src.indexOf("// 6 REFUND"));
  assert.ok(!/fetch\(|telegram|tell_kyle/i.test(seg));
  assert.equal(seg.split("d.billing.refund(").length - 1, 1, "the only billing.refund is the in-policy path");
});

test("decide replay performs NO write to the RefundCase (guard is observable, not just equivalent)", async () => {
  const { h, account, purchase } = await late();
  const r = await requestRefund(h.deps, account, purchase.id) as any;
  await decideRefund(h.deps, r.refundId, "deny");
  let writes = 0; const orig = h.store.putRefundCase.bind(h.store);
  h.store.putRefundCase = async (x) => { writes++; return orig(x); };
  await decideRefund(h.deps, r.refundId, "deny");
  assert.equal(writes, 0);
});
