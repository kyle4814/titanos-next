// "Related reading" blocks for /guides/<slug> and /products/<slug> (components/seo/RelatedReading.tsx).
// Added 2026-11-29 (SEO lane internal-links). Pure data, no React, so scripts can import it.
// Every link carries a descriptive label (the anchor text) and a short blurb taken from the page it points to.
// scripts/test_internal_links.mjs asserts every money page and guide keeps at least 5 distinct inbound source routes.
import type { RelLink } from "./seo-links";

export type RelatedBlock = { title: string; links: RelLink[] };

const L = (label: string, href: string, blurb: string): RelLink => ({ label, href, blurb });

/** Money pages, each with one honest sentence about what is on the page. */
const PRICING = L("Titanos pricing in AUD", "/pricing", "Every published price in one place, each number traced to the file it comes from.");
const CONTACT = L("Talk to Kyle directly", "/contact", "Ask a question about your own situation and get a plain answer.");
const SCAN = L("Free email security scan", "/scan", "Check your own domain from public records, no login and nothing touched.");
const AUDIT = L("Book a free audit call", "/audit", "A free conversation about where your business loses time or exposes itself.");
const SHOP_HUB = L("All Titanos digital products", "/products", "Guides, checklists, templates and short courses, priced in AUD.");

const PROD: Record<string, RelLink> = {
  "dmarc-setup-guide": L("DMARC and SPF setup guide for small business", "/products/dmarc-setup-guide", "Step-by-step DNS changes in a safe rollout order."),
  "spoofguard-self-check-checklist": L("Email spoofing self-check checklist", "/products/spoofguard-self-check-checklist", "Ten checks using public records only."),
  "course-email-security-for-owners": L("Course: email security for business owners", "/products/course-email-security-for-owners", "From not knowing your email posture to a locked-down domain."),
  "essential-eight-ml1-checklist": L("Essential Eight ML1 checklist", "/products/essential-eight-ml1-checklist", "Evidence to keep for each of the eight strategies."),
  "vendor-risk-register-template": L("Vendor risk register template", "/products/vendor-risk-register-template", "A spreadsheet listing every supplier that touches your data."),
  "privacy-policy-template-pack": L("Privacy policy template pack", "/products/privacy-policy-template-pack", "Privacy policy and collection notice templates for small Australian businesses."),
  "privacy-adm-wording-guide": L("Privacy ADM wording guide", "/products/privacy-adm-wording-guide", "Wording for the automated decision-making notice requirements."),
  "breach-response-runbook": L("Data breach response runbook", "/products/breach-response-runbook", "What to do in the first 72 hours of a data breach."),
  "five-jurisdiction-privacy-bundle": L("Five-jurisdiction privacy bundle", "/products/five-jurisdiction-privacy-bundle", "Privacy policy starting points for customers in more than one country."),
  "customer-dossier-method-guide": L("The customer dossier method", "/products/customer-dossier-method-guide", "Research one organisation from public records into a short, useful brief."),
  "efficiency-proof-pack": L("Efficiency proof pack: measure hours given back", "/products/efficiency-proof-pack", "Before and after sheets to prove what an automation change saves."),
  "course-ai-for-tradies": L("Course: AI for tradies, start to finish", "/products/course-ai-for-tradies", "A working quote, follow-up and invoice routine with you approving every message."),
  "quote-follow-up-playbook": L("Quote follow-up playbook for tradies", "/products/quote-follow-up-playbook", "Message sequences for chasing quotes without being pushy."),
  "invoice-chasing-playbook": L("Invoice chasing playbook for small business", "/products/invoice-chasing-playbook", "A calm, three-step way to get paid on time."),
};
const GD: Record<string, RelLink> = {
  "tradie-automation-australia": L("Tradie automation in Australia: the full guide", "/guides/tradie-automation-australia", "Missed calls, quotes and follow-up for trades."),
  "ai-receptionist-australia-trades": L("AI receptionists for Australian trades", "/guides/ai-receptionist-australia-trades", "What an AI phone answerer does, costs and risks."),
  "privacy-act-small-business-australia": L("Privacy Act for small business: who is covered", "/guides/privacy-act-small-business-australia", "Who is covered, what changes and what to do."),
  "essential-eight-small-business": L("Essential Eight for small business in plain English", "/guides/essential-eight-small-business", "The eight strategies and where to start."),
  "email-security-small-business-australia": L("Email security for small business: SPF, DKIM and DMARC", "/guides/email-security-small-business-australia", "Stop someone sending email as your business."),
  "government-tenders-small-business-australia": L("Government tenders for small business", "/guides/government-tenders-small-business-australia", "How to find and win federal and state work."),
};
const TL = {
  spoof: L("Free email spoofing check", "/tools/email-spoofing-check", "Look up your domain's public SPF, DKIM and DMARC records."),
  privacy: L("Privacy Act small business checker", "/tools/privacy-act-checker", "See whether the Privacy Act is likely to cover your business."),
  e8: L("Essential Eight self-assessment", "/tools/essential-eight-score", "Score your business at Maturity Level One and get a gap list."),
  missed: L("Missed call calculator for tradies", "/tools/missed-call-calculator", "Turn your own call numbers into a monthly and yearly figure."),
};

