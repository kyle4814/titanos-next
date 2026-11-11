// Compact price strip for the home page. Every amount is read from lib/pricing.ts (the source /pricing uses); none is typed here.
import Link from "next/link";
import { PRICING, formatAUD } from "@/lib/pricing";

const ROWS: { name: string; amount: number; note: string }[] = [
  { name: "AI Growth Partner", amount: PRICING.AI_GROWTH_PARTNER, note: `a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum` },
  { name: "AI Ops Partner", amount: PRICING.AI_OPS_PARTNER, note: `a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum` },
  { name: "Embedded AI Partner", amount: PRICING.AI_EMBEDDED_PARTNER, note: `a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum` },
  { name: "Compliance Monitor", amount: PRICING.MONITOR_MONTHLY, note: "a month" },
];

export default function PriceStrip() {
  return (
    <section aria-label="Prices" data-price-strip style={{ padding: "var(--space-6) 20px 0", position: "relative", zIndex: 2 }}>
      <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", textAlign: "center" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {ROWS.map((r) => (
            <li key={r.name} data-price-row style={{ color: "var(--ice)" }}>
              <span style={{ display: "block", fontSize: "0.9rem" }}>{r.name}</span>
              <strong style={{ display: "block", color: "var(--gold)", fontSize: "1.3rem" }}>{formatAUD(r.amount)}</strong>
              <span style={{ display: "block", fontSize: "0.8rem" }}>{r.note}</span>
            </li>
          ))}
        </ul>
        <p style={{ margin: "12px 0 0" }}><Link href="/pricing" style={{ color: "var(--gold)" }}>See all pricing</Link></p>
      </div>
    </section>
  );
}
