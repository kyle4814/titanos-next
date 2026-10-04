import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { DISPLAY } from "@/lib/pricing";
import { SystemLabel, DepthIndex } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";

// Unlinked on purpose: no nav, footer, sitemap or homepage link, and noindex,
// until Kyle confirms the enterprise prices. The figures come from lib/pricing.ts
// (anchors, not market-tested) and are shown as starting points only.

export const metadata: Metadata = {
  title: "Titanos Enterprise: Scoped on a Call",
  description:
    "Indicative starting points for larger engagements. Every engagement is scoped on a call.",
  alternates: { canonical: "https://titanos.tech/enterprise" },
  robots: { index: false, follow: false },
};

const ENTERPRISE_OFFERS = [
  { label: "Board AI risk advisory", price: DISPLAY.BOARD_ADVISORY_MONTHLY },
  { label: "Enterprise continuous monitoring", price: DISPLAY.ENTERPRISE_MONITORING_MONTHLY },
  { label: "Enterprise AI security operations", price: DISPLAY.ENTERPRISE_SOC_MONTHLY },
  { label: "Enterprise AI governance program", price: DISPLAY.ENTERPRISE_GOVERNANCE },
  { label: "Multi-entity compliance program", price: DISPLAY.ENTERPRISE_MULTI_ENTITY },
  { label: "EU AI Act readiness program", price: DISPLAY.ENTERPRISE_AI_ACT },
  { label: "OEM platform licence", price: DISPLAY.OEM_LICENCE_ANNUAL },
];

export default function EnterprisePage() {
  return (
    <>
      <PageHero
        badge="TITANOS ENTERPRISE"
        title="Larger engagements, scoped on a call."
        tagline="For groups, regulated entities and boards. Indicative starting points. Every engagement is scoped on a call."
        sub="These figures are starting points, not a fixed price list, and they have not been market-tested. Nothing is signed until we have talked through what you actually need."
      >
        <AnimatedButton href="/contact" variant="primary" ariaLabel="Message Kyle about an enterprise engagement">
          BOOK A FREE ENTERPRISE CONSULTATION →
        </AnimatedButton>
      </PageHero>
      <Bluf replaced>
        Larger engagements are scoped on a call and priced before anything starts, with the output of a 20-person engineering team and nobody replaced.
      </Bluf>
      <Analogy k="department" />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={1} total={1} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Starting points</SystemLabel>
          <SectionHeading
            title="What We Can Scope Together"
            lead="Indicative starting points. Every engagement is scoped on a call."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "26px 28px",
                margin: 0,
              }}
            >
              {ENTERPRISE_OFFERS.map((o) => (
                <li
                  key={o.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span>{o.label}</span>
                  <span style={{ color: "var(--gold)" }}>{o.price}</span>
                </li>
              ))}
            </ul>
            <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.7, marginTop: 16, textAlign: "center" }}>
              These are starting points, not quotes. The final scope and price are agreed with you on a call, with no pressure to proceed.
            </p>
          </div>
        </div>
      </SectionReveal>
      <FrontLoad
        extra={[
          { q: "I run IT. Where does this sit?", a: "Beside your IT provider and your own team. Nothing goes live without passing thousands of automated checks, and you keep control of every change." },
        ]}
      />
      <FreeStart />
    </>
  );
}