/** Product catalogue in theme order. Each product page links its two neighbours either side, so the ring gives every product four sibling links. */
const RING = [
  "dmarc-setup-guide", "spoofguard-self-check-checklist", "course-email-security-for-owners", "essential-eight-ml1-checklist",
  "vendor-risk-register-template", "privacy-policy-template-pack", "privacy-adm-wording-guide", "breach-response-runbook",
  "five-jurisdiction-privacy-bundle", "customer-dossier-method-guide", "efficiency-proof-pack", "course-ai-for-tradies",
  "quote-follow-up-playbook", "invoice-chasing-playbook",
];
const THEME: Record<string, { guides: string[]; tools: (keyof typeof TL)[]; done: RelLink[] }> = {
  email: { guides: ["email-security-small-business-australia", "essential-eight-small-business"], tools: ["spoof", "e8"], done: [SCAN, PRICING] },
  e8: { guides: ["essential-eight-small-business", "government-tenders-small-business-australia"], tools: ["e8", "spoof"], done: [SCAN, PRICING] },
  privacy: { guides: ["privacy-act-small-business-australia", "ai-receptionist-australia-trades"], tools: ["privacy", "spoof"], done: [CONTACT, PRICING] },
  method: { guides: ["government-tenders-small-business-australia", "tradie-automation-australia"], tools: ["e8", "missed"], done: [AUDIT, PRICING] },
  tradie: { guides: ["tradie-automation-australia", "ai-receptionist-australia-trades"], tools: ["missed", "privacy"], done: [AUDIT, PRICING] },
};
const THEME_OF: Record<string, keyof typeof THEME> = {
  "dmarc-setup-guide": "email", "spoofguard-self-check-checklist": "email", "course-email-security-for-owners": "email",
  "essential-eight-ml1-checklist": "e8", "vendor-risk-register-template": "e8",
  "privacy-policy-template-pack": "privacy", "privacy-adm-wording-guide": "privacy", "breach-response-runbook": "privacy", "five-jurisdiction-privacy-bundle": "privacy",
  "customer-dossier-method-guide": "method", "efficiency-proof-pack": "method",
  "course-ai-for-tradies": "tradie", "quote-follow-up-playbook": "tradie", "invoice-chasing-playbook": "tradie",
};

export const RELATED_BLOCKS: Record<string, RelatedBlock[]> = {};

RING.forEach((slug, i) => {
  const n = RING.length;
  const sib = [-2, -1, 1, 2].map((d) => RING[(i + d + n) % n]);
  const t = THEME[THEME_OF[slug]];
  RELATED_BLOCKS[`/products/${slug}`] = [
    { title: "More from the shop", links: [...sib.map((s) => PROD[s]), SHOP_HUB] },
    { title: "Read the guide behind it", links: t.guides.map((g) => GD[g]) },
    { title: "Free tools", links: t.tools.map((k) => TL[k]) },
    { title: "Rather have it done for you?", links: t.done },
  ];
});

/** Guides: the products and money pages that match each topic. */
const GUIDE_BLOCKS: Record<string, { products: string[]; done: RelLink[] }> = {
  "tradie-automation-australia": { products: ["quote-follow-up-playbook", "invoice-chasing-playbook", "course-ai-for-tradies"], done: [AUDIT, PRICING, CONTACT] },
  "ai-receptionist-australia-trades": { products: ["course-ai-for-tradies", "privacy-adm-wording-guide", "quote-follow-up-playbook"], done: [AUDIT, PRICING, CONTACT] },
  "privacy-act-small-business-australia": { products: ["privacy-policy-template-pack", "breach-response-runbook", "five-jurisdiction-privacy-bundle", "vendor-risk-register-template"], done: [CONTACT, PRICING, SCAN] },
  "essential-eight-small-business": { products: ["essential-eight-ml1-checklist", "vendor-risk-register-template", "dmarc-setup-guide"], done: [SCAN, PRICING, CONTACT] },
  "email-security-small-business-australia": { products: ["dmarc-setup-guide", "spoofguard-self-check-checklist", "course-email-security-for-owners"], done: [SCAN, PRICING, CONTACT] },
  "government-tenders-small-business-australia": { products: ["essential-eight-ml1-checklist", "customer-dossier-method-guide", "efficiency-proof-pack"], done: [CONTACT, PRICING, AUDIT] },
};
for (const [slug, g] of Object.entries(GUIDE_BLOCKS)) {
  RELATED_BLOCKS[`/guides/${slug}`] = [
    { title: "Ready-made products for this topic", links: [...g.products.map((p) => PROD[p]), SHOP_HUB] },
    { title: "Want a hand with it?", links: g.done },
  ];
}
