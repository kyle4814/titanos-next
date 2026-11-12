import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { PRICING, LEADS, formatAUD } from "@/lib/pricing";
import { BOOK_HREF } from "@/lib/config";

/**
 * PricingGlance: the compact price list on the homepage (Kyle, 2026-11-12: "the pricing still isn't on the front page").
 * Every amount is read from lib/pricing.ts, the same constants app/pricing/page.tsx renders, and the wording follows that page.
 * scripts/test_home_pricing.mjs fails if a price appears here that /pricing does not show.
 */
const leadPrices = [LEADS.STARTER.price, LEADS.GROWTH.price, LEADS.CAMPAIGN.price];

const ROWS: { id: string; label: string; price: string; unit: string; note: string }[] = [
  {
    id: "retainers",
    label: "Retainers",
    price: `${formatAUD(PRICING.AI_GROWTH_PARTNER)}, ${formatAUD(PRICING.AI_OPS_PARTNER)} or ${formatAUD(PRICING.AI_EMBEDDED_PARTNER)}`,
    unit: "a month",
    note: `Three tiers, a ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum, then month to month. The build happens inside month 1.`,
  },
  {
    id: "monitor",
    label: "Compliance Monitor",
    price: formatAUD(PRICING.MONITOR_MONTHLY),
    unit: "a month",
    note: "Monitor is a subscription you can cancel any time.",
  },
  {
    id: "pack",
    label: "Privacy Act and Essential Eight pack",
    price: formatAUD(PRICING.PACK_PRICE),
    unit: "one-off",
    note: "The pack is a fixed price.",
  },
  {
    id: "leads",
    label: "Leads programmes",
    price: `${formatAUD(Math.min(...leadPrices))} to ${formatAUD(Math.max(...leadPrices))}`,
    unit: "one-off",
    note: "One-off verified contact lists.",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: `${formatAUD(PRICING.ENTERPRISE_GOVERNANCE)} to ${formatAUD(PRICING.OEM_LICENCE_ANNUAL)}`,
    unit: "a year",
    note: "Every enterprise engagement is scoped on a call before anything is signed.",
  },
];

export default function PricingGlance() {
  return (
    <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
      <div role="group" aria-labelledby="home-pricing-h" className="container-vault" data-home-pricing>
        <div style={{ textAlign: "center", maxWidth: "var(--maxw-prose)", margin: "0 auto 24px" }}>
          <h2 id="home-pricing-h" style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, fontStyle: "italic", fontSize: "var(--fs-h3, 1.5rem)", color: "var(--gold)", margin: "0 0 10px" }}>
            What it costs, before you have to ask
          </h2>
          <p style={{ color: "var(--ice)", lineHeight: 1.6, margin: 0 }}>Published prices in AUD. The free scan costs nothing and needs no card.</p>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 auto", maxWidth: "var(--maxw-wide)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {ROWS.map((r) => (
            <li key={r.id} data-price={r.id} style={{ padding: "14px 16px", border: "1px solid rgb(var(--gold-rgb) / 0.18)", borderRadius: "var(--radius-md)", background: "rgb(var(--gold-rgb) / 0.02)" }}>
              <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-sm)" }}>{r.label}</span>
              <span style={{ display: "block", color: "var(--gold)", fontWeight: 700, fontSize: "var(--fs-lg)", lineHeight: 1.3 }}>
                {r.price} <span style={{ color: "var(--ice)", fontWeight: 400, fontSize: "var(--fs-sm)" }}>{r.unit}</span>
              </span>
              <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-xs)", lineHeight: 1.5, marginTop: 4 }}>{r.note}</span>
            </li>
          ))}
        </ul>
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href={BOOK_HREF} variant="primary">Book a free call →</AnimatedButton>
            <AnimatedButton href="/pricing" variant="secondary">See every price →</AnimatedButton>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
