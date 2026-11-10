// Test for scripts/drill_twenty_faults.mjs (C3 kill test, plan line 1491). SYNTHETIC data only.
import assert from "node:assert/strict";
import { runDrill, runOne } from "./drill_twenty_faults.mjs";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const d = await runDrill();
assert.equal(d.total, 20); n++;
assert.equal(d.passed, 20, `N of 20 must be 20; failed: ${JSON.stringify(d.failedByClass)}`); n++;
ok(/^20 of 20/.test(d.line), "honest line");
ok(/SYNTHETIC/.test(d.label), "labelled synthetic");
ok(d.results.every((r) => r.id && r.results === undefined && r.steps.length >= 13), "every fault ran its full step list");
ok(d.results.every((r) => r.steps.some((s) => s.step === "badge_lost" && s.ok)), "badge lost when re-planted: 20/20");
ok(d.results.filter((r) => r.auto).every((r) => ["undo_ok", "undo_exact", "undo_reopens"].every((k) => r.steps.some((s) => s.step === k && s.ok))), "every auto-fix is reversible and exact");
ok(d.results.filter((r) => !r.auto).every((r) => r.steps.some((s) => s.step === "refusal_writes_nothing" && s.ok)), "guided faults: we wrote nothing");
for (const c of ["SPF", "DMARC", "DKIM", "DNSSEC", "MX", "MTA-STS"]) ok(d.classes.includes(c), `class ${c} covered`);

// MUTATION 1: an adapter that silently drops writes. The drill must NOT report 20, and must list the SPF/DMARC classes.
const lying = (z) => { const real = z.setTxt.bind(z); z.setTxt = async () => { void real; }; };
const m1 = await runDrill({ wrapZone: lying });
ok(m1.passed < 20, `lying adapter must fail the drill (got ${m1.passed})`);
ok(Object.keys(m1.failedByClass).some((c) => c === "SPF" || c === "DMARC"), "failures are listed by class");
ok(Object.values(m1.failedByClass).flat().every((x) => x.failures.length > 0), "no failure hidden");

// MUTATION 2: undo that does not restore the exact records is caught.
const sloppy = (z) => { const real = z.setTxt.bind(z); let calls = 0; z.setTxt = async (n, v) => { calls++; await real(n, calls > 1 ? [...v, "junk=1"] : v); }; };
const spf = (await import("../portal-api/test/owner_faults.ts")).FAULTS.find((f) => f.id.startsWith("02"));
const m2 = await runOne(spf, { wrapZone: sloppy });
ok(!m2.ok, "sloppy undo must fail the fault");

// MUTATION 3: a fault that is never actually planted (no-op plant) cannot be "found".
const noop = { ...spf, plant: () => {} };
const m3 = await runOne(noop);
ok(!m3.ok && m3.failures.some((x) => x.step === "found"), "an unplanted fault is not found");
console.log(`drill_twenty_faults OK: ${n} assertions, 20 of 20, 3 mutations bite`);
