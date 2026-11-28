// Batch 2 guides gate: the six new email security guides exist, are long enough, link each other and carry no invented figures.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_guides_batch2.mjs
import { GUIDES, guideWordCount, guideTexts, guideHrefs } from "../lib/guides.ts";

const fails = [];
const bad = (m) => fails.push(m);
const NEW = ["stop-email-spoofing-my-domain", "dmarc-for-microsoft-365", "what-is-a-dkim-record", "bimi-for-small-business", "invoice-fraud-email-scams-australia", "what-is-an-spf-record"];
const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|streamlin\w*|synerg\w*|ecosystem)\b|[–—]/i;

for (const slug of NEW) {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) { bad(`missing guide ${slug}`); continue; }
  const w = guideWordCount(g);
  if (w < 1800) bad(`[${slug}] ${w} words, need 1800+`);
  if (g.faq.length < 6) bad(`[${slug}] needs 6+ FAQ`);
  if (g.sources.length < 4) bad(`[${slug}] needs 4+ sources`);
  if (!g.sources.every((s) => /^https:\/\//.test(s.url))) bad(`[${slug}] source not https`);
  if (g.sections.length < 5) bad(`[${slug}] needs 5+ sections`);
  // spoke links: each new guide links to at least two other guides in its body
  const body = guideHrefs(g).filter((h) => h.startsWith("/guides/") && h !== `/guides/${slug}`);
  if (new Set(body).size < 2) bad(`[${slug}] links fewer than 2 other guides`);
  for (const t of guideTexts(g)) if (TELLS.test(t)) bad(`[${slug}] banned word or dash: ${t.match(TELLS)[0]}`);
  // no invented statistics: any percentage or dollar figure in prose must be on this allow-list
  const text = guideTexts(g).join(" ");
  for (const m of text.matchAll(/\$\s?\d[\d,.]*|\d+(\.\d+)?\s?%/g)) bad(`[${slug}] unsourced figure "${m[0]}"`);
  console.log(`[${slug}] ${w} words, ${g.faq.length} FAQ, ${g.sources.length} sources`);
}
// every guide-to-guide link inside new guides resolves
const slugs = new Set(GUIDES.map((g) => g.slug));
for (const slug of NEW) {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) continue;
  for (const h of guideHrefs(g)) if (h.startsWith("/guides/") && !slugs.has(h.split("/")[2].split("#")[0])) bad(`[${slug}] broken guide link ${h}`);
}
if (fails.length) { console.error("FAIL test_guides_batch2:\n" + fails.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log("OK test_guides_batch2");
