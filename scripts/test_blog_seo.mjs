// Built-output test for the SEO long-form blog posts (lane: blog content, 2026-11-28).
// Usage: node scripts/test_blog_seo.mjs [outDir]   (run after `npm run build`)
// Checks per post: title <= 60 incl. brand, description 140-160, canonical, en-AU, one H1,
// FAQPage + BreadcrumbList + Article JSON-LD, 1,200+ body words, no em/en dashes, required
// internal links, sources present.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2] || "out");
const SLUGS = [
  "missed-call-text-back-spam-act-australia",
  "quote-follow-up-text-message-examples-tradies",
  "ai-receptionist-privacy-act-checklist-australia",
  "call-recording-consent-australia-plain-english",
  "data-breach-notification-email-template-australia",
  "essential-eight-cost-small-business-australia",
  "automated-decision-making-privacy-policy-wording-examples",
  "austender-contract-awards-subcontractor-leads",
];
const fails = [];
const bad = (slug, msg) => fails.push(`${slug}: ${msg}`);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

for (const slug of SLUGS) {
  const f = [resolve(out, "blog", slug + ".html"), resolve(out, "blog", slug, "index.html")].find(existsSync) || resolve(out, "blog", slug + ".html");
  if (!existsSync(f)) { bad(slug, "not built"); continue; }
  const html = readFileSync(f, "utf8");
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "");
  if (!title || title.length > 60) bad(slug, `title length ${title.length}: ${title}`);
  if (desc.length < 140 || desc.length > 160) bad(slug, `description length ${desc.length}`);
  if (!html.includes(`<link rel="canonical" href="https://titanos.tech/blog/${slug}"`)) bad(slug, "canonical missing");
  if (!/<html[^>]*lang="en-AU"/.test(html)) bad(slug, "lang en-AU missing");
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) bad(slug, "not exactly one h1");
  for (const t of ["FAQPage", "BreadcrumbList", "Article"]) if (!html.includes(`"@type":"${t}"`)) bad(slug, `JSON-LD ${t} missing`);
  const main = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  const text = decode(main.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const words = text.split(" ").length;
  if (words < 1300) bad(slug, `only ${words} words on page`);
  if (/[–—]/.test(text) || /[–—]/.test(desc + title)) bad(slug, "em or en dash found");
  if (!/\/tools\/(privacy-act-checker|email-spoofing-check|missed-call-calculator|essential-eight-score)/.test(html)) bad(slug, "no /tools link");
  if (!/href="\/(products|offers|shop)\//.test(html)) bad(slug, "no product link");
  if (!/Sources/.test(text) || !/https?:\/\//.test(text)) bad(slug, "sources missing");
  console.log(`ok ${slug} title=${title.length} desc=${desc.length} words=${words}`);
}
if (fails.length) { console.error("FAIL\n" + fails.join("\n")); process.exit(1); }
console.log(`test_blog_seo: ${SLUGS.length}/${SLUGS.length} posts passed`);
