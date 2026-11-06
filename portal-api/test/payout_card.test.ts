// f31 tests. SYNTHETIC data only: invented ids, invented secrets, nothing real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDecision, buildPayoutCard, cardIdFor, findForTenant, needsCard, type CardPayout } from "../src/enterprise/payout_card.ts";

const mk = (over: Partial<CardPayout> = {}): CardPayout => ({ id: "po_synth_1", partnerId: "t_partner_A", amountCents: 250_000, status: "pending_approval", createdAt: 1, ...over });

test("boundary: AU$1,000.00 is the auto path, AU$1,000.01 gets a card", () => {
  assert.equal(needsCard(100_000), false);
  assert.equal(needsCard(100_001), true);
  assert.throws(() => buildPayoutCard(mk({ amountCents: 100_000 })), /below_card_threshold/);
  assert.equal(buildPayoutCard(mk({ amountCents: 100_001 })).amountCents, 100_001);
});
test("card has WHAT / WHY / COST / REVERSIBLE and approve-deny", () => {
  const t = buildPayoutCard(mk()).text;
  for (const k of ["WHAT:", "WHY:", "COST:", "REVERSIBLE:", "approve or deny", "AU$2,500.00"]) assert.ok(t.includes(k), k);
});
test("same payout, same card id; a different amount or payout changes it", () => {
  assert.equal(buildPayoutCard(mk()).cardId, buildPayoutCard(mk({ createdAt: 999 })).cardId);
  assert.notEqual(cardIdFor("po_synth_1", 250_000), cardIdFor("po_synth_1", 250_001));
  assert.notEqual(cardIdFor("po_synth_1", 250_000), cardIdFor("po_synth_2", 250_000));
});
test("card never carries secrets, account tokens, provider refs or bank details", () => {
  const dirty = { ...mk(), providerRef: "ch_SECRET_REF", reason: "BSB 062-000 acct 12345678", payoutAccount: "acct_SYNTH_TOKEN", token: "sk_live_SYNTH" } as unknown as CardPayout;
  const c = buildPayoutCard(dirty, "Acme <script>sk_live_x</script> Pty");
  for (const bad of ["SECRET_REF", "062-000", "12345678", "acct_SYNTH", "sk_live", "<script>", "<", ">"]) assert.ok(!c.text.includes(bad), bad);
  assert.ok(!/\d{6,}/.test(c.text.replace(/AU\$[\d,]+\.\d\d/g, "").replace(c.cardId, "")), "no long digit runs");
});
test("card refuses a payout that is not pending_approval or has a bad amount", () => {
  assert.throws(() => buildPayoutCard(mk({ status: "paid" })), /not_pending_approval/);
  assert.throws(() => buildPayoutCard(mk({ amountCents: 0 })), /bad_amount/);
  assert.throws(() => buildPayoutCard(mk({ amountCents: 1500.5 })), /bad_amount/);
});
test("approve and deny move only from pending_approval", () => {
  const a = applyDecision(mk(), "approve", "t_partner_A");
  assert.ok(a.ok && a.outcome === "applied" && a.payout.status === "approved");
  const d = applyDecision(mk(), "deny", "t_partner_A");
  assert.ok(d.ok && d.outcome === "applied" && d.payout.status === "denied");
  assert.equal(mk().status, "pending_approval", "input not mutated");
});
test("replay of the same decision is idempotent; the opposite decision is refused", () => {
  const a = applyDecision(mk(), "approve", "t_partner_A");
  assert.ok(a.ok);
  const again = applyDecision(a.payout, "approve", "t_partner_A");
  assert.ok(again.ok && again.outcome === "replayed" && again.payout.status === "approved");
  const flip = applyDecision(a.payout, "deny", "t_partner_A");
  assert.ok(!flip.ok && flip.reason === "wrong_state");
});
test("wrong-state decisions are refused: no skipping states", () => {
  for (const status of ["sending", "paid", "failed", "rejected"] as const) for (const dec of ["approve", "deny"] as const) {
    const r = applyDecision(mk({ status }), dec, "t_partner_A");
    assert.ok(!r.ok && r.reason === "wrong_state", `${status}/${dec}`);
  }
  assert.ok(!applyDecision(mk(), "maybe" as never, "t_partner_A").ok);
});
test("tenant id guards every lookup and decision", () => {
  const list = [mk(), mk({ id: "po_synth_2", partnerId: "t_partner_B" })];
  assert.equal(findForTenant(list, "t_partner_A", "po_synth_2"), undefined);
  assert.equal(findForTenant(list, "t_partner_B", "po_synth_2")?.id, "po_synth_2");
  const r = applyDecision(mk(), "approve", "t_partner_B");
  assert.ok(!r.ok && r.reason === "wrong_tenant");
});
test("a decision for a stale card (amount changed) is refused", () => {
  const card = buildPayoutCard(mk());
  assert.ok(applyDecision(mk(), "approve", "t_partner_A", card.cardId).ok);
  const r = applyDecision(mk({ amountCents: 260_000 }), "approve", "t_partner_A", card.cardId);
  assert.ok(!r.ok && r.reason === "card_mismatch");
});
test("module is pure: no network, no fs, no env, no em dashes", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/enterprise/payout_card.ts", import.meta.url), "utf8");
  assert.ok(!/fetch\(|node:fs|node:http|process\.env|telegram/i.test(src.replace(/\/\/.*$/gm, "")), "no I/O");
  assert.ok(!new RegExp("[\\u2013\\u2014]").test(src), "no dashes");
});
