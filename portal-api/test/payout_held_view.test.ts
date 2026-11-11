// f425 tests. SYNTHETIC data only. Read-only view and pure planner: no provider, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { listPayoutsNeedingAttention, planRetries, planRetriesForTenant, NEXT_ACTION } from "../src/enterprise/payout_held_view.ts";

const T0 = 1_000_000, NOW = T0 + 100_000;
async function world() {
  const store = new MemoryEntStore();
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"], ["t_partner_C", undefined]]) await store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct } as any);
  const add = (id: string, status: string, partnerId = "t_partner_A", extra: Record<string, unknown> = {}) => store.putPayout({ id, partnerId, amountCents: 250_000, status, createdAt: T0, ...extra } as any);
  return { store, add };
}

test("lists held and approved_retry with reason, age, amount and next action", async () => {
  const w = await world();
  await w.add("po_synth_h", "held", "t_partner_A", { reason: "provider_unknown", heldAt: NOW - 5000, attempts: 0 });
  await w.add("po_synth_r", "approved_retry", "t_partner_A", { reason: "provider_no_record", sendingAt: NOW - 9000, attempts: 1 });
  await w.add("po_synth_p", "paid");
  const rows = await listPayoutsNeedingAttention(w.store, "t_partner_A", NOW);
  assert.deepEqual(rows.map((r) => r.payoutId), ["po_synth_r", "po_synth_h"]);
  assert.deepEqual(rows[0], { payoutId: "po_synth_r", tenantId: "t_partner_A", status: "approved_retry", reason: "provider_no_record", ageMs: 9000, amountCents: 250_000, attempts: 1, nextAction: NEXT_ACTION.approved_retry });
  assert.equal(rows[1].nextAction, NEXT_ACTION.held);
});
test("age ordering: oldest first, ties by id; age never negative", async () => {
  const w = await world();
  await w.add("po_b", "held", "t_partner_A", { heldAt: NOW - 1000 });
  await w.add("po_a", "held", "t_partner_A", { heldAt: NOW - 1000 });
  await w.add("po_old", "approved_retry", "t_partner_A", { sendingAt: NOW - 50_000 });
  await w.add("po_future", "held", "t_partner_A", { heldAt: NOW + 9999 });
  const rows = await listPayoutsNeedingAttention(w.store, "t_partner_A", NOW);
  assert.deepEqual(rows.map((r) => r.payoutId), ["po_old", "po_a", "po_b", "po_future"]);
  assert.equal(rows[3].ageMs, 0);
});
test("tenant isolation: other tenants never appear, even when the store ignores the filter", async () => {
  const w = await world();
  await w.add("po_a", "held", "t_partner_A", { heldAt: T0 });
  await w.add("po_b", "approved_retry", "t_partner_B");
  const orig = w.store.payoutsByStatus.bind(w.store);
  (w.store as any).payoutsByStatus = (s: any) => orig(s); // drops the tenant filter
  assert.deepEqual((await listPayoutsNeedingAttention(w.store, "t_partner_A", NOW)).map((r) => r.payoutId), ["po_a"]);
  assert.deepEqual(await listPayoutsNeedingAttention(w.store, "", NOW), []);
  const plan = await planRetriesForTenant(w.store, "t_partner_A");
  assert.deepEqual(plan.items, []);
  assert.deepEqual(plan.skipped.map((s) => s.payoutId).sort(), ["po_a", "po_b"]);
  assert.equal(plan.skipped.find((s) => s.payoutId === "po_b")!.reason, "wrong_tenant");
  assert.deepEqual((await planRetriesForTenant(w.store, "t_partner_B")).items.map((i) => i.payoutId), ["po_b"]);
});
test("empty store: no rows, empty plan", async () => {
  const w = await world();
  assert.deepEqual(await listPayoutsNeedingAttention(w.store, "t_partner_A", NOW), []);
  const plan = await planRetriesForTenant(w.store, "t_partner_A");
  assert.deepEqual([plan.items, plan.skipped], [[], []]);
  assert.deepEqual(planRetries("t_partner_A", [], "acct_SYNTH_1").items, []);
});
test("held is never planned for retry, and is reported as skipped", async () => {
  const w = await world();
  await w.add("po_h", "held", "t_partner_A", { reason: "provider_unknown" });
  await w.add("po_r", "approved_retry", "t_partner_A");
  const plan = await planRetriesForTenant(w.store, "t_partner_A");
  assert.deepEqual(plan.items.map((i) => i.payoutId), ["po_r"]);
  assert.deepEqual(plan.skipped, [{ payoutId: "po_h", reason: "held_never_retried" }]);
});
test("planned request reuses the original idempotency key (payout id), is flagged CARD NEEDED and calls no provider", async () => {
  const w = await world();
  await w.add("po_r", "approved_retry", "t_partner_A", { attempts: 2 });
  const p1 = await planRetriesForTenant(w.store, "t_partner_A"), p2 = await planRetriesForTenant(w.store, "t_partner_A");
  assert.deepEqual(p1, p2);
  assert.deepEqual(p1.items[0], { payoutId: "po_r", tenantId: "t_partner_A", request: { partnerId: "t_partner_A", accountRef: "acct_SYNTH_1", amountCents: 250_000, idempotencyKey: "po_r" }, cardNeeded: "GATE1/GATE2", wouldCallProvider: false, attemptNumber: 3 });
  assert.equal((await w.store.payoutById("po_r"))!.status, "approved_retry");
  assert.equal((await w.store.payoutById("po_r"))!.attempts, 2);
});
test("missing payout account is skipped, not guessed", async () => {
  const w = await world();
  await w.add("po_c", "approved_retry", "t_partner_C");
  const plan = await planRetriesForTenant(w.store, "t_partner_C");
  assert.deepEqual([plan.items, plan.skipped], [[], [{ payoutId: "po_c", reason: "payout_account_missing" }]]);
});
test("planner is pure: input rows are not mutated; foreign and non-retry rows never planned", () => {
  const rows: any[] = [{ id: "x1", partnerId: "t_partner_B", amountCents: 1, status: "approved_retry", createdAt: 1 }, { id: "x2", partnerId: "t_partner_A", amountCents: 1, status: "sending", createdAt: 1 }];
  const before = JSON.stringify(rows);
  const plan = planRetries("t_partner_A", rows, "acct_SYNTH_1");
  assert.deepEqual(plan.items, []);
  assert.deepEqual(plan.skipped.map((s) => s.reason), ["wrong_tenant", "not_approved_retry"]);
  assert.equal(JSON.stringify(rows), before);
});
test("source check: no fetch, provider send, stripe, timers or cron; zero em/en dashes in operator copy", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_held_view.ts", import.meta.url), "utf8");
  for (const bad of [/\bfetch\b/i, /stripe/i, /transfer/i, /setTimeout|setInterval|cron|scheduled/i, /\bimport\(/, /XMLHttp|WebSocket/]) assert.ok(!bad.test(src), `forbidden ${bad}`);
  assert.ok(!/[–—]/.test(src), "dash in source");
  for (const t of Object.values(NEXT_ACTION)) assert.ok(!/[–—]/.test(t));
});
