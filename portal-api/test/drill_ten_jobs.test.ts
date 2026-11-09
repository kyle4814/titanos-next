import { test } from "node:test";
import assert from "node:assert/strict";
import { runDrill } from "./drill_ten_jobs.ts";

test("PAY10: ten synthetic jobs, payout cards and transfers exist for exactly the re-proved jobs", async () => {
  const rep = await runDrill();
  assert.deepEqual(rep.failures, []);
  assert.equal(rep.rows.length, 10);
  assert.equal(rep.cards.length, 7); assert.equal(rep.transferCalls, 7);
  for (const row of rep.rows) assert.equal(!!row.card, row.provenExpected, `job ${row.n} ${row.kind}`);
  assert.deepEqual(rep.rows.filter((r) => !r.provenExpected).map((r) => r.n), [7, 8, 10]);
  assert.ok(rep.rows.filter((r) => !r.provenExpected).every((r) => r.status === "delivered"));
  assert.equal(rep.cards.find((c) => c.via === "review_card_approved")!.amountCents, 59_900);
});
