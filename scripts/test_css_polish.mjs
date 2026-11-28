// R3 regression guards on globals.css. Run via `npm test`.
import fs from "node:fs";
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const page = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
ok(/color-scheme:\s*dark/.test(css), "root declares color-scheme: dark");
ok(/text-wrap:\s*pretty/.test(css), "body copy uses text-wrap: pretty");
ok(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after/.test(css), "global reduced-motion catch-all present");
for (const p of ["app/order/ai/page.tsx", "app/order/leads/page.tsx"])
  ok(/<Suspense fallback=\{<FormFallback/.test(page(p)), `${p} reserves form height (no CLS pop-in)`);
ok(page("app/black-ice/doctrine/page.tsx").split("\n").some((l) => /<a href=\{`#\$\{id\}`\}/.test(l) && /inline-block/.test(l)), "doctrine TOC links have a 24px+ tap target");
ok(/aspectRatio:\s*"1280 \/ 1706"/.test(page("app/v/titanos-pitch/page.tsx")), "pitch video reserves its box (no CLS from late metadata)");
const charts = fs.readFileSync(new URL("../components/charts/charts.css", import.meta.url), "utf8");
ok(!/font-size:\s*0\.(6|7[0-4])\d*rem/.test(charts) && /\.w4-chip \{[^}]*font-size: 0\.75rem/.test(charts), "chart chips and nodes keep labels at 12px or more");
const hnav = page("components/home-redesign/HomeNav.tsx");
const hcss = page("components/home-redesign/home-redesign.css");
ok(/pe-nav__menu--wide/.test(hnav) && /\.pe-nav__menu--wide \{[^}]*max-height[^}]*overflow-y: auto/.test(hcss), "header More menu scrolls inside the viewport (long list never runs off screen)");
ok(/\.pe-nav__menu a \{ display: block;/.test(hcss), "header menu items are block links (labels wrap inside the panel)");
ok(/pe-drawer__cta/.test(hnav) && /\.pe-drawer__cta \{ margin-top: 24px; width: 100%; \}/.test(hcss), "mobile drawer CTA is full width (text stays inside the button at 390px)");
ok(/grid-template-columns: 4rem minmax\(0, 1fr\) auto/.test(page("components/charts/charts.css")), "cost-curve bar label column fits BEFORE");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
