// Homepage pricing (2026-11-12): the compact price list on / must carry the canonical prices, the same amounts /pricing shows,
// links to /pricing and /book, and sit after the proof and offer content and before the final call to action.
// Usage: node scripts/test_home_pricing.mjs [outDir=out]    (needs a built export)
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const out = process.argv[2] || "out";
const txt = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const sectionOf = (html) => { const i = html.indexOf("data-home-pricing"); if (i < 0) return null; const j = html.indexOf("</ul>", i); return html.slice(i, html.indexOf("</div></div>", j) > 0 ? html.indexOf("</div></div>", j) + 12 : j + 600); };
const amounts = (s) => [...new Set(s.match(/AU\$[0-9][0-9,]*/g) ?? [])];

// The pure check, so the mutation below can prove this test is able to fail.
export function check(homeHtml, pricingHtml) {
  const errs = [];
  const sec = sectionOf(homeHtml);
  if (!sec) return ["no data-home-pricing section on the homepage"];
  const t = txt(sec);
  for (const a of ["AU$1,500", "AU$2,500", "AU$5,000", "AU$149", "AU$497", "AU$3,497", "AU$5,997", "AU$49,997", "AU$149,997"]) if (!t.includes(a)) errs.push(`homepage pricing lacks ${a}`);
  if (!/3-month minimum/.test(t)) errs.push("homepage pricing lacks the 3-month minimum");
  const p = txt(pricingHtml);
  for (const a of amounts(t)) if (!p.includes(a)) errs.push(`${a} is on the homepage but not on /pricing`);
  if (!/href="\/pricing"/.test(sec)) errs.push("no link to /pricing");
  if (!/href="\/book"/.test(sec)) errs.push("no link to /book");
  const iSec = homeHtml.indexOf("data-home-pricing");
  const iFinal = homeHtml.indexOf("You have seen the receipts");
  const iProof = homeHtml.indexOf("Everything else is one tap away");
  if (!(iProof >= 0 && iProof < iSec)) errs.push("pricing is not after the proof and offer content");
  if (!(iFinal > iSec)) errs.push("pricing is not before the final call to action");
  return errs;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const home = fs.readFileSync(`${out}/index.html`, "utf8");
  const pricing = fs.readFileSync(`${out}/pricing.html`, "utf8");
  const errs = check(home, pricing);
  ok(errs.length === 0, errs.length ? errs.join("; ") : "homepage pricing: canonical prices, matches /pricing, links /pricing and /book, placed before the final CTA");
  // mutations: each must be caught
  ok(check(home.replace("AU$5,997", "AU$5,998"), pricing).some((e) => /5,998|5,997/.test(e)), "mutation: a changed price is caught");
  ok(check(home.replace(/data-home-pricing/g, "data-nope"), pricing).length > 0, "mutation: removing the section is caught");
  ok(check(home, pricing.replace(/AU\$149,997/g, "AU$150,000")).some((e) => /149,997/.test(e)), "mutation: a price the pricing page does not show is caught");
  ok(check(home.replace(/href="\/book"/g, 'href="/x"'), pricing).some((e) => /\/book/.test(e)), "mutation: a missing /book link is caught");
  // wording follows the pricing page
  const t = txt(sectionOf(home) ?? "");
  ok(/Published prices in AUD\. The free scan costs nothing and needs no card\./.test(t), "wording: the pricing page's own tagline");
  ok(/The build happens inside month 1\./.test(t) && /can cancel any time/.test(t) && /scoped on a call before anything is signed/.test(t), "wording: the pricing page's own notes");
  ok(!/[–—]/.test(t), "no em or en dashes");
  // source: no price is typed into the component
  const src = fs.readFileSync("components/home/PricingGlance.tsx", "utf8");
  ok(!/AU\$\s?[0-9]|\$[0-9]/.test(src), "PricingGlance.tsx reads every amount from lib/pricing.ts");
  process.exit(fail);
}
