import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import trace from "@/lib/site-data/pricing-trace.json";
import { PRICING, LEADS, formatAUD } from "@/lib/pricing";
import { longDate } from "@/lib/provenance";
import { PartnershipStack } from "@/components/home/moved/PartnershipStack";

const META_TITLE = "Pricing: what each service costs, in AUD | TITANOS";
const META_DESC = "Every published price in one place: retainers, Compliance Monitor, the Privacy Act and Essential Eight pack, leads and enterprise. Each number names the file it comes from.";

export const metadata: Metadata = withSeo("/pricing", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/pricing" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/pricing" },
  robots: { index: true, follow: true },
});

type Row = { id: string; label: string; key: string; unit: string; amount: number; source: string; needle: string };

// The amount shown is read from lib/pricing.ts here, never typed. scripts/test_pricing_page.mjs fails if the trace file and lib/pricing.ts disagree.
function live(key: string): number {
  if (key.startsWith("LEADS.")) return (LEADS as Record<string, { price: number }>)[key.slice(6)].price;
  return (PRICING as Record<string, number | string>)[key] as number;
}
const UNIT: Record<string, string> = { month: "a month", year: "a year", "one-off": "one-off" };

export default function Pricing() {
  const rows = trace.rows as Row[];
  const groups: [string, string[], string][] = [
    ["Retainers", ["retainer-growth", "retainer-ops", "retainer-embedded"], `Three tiers, a ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum, then month to month. The build happens inside month 1.`],
    ["Compliance", ["pack", "monitor", "monitor-annual"], "The pack is a fixed price. Monitor is a subscription you can cancel any time."],
    ["Leads", ["leads-starter", "leads-growth", "leads-campaign"], "One-off verified contact lists. The leads page has the turnaround for each."],
    ["Enterprise", ["enterprise-low", "enterprise-high"], "Listed as a range per year. Every enterprise engagement is scoped on a call before anything is signed."],
  ];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (
    <>
      <PageHero badge="PRICING" title="What it costs, before you have to ask." tagline="Published prices in AUD. The free scan costs nothing and needs no card." />
      <div className="pe-page">
        <section className="pe-section" aria-label="Published prices">
          <div className="pe-grid pe-grid--2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>
            {groups.map(([name, ids, line]) => (
              <div key={name} className="pe-card pe-card--pad">
                <p className="pe-eyebrow-line">{name}</p>
                <p className="pe-muted" style={{ margin: "0 0 12px", lineHeight: 1.6 }}>{line}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {ids.map((id) => {
                    const r = byId.get(id)!;
                    return (
                      <li key={id} data-price={id} style={{ padding: "10px 0", borderTop: "1px solid var(--pe-line)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span>{r.label}</span>
                        <span><strong style={{ color: "var(--pe-gold-hi)" }}>{formatAUD(live(r.key))}</strong> {UNIT[r.unit]}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
      <PartnershipStack />
      <div className="pe-page pe-page--narrow">
        <section className="pe-section">
          <h2>What is not on this page</h2>
          <p className="pe-muted" style={{ lineHeight: 1.7 }}>
            Owner plans for the portal, marketplace fees and metered usage for agents are still being designed, so there is no price to publish and we will not guess one. When one is set it appears here with its source. Until then, ask on the{" "}
            <a href="/contact">contact page</a> and you get a human reply.
          </p>
        </section>
        <section className="pe-section">
          <h2>Where these numbers come from</h2>
          <p className="pe-muted" style={{ lineHeight: 1.7 }} data-provenance="/pricing">{trace.system}, read {longDate(trace.asOf)}. Each row names the line it rests on: {rows.map((r) => r.source).filter((v, i, a) => a.indexOf(v) === i).join(", ")}.</p>
        </section>
      </div>
    </>
  );
}
