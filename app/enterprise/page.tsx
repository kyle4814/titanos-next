import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { DISPLAY } from "@/lib/pricing";
import { SystemLabel, DepthIndex } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

// Unlinked on purpose: no nav, footer, sitemap or homepage link, and noindex,
// until Kyle confirms the enterprise prices. The figures come from lib/pricing.ts
// (anchors, not market-tested) and are shown as starting points only.

const baseMetadata: Metadata = {
  title: "Titanos Enterprise: Scoped on a Call",
  description:
    "Indicative starting points for larger engagements. Every engagement is scoped on a call.",
  alternates: { canonical: "https://titanos.tech/enterprise" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/enterprise", baseMetadata);

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
        tagline="For groups, regulated entities and boards. Every engagement is scoped on a call."
        sub="These figures are starting points, not a price list, and they have not been market-tested. Nothing is signed until we have talked through what you actually need."
      >
        <AnimatedButton href="/contact" variant="primary" ariaLabel="Message Kyle about an enterprise engagement">
          BOOK A FREE ENTERPRISE CONSULTATION →
        </AnimatedButton>
      </PageHero>
      <Bluf replaced>
        Larger engagements are scoped on a call and priced before anything starts, built by one engineer at the output of a roughly 20-person team by the COCOMO estimate, and nobody replaced.
      </Bluf>
      <Analogy k="department" />

      <SectionReveal style={{ padding: "var(--space-12, 32px) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.engineers} />
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginTop: 16 }}>
            Method: the COCOMO model, explained on the Engineering page. A larger organisation will have questions first, so here they are
            answered up front. The scan reads public records only. Nothing inside your systems is touched. Nobody on your team is replaced.
            Your IT provider and your own people stay in charge of every change. And the price is agreed before anything starts.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>What would an engagement like that actually be called, and what might it cost to scope?</OpenLoop>

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
              These are starting points, not quotes. The final scope and price are agreed with you on a call. Would it be okay if we started there? A no is welcome.
            </p>
          </div>
        </div>
      </SectionReveal>
      <FrontLoad
        extra={[
          { q: "I run IT. Where does this sit?", a: "Beside your IT provider and your own team. Nothing goes live without passing thousands of automated checks, and you keep control of every change. Your IT team stays in charge." },
        ]}
      />
      <FreeStart />
    </>
  );
}
