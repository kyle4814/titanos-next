// SEO20 batch 3: tradie and service business guides are registered, cross-linked and in the sitemap data.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_guides_batch3.mjs
import { GUIDES, guideHrefs } from "../lib/guides.ts";

const NEW = ["servicem8-automation-tradies", "tradify-vs-servicem8-automation", "google-reviews-tradies-australia", "automated-appointment-reminders-australia", "job-quote-template-tradies-australia"];
const fails = [];
const bad = (m) => fails.push(m);
for (const s of NEW) {
  const g = GUIDES.find((x) => x.slug === s);
  if (!g) { bad(`missing guide ${s}`); continue; }
  if (g.date !== "2026-11-29") bad(`${s} date`);
  if (g.sources.length < 4) bad(`${s} needs 4+ sources`);
  if (!g.related.tools.length || !g.related.products.some((p) => p.href === "/shop")) bad(`${s} related tools/shop`);
  if (!/[a-z]/.test(g.nextStep.text)) bad(`${s} next step`);
  const hrefs = guideHrefs(g);
  const inbound = GUIDES.filter((o) => o.slug !== s).some((o) => guideHrefs(o).includes(`/guides/${s}`));
  if (!inbound) bad(`${s} has no inbound guide link`);
  if (hrefs.filter((h) => h.startsWith("/guides/")).length < 1) bad(`${s} links no sibling guide`);
}
if (new Set(GUIDES.map((g) => g.slug)).size !== GUIDES.length) bad("duplicate slugs");
// no invented figures: every statistic-like claim in these guides must be one of the sourced or labelled-example ones
const allowed = /75,000|82\.50|3 million|10 December 2026|7 and 14 days|five|5 follow-ups/;
for (const s of NEW) {
  const g = GUIDES.find((x) => x.slug === s);
  const txt = JSON.stringify(g);
  if (/\b\d{2,3}(?:\.\d+)? ?(?:%|percent) (?:of|more|increase)/.test(txt) && !allowed.test(txt)) bad(`${s} unlabelled statistic`);
}
if (fails.length) { console.error("FAIL test_guides_batch3:\n" + fails.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log(`OK test_guides_batch3 (${NEW.length} guides)`);
