// Every LINKS href (mobile drawer) must be reachable on desktop:
// strip, More menu, or the gold CTA. Run via `npm test`.
import { LINKS, DESKTOP_LINKS, MORE_LINKS, CTA_HREFS, groupMore } from "../lib/navLinks.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

for (const l of LINKS) {
  const where = DESKTOP_LINKS.some((d) => d.href === l.href) ? "strip"
    : MORE_LINKS.some((m) => m.href === l.href) ? "more"
    : CTA_HREFS.includes(l.href) ? "cta" : null;
  ok(where, `${l.href} reachable on desktop (${where ?? "MISSING"})`);
}
ok(MORE_LINKS.every((m) => !DESKTOP_LINKS.some((d) => d.href === m.href)), "More has no strip duplicates");
ok(DESKTOP_LINKS.every((d) => LINKS.some((l) => l.href === d.href)), "every strip link is also in the drawer");
const grouped = groupMore().flatMap((g) => g.items).length;
ok(grouped === MORE_LINKS.length, `grouping keeps all ${MORE_LINKS.length} More items`);
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
