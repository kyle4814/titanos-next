// L10 guard: a root app/loading.tsx wraps every page in a Suspense boundary. In the static export the real content then streams in
// as a hidden block swapped by an inline script AFTER first paint: spinner flash, CLS 0.50 (footer jumps 40 KB down), late LCP, and
// content invisible without JS. Measured 2026-10-09 (qa_gate + l10_grade). Source check always; built-output check when out/ exists.
import fs from "node:fs";
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
ok(!fs.existsSync("app/loading.tsx"), "no root app/loading.tsx");
if (fs.existsSync("out/index.html")) {
  for (const f of fs.readdirSync("out").filter((x) => /^(index|offers|services|products|scan|costs|proof)\.html$/.test(x))) {
    const h = fs.readFileSync("out/" + f, "utf8");
    const m = h.match(/<main[^>]*>(.{0,400})/s);
    ok(m && !/<template id="B:\d+"/.test(m[1]), `${f}: <main> holds real content in the first HTML (no pending Suspense spinner)`);
  }
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
