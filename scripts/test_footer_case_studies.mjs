// Regression: /case-studies must stay discoverable from the footer Proof list,
// the desktop nav strip and the home page. Run via `npm test`.
import { readFileSync } from "node:fs";
import { DESKTOP_LINKS } from "../lib/navLinks.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const footer = readFileSync(new URL("../components/Footer.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

ok(/href:\s*"\/case-studies"/.test(footer), "footer lists /case-studies");
const proof = footer.slice(footer.indexOf('heading: "Proof"'), footer.indexOf('heading: "Company"'));
ok(/href:\s*"\/case-studies"/.test(proof), "/case-studies sits in the footer Proof list");
ok(DESKTOP_LINKS.some((d) => d.href === "/case-studies"), "desktop nav strip links /case-studies");
ok(/href="\/case-studies"/.test(home), "home page links /case-studies");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
