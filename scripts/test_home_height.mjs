// C10 regression: homepage document height at 390 px must stay inside a budget, and the test must
// be able to fail (mutation: re-inflate the folded sections with injected CSS, the budget must catch it).
// Needs a built export: npx next build && node scripts/test_home_height.mjs [outDir=out]
// BUDGET: 2026-11-10 baseline 38,319 px; the focused homepage (main 1514abd30, long sections moved to the pages that own
// them) measures 11,310 px at 390 px on 2026-11-12. Budget 11,500 = achieved + ~1.7% headroom for copy drift, inside the
// design target of under 12,000 px. The old PhoneFold mutation is gone: the homepage no longer carries folded sections.
import fs from "node:fs";
import { measureHome } from "./home_height.mjs";

export const BUDGET_PX = 11500;
const out = process.argv[2] || "out";
if (!fs.existsSync(`${out}/index.html`)) { console.error(`test_home_height: ${out}/index.html missing, build first`); process.exit(2); }

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };

const real = await measureHome(out);
ok(real.docHeight <= BUDGET_PX, `homepage at 390 px is ${real.docHeight} px, budget ${BUDGET_PX}`);
ok(real.mainChildren.length > 10, `measured ${real.mainChildren.length} top-level sections`);

// mutation: pad every top-level section by 400 px; the budget must catch it, or the test could never fail
const mutant = await measureHome(out, 390, "main > * { padding-bottom: 400px !important; }");
ok(mutant.docHeight > BUDGET_PX, `mutation (400 px added under every section) is ${mutant.docHeight} px and exceeds the budget, so the test can fail`);
ok(mutant.docHeight > real.docHeight, `mutation inflates the page by ${mutant.docHeight - real.docHeight} px`);

process.exit(fail);
