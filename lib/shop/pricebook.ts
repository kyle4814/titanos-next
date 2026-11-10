// C5 pricebook: the AU$ price each product/course slug may carry. A grade passes the price check only when the entry's
// price equals the pricebook row for its slug. HONEST GAP (plan ch.5 table, 2026-11-06): chapter 5 has no per-product row for
// DIY guides, checklists, templates or courses ("Courses done for you: per build, no number, UNKNOWN", P023). These rows are
// therefore PROPOSED (lib/products/products.ts suggestedPriceAud, a staged Stripe-card proposal) until Kyle approves them.
// The ch.5 PUBLISHED anchors are listed so no product can claim an anchor price of a different SKU.
export type PriceRow = { priceAud: number; label: "PUBLISHED" | "PROPOSED"; source: string };

export const CH5_ANCHORS_AUD: Record<string, number> = {
  "retainer-small": 1500, "retainer-mid": 2500, "retainer-large": 5000,
  "compliance-monitor": 149, "privacy-act-e8-package": 5997, "enterprise-low": 49997, "enterprise-high": 149997,
  "owner-tier-level": 49, "owner-tier-weekly": 149, "owner-tier-autofix": 499, "nuke-total": 17997,
};

const P = (priceAud: number): PriceRow => ({ priceAud, label: "PROPOSED", source: "lib/products/products.ts suggestedPriceAud; ch.5 has no per-product row (P023 UNKNOWN)" });
export const PRICEBOOK: Record<string, PriceRow> = {
  "dmarc-setup-guide": P(49), "spoofguard-self-check-checklist": P(15), "essential-eight-ml1-checklist": P(30),
  "privacy-policy-template-pack": P(30), "privacy-adm-wording-guide": P(29), "five-jurisdiction-privacy-bundle": P(49),
  "breach-response-runbook": P(30), "vendor-risk-register-template": P(15), "customer-dossier-method-guide": P(100),
  "quote-follow-up-playbook": P(30), "invoice-chasing-playbook": P(30), "efficiency-proof-pack": P(100),
  "course-ai-for-tradies": P(100), "course-email-security-for-owners": P(100),
};
