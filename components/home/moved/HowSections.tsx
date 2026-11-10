// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
// This file: HowSections.
import { TEAM_LINE, ELAPSED_LINE } from "@/lib/ledger";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import JourneySteps from "@/components/JourneySteps";
import { Bluf, Analogy, Pillars } from "@/components/SalesKit";



export function HowSections() {
  return (
    <>
    {/* ═══ BLUF + THE FIVE PILLARS ═══ */}
    <Bluf replaced>
      One engineer built TITANOS in {ELAPSED_LINE}, around a day job. The industry COCOMO model says that is {TEAM_LINE} (MODELLED, method on the Engineering page). We exist to give your business that output safely, without
      replacing anyone.
    </Bluf>
    <Analogy k="department" />
    <Pillars />
    <Analogy k="preflight" />

    {/* ═══ THE PROBLEM ═══ */}
    <SectionReveal style={{ padding: "var(--space-20) 20px 0", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading
          title="Four places the manual work is quietly costing you"
          lead="Leads that never get followed up. The same questions answered by hand, every day. Data copied between systems by a person instead of a computer. A privacy problem nobody's checked in a year. Most owners know AI could help. Fewer know where to start."
        />
      </div>
    </SectionReveal>

    <div className="divider-gold" />

    {/* ═══ THE JOURNEY ═══ */}
    <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title="How this actually works" lead="One path, start to finish." />
        <JourneySteps />
      </div>
    </SectionReveal>
    </>
  );
}
