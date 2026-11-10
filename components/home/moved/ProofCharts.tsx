// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
// This file: ProofCharts.
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import CostCurve from "@/components/charts/CostCurve";
import { FlexGrid } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";



export function ProofCharts() {
  return (
    <>
    <CostCurve />
    {/* THE PROOF: biggest true numbers first, each with its label and source. */}
    <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading
          title="The machine, measured on itself first"
          lead="Every number below was read off our own running system on 8 October 2026. Tap any card to see exactly where it came from."
        />
        <FlexGrid items={[FLEX.costPerJob, FLEX.startTokens, FLEX.fleetJobs, FLEX.tests]} />
      </div>
    </SectionReveal>
    {/* THE CEILING: market size and the build-cost multiple, labelled. */}
    <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading
          title="How far this reaches"
          lead="Hours handed back, nobody replaced. The market is large, and the cost of building for it just fell. Both numbers are labelled and sourced."
        />
        <FlexGrid items={[FLEX.market, FLEX.engineers, FLEX.memory]} />
      </div>
    </SectionReveal>
    </>
  );
}
