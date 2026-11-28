// Regression: /case-studies must stay discoverable from the footer Proof list,
// the desktop nav strip and the home page. Run via `npm test`.
import { readFileSync } from "node:fs";
import { DESKTOP_LINKS } from "../lib/navLinks.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const footer = readFileSync(new URL("../components/home-redesign/HomeFooter.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

ok(/"\/case-studies"/.test(footer), "footer lists /case-studies");
const company = footer.slice(footer.indexOf('h: "Company"'), footer.indexOf("// Links the previous"));
ok(/"\/case-studies"/.test(company), "/case-studies sits in the footer Company list (the Proof column was merged into Company in the 2026-11-28 redesign)");
ok(DESKTOP_LINKS.some((d) => d.href === "/case-studies"), "desktop nav strip links /case-studies");
ok(/href="\/case-studies"/.test(home), "home page links /case-studies");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
