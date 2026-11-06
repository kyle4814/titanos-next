import { test } from "node:test";
import assert from "node:assert/strict";
import { runDrill, STEPS } from "../scripts/drill50.ts";

test("drill50: 50 clean runs report 0 touches, every step exercised, 0 review cards", async () => {
  const r = await runDrill({ runs: 50 });
  assert.equal(r.touches, 0, JSON.stringify(r.failures.slice(0, 3)));
  assert.equal(r.pass, true);
  assert.equal(r.openReviewCards, 0);
  assert.deepEqual(r.touchedRuns, []);
  for (const s of STEPS) assert.ok((r.perStepCounts[s] ?? 0) >= 50 || s === "cancel", `${s} exercised`);
  assert.ok(r.perStepCounts.cancel > 0);
  assert.match(r.verdict, /^DRILL50 PASS 50 runs, 0 touches$/);
});

for (const kind of ["status503", "status500", "throw", "timeout", "needs_human"] as const) {
  test(`drill50: a planted ${kind} at run 17 is detected (and only run 17)`, async () => {
    const r = await runDrill({ runs: 50, timeoutMs: 50, faults: [{ run: 17, step: "verify_domain.verify", kind }] });
    assert.equal(r.pass, false);
    assert.deepEqual(r.touchedRuns, [17]);
    assert.equal(r.perStepFailures["verify_domain.verify"], 1);
    assert.equal(r.failures[0].step, "verify_domain.verify"); // root cause is first; unverified-domain checkouts cascade inside run 17 only
    assert.ok(r.failures.every((f) => f.run === 17));
    assert.match(r.verdict, /^DRILL50 FAIL \d+ touches in runs \[17\]$/);
  });
}

test("drill50: a planted failure at signup is detected and the run skips downstream steps", async () => {
  const r = await runDrill({ runs: 50, faults: [{ run: 17, step: "signup.verify", kind: "status503" }] });
  assert.equal(r.pass, false);
  assert.deepEqual(r.touchedRuns, [17]);
  assert.equal(r.failures[0].reason, "missing_adapter_or_needs_human");
});
