import { TEAM_SIZE_PHRASE } from "@/lib/ledger";
import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import s from "./enterprise.module.css";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { PriceTiles } from "@/components/offers/Bento";
import { DISPLAY } from "@/lib/pricing";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber } from "@/components/FlexBlock";
import SeatAnchors from "@/components/SeatAnchors";
import EnterpriseSavingsCalculator from "@/components/EnterpriseSavingsCalculator";
import SsoSetup from "@/components/SsoSetup";
import { ANCHORS } from "./anchors";
import { FLEX } from "@/lib/flex";
import DossierSelfServe from "@/components/DossierSelfServe";

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
        Larger engagements are scoped on a call and priced before anything starts, built by one engineer at the output of a {TEAM_SIZE_PHRASE} by the COCOMO estimate, and nobody replaced.
      </Bluf>
      <Analogy k="department" />

      <SectionReveal className="pe-section">
        <div className="pe-page">
          <FlexNumber f={FLEX.engineers} />
          <p className={s.method}>
            Method: the COCOMO model, explained on the Engineering page. A larger organisation will have questions first, so here they are
            answered up front. The scan reads public records only. Nothing inside your systems is touched. Nobody on your team is replaced.
            Your IT provider and your own people stay in charge of every change. And the price is agreed before anything starts.
          </p>
        </div>
      </SectionReveal>

      <div className="pe-page"><p className={s.bridge}>What would an engagement like that actually be called, and what might it cost to scope?</p></div>

      <SectionReveal className="pe-section">
        <div className="pe-page">
          <div className={s.head}>
            <span className="pe-eyebrow-line">Starting points</span>
            <h2>What We Can Scope Together</h2>
            <p className={s.lead}>Indicative starting points. Every engagement is scoped on a call.</p>
          </div>
          <div className={s.tiles}>
            <PriceTiles rows={ENTERPRISE_OFFERS} />
            <p className={s.fine}>
              These are starting points, not quotes. The final scope and price are agreed with you on a call. Would it be okay if we started there? A no is welcome.
            </p>
          </div>
        </div>
      </SectionReveal>
      <SeatAnchors rows={ANCHORS} extras={{ "savings-calculator": <EnterpriseSavingsCalculator />, sso: <SsoSetup /> }} />
      <SectionReveal className="pe-section">
        <div className="pe-page">
          <div className={s.head}>
            <span className="pe-eyebrow-line">Dossiers</span>
            <h2>Request a dossier</h2>
            <p className={s.lead}>Prove you control the domain, then queue it. This preview shows the steps with a sample, clearly labelled.</p>
          </div>
          <DossierSelfServe />
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
