// C10 regression: homepage document height at 390 px must stay inside a budget, and the test must
// be able to fail (mutation: re-inflate the folded sections with injected CSS, the budget must catch it).
// Needs a built export: npx next build && node scripts/test_home_height.mjs [outDir=out]
// BUDGET: 2026-11-10 baseline 38,319 px, after PhoneFold on three repeated sections 30,961 px.
// Budget 31,500 = achieved + ~1.7% headroom for copy drift. The design target (under 12,000 px) needs
// a D-decision (fold the offers/FAQ/vault sections); see FILL_f370_c10 receipt. Lower this when it lands.
import fs from "node:fs";
import { measureHome } from "./home_height.mjs";

export const BUDGET_PX = 31500;
const out = process.argv[2] || "out";
if (!fs.existsSync(`${out}/index.html`)) { console.error(`test_home_height: ${out}/index.html missing, build first`); process.exit(2); }

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };

const real = await measureHome(out);
ok(real.docHeight <= BUDGET_PX, `homepage at 390 px is ${real.docHeight} px, budget ${BUDGET_PX}`);
ok(real.mainChildren.length > 10, `measured ${real.mainChildren.length} top-level sections`);

const mutant = await measureHome(out, 390, '[data-pfold] > * { display: revert !important; }');
ok(mutant.docHeight > BUDGET_PX, `mutation (unfold everything) is ${mutant.docHeight} px and exceeds the budget, so the test can fail`);
ok(mutant.docHeight > real.docHeight, `fold saves ${mutant.docHeight - real.docHeight} px`);

process.exit(fail);
