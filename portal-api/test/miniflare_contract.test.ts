import { test, after } from "node:test";
import assert from "node:assert/strict";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { miniflareAvailable, MiniflareD1, stopMiniflare, findMiniflare } from "./miniflare_d1.ts";

// f196: the f172..f194 WOULD-FLIP. The SAME contract functions that run on FakeD1 (real SQLite via node:sqlite) run here on a real local miniflare D1 binding (workerd).
// Skips cleanly when miniflare is not installed (it is not a dependency). Run only these with: node scripts/test_miniflare_d1.sh  (or --test-name-pattern=miniflare).
// SYNTHETIC fixtures only; nothing leaves the machine.
// f369 budget: measured 124 s wall for this file at load 25/8 cores (each store reset drops + re-applies 32 migrations, ~5 to 11 s a seed); teardown is the after() below. Not a hang.
// Run with a harness limit of at least 300 s, and never with --test-timeout under 300000.
process.env.CONTRACT_LIB = "1"; // the imported contract files then export violations()/race() without registering their own FakeD1 tests
const skip = miniflareAvailable() ? false : "miniflare not resolvable (set MINIFLARE_DIR to a dir holding node_modules/miniflare); skipped";
after(async () => { await stopMiniflare(); });

const d1 = () => { const db = new MiniflareD1(); return { open: () => new D1PlanStore(db), db: db as any }; };

test("miniflare: resolves offline and reports its path", { skip }, () => { assert.ok(findMiniflare()); });

test("miniflare: held-facts contract F1..F6 holds on a real miniflare D1", { skip }, async () => {
  const { violations } = await import("./facts_contract.test.ts");
  assert.deepEqual(await violations(d1), []);
});

test("miniflare: invoice contract C1..C7 holds on a real miniflare D1", { skip }, async () => {
  const { violations } = await import("./invoice_contract.test.ts");
  assert.deepEqual(await violations(() => { const db = new MiniflareD1(); return { open: () => new D1PlanStore(db) }; }), []);
});

test("miniflare: every take is exactly-once under a real concurrent race (20 seeds)", { skip, timeout: 600_000 }, async () => {
  const { race } = await import("./facts_contract.test.ts");
  for (let seed = 1; seed <= 20; seed++) assert.deepEqual(await race(seed, d1), [], `seed ${seed}`);
});

test("miniflare: foreign keys are enforced and a reset gives each store a fresh database", { skip }, async () => {
  const a = new D1PlanStore(new MiniflareD1()), b = new D1PlanStore(new MiniflareD1());
  await a.holdFact("k", { id: "1" });
  assert.deepEqual(await b.takeFacts("k"), [], "a second MiniflareD1 must not see the first one's rows");
  assert.deepEqual(await a.takeFacts("k"), [{ id: "1" }]);
});

test("miniflare: the adapter is not vacuous: a foreign key violation is refused by miniflare itself", { skip }, async () => {
  const s = new D1PlanStore(new MiniflareD1());
  await assert.rejects(() => s.putPurchase({ id: "p", accountId: "no_such_account", productId: "x", checkoutId: "c", amountCents: 1, deliverableIssued: false, refundedCents: 0, status: "paid" }));
});
