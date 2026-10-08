import { ALL_OFFERS, availability } from "@/lib/offers";
import { int, dec, v, AS_OF_LONG } from "@/lib/ledger";
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
  `Cost per automated worker job fell from US$${v("cost_job_before").toFixed(2)} to US$${v("cost_job_after").toFixed(2)} (MEASURED 8 October 2026: 25 matched jobs, same task text, API-equivalent pricing, TITANOS's own ledgers).`,
  `Worker start-up context fell from about ${int("tokens_before")} tokens to about ${int("tokens_after")} (MEASURED 8 October 2026: median at session start, 198 worker sessions in the baseline).`,
  "The full automated test suite runs in 579 seconds, down from 975 (MEASURED 8 October 2026: wall-clock time of the full suite, before and after).",
  `The ${dec("estate_ey")} engineer-years headline on the home page is MODELLED (a COCOMO estimate, method shown on /engineering). Measured ${AS_OF_LONG}: ${dec("estate_ey")} engineer-years on ${int("estate_sloc")} lines. It is not revenue and not a client result.`,
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
