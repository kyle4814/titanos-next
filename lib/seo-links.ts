// Cross-link map for the SEO push (2026-11-28): tools, guides, blog posts and shop products link both ways from this one file.
// Pure data, no React, so scripts can import it. Hrefs are checked by scripts/test_seo_crosslinks.mjs.

export type RelLink = { label: string; href: string; blurb: string };

export const TOOLS: RelLink[] = [
  { label: "Privacy Act small business checker", href: "/tools/privacy-act-checker", blurb: "Answer a few questions to see whether the Privacy Act is likely to cover your business, with the exceptions explained." },
  { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records and see whether someone could send email as your business." },
  { label: "Essential Eight self-assessment", href: "/tools/essential-eight-score", blurb: "Score your business against the eight ASD mitigation strategies at Maturity Level One and get a gap list." },
  { label: "Missed call calculator for tradies", href: "/tools/missed-call-calculator", blurb: "Turn your own call numbers into a monthly and yearly figure for jobs lost to unanswered calls." },
];
const tool = (href: string) => TOOLS.find((t) => t.href === href)!;

export const GUIDE_LINKS: Record<string, RelLink> = {
  "tradie-automation-australia": { label: "Tradie automation in Australia", href: "/guides/tradie-automation-australia", blurb: "The full guide to missed calls, quotes and follow-up for trades." },
  "ai-receptionist-australia-trades": { label: "AI receptionists for Australian trades", href: "/guides/ai-receptionist-australia-trades", blurb: "What an AI phone answerer does, costs and risks." },
  "privacy-act-small-business-australia": { label: "Privacy Act for small business", href: "/guides/privacy-act-small-business-australia", blurb: "Who is covered, what changes and what to do." },
  "essential-eight-small-business": { label: "Essential Eight for small business", href: "/guides/essential-eight-small-business", blurb: "The eight strategies in plain English." },
  "email-security-small-business-australia": { label: "Email security for small business", href: "/guides/email-security-small-business-australia", blurb: "SPF, DKIM, DMARC and scams, step by step." },
  "government-tenders-small-business-australia": { label: "Government tenders for small business", href: "/guides/government-tenders-small-business-australia", blurb: "How to find and win federal and state work." },
};
export const guide = (slug: string): RelLink => {
  const g = GUIDE_LINKS[slug];
  if (!g) throw new Error(`seo-links: unknown guide ${slug}`);
  return g;
};

export const PRODUCT_LINKS: Record<string, RelLink> = {
  "dmarc-setup-guide": { label: "DMARC and SPF setup guide", href: "/products/dmarc-setup-guide", blurb: "Step-by-step DMARC and SPF setup for a small business domain." },
  "spoofguard-self-check-checklist": { label: "SpoofGuard self-check checklist", href: "/products/spoofguard-self-check-checklist", blurb: "A short checklist to test your own email domain." },
  "essential-eight-ml1-checklist": { label: "Essential Eight ML1 checklist", href: "/products/essential-eight-ml1-checklist", blurb: "Evidence to keep for each of the eight strategies, plus a gap sheet." },
  "privacy-policy-template-pack": { label: "Privacy policy template pack", href: "/products/privacy-policy-template-pack", blurb: "Privacy policy and collection notice templates for small Australian businesses." },
  "privacy-adm-wording-guide": { label: "Privacy ADM wording guide", href: "/products/privacy-adm-wording-guide", blurb: "Wording for the automated decision-making notice requirements." },
  "breach-response-runbook": { label: "Breach response runbook", href: "/products/breach-response-runbook", blurb: "What to do in the first 72 hours of a data breach." },
  "quote-follow-up-playbook": { label: "Quote follow-up playbook", href: "/products/quote-follow-up-playbook", blurb: "Message sequences for chasing quotes without being pushy." },
};
export const product = (slug: string): RelLink => {
  const p = PRODUCT_LINKS[slug];
  if (!p) throw new Error(`seo-links: unknown product ${slug}`);
  return p;
};
export const SHOP: RelLink = { label: "The TITANOS shop", href: "/shop", blurb: "Guides, templates and checklists in AUD, no GST." };

/** Per tool: the guides and products to show beneath it. */
export const TOOL_RELATED: Record<string, { guides: string[]; products: string[]; tools: string[]; posts: string[] }> = {
  "/tools/privacy-act-checker": {
    guides: ["privacy-act-small-business-australia", "ai-receptionist-australia-trades"],
    products: ["privacy-policy-template-pack", "privacy-adm-wording-guide", "breach-response-runbook"],
    tools: ["/tools/email-spoofing-check", "/tools/essential-eight-score"],
    posts: ["privacy-act-small-business-deadline", "sole-trader-privacy-policy-threshold", "ai-receptionist-privacy-act-checklist-australia"],
  },
  "/tools/email-spoofing-check": {
    guides: ["email-security-small-business-australia", "essential-eight-small-business"],
    products: ["dmarc-setup-guide", "spoofguard-self-check-checklist"],
    tools: ["/tools/essential-eight-score", "/tools/privacy-act-checker"],
    posts: ["can-someone-send-email-pretending-to-be-my-business", "anz-smb-email-security-double-gap-measured"],
  },
  "/tools/essential-eight-score": {
    guides: ["essential-eight-small-business", "government-tenders-small-business-australia"],
    products: ["essential-eight-ml1-checklist"],
    tools: ["/tools/email-spoofing-check", "/tools/privacy-act-checker"],
    posts: ["essential-eight-small-trade-business"],
  },
  "/tools/missed-call-calculator": {
    guides: ["tradie-automation-australia", "ai-receptionist-australia-trades"],
    products: ["quote-follow-up-playbook"],
    tools: ["/tools/privacy-act-checker"],
    posts: ["missed-call-text-back-spam-act-australia", "quote-follow-up-text-message-examples-tradies"],
  },
};

/** Per guide: tools and products to add to its "related" lists (merged, de-duplicated by href). */
export const GUIDE_EXTRA: Record<string, { tools: string[]; products: string[] }> = {
  "tradie-automation-australia": { tools: ["/tools/missed-call-calculator", "/tools/privacy-act-checker"], products: ["quote-follow-up-playbook"] },
  "ai-receptionist-australia-trades": { tools: ["/tools/privacy-act-checker", "/tools/missed-call-calculator"], products: ["privacy-adm-wording-guide"] },
  "privacy-act-small-business-australia": { tools: ["/tools/privacy-act-checker"], products: ["privacy-policy-template-pack", "breach-response-runbook"] },
  "essential-eight-small-business": { tools: ["/tools/essential-eight-score", "/tools/email-spoofing-check"], products: ["essential-eight-ml1-checklist"] },
  "email-security-small-business-australia": { tools: ["/tools/email-spoofing-check", "/tools/essential-eight-score"], products: ["dmarc-setup-guide", "spoofguard-self-check-checklist"] },
  "government-tenders-small-business-australia": { tools: ["/tools/essential-eight-score", "/tools/privacy-act-checker"], products: ["essential-eight-ml1-checklist"] },
};
// SEO20 batch 3 guides
GUIDE_EXTRA["servicem8-automation-tradies"] = { tools: ["/tools/missed-call-calculator", "/tools/privacy-act-checker"], products: ["quote-follow-up-playbook"] };
GUIDE_EXTRA["tradify-vs-servicem8-automation"] = { tools: ["/tools/missed-call-calculator"], products: ["quote-follow-up-playbook"] };
GUIDE_EXTRA["google-reviews-tradies-australia"] = { tools: ["/tools/privacy-act-checker"], products: ["privacy-policy-template-pack"] };
GUIDE_EXTRA["automated-appointment-reminders-australia"] = { tools: ["/tools/missed-call-calculator", "/tools/privacy-act-checker"], products: ["privacy-policy-template-pack"] };
GUIDE_EXTRA["job-quote-template-tradies-australia"] = { tools: ["/tools/missed-call-calculator"], products: ["quote-follow-up-playbook"] };
export const toolLink = tool;

/** Per new blog post: the guide and product that close it. */
export const POST_RELATED: Record<string, { guide: string; product?: string }> = {
  "missed-call-text-back-spam-act-australia": { guide: "tradie-automation-australia", product: "quote-follow-up-playbook" },
  "quote-follow-up-text-message-examples-tradies": { guide: "tradie-automation-australia", product: "quote-follow-up-playbook" },
  "ai-receptionist-privacy-act-checklist-australia": { guide: "ai-receptionist-australia-trades", product: "privacy-adm-wording-guide" },
  "call-recording-consent-australia-plain-english": { guide: "ai-receptionist-australia-trades", product: "privacy-policy-template-pack" },
  "data-breach-notification-email-template-australia": { guide: "privacy-act-small-business-australia", product: "breach-response-runbook" },
  "automated-decision-making-privacy-policy-wording-examples": { guide: "privacy-act-small-business-australia", product: "privacy-adm-wording-guide" },
  "essential-eight-cost-small-business-australia": { guide: "essential-eight-small-business", product: "essential-eight-ml1-checklist" },
  "austender-contract-awards-subcontractor-leads": { guide: "government-tenders-small-business-australia" },
};
