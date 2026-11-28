// What can be bought through checkout. Amounts are AUD cents and are PINNED to lib/pricing.ts by
// scripts/test_portal_catalogue.mjs (the site's single source of truth for prices).
// Refund and cancel rules mirror app/terms/page.tsx "Refunds" (read 2026-11-06), they are not new policy.
export type Kind = "monitor" | "compliance" | "ai" | "leads";
export interface Product {
  id: string;
  kind: Kind;
  name: string;
  amountCents: number;
  mode: "payment" | "subscription";
  interval?: "month" | "year";
  minMonths?: number;          // retainers: cancel takes effect no earlier than the end of the minimum term
  needsVerifiedDomain: boolean; // active monitoring or compliance work only runs on a domain the buyer proved they own
}
export const PRODUCTS: Record<string, Product> = {
  monitor_monthly: { id: "monitor_monthly", kind: "monitor", name: "Titanos Monitor (monthly)", amountCents: 14900, mode: "subscription", interval: "month", needsVerifiedDomain: true },
  monitor_annual: { id: "monitor_annual", kind: "monitor", name: "Titanos Monitor (annual)", amountCents: 149000, mode: "subscription", interval: "year", needsVerifiedDomain: true },
  compliance_pack: { id: "compliance_pack", kind: "compliance", name: "Privacy Act + Essential Eight Compliance", amountCents: 599700, mode: "payment", needsVerifiedDomain: true },
  ai_growth: { id: "ai_growth", kind: "ai", name: "AI Growth Partner", amountCents: 150000, mode: "subscription", interval: "month", minMonths: 3, needsVerifiedDomain: false },
  ai_ops: { id: "ai_ops", kind: "ai", name: "AI Ops Partner", amountCents: 250000, mode: "subscription", interval: "month", minMonths: 3, needsVerifiedDomain: false },
  ai_embedded: { id: "ai_embedded", kind: "ai", name: "Embedded AI Partner", amountCents: 500000, mode: "subscription", interval: "month", minMonths: 3, needsVerifiedDomain: false },
  leads_starter: { id: "leads_starter", kind: "leads", name: "Leads Starter (250 contacts)", amountCents: 49700, mode: "payment", needsVerifiedDomain: false },
  leads_growth: { id: "leads_growth", kind: "leads", name: "Leads Growth (1,000 contacts)", amountCents: 149700, mode: "payment", needsVerifiedDomain: false },
  leads_campaign: { id: "leads_campaign", kind: "leads", name: "Leads Full Campaign (3,000 contacts)", amountCents: 349700, mode: "payment", needsVerifiedDomain: false },
  leads_retainer: { id: "leads_retainer", kind: "leads", name: "Leads Ongoing Retainer", amountCents: 99000, mode: "subscription", interval: "month", needsVerifiedDomain: false },
};

export const REFUND_WINDOW_DAYS = 14; // terms page: compliance, full refund within 14 days of payment, no deliverable issued

export type RefundVerdict = { auto: true } | { auto: false; reason: string };
// Auto-refund ONLY where the published terms promise it. Everything else becomes a review card (a Kyle tap at GATE1).
export function refundVerdict(p: Product, paidAtMs: number, nowMs: number, deliverableIssued: boolean, alreadyRefunded: boolean): RefundVerdict {
  if (alreadyRefunded) return { auto: false, reason: "already_refunded" };
  if (p.kind !== "compliance") {
    return { auto: false, reason: p.kind === "monitor" ? "monitor_no_refund_current_period" : "scope_terms_apply" };
  }
  if (deliverableIssued) return { auto: false, reason: "deliverable_issued" };
  if (nowMs - paidAtMs > REFUND_WINDOW_DAYS * 86_400_000) return { auto: false, reason: "outside_14_days" };
  return { auto: true };
}
