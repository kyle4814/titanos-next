// C9 FAST text-sanity gate (f384). Usage: node scripts/text_sanity_fast.mjs [--out out] [--allow-no-browser]
// Fails (exit 1) on any text defect, any off-centre hero CTA, any followup count above its cap, a raised cap, or an uncovered route family.
// No browser: exit 3 (fail closed) unless --allow-no-browser, which prints SKIPPED-NO-BROWSER loudly and exits 0.
// The full sweep stays as `npm run audit:text-sanity`.
import { runFast, FAST_BUDGET_S } from "./lib/text_sanity_fast.mjs";
const i = process.argv.indexOf("--out"); const root = i > 0 ? process.argv[i + 1] : "out";
const r = await runFast({ root });
if (r.skipped) {
  const allow = process.argv.includes("--allow-no-browser");
  console.log(`${allow ? "SKIPPED-NO-BROWSER" : "FAIL"} text_sanity_fast: ${r.skipped}`); process.exit(allow ? 0 : 3);
}
if (!r.ok) { console.error("text_sanity_fast FAILED:\n  " + r.problems.slice(0, 25).join("\n  ")); process.exit(1); }
console.log(`text_sanity_fast OK: ${r.renders} renders in ${r.seconds.toFixed(1)}s (target ${FAST_BUDGET_S}s${r.overBudget ? ", OVER target: slow box" : ""}), followups ${JSON.stringify(r.followupCounts)}`);
