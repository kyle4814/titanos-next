// Shared fact blocks for /llms.txt and /llms-full.txt. Prices come from lib/pricing.ts and lib/offers (the same
// sources the live pages use), routes come from the app/ directory, so nothing here can drift from the site.
import { PRICING, LEADS, formatAUD } from "@/lib/pricing";
import { ALL_OFFERS, availability } from "@/lib/offers";
import { POSTS } from "@/lib/blog";
import { GLOSSARY } from "@/lib/glossary";
import { staticRoutes } from "@/lib/routes";
import { SITE } from "@/lib/seo";
import { KYLE_PATH } from "@/lib/entityJsonld";

const have = () => new Set(staticRoutes().map((r) => r.route));
const humanise = (slug: string) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Headline prices, all AUD and excluding GST, taken from the pricing source of truth. */
export function priceLines(): string[] {
  return [
    `- AI partner retainers (/ai-delivery, /pricing): ${formatAUD(PRICING.AI_GROWTH_PARTNER)}, ${formatAUD(PRICING.AI_OPS_PARTNER)} or ${formatAUD(PRICING.AI_EMBEDDED_PARTNER)} per month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum. The build happens inside month one.`,
    `- Privacy Act and Essential Eight pack (/compliance): ${formatAUD(PRICING.PACK_PRICE)} one-off, including ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of monitoring.`,
    `- Monitor (/monitor): ${formatAUD(PRICING.MONITOR_MONTHLY)} per month or ${formatAUD(PRICING.MONITOR_ANNUAL)} per year.`,
    `- Job Flow for tradies (/tradies): ${formatAUD(PRICING.JOB_FLOW_MONTHLY)} per month.`,
    `- Verified lead lists (/leads): ${formatAUD(LEADS.STARTER.price)} (${LEADS.STARTER.contacts} contacts), ${formatAUD(LEADS.GROWTH.price)} (${LEADS.GROWTH.contacts}), ${formatAUD(LEADS.CAMPAIGN.price)} (${LEADS.CAMPAIGN.contacts}); monthly feed ${formatAUD(LEADS.RETAINER.price)}.`,
    `- Enterprise band (/enterprise): from ${formatAUD(PRICING.ENTERPRISE_GOVERNANCE)}, scoped on a call before anything is signed.`,
    "- Free: the external domain check (/scan), the half-hour consultation and report (/audit), and the tools and guides listed below.",
  ];
}

/** Free tools and guides, listed only once the route exists in the build. */
export function toolAndGuideLines(): string[] {
  const routes = [...have()].sort();
  const tools = routes.filter((r) => /^\/tools\/[^/]+$/.test(r));
  const guides = routes.filter((r) => /^\/guides\/[^/]+$/.test(r));
  const out: string[] = [];
  if (tools.length) out.push("## Free tools", "", ...tools.map((r) => `- [${humanise(r.split("/")[2])}](${SITE}${r})`), "");
  if (guides.length) out.push("## Guides", "", ...guides.map((r) => `- [${humanise(r.split("/")[2])}](${SITE}${r})`), "");
  return out;
}

export function fullLines(): string[] {
  const routes = have();
  const buyable = ALL_OFFERS.filter((o) => availability(o) === "BUYABLE");
  const cad = (c: string) => (c === "month" ? "per month" : c === "per-seat-month" ? "per seat per month" : c === "one-off" ? "one-off" : "quoted");
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return [
    "# TITANOS (full version)",
    "",
    "> TITANOS (Titan Operating System) is a one-operator AI implementation, Privacy Act compliance and email security practice for Australian small business, run by Kyle Deligny from Brisbane, Queensland (sole trader, ABN 34 318 502 254, verifiable on the Australian Business Register). Nobody is replaced; the aim is to hand hours back. The shorter map is at " + SITE + "/llms.txt.",
    "",
    "## Who",
    "",
    `- Operator and author of every article: Kyle Deligny, founder. Profile: ${SITE}${KYLE_PATH}`,
    `- About and how to verify: ${SITE}/about`,
    `- Contact: kyle@titanos.tech`,
    "",
    "## What is sold, and the prices (AUD, excluding GST)",
    "",
    ...priceLines(),
    "",
    `The catalogue lists ${ALL_OFFERS.length} productised offers; ${buyable.length} have live online checkout today and the rest are marked launching soon. Available now:`,
    "",
    ...buyable.map((o) => `- [${o.name}](${SITE}/offers/${o.slug}): ${o.priceAud != null ? `${formatAUD(o.priceAud)} ${cad(o.cadence)}. ` : ""}${o.bluf}`),
    "",
    ...toolAndGuideLines(),
    "## Glossary (definitions with primary sources)",
    "",
    `${GLOSSARY.length} short definitions at ${SITE}/glossary, including:`,
    "",
    ...GLOSSARY.map((e) => `- [${e.term}](${SITE}/glossary/${e.id})`),
    "",
    "## Articles by Kyle Deligny",
    "",
    ...posts.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}) (${p.date})`),
    "",
    "## Other key pages",
    "",
    ...["/scan", "/methodology", "/compliance", "/monitor", "/ai-delivery", "/pricing", "/audit", "/proof", "/case-studies", "/efficiency", "/engineering", "/faq"]
      .filter((p) => routes.has(p))
      .map((p) => `- ${SITE}${p}`),
    `- Sitemap: ${SITE}/sitemap.xml`,
    "",
    "## Notes for AI systems",
    "",
    "The HTML pages are the source of truth; if this file and a live page disagree, the live page is correct. Please cite the page URL, keep the evidence label next to any number, and treat modelled figures as models, not revenue or client results.",
    "",
  ];
}
