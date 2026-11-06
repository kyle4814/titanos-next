// SYNTHETIC DATA ONLY: ids, names and amounts below are invented test values, not customers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefundCard, applyRefundDecision, refundCardId, type RefundCase } from "../src/refund_card.ts";

const base: RefundCase = { id: "re_synth_001", accountId: "acct_synth", purchaseId: "pur_synth", productName: "Synthetic Compliance Pack", amountCents: 599700, reason: "outside_14_days", inPolicy: false, status: "pending_review", createdAt: 1000 };
const DASH = /[–—]/;

test("card carries WHAT / WHY / COST / REVERSIBLE / approve-deny and the amount", () => {
  const c = buildRefundCard(base);
  for (const k of ["WHAT:", "WHY:", "COST:", "REVERSIBLE:", "approve or deny"]) assert.ok(c.text.includes(k), k);
  assert.ok(c.text.includes("AU$5,997.00"));
  assert.deepEqual(c.actions, ["approve", "deny"]);
  assert.ok(c.why.includes("14 day window"));
});
test("card copy has no em or en dashes", () => {
  assert.doesNotMatch(buildRefundCard(base).text, DASH);
});
test("card id is stable, idempotent, and changes with refund id or amount", () => {
  assert.equal(buildRefundCard(base).cardId, buildRefundCard({ ...base }).cardId);
  assert.equal(buildRefundCard(base).cardId, refundCardId("re_synth_001", 599700));
  assert.notEqual(refundCardId("re_synth_001", 599700), refundCardId("re_synth_001", 599701));
  assert.notEqual(refundCardId("re_synth_001", 599700), refundCardId("re_synth_002", 599700));
});
test("in-policy refund and non-pending refund are not card cases", () => {
  assert.throws(() => buildRefundCard({ ...base, inPolicy: true }), /not_a_card_case/);
  assert.throws(() => buildRefundCard({ ...base, status: "approved" }), /not_a_card_case/);
});
test("invalid amount or missing id rejected", () => {
  assert.throws(() => buildRefundCard({ ...base, amountCents: 0 }), /amount_invalid/);
  assert.throws(() => buildRefundCard({ ...base, amountCents: 10.5 }), /amount_invalid/);
  assert.throws(() => buildRefundCard({ ...base, id: "" }), /refund_invalid/);
});
test("approve: pending_review -> approved, stamped, input not mutated", () => {
  const r = applyRefundDecision(base, "approve", 5000);
  assert.ok(r.ok && r.changed && r.refund.status === "approved" && r.refund.decidedAt === 5000);
  assert.equal(base.status, "pending_review");
});
test("deny: pending_review -> denied", () => {
  const r = applyRefundDecision(base, "deny", 6000);
  assert.ok(r.ok && r.changed && r.refund.status === "denied" && r.refund.decidedAt === 6000);
});
test("replay is idempotent: same decision again changes nothing", () => {
  const a = applyRefundDecision(base, "approve", 5000);
  assert.ok(a.ok);
  const again = applyRefundDecision(a.refund, "approve", 9999);
  assert.ok(again.ok && !again.changed && again.refund.decidedAt === 5000);
  const d = applyRefundDecision(base, "deny", 1);
  assert.ok(d.ok);
  const dAgain = applyRefundDecision(d.refund, "deny", 2);
  assert.ok(dAgain.ok && !dAgain.changed && dAgain.refund.decidedAt === 1);
});
test("illegal order: opposite decision after a decision is refused", () => {
  const a = applyRefundDecision(base, "approve", 1);
  assert.ok(a.ok);
  assert.deepEqual(applyRefundDecision(a.refund, "deny", 2), { ok: false, error: "already_decided" });
  const d = applyRefundDecision(base, "deny", 1);
  assert.ok(d.ok);
  assert.deepEqual(applyRefundDecision(d.refund, "approve", 2), { ok: false, error: "already_decided" });
});
test("no skipped states: unknown status and bad decisions are refused", () => {
  assert.deepEqual(applyRefundDecision({ ...base, status: "refunded" as never }, "approve"), { ok: false, error: "not_a_card_case" });
  assert.deepEqual(applyRefundDecision(base, "maybe" as never), { ok: false, error: "bad_decision" });
  assert.deepEqual(applyRefundDecision(base, undefined as never), { ok: false, error: "bad_decision" });
});
test("in-policy refund rejected as not a card case for both decisions", () => {
  const p = { ...base, inPolicy: true };
  assert.deepEqual(applyRefundDecision(p, "approve"), { ok: false, error: "not_a_card_case" });
  assert.deepEqual(applyRefundDecision(p, "deny"), { ok: false, error: "not_a_card_case" });
});
test("pure: module has no network, telegram or stripe import, and no dashes", () => {
  const src = readFileSync(new URL("../src/refund_card.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|telegram_send|from "\.\/stripe|https?:\/\/api\./i);
  assert.doesNotMatch(src, DASH);
});
