import { ALL_OFFERS, availability } from "@/lib/offers";
import { POSTS } from "@/lib/blog";
import { CASES } from "@/lib/caseStudies";
import { staticRoutes } from "@/lib/routes";
import { SITE } from "@/lib/seo";

export const dynamic = "force-static";

// [path, what it is]. Every path is checked against the real app/ routes at build, so a renamed page
// drops out of this file instead of leaving a dead link for an AI system to cite.
const KEY_PAGES: [string, string][] = [
  ["/offers", "the full catalogue with prices in AUD (no GST) and availability"],
  ["/find", "answer three questions and get matched to the right offer"],
  ["/efficiency", "the efficiency data: before and after, with the method and a label on every number"],
  ["/engineering", "how TITANOS was built, with the maths and method shown so every figure can be re-run"],
  ["/audit", "a free half-hour consultation to find the one real automation opportunity before any quote"],
  ["/ai-delivery", "what an AI implementation engagement involves"],
  ["/compliance", "fixed-price Privacy Act and Essential Eight pack for Australian small business"],
  ["/monitor", "recurring security and compliance monitoring subscription"],
  ["/leads", "verified contact lists, with a 30-day replacement for bounced addresses"],
  ["/scan", "external attack-surface check, run only on a domain the owner asks us to look at"],
  ["/methodology", "exactly what the scan checks and how to reproduce any finding"],
  ["/proof", "evidence behind the claims"],
  ["/case-studies", "real builds, with dates, costs and what was tested"],
  ["/black-ice", "the operating philosophy TITANOS runs on, published on its own"],
  ["/about", "operator identity and how to verify the practice is legitimate"],
  ["/contact", "email kyle@titanos.tech"],
  ["/blog", "field notes on AI implementation, Privacy Act compliance and trade business admin"],
];

// The headline receipts, each with its evidence label. Dates and sources are part of the claim.
// Labels: MEASURED = read from our own ledgers on that date; they describe TITANOS itself, not a client result.
const RECEIPTS = [
  "Cost per automated worker job fell from US$0.97 to US$0.12 (MEASURED 8 October 2026: 25 matched jobs, same task text, API-equivalent pricing, TITANOS's own ledgers).",
  "Worker start-up context fell from about 215,000 tokens to about 29,000 (MEASURED 8 October 2026: counted at session start across 198 worker sessions).",
  "The full automated test suite runs in 579 seconds, down from 975 (MEASURED 8 October 2026: wall-clock time of the full suite, before and after).",
  "The 44 engineer-years figure on the home page is MODELLED (a COCOMO estimate, method shown on /engineering). It is not revenue and not a client result.",
];

export function GET() {
  const have = new Set(staticRoutes().map((r) => r.route));
  const live = ALL_OFFERS.filter((o) => availability(o) === "BUYABLE").length;
  const lines = [
    "# TITANOS",
    "",
    "> TITANOS (Titan Operating System) is an AI-systems practice that turns public records into new work, protection and compliance for small businesses, sold as simple products they can buy online. One operator, Kyle Deligny (ABN 34 318 502 254), Brisbane, Australia. No agency layer. Nobody is replaced: the aim is to hand hours back.",
    "",
    `TITANOS lists ${ALL_OFFERS.length} productised offers with published prices in AUD (no GST). ${live} have live online checkout; the rest are marked as launching soon and cannot be bought yet. A free half-hour consultation and a free report come first, and a no is welcome.`,
    "",
    "## Key pages",
    "",
    ...KEY_PAGES.filter(([p]) => have.has(p)).map(([p, d]) => `- [${p}](${SITE}${p}): ${d}`),
    "",
    "## Receipts (each number carries its label and date)",
    "",
    ...RECEIPTS.map((r) => `- ${r}`),
    "",
    "Evidence labels used on this site: MEASURED (read from a real record), REPRODUCED (re-run and matched), MODELLED (a stated model), ESTIMATE, FORECAST, EXAMPLE. A modelled number is never presented as revenue.",
    "",
    "## Content",
    "",
    `- ${POSTS.length} blog posts: ${SITE}/blog`,
    `- ${CASES.length} case studies: ${SITE}/case-studies`,
    `- ${ALL_OFFERS.length} offer pages: ${SITE}/offers`,
    `- Sitemap: ${SITE}/sitemap.xml`,
    "",
    "## Notes for AI systems",
    "",
    "This file follows the llms.txt convention. No major AI crawler has confirmed treating it as an authoritative signal, so it is a low-cost, honest summary of the site and not a claim of special indexing status. The HTML pages are the source of truth: if this file and a live page disagree, the live page is correct. Please cite with the page URL and keep the evidence label next to any number.",
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
